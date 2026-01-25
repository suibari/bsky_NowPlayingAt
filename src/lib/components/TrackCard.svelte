<script lang="ts">
  import type { Track } from "$lib/music";
  import { createEventDispatcher } from "svelte";
  import {
    ChevronDown,
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

  export let showDelete: boolean = false;
  export let showDragHandle: boolean = false;
  export let isDragging: boolean = false; // Styling state

  export let index: number = 0; // For drag reference
  export let isProcessing: boolean = false;
  export let reactionGroups: any[] = [];

  const dispatch = createEventDispatcher();

  let expanded = false;
  let postToBsky = false;
  let comment = "";

  // Link Resolution
  let resolvingLink: "spotify" | "ytmusic" | "appleMusic" | null = null;
  let cachedSpotify: string | undefined = track.spotifyUrl;
  let cachedYtMusic: string | undefined = track.youtubeMusicUrl;
  let cachedAppleMusic: string | undefined = track.appleMusicUrl;

  function toggleExpand() {
    expanded = !expanded;
  }

  async function resolveAndOpen(
    platform: "spotify" | "ytmusic" | "appleMusic",
  ) {
    let targetUrl: string | undefined;

    if (platform === "spotify") targetUrl = cachedSpotify;
    else if (platform === "ytmusic") targetUrl = cachedYtMusic;
    else if (platform === "appleMusic") targetUrl = cachedAppleMusic;

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
        } else if (platform === "ytmusic") {
          cachedYtMusic = res.linksByPlatform.youtubeMusic?.url;
          targetUrl = cachedYtMusic;
        } else if (platform === "appleMusic") {
          cachedAppleMusic = res.linksByPlatform.appleMusic?.url;
          targetUrl = cachedAppleMusic;
        }
      }

      if (targetUrl) {
        window.open(targetUrl, "_blank");
      } else {
        const query = encodeURIComponent(`${track.artist} ${track.title}`);
        if (platform === "spotify") {
          window.open(`https://open.spotify.com/search/${query}`, "_blank");
        } else if (platform === "ytmusic") {
          window.open(`https://music.youtube.com/search?q=${query}`, "_blank");
        } else if (platform === "appleMusic") {
          // Apple Music search URL is slightly more complex or just use google search?
          // Using a generic search or geo specific. iTunes link maker is hard to deep link search.
          // Fallback to simple google search for "apple music <artist> <track>" might be better or just alert.
          // But actually, https://music.apple.com/us/search?term= works.
          window.open(
            `https://music.apple.com/jp/search?term=${query}`,
            "_blank",
          );
        }
      }
    } catch (e) {
      console.error("Link resolution failed", e);
    }
    resolvingLink = null;
  }

  function handleNowPlaying() {
    // If track doesn't have comment but local input does, attach it temporarily for the event
    const trackWithComment = { ...track, comment: comment || track.comment };
    dispatch("nowPlaying", { track: trackWithComment, postToBsky });
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
  role="listitem"
>
  <div class="flex gap-4 items-center">
    <!-- Drag Handle -->
    {#if showDragHandle}
      <div class="text-gray-600 cursor-grab active:cursor-grabbing p-1 -ml-2">
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
        <ChevronDown class="text-white w-8 h-8" />
      </div>
    </div>

    <!-- Meta -->
    <div
      class="flex-grow min-w-0 flex flex-col justify-center min-h-16 cursor-pointer"
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
        <p class="text-white/80 text-sm mt-1 italic break-words line-clamp-2">
          "{track.comment}"
        </p>
      {/if}
    </div>

    <!-- Quick Actions (Direct Playback) -->
    <div class="flex gap-2 items-center" on:click|stopPropagation={() => {}}>
      <button
        on:click={() => resolveAndOpen("spotify")}
        class="text-gray-400 hover:text-green-500 transition-colors p-1"
        title="Spotifyで再生"
        disabled={resolvingLink === "spotify"}
      >
        {#if resolvingLink === "spotify"}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <!-- Spotify Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="transform scale-110"
          >
            <path
              d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.4-1.02 16.141 1.8.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
            />
          </svg>
        {/if}
      </button>

      <button
        on:click={() => resolveAndOpen("ytmusic")}
        class="text-gray-400 hover:text-red-500 transition-colors p-1"
        title="YouTube Musicで再生"
        disabled={resolvingLink === "ytmusic"}
      >
        {#if resolvingLink === "ytmusic"}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <!-- YouTube Music Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="transform scale-125"
          >
            <path
              d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19.2c-3.977 0-7.2-3.223-7.2-7.2s3.223-7.2 7.2-7.2 7.2 3.223 7.2 7.2-3.223 7.2-7.2 7.2zm-2.4-10.8v7.2l6-3.6z"
            />
          </svg>
        {/if}
      </button>

      <button
        on:click={() => resolveAndOpen("appleMusic")}
        class="text-gray-400 hover:text-pink-500 transition-colors p-1"
        title="Apple Musicで再生"
        disabled={resolvingLink === "appleMusic"}
      >
        {#if resolvingLink === "appleMusic"}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <!-- Apple Music Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="transform scale-110"
          >
            <path
              d="M18.7107 19.5002C17.7951 20.8403 16.7891 22.3117 15.1466 22.3117C13.5358 22.3117 13.0457 21.3768 11.2338 21.3768C9.39003 21.3768 8.84759 22.2801 7.30064 22.3117C5.68984 22.3432 4.29344 20.6206 3.16334 18.9663C0.844788 15.5898 2.58554 10.3708 5.43809 10.3393C6.98504 10.3077 8.0924 11.3804 9.03632 11.3804C10.0118 11.3804 10.8928 10.1501 12.6234 10.1185C13.5044 10.1185 15.1781 10.434 16.2165 11.9799C16.1221 12.043 13.913 13.3364 13.9444 16.1439C13.9759 18.51 16.0277 19.3424 16.1221 19.3739C16.0592 19.5316 19.1827 18.8077 18.7107 19.5002ZM12.3087 7.02704C13.0639 6.08064 13.6015 4.75549 13.4442 3.46231C12.3114 3.52541 10.9268 4.25096 10.1397 5.16579C9.38453 6.04909 8.75519 7.374 8.94399 8.66723C10.1397 8.76186 11.5534 8.00499 12.3087 7.02704Z"
            />
          </svg>
        {/if}
      </button>

      <!-- Delete Button (Owner) -->
      {#if showDelete}
        <button
          on:click={handleDelete}
          class="text-gray-600 hover:text-red-500 transition-colors p-1 ml-1"
          title="削除"
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
        initialReactions={reactionGroups}
        on:reaction={handleReaction}
      />

      <div class="bg-gray-800/50 p-3 rounded-lg flex flex-col gap-3">
        <!-- Row 1: Comment Input -->
        <div class="w-full">
          <input
            type="text"
            bind:value={comment}
            placeholder="コメントを追加..."
            class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none placeholder-gray-600"
            on:click|stopPropagation
            on:keydown|stopPropagation
          />
        </div>

        <!-- Row 2: Actions (Checkbox & Post Button) -->
        <div class="flex justify-between items-center flex-wrap gap-2">
          <label
            class="flex items-center gap-2 cursor-pointer text-sm text-gray-300 select-none"
          >
            <input
              type="checkbox"
              bind:checked={postToBsky}
              class="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700"
            />
            Blueskyに投稿
          </label>

          <button
            on:click={handleNowPlaying}
            disabled={isProcessing}
            class="bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 disabled:cursor-not-allowed text-black font-bold px-4 py-1.5 rounded-full text-sm flex items-center gap-2 transition-transform active:scale-95 disabled:active:scale-100"
            title="再生中にする"
          >
            {#if isProcessing}
              <Loader2 size={16} class="animate-spin" />
              処理中...
            {:else}
              <Share2 size={16} /> #NowPlaying
            {/if}
          </button>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          on:click={handleAddToPlaylist}
          class="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} /> プレイリストに追加
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
