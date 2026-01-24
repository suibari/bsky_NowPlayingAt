<script lang="ts">
  import { authState, userProfile } from "$lib/stores";
  import { signIn, signOut } from "$lib/atproto";
  import {
    createHistoryRecord,
    postToFeed,
    getPlaylists,
    addToPlaylist,
    createReactionRecord,
    getGlobalTimeline,
  } from "$lib/bsky";
  import { searchTracks, type Track } from "$lib/music";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import PlaylistCard from "$lib/components/PlaylistCard.svelte";
  import { Loader2, Music, X, Plus } from "lucide-svelte";

  let handleInput = "";
  let isSigningIn = false;
  let activeTab: "search" | "discovery" = "search";

  // Search State
  let searchQuery = "";
  let searchResults: Track[] = [];
  let isSearching = false;
  let searchTimeout: any;

  // Modal State
  let showPlaylistModal = false;
  let targetTrack: Track | null = null;
  let myPlaylists: any[] = [];
  let loadingPlaylists = false;

  // Reaction State
  let showReactionModal = false;
  let targetTrackForReaction: Track | null = null;
  const popularEmojis = [
    "🔥",
    "❤️",
    "🥺",
    "🎧",
    "🕺",
    "🤘",
    "🎹",
    "✨",
    "💯",
    "😭",
    "😴",
    "🍺",
    "💿",
    "🚀",
  ];

  async function handleSignIn() {
    if (!handleInput.includes(".")) {
      handleInput += ".bsky.social";
    }
    isSigningIn = true;
    try {
      await signIn(handleInput);
    } catch (e) {
      console.error(e);
      isSigningIn = false;
      alert("Sign in failed: " + e);
    }
  }

  function performSearch(query: string) {
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!query || query.length < 2) {
      searchResults = [];
      return;
    }

    isSearching = true;
    searchTimeout = setTimeout(async () => {
      searchResults = await searchTracks(query);
      isSearching = false;
    }, 500);
  }

  async function executeNowPlaying(track: Track, postToBsky: boolean) {
    if (!confirm(`Post "${track.title}" to NowPlaying?`)) return;

    try {
      // 1. Write to History (PDS)
      await createHistoryRecord(track);

      // 2. Post to Feed
      if (postToBsky) {
        await postToFeed(track);
      }

      alert("Posted NowPlaying successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to post: " + e);
    }
  }

  // --- PLAYLIST LOGIC ---

  async function openPlaylistModal(track: Track) {
    targetTrack = track;
    showPlaylistModal = true;
    loadingPlaylists = true;

    try {
      if ($userProfile) {
        myPlaylists = await getPlaylists($userProfile.did);
      }
    } catch (e) {
      console.error(e);
    }
    loadingPlaylists = false;
  }

  async function handleAddToPlaylist(playlist: any) {
    if (!targetTrack) return;
    try {
      await addToPlaylist(playlist.uri, targetTrack, playlist);
      alert(`Added to ${playlist.value.name}!`);
      showPlaylistModal = false;
    } catch (e) {
      alert("Failed to add: " + e);
    }
  }

  // --- REACTION LOGIC ---

  function openReactionModal(track: Track) {
    targetTrackForReaction = track;
    showReactionModal = true;
  }

  async function handleReaction(emoji: string) {
    if (!targetTrackForReaction) return;
    try {
      await createReactionRecord({
        subjectUri: targetTrackForReaction.trackUri,
        emoji: emoji,
        track: targetTrackForReaction,
      });
      alert(`Reacted with ${emoji}!`);
      showReactionModal = false;
    } catch (e) {
      alert("Failed to react: " + e);
    }
  }

  function handleCustomReaction() {
    const emoji = prompt("Enter a custom emoji:");
    if (emoji) handleReaction(emoji);
  }
</script>

