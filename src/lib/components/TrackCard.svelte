<script lang="ts">
  import type { Track } from "$lib/music";
  import { createEventDispatcher } from "svelte";
  import {
    ChevronDown,
    Disc,
    Loader2,
    GripVertical,
    Trash2,
    Play,
  } from "lucide-svelte";
  import { resolveLinks } from "$lib/odesli";
  import { songKey } from "$lib/bsky";
  import TrackActionPane from "$lib/components/TrackActionPane.svelte";
  import { t } from "$lib/i18n";

  export let track: Track;
  export let fallbackArtworkUrl: string | undefined = undefined;

  let imgErrorCount = 0;
  function handleImgError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (imgErrorCount === 0 && fallbackArtworkUrl) {
      imgErrorCount++;
      img.src = fallbackArtworkUrl;
    } else {
      img.src = "https://placehold.co/300x300?text=No+Art";
    }
  }

  // Layout variant:
  //  - "square": Last.fm-style square jacket card (search / chart / feeds)
  //  - "bar": classic horizontal bar (playlist track list / profile history)
  export let variant: "square" | "bar" = "square";

  // Some tracks (e.g. Last.fm auto-posts surfaced in What's hot) have no trackUri.
  // Fall back to a stable song key so reactions still have a valid, aggregatable
  // subject instead of sending an empty subjectUri (which the API rejects with 400).
  // When set (history cards), use the history record's AT-URI so reactions on
  // different play events of the same song are stored separately.
  export let subjectUriOverride: string | undefined = undefined;
  $: reactionSubjectUri = subjectUriOverride || track.trackUri || songKey(track.artist, track.title);
  // AT-URI of the Bluesky post backing this track (history cards only).
  // Forwarded to ReactionBar so post likes are merged into reactions.
  export let postUri: string | undefined = undefined;

  export let showDelete: boolean = false;
  export let showDragHandle: boolean = false;
  export let isDragging: boolean = false; // Styling state

  export let index: number = 0; // For drag reference
  export let isProcessing: boolean = false;
  export let reactionGroups: any[] = [];
  export let autoExpand: boolean = false;

  const dispatch = createEventDispatcher();

  let expanded = autoExpand;

  // Link Resolution
  let resolving = false;
  let cachedSpotify: string | undefined = track.spotifyUrl;
  let cachedYtMusic: string | undefined = track.youtubeMusicUrl;
  let cachedAppleMusic: string | undefined = track.appleMusicUrl;

  function toggleExpand() {
    expanded = !expanded;
  }

  // Single unified play button: jump to the first available service following a
  // fixed priority (Spotify → YouTube Music → Apple Music). Resolves missing
  // links once via Odesli, falling back to a Spotify search.
  async function resolveAndPlay() {
    // 1. Use any already-known link in priority order.
    const cached = cachedSpotify ?? cachedYtMusic ?? cachedAppleMusic;
    if (cached) {
      window.open(cached, "_blank");
      return;
    }

    // 2. Resolve all platform links once, then pick by priority.
    resolving = true;
    try {
      const res = await resolveLinks(track.trackUri);
      if (res) {
        cachedSpotify = res.linksByPlatform.spotify?.url;
        cachedYtMusic = res.linksByPlatform.youtubeMusic?.url;
        cachedAppleMusic = res.linksByPlatform.appleMusic?.url;
      }

      const targetUrl = cachedSpotify ?? cachedYtMusic ?? cachedAppleMusic;
      if (targetUrl) {
        window.open(targetUrl, "_blank");
      } else {
        // 3. Fallback: Spotify search.
        const query = encodeURIComponent(`${track.artist} ${track.title}`);
        window.open(`https://open.spotify.com/search/${query}`, "_blank");
      }
    } catch (e) {
      console.error("Link resolution failed", e);
    }
    resolving = false;
  }

  function handleDelete() {
    dispatch("delete", index);
  }
</script>

<!-- Card Container -->
<div
  class="group relative"
  class:opacity-50={isDragging}
  role="listitem"
