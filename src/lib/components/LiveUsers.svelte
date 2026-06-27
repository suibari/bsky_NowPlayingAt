<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { resolveArtworkUrl } from "$lib/artwork";
  import { resolveLinks } from "$lib/odesli";
  import { t } from "$lib/i18n";
  import { Play, Loader2 } from "lucide-svelte";

  const LIVE_WINDOW_MS = 10 * 60 * 1000;
  const LIVE_REFRESH_MS = 3 * 60 * 1000;
  const LIVE_STALE_MS = 30 * 1000;
  const MAX_SHOWN = 6;

  interface LiveUser {
    did: string;
    handle: string;
    displayName: string;
    avatar: string | null;
    track: string;
    artist: string;
    artworkUrl: string | null;
    trackUri: string;
    spotifyUrl: string | null;
    ytMusicUrl: string | null;
    appleMusicUrl: string | null;
  }

  let liveUsers: LiveUser[] = [];
  let lastFetchedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let resolvingDid: string | null = null;

  $: isLive = liveUsers.length > 0;

  async function fetchLive() {
    try {
      const res = await fetch("/api/timeline");
      const json = await res.json();
      const items: any[] = Array.isArray(json.data) ? json.data : [];
      const cutoff = Date.now() - LIVE_WINDOW_MS;
      const recent = items
        .filter(
          (i) =>
            i.type === "history" &&
            new Date(i.indexedAt).getTime() >= cutoff
        )
        .sort(
          (a, b) =>
            new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
        );
      const seen = new Set<string>();
      const result: LiveUser[] = [];
      for (const item of recent) {
        const did = item.author?.did;
        if (!did || seen.has(did)) continue;
        seen.add(did);
        result.push({
          did,
          handle: item.author.handle ?? "",
          displayName:
            item.author.displayName || item.author.handle || did,
          avatar: item.author.avatar ?? null,
          track: item.record?.track ?? "",
          artist: item.record?.artist ?? "",
          artworkUrl: resolveArtworkUrl(
            item.record?.imgBlob,
            item.record?.img,
            did
          ),
          trackUri: item.record?.trackUri ?? "",
          spotifyUrl: item.record?.links?.spotify ?? null,
          ytMusicUrl: item.record?.links?.youtube ?? null,
          appleMusicUrl: item.record?.links?.appleMusic ?? null,
        });
        if (result.length >= MAX_SHOWN) break;
      }
      liveUsers = result;
      lastFetchedAt = Date.now();
    } catch (e) {
      console.warn("Failed to fetch live users", e);
    }
  }

  async function resolveAndPlay(user: LiveUser) {
    const cached = user.spotifyUrl ?? user.ytMusicUrl ?? user.appleMusicUrl;
    if (cached) {
      window.open(cached, "_blank");
      return;
    }
    resolvingDid = user.did;
    try {
      const res = await resolveLinks(user.trackUri);
      if (res) {
        user.spotifyUrl = res.linksByPlatform.spotify?.url ?? null;
        user.ytMusicUrl = res.linksByPlatform.youtubeMusic?.url ?? null;
        user.appleMusicUrl = res.linksByPlatform.appleMusic?.url ?? null;
        liveUsers = liveUsers;
      }
      const url = user.spotifyUrl ?? user.ytMusicUrl ?? user.appleMusicUrl;
      if (url) {
        window.open(url, "_blank");
      } else {
        const q = encodeURIComponent(`${user.artist} ${user.track}`);
        window.open(`https://open.spotify.com/search/${q}`, "_blank");
      }
    } finally {
      resolvingDid = null;
    }
  }

  function onVisChange() {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastFetchedAt > LIVE_STALE_MS) fetchLive();
  }

  onMount(() => {
    fetchLive();
    timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchLive();
    }, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisChange);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisChange);
  });
</script>

<div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
  <!-- ヘッダー -->
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-sm font-bold text-white uppercase tracking-wider">
      {$t("live.title")}
    </h2>
    <span
      class="flex items-center gap-1.5 text-xs font-bold {isLive
        ? 'text-green-400'
        : 'text-gray-600'}"
    >
      <span
        class="w-2 h-2 rounded-full {isLive
          ? 'bg-green-400 animate-pulse'
          : 'bg-gray-600'}"
      ></span>
      LIVE
    </span>
  </div>

  {#if liveUsers.length === 0}
    <p class="text-xs text-gray-600 text-center py-3">{$t("live.empty")}</p>
  {:else}
    <ul class="space-y-3">
      {#each liveUsers as user (user.did)}
        <li class="flex items-center gap-2 min-w-0">
          <!-- アバター（左端・プロフィールリンク） -->
          <a href="/profile/{user.did}" class="shrink-0">
            {#if user.avatar}
              <img
                src={user.avatar}
                alt={user.handle}
                class="w-7 h-7 rounded-full border border-gray-700"
              />
            {:else}
              <div
                class="w-7 h-7 rounded-full bg-gray-800 border border-gray-700"
              ></div>
            {/if}
          </a>

          <!-- テキスト（中央・flex-1） -->
          <div class="min-w-0 flex-1">
            <a
              href="/profile/{user.did}"
              class="block text-xs font-semibold text-white! truncate hover:underline leading-tight"
            >
              {user.displayName}
            </a>
            <p class="text-[11px] text-gray-500 truncate leading-tight">
              {user.track} — {user.artist}
            </p>
          </div>

          <!-- ジャケット（右端・hover で再生ボタン） -->
          <div class="relative group/jacket shrink-0 w-8 h-8">
            {#if user.artworkUrl}
              <img
                src={user.artworkUrl}
                alt=""
                class="w-8 h-8 rounded object-cover"
              />
            {:else}
              <div class="w-8 h-8 rounded bg-gray-800"></div>
            {/if}
            <button
              on:click={() => resolveAndPlay(user)}
              disabled={resolvingDid === user.did}
              class="absolute inset-0 flex items-center justify-center rounded
                     bg-black/0 group-hover/jacket:bg-black/60 transition-colors
                     opacity-0 group-hover/jacket:opacity-100"
              title={$t("track.play")}
            >
              {#if resolvingDid === user.did}
                <Loader2 size={14} class="animate-spin text-white" />
              {:else}
                <Play size={14} class="fill-white text-white" />
              {/if}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
