<script lang="ts">
  import type { Track } from "$lib/music";
  import { createEventDispatcher } from "svelte";
  import {
    Play,
    Plus,
    Share2,
    MessageSquarePlus,
    Disc,
    Loader2,
  } from "lucide-svelte";
  import { getBacklinks } from "$lib/constellation";
  import { resolveLinks } from "$lib/odesli";

  // Custom Icon for YT Music if needed, or re-use others.
  // Lucide doesn't have specific yt-music, using 'Music' or similar.

  export let track: Track;

  const dispatch = createEventDispatcher();

  let expanded = false;
  let postToBsky = false;

  // Reaction State
  interface ReactionDisplay {
    emoji: string;
    avatar?: string;
    handle: string;
  }
  let reactions: ReactionDisplay[] = [];
  let loadingReactions = false;
  let loadedReactions = false;

  // Link Resolution State
  let resolvingLink: "spotify" | "ytmusic" | null = null;
  // Cache resolved links locally to avoid re-fetching
  let cachedSpotify: string | undefined = track.spotifyUrl;
  let cachedYtMusic: string | undefined = track.youtubeMusicUrl;

  function toggleExpand() {
    expanded = !expanded;
    if (expanded && !loadedReactions) {
      loadReactions();
    }
  }

  async function loadReactions() {
    if (!track.trackUri) return;
    loadingReactions = true;
    try {
      const res = await getBacklinks(track.trackUri, undefined, 50);
      reactions = res
        .filter((r) => (r.value as any)?.emoji)
        .map((r) => ({
          emoji: (r.value as any).emoji,
          avatar: r.author?.avatar,
          handle: r.author?.handle || "Unknown",
        }));
      loadedReactions = true;
    } catch (e) {
      console.error("Failed to load reactions", e);
    }
    loadingReactions = false;
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
        // Fallback to search if Odesli fails
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

  function handleReaction() {
    dispatch("reaction", track);
  }
</script>

<!-- Card Container -->
<div
  class="bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all duration-300 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-900/10 cursor-pointer group"
  class:ring-2={expanded}
  class:ring-green-500={expanded}
  on:click={toggleExpand}
  on:keydown={(e) => e.key === "Enter" && toggleExpand()}
  role="button"
  tabindex="0"
>
  <div class="flex gap-4 items-center">
    <!-- Artwork -->
    <div class="relative w-16 h-16 flex-shrink-0">
      <img
        src={track.artworkUrl}
        alt={track.title}
        class="w-full h-full object-cover rounded-md shadow-md"
      />
      <div
        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md"
      >
        <Play class="text-white fill-white w-6 h-6" />
      </div>
    </div>

    <!-- Meta -->
    <div class="flex-grow min-w-0">
      <h3 class="font-bold text-white truncate text-lg leading-tight">
        {track.title}
      </h3>
      <p class="text-gray-400 text-sm truncate">{track.artist}</p>
      <p class="text-gray-500 text-xs truncate">{track.album}</p>
    </div>

    <!-- Quick Actions (Direct Playback) -->
    <div class="flex gap-2" on:click|stopPropagation={() => {}}>
      <!-- Spotify -->
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

      <!-- Youtube Music -->
      <button
        on:click={() => resolveAndOpen("ytmusic")}
        class="text-gray-400 hover:text-red-500 transition-colors p-1"
        title="Play on YouTube Music"
        disabled={resolvingLink === "ytmusic"}
      >
        {#if resolvingLink === "ytmusic"}
          <Loader2 size={20} class="animate-spin" />
        {:else}
          <!-- Custom Circle Play icon for YTM-ish look -->
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
    </div>
  </div>

  <!-- Expanded Options -->
  {#if expanded}
    <div
      class="mt-4 pt-4 border-t border-gray-800 flex flex-col gap-3 animate-fade-in"
      on:click|stopPropagation={() => {}}
    >
      <!-- Reactions Showcase -->
      <div class="mb-2">
        {#if loadingReactions}
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={12} class="animate-spin" /> Loading reactions...
          </div>
        {:else if reactions.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each reactions as rx}
              <div
                class="flex items-center gap-1 bg-gray-800/80 rounded-full px-2 py-1"
                title={rx.handle}
              >
                {#if rx.avatar}
                  <img
                    src={rx.avatar}
                    alt={rx.handle}
                    class="w-4 h-4 rounded-full"
                  />
                {/if}
                <span class="text-xs">{rx.emoji}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-xs text-gray-600 italic">
            No reactions yet. Be the first!
          </p>
        {/if}
      </div>

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
        <button
          on:click={handleReaction}
          class="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <MessageSquarePlus size={16} /> React
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
