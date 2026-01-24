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
    GripVertical,
    Trash2,
  } from "lucide-svelte";
  import { getBacklinks } from "$lib/constellation";
  import { resolveLinks } from "$lib/odesli";
  import { REACTION_SOURCE } from "$lib/schema";
  import { hydrateReactions } from "$lib/bsky";

  export let track: Track;
  export let isOwner: boolean = false;
  export let showDelete: boolean = false;
  export let showDragHandle: boolean = false;
  export let isDragging: boolean = false; // Styling state
  export let index: number = 0; // For drag reference

  import { agent } from "$lib/stores";
  import { get } from "svelte/store";
  import { publicAgent } from "$lib/atproto";

  const dispatch = createEventDispatcher();

  let expanded = false;
  let postToBsky = false;

  // Reaction State (Grouped)
  interface ReactionUser {
    did: string;
    handle: string;
    avatar?: string;
    displayName?: string;
  }
  interface ReactionGroup {
    emoji: string;
    users: ReactionUser[];
  }
  let reactions: ReactionGroup[] = [];
  let loadingReactions = false;
  let loadedReactions = false;

  // Hover State
  let hoveredEmoji: string | null = null;

  // Link Resolution
  let resolvingLink: "spotify" | "ytmusic" | null = null;
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
      const res = await getBacklinks(track.trackUri, REACTION_SOURCE);
      const hydrated = await hydrateReactions(res);

      // Group by emoji -> dids
      const groups: Record<string, string[]> = {};
      hydrated.forEach(({ record, authorDid }) => {
        if (record.emoji) {
          if (!groups[record.emoji]) groups[record.emoji] = [];
          groups[record.emoji].push(authorDid);
        }
      });

      // Fetch profiles
      const allDids = Array.from(new Set(Object.values(groups).flat()));
      let profilesMap = new Map<string, ReactionUser>();

      if (allDids.length > 0) {
        try {
          // Chunk requests if needed (limit 25)
          const chunks = [];
          for (let i = 0; i < allDids.length; i += 25) {
            chunks.push(allDids.slice(i, i + 25));
          }

          for (const chunk of chunks) {
            const pRes = await publicAgent.app.bsky.actor.getProfiles({
              actors: chunk,
            });
            pRes.data.profiles.forEach((p) => {
              profilesMap.set(p.did, {
                did: p.did,
                handle: p.handle,
                avatar: p.avatar,
                displayName: p.displayName,
              });
            });
          }
        } catch (e) {
          console.error("Failed to fetch profiles", e);
        }
      }

      // Build reaction groups
      reactions = Object.entries(groups).map(([emoji, dids]) => ({
        emoji,
        users: dids
          .map((did) => profilesMap.get(did) || { did, handle: "Unknown" })
          .filter((u): u is ReactionUser => !!u),
      }));

      loadedReactions = true;
    } catch (e) {
      // console.error("Failed to load reactions", e);
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
      <div class="flex flex-wrap items-center gap-2 min-h-[2rem]">
        <!-- Add Reaction Button (Left) -->
        <button
          on:click={handleReaction}
          class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
          title="Add Reaction"
        >
          <Plus size={16} />
        </button>

        {#if loadingReactions}
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={12} class="animate-spin" />
          </div>
        {:else if reactions.length > 0}
          <!-- Reaction Badges -->
          {#each reactions as rx}
            <div
              class="relative group"
              on:mouseenter={() => (hoveredEmoji = rx.emoji)}
              on:mouseleave={() => (hoveredEmoji = null)}
              role="group"
            >
              <div
                class="flex items-center gap-1 bg-gray-800/80 rounded-full px-3 py-1 border border-gray-700 font-bold text-white shadow-sm cursor-help select-none"
              >
                <span class="text-sm">{rx.emoji}</span>
                <span class="text-xs text-green-500 ml-1"
                  >{rx.users.length}</span
                >
              </div>

              <!-- Hover Tooltip -->
              {#if hoveredEmoji === rx.emoji}
                <div
                  class="absolute bottom-full left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pb-2 animate-fade-in"
                >
                  <div
                    class="w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 flex flex-col gap-1"
                  >
                    <div
                      class="text-xs text-gray-500 font-bold px-1 mb-1 border-b border-gray-800 pb-1"
                    >
                      Reacted by:
                    </div>
                    {#each rx.users as user}
                      <a
                        href={`/profile/${user.did}`}
                        class="flex items-center gap-2 p-1 hover:bg-gray-800 rounded transition-colors group/user"
                      >
                        {#if user ? user.avatar : false}
                          <img
                            src={user.avatar}
                            alt={user.handle}
                            class="w-5 h-5 rounded-full bg-gray-800"
                          />
                        {:else}
                          <div class="w-5 h-5 rounded-full bg-gray-700"></div>
                        {/if}
                        <div class="flex flex-col min-w-0">
                          <span
                            class="text-xs font-bold text-white truncate group-hover/user:text-green-400"
                            >{user
                              ? user.displayName || user.handle
                              : "Unknown"}</span
                          >
                        </div>
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {:else}
          <span class="text-xs text-gray-600 italic ml-1"
            >No reactions yet. Be the first!</span
          >
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
        <!-- React button removed from here, moved to top -->
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
