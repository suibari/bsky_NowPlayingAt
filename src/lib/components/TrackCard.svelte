<script lang="ts">
  import type { Track } from "$lib/music";
  import { createEventDispatcher } from "svelte";
  import {
    Play,
    Share2,
    Disc,
    Loader2,
    GripVertical,
    Trash2,
    Plus,
  } from "lucide-svelte";
  import { resolveLinks } from "$lib/odesli";
  import ReactionBar from "$lib/components/ReactionBar.svelte";

  export let track: Track;
  export let isOwner: boolean = false;
  export let showDelete: boolean = false;
  export let showDragHandle: boolean = false;
  export let isDragging: boolean = false; // Styling state
  export let index: number = 0; // For drag reference

  const dispatch = createEventDispatcher();

  let expanded = false;
  let postToBsky = false;

  // Link Resolution
  let resolvingLink: "spotify" | "ytmusic" | null = null;
  let cachedSpotify: string | undefined = track.spotifyUrl;
  let cachedYtMusic: string | undefined = track.youtubeMusicUrl;

  function toggleExpand() {
    expanded = !expanded;
  }

  async function resolveAndOpen(platform: "spotify" | "ytmusic") {
    let targetUrl = platform === "spotify" ? cachedSpotify : cachedYtMusic;

    if (targetUrl) {
      window.open(targetUrl, "_blank");
      return;
    }

    resolvingLink = platform;
    try {
      const res = await resolveLinks(track.trackUri);
      if (res) {
        if (platform === "spotify") {
          cachedSpotify = res.linksByPlatform.spotify?.url;
          targetUrl = cachedSpotify;
        } else {
          cachedYtMusic = res.linksByPlatform.youtubeMusic?.url;
          targetUrl = cachedYtMusic;
        }
      }

      if (targetUrl) {
        window.open(targetUrl, "_blank");
      } else {
        const query = encodeURIComponent(`${track.artist} ${track.title}`);
        if (platform === "spotify") {
          window.open(`https://open.spotify.com/search/${query}`, "_blank");
        } else {
          window.open(`https://music.youtube.com/search?q=${query}`, "_blank");
        }
      }
    } catch (e) {
      console.error("Link resolution failed", e);
    }
    resolvingLink = null;
  }

  function handleNowPlaying() {
    dispatch("nowPlaying", { track, postToBsky });
  }

  function handleAddToPlaylist() {
    dispatch("addToPlaylist", track);
  }

  function handleReaction(e: CustomEvent) {
    dispatch("reaction", { track: track, emoji: e.detail });
  }

  function handleDelete() {
    dispatch("delete", index);
  }
</script>

<!-- Card Container -->
<div
  class="bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all duration-300 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-900/10 group relative"
  class:ring-2={expanded}
  class:ring-green-500={expanded}
  class:opacity-50={isDragging}
  class:cursor-move={showDragHandle}
  draggable={showDragHandle}
  on:dragstart
  on:dragover
  on:drop
  role="listitem"
>
  <div class="flex gap-4 items-center">
    <!-- Drag Handle -->
    {#if showDragHandle}
      <div
        class="text-gray-600 cursor-grab active:cursor-grabbing p-1 -ml-2"
        on:mousedown|stopPropagation
      >
        <GripVertical size={20} />
      </div>
    {/if}

    <!-- Artwork -->
    <div
      class="relative w-16 h-16 flex-shrink-0 cursor-pointer"
      on:click={toggleExpand}
      on:keypress={(e) => e.key === "Enter" && toggleExpand()}
      role="button"
      tabindex="0"
    >
      <img
        src={track.artworkUrl || "/placeholder_art.png"}
        alt={track.title}
        class="w-full h-full object-cover rounded-md shadow-md bg-gray-800"
        on:error={(e) =>
          ((e.currentTarget as HTMLImageElement).src =
            "https://placehold.co/100x100?text=No+Art")}
      />
      <div
        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md"
      >
        <Play class="text-white fill-white w-6 h-6" />
      </div>
    </div>

    <!-- Meta -->
    <div
      class="flex-grow min-w-0 flex flex-col justify-center h-16 cursor-pointer"
      on:click={toggleExpand}
    >
      <h3 class="font-bold text-white truncate text-lg leading-tight">
        {track.title}
      </h3>
      <p class="text-gray-400 text-sm truncate">{track.artist}</p>
      {#if track.album}
        <p class="text-gray-500 text-xs truncate">{track.album}</p>
      {/if}
    </div>

    <!-- Quick Actions (Direct Playback) -->
    <div class="flex gap-2 items-center" on:click|stopPropagation={() => {}}>
      <button
        on:click={() => resolveAndOpen("spotify")}
        class="text-gray-400 hover:text-green-500 transition-colors p-1"
        title="Play on Spotify"
        disabled={resolvingLink === "spotify"}
      >
        {#if resolvingLink === "spotify"}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <Disc size={20} />
        {/if}
      </button>

      <button
        on:click={() => resolveAndOpen("ytmusic")}
        class="text-gray-400 hover:text-red-500 transition-colors p-1"
        title="Play on YouTube Music"
        disabled={resolvingLink === "ytmusic"}
      >
        {#if resolvingLink === "ytmusic"}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="12" cy="12" r="10" /><polygon
              points="10 8 16 12 10 16 10 8"
            /></svg
          >
        {/if}
      </button>

      <!-- Delete Button (Owner) -->
      {#if showDelete}
        <button
          on:click={handleDelete}
          class="text-gray-600 hover:text-red-500 transition-colors p-1 ml-1"
          title="Remove Track"
        >
          <Trash2 size={20} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Expanded Options -->
  {#if expanded}
    <div
      class="mt-4 pt-4 border-t border-gray-800 flex flex-col gap-3 animate-fade-in"
      on:click|stopPropagation={() => {}}
    >
      <!-- Reactions Showcase -->
      <ReactionBar
        subjectUri={track.trackUri}
        {track}
        on:reaction={handleReaction}
      />

      <div
        class="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg"
      >
        <label
          class="flex items-center gap-2 cursor-pointer text-sm text-gray-300 select-none"
        >
          <input
            type="checkbox"
            bind:checked={postToBsky}
            class="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700"
          />
          Post to Bluesky
        </label>

        <button
          on:click={handleNowPlaying}
          class="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-1.5 rounded-full text-sm flex items-center gap-2 transition-transform active:scale-95"
          title="Share to NowPlaying Feed"
        >
          <Share2 size={16} /> #NowPlaying
        </button>
      </div>

      <div class="flex gap-2">
        <button
          on:click={handleAddToPlaylist}
          class="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} /> Add to Playlist
        </button>
      </div>
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