{#if $authState.isLoading}
  <div class="flex items-center justify-center h-screen bg-black text-white">
    <Loader2 class="w-8 h-8 animate-spin text-green-500" />
  </div>
{:else if $authState.isAuthenticated}
  <!-- DASHBOARD VIEW -->
  <div class="p-6 max-w-5xl mx-auto min-h-screen">
    <!-- Header -->
    <div
      class="flex justify-between items-center mb-6 sticky top-0 bg-black/95 backdrop-blur-md z-20 py-4 border-b border-gray-800/50"
    >
      <h1 class="text-3xl font-black text-white tracking-tighter">
        なうぷれ<span class="text-green-500">あっと</span>
      </h1>
      <div class="flex gap-4 items-center">
        <!-- User Info (Linked to Profile) -->
        <a
          href={`/profile/${$userProfile?.did}`}
          class="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors group"
        >
          {#if $userProfile?.avatar}
            <img
              src={$userProfile.avatar}
              alt="avatar"
              class="w-8 h-8 rounded-full border border-gray-700 group-hover:border-green-500 transition-colors"
            />
          {/if}
          <span class="hidden sm:inline font-medium group-hover:underline"
            >{$userProfile?.displayName || $userProfile?.handle}</span
          >
        </a>

        <button
          class="px-3 py-1 rounded-md bg-gray-900 border border-gray-800 hover:bg-red-900/20 hover:border-red-900/50 hover:text-red-400 text-xs text-gray-400 transition-all ml-2"
          on:click={() => signOut($userProfile?.did || "")}
        >
          Sign Out
        </button>
      </div>
    </div>

    <!-- TABS -->
    <div class="flex justify-center mb-8">
      <div class="bg-gray-900 p-1 rounded-full flex gap-1">
        <button
          on:click={() => (activeTab = "search")}
          class="px-6 py-2 rounded-full text-sm font-bold transition-all {activeTab ===
          'search'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          Song Search
        </button>
        <button
          on:click={() => (activeTab = "discovery")}
          class="px-6 py-2 rounded-full text-sm font-bold transition-all {activeTab ===
          'discovery'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          Discovery
        </button>
      </div>
    </div>

    {#if activeTab === "search"}
      <!-- Search Section -->
      <div class="mb-10 max-w-3xl mx-auto animate-fade-in">
        <div class="relative group">
          <div
            class="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-gray-500 group-focus-within:text-green-500 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            bind:value={searchQuery}
            on:input={() => performSearch(searchQuery)}
            placeholder="Search for songs, artists, or albums..."
            class="w-full bg-gray-900 border border-gray-800 text-white rounded-full py-4 pl-14 pr-6 shadow-lg focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none transition-all placeholder-gray-600 text-lg"
          />
          {#if searchQuery}
            <button
              on:click={() => {
                searchQuery = "";
                performSearch("");
              }}
              class="absolute inset-y-0 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>
          {/if}
        </div>
      </div>

      <!-- Results / Content -->
      <div class="max-w-4xl mx-auto">
        {#if isSearching}
          <div class="flex justify-center py-12">
            <Loader2 class="w-8 h-8 animate-spin text-green-500" />
          </div>
        {:else if searchResults.length > 0}
          <h2
            class="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 px-2"
          >
            Top Results
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {#each searchResults as track (track.id)}
              <TrackCard
                {track}
                on:nowPlaying={(e) =>
                  executeNowPlaying(e.detail.track, e.detail.postToBsky)}
                on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                on:reaction={(e) => openReactionModal(e.detail)}
              />
            {/each}
          </div>
        {:else if searchQuery.length > 1}
          <div class="text-center py-12 text-gray-500">
            No tracks found for "{searchQuery}"
          </div>
        {:else}
          <!-- Empty State / Recent History (Placeholder) -->
          <div class="text-center py-20 opacity-30 select-none">
            <Music size={80} class="mx-auto mb-6 text-gray-700" />
            <p class="text-gray-500 text-lg">
              Start typing to explore music...
            </p>
          </div>
        {/if}
      </div>
    {:else if activeTab === "discovery"}
      <div class="max-w-2xl mx-auto animate-fade-in pb-20">
        {#await getGlobalTimeline()}
          <div class="text-center py-20 text-gray-500">
            <Loader2 class="w-8 h-8 animate-spin mx-auto mb-4 text-green-500" />
            <p>Loading the atmosphere...</p>
          </div>
        {:then timeline}
          {#if timeline.length > 0}
            <div class="space-y-8">
              {#each timeline as item}
                <div
                  class="bg-gray-900/50 rounded-xl p-4 border border-gray-800"
                >
                  <!-- Header: User Action -->
                  <div class="flex items-center gap-3 mb-3">
                    <a
                      href={`/profile/${item.author.did}`}
                      class="flex-shrink-0"
                    >
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
                    <div>
                      <div class="text-sm text-gray-300">
                        <span class="font-bold text-white">
                          {item.author.displayName || item.author.handle}
                        </span>
                        {#if item.type === "history"}
                          <span class="text-gray-500">listened to a track</span>
                        {:else if item.type === "reaction"}
                          <span class="text-gray-500">
                            reacted with <span class="text-lg"
                              >{item.record.emoji}</span
                            >
                          </span>
                        {:else if item.type === "playlist"}
                          <span class="text-gray-500">created a playlist</span>
                        {/if}
                      </div>
                      <div class="text-xs text-gray-600">
                        {new Date(item.indexedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="pl-12">
                    {#if item.type === "history"}
                      <TrackCard
                        track={{
                          id: item.record.trackUri, // Use Uri as ID
                          title: item.record.track,
                          artist: item.record.artist,
                          album: item.record.album,
                          artworkUrl: item.record.img,
                          trackUri: item.record.trackUri,
                          spotifyUrl: item.record.links?.spotify,
                          youtubeMusicUrl: item.record.links?.youtube,
                        }}
                        on:nowPlaying={(e) =>
                          executeNowPlaying(
                            e.detail.track,
                            e.detail.postToBsky,
                          )}
                        on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                        on:reaction={(e) => openReactionModal(e.detail)}
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
                            artworkUrl:
                              item.record.img || "/placeholder_art.png",
                            spotifyUrl: item.record.links?.spotify,
                            youtubeMusicUrl: item.record.links?.youtube,
                          }}
                          on:nowPlaying={(e) =>
                            executeNowPlaying(
                              e.detail.track,
                              e.detail.postToBsky,
                            )}
                          on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                          on:reaction={(e) => openReactionModal(e.detail)}
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
              {/each}
            </div>
          {:else}
            <div class="text-center py-20 text-gray-500">
              <p>No actitivity yet. Be the first!</p>
            </div>
          {/if}
        {:catch error}
          <div class="text-center py-20 text-red-500">
            Failed to load timeline: {error.message}
          </div>
        {/await}
      </div>
    {/if}

    <!-- Playlist Modal -->
    {#if showPlaylistModal}
      <div
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        on:click|self={() => (showPlaylistModal = false)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === "Escape" && (showPlaylistModal = false)}
      >
        <div
          class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        >
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-white">Add to Playlist</h2>
            <button
              on:click={() => (showPlaylistModal = false)}
              class="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {#if loadingPlaylists}
            <div class="flex justify-center py-8">
              <Loader2 class="animate-spin text-green-500" />
            </div>
          {:else if myPlaylists.length > 0}
            <div class="space-y-2 max-h-60 overflow-y-auto">
              {#each myPlaylists as pl}
                <button
                  on:click={() => handleAddToPlaylist(pl)}
                  class="w-full flex items-center justify-between bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition-colors text-left"
                >
                  <span class="font-medium text-white">{pl.value.name}</span>
                  <span class="text-xs text-gray-500"
                    >{pl.value.tracks?.length || 0} songs</span
                  >
                </button>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-gray-500">
              No playlists found. Go to your profile to create one!
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Reaction Modal -->
    {#if showReactionModal}
      <div
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        on:click|self={() => (showReactionModal = false)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === "Escape" && (showReactionModal = false)}
      >
        <div
          class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl"
        >
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-white">Pick a Vibe</h2>
            <button
              on:click={() => (showReactionModal = false)}
              class="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div class="grid grid-cols-5 gap-3 mb-6">
            {#each popularEmojis as emoji}
              <button
                on:click={() => handleReaction(emoji)}
                class="text-2xl hover:scale-125 transition-transform p-2 hover:bg-white/10 rounded-lg"
              >
                {emoji}
              </button>
            {/each}
          </div>

          <button
            on:click={handleCustomReaction}
            class="w-full py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
          >
            Use Custom Emoji...
          </button>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <!-- GUEST / LOGIN VIEW -->
  <div
    class="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black"
  >
    <!-- Background video/reel placeholder -->
    <div class="absolute inset-0 z-0 overflow-hidden">
      <div
        class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10"
      ></div>
      <!-- Animated Background Elements -->
      <div
        class="w-full h-full flex flex-wrap opacity-20 transform scale-110 blur-sm"
      >
        <div
          class="w-1/2 h-1/2 bg-green-900 rounded-full mix-blend-screen filter blur-3xl animate-blob"
        ></div>
        <div
          class="w-1/2 h-1/2 bg-blue-900 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000"
        ></div>
      </div>
    </div>

    <!-- Login Card -->
    <div
      class="relative z-20 bg-black/60 backdrop-blur-xl p-10 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl"
    >
      <div class="text-center mb-10">
        <h1 class="text-5xl font-black tracking-tighter text-white mb-2">
          なうぷれ<span class="text-green-500">あっと</span>
        </h1>
        <p class="text-gray-400 text-lg">Share your vibe on the Atmosphere.</p>
      </div>

      <form on:submit|preventDefault={handleSignIn} class="space-y-6">
        <div>
          <label
            for="handle"
            class="block text-sm font-medium text-gray-400 mb-2 ml-1"
            >Bluesky Handle</label
          >
          <div class="relative">
            <span class="absolute left-4 top-3.5 text-gray-500">@</span>
            <input
              type="text"
              id="handle"
              bind:value={handleInput}
              placeholder="username.bsky.social"
              class="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none transition-all placeholder-gray-600 shadow-inner"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSigningIn}
          class="w-full bg-green-500 hover:bg-green-400 text-black font-extrabold text-lg py-4 rounded-xl transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {#if isSigningIn}
            <Loader2 class="animate-spin" size={24} /> Connecting...
          {:else}
            Sign In
          {/if}
        </button>
      </form>

      <div class="mt-8 text-center text-xs text-gray-600">
        Powered by AT Protocol & Itunes Search
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-blob {
    animation: blob 10s infinite;
  }
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  @keyframes blob {
    0% {
      transform: translate(0px, 0px) scale(1);
    }
    33% {
      transform: translate(30px, -50px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
    100% {
      transform: translate(0px, 0px) scale(1);
    }
  }
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
