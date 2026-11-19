import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Load .env if present (for local dev)
try {
  const envPath = resolve(process.cwd(), '.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
      process.env[key.trim()] ??= rest.join('=').trim();
    }
  }
} catch {
  // .env not found — rely on systemd EnvironmentFile or shell env
}

import { getAllEnabledUsers, updateLastScrobble, updateLastScrobbleKeyOnly } from './db.js';
import { getLatestScrobble, getGenreTags } from './lastfm.js';
import { getHotContent, scanAllHistory } from './bsky.js';
import { normalizeGenres } from './ollama.js';

const POLL_INTERVAL_MS = 60_000;
const CACHE_REFRESH_INTERVAL_MS = 5 * 60_000;
// Full history scan is heavier than the hot/timeline refresh, and all-time
// totals don't need fine-grained freshness. Each run writes up to 6 KV entries
// (stats + artists_0..3 + user_stats), so hourly keeps it at <=144 writes/day.
const STATS_REFRESH_INTERVAL_MS = 60 * 60_000;
const INTER_USER_DELAY_MS = 250;
const ONE_HOUR_MS = 60 * 60 * 1000;
const API_URL = process.env.NOWPLAYINGAT_API_URL ?? 'https://nowplayingat.suibari.com';
const SHARED_SECRET = process.env.NOWPLAYINGAT_SHARED_SECRET!;

if (!SHARED_SECRET) {
  console.error('NOWPLAYINGAT_SHARED_SECRET is not set');
  process.exit(1);
}

async function tick() {
  let users;
  try {
    users = await getAllEnabledUsers();
  } catch (e) {
    console.error('[poller] Failed to fetch enabled users:', e);
    return;
  }

  for (const user of users) {
    try {
      const { scrobble } = await getLatestScrobble(user.lastfm_username);
      if (!scrobble) continue;

      const key = `${scrobble.artist}::${scrobble.title}`;
      if (key === user.last_scrobble_key) continue;

      const lastPostMs = user.last_scrobble_ts ? new Date(user.last_scrobble_ts).getTime() : 0;
      const hourElapsed = (Date.now() - lastPostMs) >= ONE_HOUR_MS;
      // この完了曲がギャップ後に新しく再生されたものか（ギャップ前の古い曲を弾く）。
      // 1時間以上のギャップがあれば、ギャップ前の曲の再生時刻は1時間以上前になる。
      const playedRecently = scrobble.playedAt != null && (Date.now() - scrobble.playedAt) < ONE_HOUR_MS;

      const staleTrack = hourElapsed && !playedRecently;
      if (staleTrack) {
        // ギャップ後の古い曲。再生記録としても残さずスキップ（postedAt の整合性を保つ）。
        await updateLastScrobbleKeyOnly(user.did, key);
        console.log(`[SKIP] ${user.bsky_handle}: ${scrobble.artist} - ${scrobble.title} (gap detected, stale track)`);
        await new Promise(r => setTimeout(r, INTER_USER_DELAY_MS));
        continue;
      }

      const autoPostEnabled = user.post_probability >= 1;
      const forcedBypass = autoPostEnabled && hourElapsed && playedRecently;
      const probabilityHit = Math.random() * 100 < user.post_probability;

      // Derive genres for the recommendation profile (non-fatal). Done once per
      // new track and attached to both the skip and post paths below.
      const tags = await getGenreTags(scrobble.artist, scrobble.title);
      const genres = await normalizeGenres(tags);

      if (!forcedBypass && !probabilityHit) {

        // 確率ミス: 投稿はしないが PDS history に再生記録は残す。
        const res = await fetch(`${API_URL}/api/auto-post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SHARED_SECRET}`,
          },
          body: JSON.stringify({
            did: user.did,
            artist: scrobble.artist,
            title: scrobble.title,
            album: scrobble.album,
            genres,
            skipPost: true,
          }),
        });

        if (res.ok) {
          // 投稿は発生していないので last_scrobble_ts は更新しない（forced 1h bypass(1%以上) 判定を維持）。
          await updateLastScrobbleKeyOnly(user.did, key);
          const body = await res.json().catch(() => ({}));
          if (body.warnings?.length) {
            for (const w of body.warnings) {
              console.warn(`[WARN] ${user.bsky_handle}: ${w}`);
            }
          }
          console.log(`[HISTORY] ${user.bsky_handle}: ${scrobble.artist} - ${scrobble.title} (probability miss, ${user.post_probability}%)`);
        } else {
          let errMsg = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            errMsg += ` — ${body.error ?? JSON.stringify(body)}`;
            if (body.stack) errMsg += `\n${body.stack}`;
          } catch {
            errMsg += ` — ${await res.text().catch(() => '(no body)')}`;
          }
          console.error(`[ERROR] ${user.bsky_handle} (history): ${errMsg}`);
        }
        await new Promise(r => setTimeout(r, INTER_USER_DELAY_MS));
        continue;
      }

      const bypassReason = forcedBypass && !probabilityHit ? 'forced 1h bypass' : `${user.post_probability}%`;

      const res = await fetch(`${API_URL}/api/auto-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SHARED_SECRET}`,
        },
        body: JSON.stringify({
          did: user.did,
          artist: scrobble.artist,
          title: scrobble.title,
          album: scrobble.album,
          genres,
        }),
      });

      if (res.ok) {
        await updateLastScrobble(user.did, key);
        const body = await res.json().catch(() => ({}));
        if (body.warnings?.length) {
          for (const w of body.warnings) {
            console.warn(`[WARN] ${user.bsky_handle}: ${w}`);
          }
        }
        console.log(`[OK] ${user.bsky_handle}: ${scrobble.artist} - ${scrobble.title} (${bypassReason})`);
      } else {
        let errMsg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          errMsg += ` — ${body.error ?? JSON.stringify(body)}`;
          if (body.stack) errMsg += `\n${body.stack}`;
        } catch {
          errMsg += ` — ${await res.text().catch(() => '(no body)')}`;
        }
        console.error(`[ERROR] ${user.bsky_handle}: ${errMsg}`);
      }
    } catch (e) {
      console.error(`[ERROR] ${user.bsky_handle}:`, e);
    }
    await new Promise(r => setTimeout(r, INTER_USER_DELAY_MS));
  }
}