>
  {#if variant === "square"}
    <!-- SQUARE VARIANT: Last.fm-style jacket card -->
    <div
      class="relative aspect-square w-full rounded-xl overflow-hidden cursor-pointer bg-gray-800 ring-1 ring-gray-800 transition-all duration-300 hover:ring-green-500/50"
      class:ring-2={expanded}
      class:ring-green-500={expanded}
      on:click={toggleExpand}
      on:keypress={(e) => e.key === "Enter" && toggleExpand()}
      role="button"
      tabindex="0"
    >
        <img
          src={track.artworkUrl || "/placeholder_art.png"}
          alt={track.title}
          class="absolute inset-0 w-full h-full object-cover"
          on:error={handleImgError}
        />

      <!-- Hover darken hint -->
      <div
        class="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors"
      ></div>

      <!-- Play button (top-left) -->
      <button
        on:click|stopPropagation={resolveAndPlay}
        class="absolute top-2 left-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors active:scale-95"
        title={$t('track.play')}
        disabled={resolving}
      >
        {#if resolving}
          <Loader2 size={18} class="animate-spin" />
        {:else}
          <Play size={18} class="fill-current" />
        {/if}
      </button>

      <!-- Delete / Drag handle (top-right) -->
      {#if showDelete || showDragHandle}
        <div class="absolute top-2 right-2 flex items-center gap-1">
          {#if showDragHandle}
            <div
              class="bg-black/50 text-gray-200 rounded-full p-2 cursor-grab active:cursor-grabbing"
              on:click|stopPropagation={() => {}}
            >
              <GripVertical size={18} />
            </div>
          {/if}
          {#if showDelete}
            <button
              on:click|stopPropagation={handleDelete}
              class="bg-black/50 hover:bg-black/70 text-red-500 rounded-full p-2 transition-colors"
              title={$t('track.delete')}
            >
              <Trash2 size={18} />
            </button>
          {/if}
        </div>
      {/if}

      <!-- Bottom gradient + text -->
      <div
        class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8 pointer-events-none"
      >
        <h3 class="font-bold text-white truncate leading-tight">
          {track.title}
        </h3>
        <p class="text-gray-200 text-sm truncate">{track.artist}</p>
        {#if track.album}
          <p class="text-gray-400 text-xs truncate">{track.album}</p>
        {/if}
        {#if track.comment}
          <p class="text-white/80 text-xs mt-1 italic truncate">
            "{track.comment}"
          </p>
        {/if}
      </div>
    </div>
  {:else}
    <!-- BAR VARIANT: classic horizontal bar -->
    <div
      class="bg-gray-900 border border-gray-800 rounded-xl p-4 relative flex gap-4 items-center transition-all duration-300 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-900/10"
      class:ring-2={expanded}
      class:ring-green-500={expanded}
    >
      <!-- Drag Handle -->
      {#if showDragHandle}
        <div class="text-gray-600 cursor-grab active:cursor-grabbing p-1 -ml-2">
          <GripVertical size={20} />
        </div>
      {/if}

      <!-- Artwork -->
      <div
        class="relative w-16 h-16 shrink-0 cursor-pointer"
        on:click={toggleExpand}
        on:keypress={(e) => e.key === "Enter" && toggleExpand()}
        role="button"
        tabindex="0"
      >
        <img
          src={track.artworkUrl || "/placeholder_art.png"}
          alt={track.title}
          class="w-full h-full object-cover rounded-md shadow-md bg-gray-800"
          on:error={handleImgError}
        />
        <div
          class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md"
        >
          <ChevronDown class="text-white w-8 h-8" />
        </div>
      </div>

      <!-- Meta -->
      <div
        class="grow min-w-0 flex flex-col justify-center min-h-16 cursor-pointer pr-10"
        on:click={toggleExpand}
      >
        <h3 class="font-bold text-white truncate text-lg leading-tight">
          {track.title}
        </h3>
        <p class="text-gray-400 text-sm truncate">{track.artist}</p>
        {#if track.album}
          <p class="text-gray-500 text-xs truncate">{track.album}</p>
        {/if}
        {#if track.comment}
          <p class="text-white/80 text-sm mt-1 italic wrap-break-word line-clamp-2">
            "{track.comment}"
          </p>
        {/if}
      </div>

      <!-- Play button (top-right) -->
      <button
        on:click|stopPropagation={resolveAndPlay}
        class="absolute top-2 right-2 text-gray-300 hover:text-green-500 transition-colors p-1.5 rounded-full hover:bg-gray-800 active:scale-95"
        title={$t('track.play')}
        disabled={resolving}
      >
        {#if resolving}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <Play size={20} class="fill-current" />
        {/if}
      </button>

      <!-- Delete Button (bottom-right, red for caution) -->
      {#if showDelete}
        <button
          on:click|stopPropagation={handleDelete}
          class="absolute bottom-2 right-2 text-red-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-gray-800"
          title={$t('track.delete')}
        >
          <Trash2 size={20} />
        </button>
      {/if}
    </div>
  {/if}

  <!-- Expanded Options -->
  {#if expanded}
    <div
      class="flex flex-col gap-3 animate-fade-in {variant === 'square'
        ? 'mt-2 p-4 bg-gray-900 border border-gray-800 rounded-xl'
        : 'mt-4 pt-4 border-t border-gray-800'}"
      on:click|stopPropagation={() => {}}
    >
      <TrackActionPane
        subjectUri={reactionSubjectUri}
        {postUri}
        {track}
        initialReactions={reactionGroups}
        {isProcessing}
        on:nowPlaying
        on:reaction
        on:addToPlaylist
      />
    </div>
  {/if}
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out forwards;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
