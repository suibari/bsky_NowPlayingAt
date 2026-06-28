<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { userProfile, timelineStore } from "$lib/stores";
  import { t } from "$lib/i18n";
  import { resolveArtworkUrl } from "$lib/artwork";
  import {
    computeScore,
    computeTrackArtistScore,
    computeTrackGenreScore,
    type UserProfile,
  } from "$lib/recommendation";
  import TrackCard from "$lib/components/TrackCard.svelte";

  const MIX_WINDOW_MS = 24 * 60 * 60 * 1000;
  const PROFILES_REFRESH_MS = 3 * 60 * 1000;
  const PROFILES_STALE_MS = 30 * 1000;

  interface MixItem {
    did: string;
    handle: string;
    displayName: string;
    avatar: string | null;
    track: {
      id: string;
      title: string;
      artist: string;
      album: string;
      artworkUrl: string;
      trackUri: string;
      spotifyUrl?: string;
      youtubeMusicUrl?: string;
      appleMusicUrl?: string;
      provider: "itunes" | "discogs";
      genres?: string[];
    };
    fallbackArtworkUrl: string | undefined;
    postUri: string | undefined;
    uri: string;
    score: number;
  }

  let bestItem: MixItem | null = null;
  let loading = true;
  let userProfilesMap: Record<string, UserProfile> = {};
  let lastFetchedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function fetchProfiles() {
    const myDid = $userProfile?.did;
    if (!myDid) { loading = false; return; }
    try {
      const res = await fetch("/api/user-profiles");
      if (res.ok) {
        const json = await res.json();
        userProfilesMap = json.data ?? {};
        lastFetchedAt = Date.now();
      }
    } catch (e) {
      console.warn("Failed to fetch user profiles for mix", e);
    }
    loading = false;
  }

  function computeBestMix(items: any[], profiles: Record<string, UserProfile>) {
    const myDid = $userProfile?.did;
    if (!myDid) return;
    const myProfile = profiles[myDid];
    if (!myProfile) return;

    const cutoff = Date.now() - MIX_WINDOW_MS;
    const recent = items.filter(
      (i) =>
        i.type === "history" &&
        i.author?.did !== myDid &&
        new Date(i.indexedAt).getTime() >= cutoff
    );

    // trackUri 単位で重複排除（同曲は最新の1件のみ）
    const seenTrack = new Map<string, any>();
    for (const item of recent) {
      const key = item.record?.trackUri ?? "";
      if (!key) continue;
      if (!seenTrack.has(key)) seenTrack.set(key, item);
    }

    let best: { item: any; score: number } | null = null;
    for (const [, item] of seenTrack) {
      const authorDid = item.author?.did;
      const theirProfile = authorDid ? profiles[authorDid] : null;
      const userScore = theirProfile ? computeScore(myProfile, theirProfile) : 0;

      const trackArtist: string = item.record?.artist ?? "";
      const trackGenres: string[] = item.record?.genres ?? [];
      const artistScore = trackArtist
        ? computeTrackArtistScore(trackArtist, myProfile.artistFreq)
        : 0;
      const genreScore =
        trackGenres.length > 0
          ? computeTrackGenreScore(trackGenres, myProfile.genreFreq)
          : 0;
      const trackScore = Math.round(0.6 * artistScore + 0.4 * genreScore);
      const score = Math.round(0.7 * trackScore + 0.3 * userScore);

      if (!best || score > best.score) best = { item, score };
    }

    if (best && best.score > 0) {
      const { item } = best;
      bestItem = {
        did: item.author.did,
        handle: item.author.handle ?? "",
        displayName:
          item.author.displayName || item.author.handle || item.author.did,
        avatar: item.author.avatar ?? null,
        track: {
          id: item.record.trackUri,
          title: item.record.track,
          artist: item.record.artist,
          album: item.record.album,
          artworkUrl: resolveArtworkUrl(
            item.record.imgBlob,
            item.record.img,
            item.author.did
          ),
          trackUri: item.record.trackUri,
          spotifyUrl: item.record.links?.spotify,
          youtubeMusicUrl: item.record.links?.youtube,
          appleMusicUrl: item.record.links?.appleMusic,
          provider: item.record.provider || "itunes",
          genres: item.record.genres,
        },
        fallbackArtworkUrl: item.record.img,
        postUri: item.record.postUri,
        uri: item.uri,
        score: best.score,
      };
    } else {
      bestItem = null;
    }
  }

  // timeline store か userProfilesMap が更新されるたびに再計算
  $: if ($timelineStore.data !== null && Object.keys(userProfilesMap).length > 0) {
    computeBestMix($timelineStore.data, userProfilesMap);
  }

  // ユーザーがログインしたらプロフィールを取得
  $: if ($userProfile?.did) fetchProfiles();

  function onVisChange() {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastFetchedAt > PROFILES_STALE_MS) fetchProfiles();
  }

  onMount(() => {
    timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchProfiles();
    }, PROFILES_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisChange);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisChange);
  });
</script>

{#if $userProfile}
  <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
    <h2 class="text-sm font-bold text-white mb-4 uppercase tracking-wider">
      {$t("mix.title")}
    </h2>

    {#if loading}
      <p class="text-xs text-gray-600 text-center py-3">...</p>
    {:else if bestItem}
      <!-- おすすめユーザー -->
      <div class="flex items-center gap-2 mb-3">
        <a href="/profile/{bestItem.did}" class="shrink-0">
          {#if bestItem.avatar}
            <img
              src={bestItem.avatar}
              alt={bestItem.handle}
              class="w-7 h-7 rounded-full border border-gray-700"
            />
          {:else}
            <div
              class="w-7 h-7 rounded-full bg-gray-800 border border-gray-700"
            ></div>
          {/if}
        </a>
        <p class="text-xs text-gray-400 min-w-0">
          <a
            href="/profile/{bestItem.did}"
            class="font-semibold text-white! hover:underline"
          >
            {bestItem.displayName}
          </a>
          {$t("mix.recommended_by")}
        </p>
      </div>

      <!-- トラックカード -->
      <TrackCard
        track={bestItem.track}
        fallbackArtworkUrl={bestItem.fallbackArtworkUrl}
        postUri={bestItem.postUri}
        subjectUriOverride={bestItem.uri}
      />
    {:else}
      <p class="text-xs text-gray-600 text-center py-3">
        {$t("mix.empty")}
      </p>
    {/if}
  </div>
{/if}
