<script lang="ts">
  import { userProfile } from "$lib/stores";
  import { t } from "$lib/i18n";
  import { resolveArtworkUrl } from "$lib/artwork";
  import TrackCard from "$lib/components/TrackCard.svelte";

  // フィードのおすすめ度バッジと完全に一致させるため、スコア計算とデータ取得は
  // 親（+page.svelte）に任せ、本コンポーネントは表示専用にする。
  // best = { item, score } | null  （item はタイムラインの history アイテム）
  export let best: { item: any; score: number } | null = null;
  export let loading: boolean = false;

  $: item = best?.item ?? null;
  $: track = item
    ? {
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
      }
    : null;

  $: displayName = item
    ? item.author.displayName || item.author.handle || item.author.did
    : "";
</script>

{#if $userProfile}
  <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
    <h2 class="text-sm font-bold text-white mb-4 uppercase tracking-wider">
      {$t("mix.title")}
    </h2>

    {#if loading}
      <p class="text-xs text-gray-600 text-center py-3">...</p>
    {:else if item && track}
      <!-- おすすめユーザー -->
      <div class="flex items-center gap-2 mb-3">
        <a href="/profile/{item.author.did}" class="shrink-0">
          {#if item.author.avatar}
            <img
              src={item.author.avatar}
              alt={item.author.handle}
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
            href="/profile/{item.author.did}"
            class="font-semibold text-white! hover:underline"
          >
            {displayName}
          </a>
          {$t("mix.recommended_by")}
        </p>
      </div>

      <!-- トラックカード -->
      <TrackCard
        {track}
        fallbackArtworkUrl={item.record.img}
        postUri={item.record.postUri}
        subjectUriOverride={item.uri}
      />
    {:else}
      <p class="text-xs text-gray-600 text-center py-3">
        {$t("mix.empty")}
      </p>
    {/if}
  </div>
{/if}
