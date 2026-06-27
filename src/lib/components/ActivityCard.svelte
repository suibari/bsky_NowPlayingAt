<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import PlaylistCard from "$lib/components/PlaylistCard.svelte";
  import { t } from "$lib/i18n";
  import { resolveArtworkUrl } from "$lib/artwork";

  // A single activity (history / reaction / playlist) shown in the
  // recommendation and realtime feeds.
  export let item: any;
  export let processingItemUri: string | null = null;
  export let recommendScore: number | undefined = undefined;

  const dispatch = createEventDispatcher();

  function forward(name: string) {
    return (e: CustomEvent) => dispatch(name, e.detail);
  }

  // Include item.uri so +page.svelte can track processing per card, not per song.
  function forwardNowPlayingWithUri(e: CustomEvent) {
    dispatch("nowPlaying", { ...e.detail, itemUri: item.uri });
  }
</script>

<div class="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
  <!-- Header: User Action -->
  <div class="flex items-center gap-3 mb-3">
    <a href={`/profile/${item.author.did}`} class="flex-shrink-0">
      {#if item.author.avatar}
        <img
          src={item.author.avatar}
          alt={item.author.handle}
          class="w-10 h-10 rounded-full border border-gray-700"
        />
      {:else}
        <div
          class="w-10 h-10 rounded-full bg-gray-800 border border-gray-700"
        ></div>
      {/if}
    </a>
    <div class="flex-1 min-w-0">
      <div class="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
        <span>
          <a href={`/profile/${item.author.did}`} class="font-bold text-white! hover:underline">
            {item.author.displayName || item.author.handle}
          </a>
          {#if item.type === "history"}
            <span class="text-gray-500">{$t('discovery.listening')}</span>
          {:else if item.type === "reaction"}
            <span class="text-gray-500">
              {$t('discovery.reacted')}
              <span class="text-lg">{item.record.emoji}</span>
            </span>
          {:else if item.type === "playlist"}
            <span class="text-gray-500">{$t('discovery.playlist')}</span>
          {/if}
        </span>
        {#if recommendScore !== undefined && recommendScore > 0}
          <span
            class="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 shrink-0 cursor-help"
            title={$t('recommend.score.tooltip')}
          >
            ✨ {$t('recommend.score')}: {recommendScore}%
          </span>
        {/if}
      </div>
      <div class="text-xs text-gray-600">
        {new Date(item.indexedAt).toLocaleString()}
      </div>
    </div>
  </div>

  <!-- Content -->
  <div>
    {#if item.type === "history"}
      <TrackCard
        track={{
          id: item.record.trackUri,
          title: item.record.track,
          artist: item.record.artist,
          album: item.record.album,
          artworkUrl: resolveArtworkUrl(item.record.imgBlob, item.record.img, item.author.did),
          trackUri: item.record.trackUri,
          spotifyUrl: item.record.links?.spotify,
          youtubeMusicUrl: item.record.links?.youtube,
          appleMusicUrl: item.record.links?.appleMusic,
          comment: item.record.comment,
          provider: item.record.provider || "itunes",
        }}
        fallbackArtworkUrl={item.record.img}
        postUri={item.record.postUri}
        subjectUriOverride={item.uri}
        isProcessing={processingItemUri === item.uri}
        on:nowPlaying={forwardNowPlayingWithUri}
        on:addToPlaylist={forward("addToPlaylist")}
        on:reaction={forward("reaction")}
      />
    {:else if item.type === "reaction"}
      {#if item.record.kind === "playlist" && item.record.playlist}
        <PlaylistCard
          playlist={item.record.playlist.record || {
            name: item.record.playlist.title,
            tracks: [],
          }}
          author={item.record.playlist.author}
          rkey={item.record.playlist.uri.split("/").pop()}
        />
      {:else}
        <TrackCard
          track={{
            id: item.record.subjectUri,
            trackUri: item.record.subjectUri,
            title: item.record.track || "Unknown Track",
            artist: item.record.artist || "Unknown Artist",
            album: item.record.album,
            artworkUrl: resolveArtworkUrl(item.record.imgBlob, item.record.img, item.author.did) || "/placeholder_art.png",
            spotifyUrl: item.record.links?.spotify,
            youtubeMusicUrl: item.record.links?.youtube,
            appleMusicUrl: item.record.links?.appleMusic,
            provider: item.record.provider || "itunes",
          }}
          fallbackArtworkUrl={item.record.img}
          isProcessing={processingItemUri === item.uri}
          on:nowPlaying={forwardNowPlayingWithUri}
          on:addToPlaylist={forward("addToPlaylist")}
          on:reaction={forward("reaction")}
        />
      {/if}
    {:else if item.type === "playlist"}
      <PlaylistCard
        playlist={item.record}
        author={item.author}
        rkey={item.uri.split("/").pop()}
      />
    {/if}
  </div>
</div>