// Workers KV free tier allows 1000 writes/day. Remember what was last pushed
// per key and skip identical payloads. The top-level `updatedAt` is stamped on
// every run, so it is left out of the comparison; when the content is unchanged
// the KV entry keeps its previous `updatedAt`.
const lastPushedHash = new Map<string, string>();

function contentHash(data: any): string {
  const comparable =
    data && typeof data === 'object' && !Array.isArray(data) && 'updatedAt' in data
      ? { ...data, updatedAt: undefined }
      : data;
  return createHash('sha256').update(JSON.stringify(comparable)).digest('hex');
}

async function pushCache(key: string, data: any) {
  const hash = contentHash(data);
  if (lastPushedHash.get(key) === hash) {
    console.log(`[CACHE] ${key} unchanged, skipping KV write`);
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/cache`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SHARED_SECRET}`,
      },
      body: JSON.stringify({ key, data }),
    });
    if (!res.ok) {
      console.error(`[CACHE] Failed to push ${key}: ${res.status}`);
    } else {
      lastPushedHash.set(key, hash);
      console.log(`[CACHE] Successfully pushed ${key} to KV`);
    }
  } catch (e) {
    console.error(`[CACHE] Error pushing ${key}:`, e);
  }
}

async function refreshCache() {
  console.log('[CACHE] Starting refresh...');
  try {
    const hot = await getHotContent();
    // userProfiles feeds the recommendation score; keep it out of the public 'hot' payload.
    const { userProfiles, timeline, ...hotPublic } = hot;
    // Combine the three 5-minute payloads into a single KV write to stay well
    // under the 1000 writes/day limit. The read endpoints split them back out.
    await pushCache('snapshot', {
      hot: hotPublic,
      timeline,
      user_profiles: userProfiles ?? {},
    });
  } catch (e) {
    console.error('[CACHE] Error during refresh:', e);
  }
}

// One full pass over every registered user's PDS history feeds three KV entries:
// the global counter, the cross-user artist index, and the per-user aggregate
// that lets the profile page skip its own scan. Up to six writes per run
// (stats, artists_0..3, user_stats); unchanged entries are skipped in pushCache.
async function refreshStats() {
  console.log('[STATS] Starting global history scan...');
  try {
    const { stats, artists, users } = await scanAllHistory();
    await pushCache('stats', stats);
    for (const shard of artists) {
      await pushCache(`artists_${shard.shard}`, shard);
    }
    await pushCache('user_stats', users);

    const artistCount = artists.reduce((n, s) => n + Object.keys(s.artists).length, 0);
    const shardSizes = artists.map((s) => JSON.stringify(s).length).join('/');
    console.log(
      `[STATS] totalPlays=${stats.totalPlays}, days=${Object.keys(stats.daily).length},`,
      `artists=${artistCount} (shards ${shardSizes}B),`,
      `users=${Object.keys(users.users).length} (${JSON.stringify(users).length}B)`,
    );
  } catch (e) {
    console.error('[STATS] Error during refresh:', e);
  }
}

// `--stats-only` runs just the read-only history scan. `tick()` posts to real
// users' Bluesky accounts and writes records to their PDS, so local development
// against a dev server must never start it.
const STATS_ONLY = process.argv.includes('--stats-only');

if (STATS_ONLY) {
  console.log('Now Playing poller started in --stats-only mode (no posting, no hot refresh)');
} else {
  console.log(`Now Playing poller started. Polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on start, then on interval
  tick();
  setInterval(tick, POLL_INTERVAL_MS);

  // Run cache refresh immediately on start, then on interval
  refreshCache();
  setInterval(refreshCache, CACHE_REFRESH_INTERVAL_MS);
}

// Global play-stats scan (heavier; slower cadence)
refreshStats();
setInterval(refreshStats, STATS_REFRESH_INTERVAL_MS);
