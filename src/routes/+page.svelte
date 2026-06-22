<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { authState, userProfile } from "$lib/stores";
  import { signIn } from "$lib/atproto";
  import {
    createHistoryRecord,
    postToFeed,
    getPlaylists,
    addToPlaylist,
    getGlobalTimeline,
    getHotContent,
    songKey,
  } from "$lib/bsky";
  import { searchTracks, type Track } from "$lib/music";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import PlaylistCard from "$lib/components/PlaylistCard.svelte";
  import InfoModal from "$lib/components/InfoModal.svelte";
  import LangToggle from "$lib/components/LangToggle.svelte";
  import { Loader2, Music, X, Plus, Info } from "lucide-svelte";
  import { swipe } from "$lib/actions/swipe";
  import { t } from "$lib/i18n";

  let handleInput = "";
  let isSigningIn = false;
  let activeTab: "search" | "hot" | "discovery" = "search";
  let hotTab: "tracks" | "playlists" | "users" = "tracks";

  // Data State
  let hotTracks: any[] = [];
  let hotPlaylists: any[] = [];
  let hotUsers: any[] = [];
  let discoveryTimeline: any[] = [];

  // Display limits ("load more" pagination so we don't render hundreds of nodes)
  const PAGE_SIZE = 20;
  let hotLimit = PAGE_SIZE;
  let discoveryLimit = PAGE_SIZE;

  let loadingHot = true;
  let loadingDiscovery = true;
  let showSettingsBanner = false;
  let bannerChecked = false;

  onMount(() => {
    // Start background fetches
    loadHotContent();
    loadDiscoveryContent();
  });

  function setHotTab(tab: "tracks" | "playlists" | "users") {
    hotTab = tab;
    hotLimit = PAGE_SIZE; // reset pagination when switching sub-tab
  }

  function goHome() {
    activeTab = "search";
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Wait for auth to be confirmed before checking settings
  $: if ($authState.isAuthenticated && !bannerChecked) {
    bannerChecked = true;
    checkSettingsBanner();
  }

  async function checkSettingsBanner() {
    try {
      const res = await fetch("/api/register");
      if (res.ok) {
        const data = await res.json();
        showSettingsBanner = !data.enabled || !data.lastfm_username;
      } else {
        showSettingsBanner = false;
      }
    } catch {
      showSettingsBanner = false;
    }
  }

  async function loadHotContent() {
    loadingHot = true;
    try {
      // Show only the final, fully-aggregated ranking (no dynamic reshuffling
      // while loading). Spinner stays until the whole computation is done.
      const data = await getHotContent();
      hotTracks = data.tracks;
      hotPlaylists = data.playlists;
      hotUsers = data.users;
    } catch (e) {
      console.error("Failed to load hot content", e);
    } finally {
      loadingHot = false;
    }
  }

  async function loadDiscoveryContent() {
    loadingDiscovery = true;
    try {
      // Show only the final timeline at once (no items popping in while loading).
      const items = await getGlobalTimeline();
      discoveryTimeline = mergeTimeline(items);
    } catch (e) {
      console.error("Failed to load discovery content", e);
    } finally {
      loadingDiscovery = false;
    }
  }

  // Optimistic items (from the current user's just-now post/reaction) that should
  // stay pinned at the top even as fetched batches stream in.
  let optimisticItems: any[] = [];

  function mergeTimeline(fetched: any[]): any[] {
    if (optimisticItems.length === 0) return fetched;
    const seen = new Set(
      fetched.map((i) => `${i.type}:${i.uri ?? ""}:${i.record?.subjectUri ?? ""}`),
    );
    const stillPending = optimisticItems.filter(
      (o) => !seen.has(`${o.type}:${o.uri ?? ""}:${o.record?.subjectUri ?? ""}`),
    );
    return [...stillPending, ...fetched];
  }

  function prependDiscovery(item: any) {
    optimisticItems = [item, ...optimisticItems];
    discoveryTimeline = [item, ...discoveryTimeline];
  }

  // Reflect the current user's just-now post/history into Discover (no reload).
  function reflectHistoryToDiscovery(track: Track, imgBlob?: string, uri?: string) {
    const me = get(userProfile);
    if (!me) return;
    prependDiscovery({
      type: "history",
      author: me,
      record: {
        track: track.title,
        artist: track.artist,
        album: track.album,
        trackUri: track.trackUri,
        img: track.artworkUrl,
        imgBlob,
        links: {
          spotify: track.spotifyUrl,
          youtube: track.youtubeMusicUrl,
          appleMusic: track.appleMusicUrl,
        },
        comment: track.comment,
        provider: track.provider,
        postUri: uri,
      },
      uri: uri ?? `optimistic:history:${track.trackUri}:${Date.now()}`,
      indexedAt: new Date().toISOString(),
    });
  }

  // Reflect the current user's just-now reaction into Discover (no reload).
  function handleDiscoveryReaction(e: CustomEvent) {
    const me = get(userProfile);
    const track = e.detail?.track;
    const emoji = e.detail?.emoji;
    if (!me || !track || !emoji) return;
    const subjectUri = track.trackUri || songKey(track.artist, track.title);
    if (
      optimisticItems.some(
        (o) =>
          o.type === "reaction" &&
          o.record?.subjectUri === subjectUri &&
          o.record?.emoji === emoji,
      )
    )
      return;
    prependDiscovery({
      type: "reaction",
      author: me,
      record: {
        emoji,
        subjectUri,
        kind: "track",
        track: track.title,
        artist: track.artist,
        album: track.album,
        img: track.artworkUrl,
        links: {
          spotify: track.spotifyUrl,
          youtube: track.youtubeMusicUrl,
          appleMusic: track.appleMusicUrl,
        },
        provider: track.provider,
      },
      uri: `optimistic:reaction:${subjectUri}:${emoji}:${Date.now()}`,
      indexedAt: new Date().toISOString(),
    });
  }

  // Info Modal
  let showInfoModal = false;

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
  let processingTrackId: string | null = null;

  async function handleSignIn() {
    handleInput = handleInput.replace(/^@/, '').trim();
    if (!handleInput.includes(".")) {
      handleInput += ".bsky.social";
    }
    isSigningIn = true;
    try {
      await signIn(handleInput);
    } catch (e) {
      console.error(e);
      isSigningIn = false;
      alert(get(t)('alert.signinfailed') + e);
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
    if (processingTrackId) return; // Prevent double submission
    processingTrackId = track.id;

    try {
      if (postToBsky) {
        if (!confirm(get(t)('confirm.post', { title: track.title }))) return;

        // 1. Post to Feed (blob upload happens here, get imgBlob + post URI back)
        const { imgBlob, uri } = await postToFeed(track);

        // 2. Write to History (PDS) with imgBlob for permanent image reference
        //    and postUri so Bluesky likes on the post can be aggregated later.
        await createHistoryRecord(track, imgBlob, uri);

        reflectHistoryToDiscovery(track, imgBlob, uri);
        alert(get(t)('alert.posted'));
      } else {
        // No confirmation dialog when just saving to history
        // 1. Write to History (PDS)
        await createHistoryRecord(track);

        reflectHistoryToDiscovery(track);
        alert(get(t)('alert.history'));
      }
    } catch (e) {
      console.error(e);
      alert(get(t)('alert.failed') + e);
    } finally {
      processingTrackId = null;
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
      alert(get(t)('alert.addedto', { name: playlist.value.name }));
      showPlaylistModal = false;
    } catch (e) {
      alert(get(t)('alert.addfailed') + e);
    }
  }

  // --- REACTION LOGIC ---

  function handleSwipeLeft() {
    if (activeTab === "search") {
      activeTab = "hot";
    } else if (activeTab === "hot") {
      activeTab = "discovery";
    }
  }

  function handleSwipeRight() {
    if (activeTab === "discovery") {
      activeTab = "hot";
    } else if (activeTab === "hot") {
      activeTab = "search";
    }
  }
</script>

{#if $authState.isLoading}
  <div class="flex items-center justify-center h-screen bg-black text-white">
    <Loader2 class="w-8 h-8 animate-spin text-green-500" />
  </div>
{:else if $authState.isAuthenticated}
  <!-- DASHBOARD VIEW -->
  <div class="p-6 max-w-4xl mx-auto min-h-screen">
    <!-- Header -->
    <div
      class="flex justify-between items-center mb-6 sticky top-0 bg-black/95 backdrop-blur-md z-20 py-4 border-b border-gray-800/50"
    >
      <button
        on:click={goHome}
        class="text-3xl font-black text-white tracking-tighter hover:opacity-80 transition-opacity"
        title="ホーム"
      >
        なうぷれ<span class="text-green-500">あっと</span>
      </button>
      <div class="flex gap-4 items-center">
        <!-- Help / Info -->
        <button
          on:click={() => (showInfoModal = true)}
          class="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-800"
          title="About App"
        >
          <Info size={20} />
        </button>

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
      </div>
    </div>

    <!-- Settings Banner -->
    {#if showSettingsBanner}
      <a
        href="/settings"
        class="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-green-500/10 border border-green-500/40 rounded-xl text-sm text-green-300 hover:bg-green-500/20 hover:border-green-400 transition-all group"
      >
        <div class="flex items-center gap-3">
          <Music size={18} class="text-green-400 shrink-0" />
          <span>
            <span class="font-bold text-green-400">{$t('banner.bold')}</span>{$t('banner.desc')}
          </span>
        </div>
        <span class="text-green-400 font-bold whitespace-nowrap group-hover:underline">{$t('banner.cta')}</span>
      </a>
    {/if}

    <!-- TABS -->
    <div class="flex justify-center mb-8">
      <div class="bg-gray-900 p-1 rounded-full flex gap-1 w-full sm:w-auto">
        <button
          on:click={() => (activeTab = "search")}
          class="flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all {activeTab ===
          'search'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          {$t('tab.search')}
        </button>
        <button
          on:click={() => (activeTab = "hot")}
          class="flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all {activeTab ===
          'hot'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          {$t('tab.hot')}
        </button>
        <button
          on:click={() => (activeTab = "discovery")}
          class="flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all {activeTab ===
          'discovery'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          {$t('tab.discovery')}
        </button>
      </div>
    </div>

    <div
      use:swipe
      on:swipeLeft={handleSwipeLeft}
      on:swipeRight={handleSwipeRight}
      class="min-h-[50vh] touch-pan-y"
    >
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
              placeholder={$t('search.placeholder')}
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
                  isProcessing={processingTrackId === track.id}
                  on:nowPlaying={(e) =>
                    executeNowPlaying(e.detail.track, e.detail.postToBsky)}
                  on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                  on:reaction={handleDiscoveryReaction}
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
      {:else if activeTab === "hot"}
        <!-- WHAT'S HOT SECTION -->
        <div class="max-w-4xl mx-auto animate-fade-in pb-20">
          <!-- Sub Tabs -->
          <div class="flex justify-center mb-8">
            <div
              class="inline-flex bg-black/40 border border-gray-800 rounded-lg p-1"
            >
              <button
                on:click={() => setHotTab("tracks")}
                class="px-5 py-1.5 rounded-md text-sm font-medium transition-all {hotTab ===
                'tracks'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('hot.toptracks')}
              </button>
              <button
                on:click={() => setHotTab("playlists")}
                class="px-5 py-1.5 rounded-md text-sm font-medium transition-all {hotTab ===
                'playlists'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('hot.topplaylists')}
              </button>
              <button
                on:click={() => setHotTab("users")}
                class="px-5 py-1.5 rounded-md text-sm font-medium transition-all {hotTab ===
                'users'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('hot.topusers')}
              </button>
            </div>
          </div>

          {#if loadingHot}
            <div class="text-center py-20 text-gray-500">
              <Loader2
                class="w-8 h-8 animate-spin mx-auto mb-4 text-green-500"
              />
              <p>{$t('hot.loading')}</p>
            </div>
          {:else if hotTab === "tracks"}
            {#if hotTracks.length > 0}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {#each hotTracks.slice(0, hotLimit) as track}
                  <div class="relative group">
                    <TrackCard
                      track={{
                        id: track.trackUri, // Use Uri as ID
                        title: track.track,
                        artist: track.artist,
                        album: track.album,
                        artworkUrl: (track.imgBlob?.includes('cid=undefined') ? undefined : track.imgBlob) ?? track.img,
                        trackUri: track.trackUri,
                        spotifyUrl: track.links?.spotify,
                        youtubeMusicUrl: track.links?.youtube,
                        appleMusicUrl: track.links?.appleMusic,
                        provider: track.provider || "itunes",
                      }}
                      reactionGroups={track.reactionGroups}
                      isProcessing={processingTrackId === track.trackUri}
                      on:nowPlaying={(e) =>
                        executeNowPlaying(e.detail.track, e.detail.postToBsky)}
                      on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                      on:reaction={handleDiscoveryReaction}
                    />

                    <!-- Reaction Count Display -->
                    <div
                      class="mt-1 flex items-center px-1 text-xs text-gray-500 gap-2"
                    >
                      <span class="text-green-500 font-bold"
                        >{track.reactionCount} reactions</span
                      >
                      {#if track.trending}
                        <span
                          class="px-2 py-0.5 rounded-full bg-orange-500 text-black text-[10px] font-black"
                          >🔥 {$t('hot.trending')}</span
                        >
                      {/if}
                      {#if track.recentReactors && track.recentReactors.length > 0}
                        <div class="flex -space-x-1">
                          {#each track.recentReactors as u}
                            <a
                              href={`/profile/${u.did}`}
                              title={u.displayName || u.handle}
                              class="relative z-0 hover:z-10 transition-transform hover:scale-110"
                            >
                              <img
                                src={u.avatar}
                                alt={u.handle}
                                class="w-4 h-4 rounded-full border border-black"
                              />
                            </a>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
              {#if hotTracks.length > hotLimit}
                <div class="flex justify-center mt-8">
                  <button
                    on:click={() => (hotLimit += PAGE_SIZE)}
                    class="px-6 py-2 rounded-full bg-gray-800 text-gray-300 text-sm font-bold hover:bg-gray-700 transition-colors"
                  >
                    {$t('hot.loadmore')}
                  </button>
                </div>
              {/if}
            {:else}
              <div class="text-center py-20 text-gray-500">
                <Music size={48} class="mx-auto mb-4 opacity-30" />
                <p>{$t('hot.empty.tracks')}</p>
              </div>
            {/if}
          {:else if hotTab === "playlists"}
            <!-- PLAYLISTS -->
            {#if hotPlaylists.length > 0}
              <div class="space-y-4">
                {#each hotPlaylists.slice(0, hotLimit) as item}
                  <div
                    class="bg-gray-900/40 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-900/60 transition-colors"
                  >
                    <PlaylistCard
                      playlist={item.playlist}
                      author={item.author}
                      rkey={item.uri.split("/").pop()}
                    />
                    <div
                      class="mt-2 flex items-center justify-between text-xs text-gray-500 px-1"
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class="text-green-500 font-bold flex items-center gap-1"
                        >
                          {item.reactionCount} reactions
                        </span>
                        {#if item.trending}
                          <span
                            class="px-2 py-0.5 rounded-full bg-orange-500 text-black text-[10px] font-black"
                            >🔥 {$t('hot.trending')}</span
                          >
                        {/if}
                        {#if item.recentReactors && item.recentReactors.length > 0}
                          <div class="flex -space-x-1">
                            {#each item.recentReactors as u}
                              <a
                                href={`/profile/${u.did}`}
                                title={u.displayName || u.handle}
                                class="relative z-0 hover:z-10 transition-transform hover:scale-110"
                              >
                                <img
                                  src={u.avatar}
                                  alt={u.handle}
                                  class="w-4 h-4 rounded-full border border-black"
                                />
                              </a>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
              {#if hotPlaylists.length > hotLimit}
                <div class="flex justify-center mt-8">
                  <button
                    on:click={() => (hotLimit += PAGE_SIZE)}
                    class="px-6 py-2 rounded-full bg-gray-800 text-gray-300 text-sm font-bold hover:bg-gray-700 transition-colors"
                  >
                    {$t('hot.loadmore')}
                  </button>
                </div>
              {/if}
            {:else}
              <div class="text-center py-20 text-gray-500">
                <p>{$t('hot.empty.playlists')}</p>
              </div>
            {/if}
          {:else}
            <!-- USERS -->
            {#if hotUsers.length > 0}
              <div class="space-y-2">
                {#each hotUsers.slice(0, hotLimit) as user, i}
                  <a
                    href={`/profile/${user.did}`}
                    class="flex items-center gap-4 bg-gray-900/40 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-900/60 transition-colors"
                  >
                    <span class="w-6 text-center font-black text-gray-500"
                      >{i + 1}</span
                    >
                    {#if user.avatar}
                      <img
                        src={user.avatar}
                        alt={user.handle}
                        class="w-10 h-10 rounded-full border border-gray-700"
                      />
                    {:else}
                      <div
                        class="w-10 h-10 rounded-full bg-gray-800 border border-gray-700"
                      ></div>
                    {/if}
                    <div class="grow min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-white truncate"
                          >{user.displayName || user.handle}</span
                        >
                        {#if user.trending}
                          <span
                            class="px-2 py-0.5 rounded-full bg-orange-500 text-black text-[10px] font-black shrink-0"
                            >🔥 {$t('hot.trending')}</span
                          >
                        {/if}
                      </div>
                      <div class="text-xs text-gray-500 truncate">
                        @{user.handle}
                      </div>
                    </div>
                    <span class="text-green-500 font-bold text-sm whitespace-nowrap"
                      >{$t('hot.users.count', { count: String(user.historyCount) })}</span
                    >
                  </a>
                {/each}
              </div>
              {#if hotUsers.length > hotLimit}
                <div class="flex justify-center mt-8">
                  <button
                    on:click={() => (hotLimit += PAGE_SIZE)}
                    class="px-6 py-2 rounded-full bg-gray-800 text-gray-300 text-sm font-bold hover:bg-gray-700 transition-colors"
                  >
                    {$t('hot.loadmore')}
                  </button>
                </div>
              {/if}
            {:else}
              <div class="text-center py-20 text-gray-500">
                <p>{$t('hot.empty.users')}</p>
              </div>
            {/if}
          {/if}
        </div>
      {:else if activeTab === "discovery"}
        <div class="max-w-2xl mx-auto animate-fade-in pb-20">
          {#if loadingDiscovery}
            <div class="text-center py-20 text-gray-500">
              <Loader2
                class="w-8 h-8 animate-spin mx-auto mb-4 text-green-500"
              />
              <p>{$t('discovery.loading')}</p>
            </div>
          {:else if discoveryTimeline.length > 0}
            <div class="space-y-8">
              {#each discoveryTimeline.slice(0, discoveryLimit) as item (item.uri ?? `${item.type}:${item.indexedAt}`)}
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
                          <span class="text-gray-500">{$t('discovery.listening')}</span>
                        {:else if item.type === "reaction"}
                          <span class="text-gray-500">
                            {$t('discovery.reacted')} <span class="text-lg"
                              >{item.record.emoji}</span
                            >
                          </span>
                        {:else if item.type === "playlist"}
                          <span class="text-gray-500"
                            >{$t('discovery.playlist')}</span
                          >
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
                          id: item.record.trackUri,
                          title: item.record.track,
                          artist: item.record.artist,
                          album: item.record.album,
                          artworkUrl: (item.record.imgBlob?.includes('cid=undefined') ? undefined : item.record.imgBlob) ?? item.record.img,
                          trackUri: item.record.trackUri,
                          spotifyUrl: item.record.links?.spotify,
                          youtubeMusicUrl: item.record.links?.youtube,
                          appleMusicUrl: item.record.links?.appleMusic,
                          comment: item.record.comment,
                          provider: item.record.provider || "itunes",
                        }}
                        postUri={item.record.postUri}
                        isProcessing={processingTrackId ===
                          item.record.trackUri}
                        on:nowPlaying={(e) =>
                          executeNowPlaying(
                            e.detail.track,
                            e.detail.postToBsky,
                          )}
                        on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                        on:reaction={handleDiscoveryReaction}
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
                              (item.record.imgBlob?.includes('cid=undefined') ? undefined : item.record.imgBlob) ?? item.record.img ?? "/placeholder_art.png",
                            spotifyUrl: item.record.links?.spotify,
                            youtubeMusicUrl: item.record.links?.youtube,
                            appleMusicUrl: item.record.links?.appleMusic,
                            provider: item.record.provider || "itunes",
                          }}
                          isProcessing={processingTrackId ===
                            item.record.subjectUri}
                          on:nowPlaying={(e) =>
                            executeNowPlaying(
                              e.detail.track,
                              e.detail.postToBsky,
                            )}
                          on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                          on:reaction={handleDiscoveryReaction}
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
            {#if discoveryTimeline.length > discoveryLimit}
              <div class="flex justify-center mt-8">
                <button
                  on:click={() => (discoveryLimit += PAGE_SIZE)}
                  class="px-6 py-2 rounded-full bg-gray-800 text-gray-300 text-sm font-bold hover:bg-gray-700 transition-colors"
                >
                  {$t('hot.loadmore')}
                </button>
              </div>
            {/if}
          {:else}
            <div class="text-center py-20 text-gray-500">
              <p>{$t('discovery.empty')}</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

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
            <h2 class="text-xl font-bold text-white">{$t('playlist.modal.title')}</h2>
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
                    >{$t('tracks.count', { count: String(pl.value.tracks?.length || 0) })}</span
                  >
                </button>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-gray-500">
              {$t('playlist.modal.empty')}
            </div>
          {/if}
        </div>
      </div>
    {/if}
    <!-- Info Modal -->
    <InfoModal
      bind:show={showInfoModal}
      on:close={() => (showInfoModal = false)}
    />
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

      <!-- Artwork Reel Background -->
      {#await getGlobalTimeline() then timeline}
        {@const artworks = timeline
          .filter((t) => t.type === "history" && (t.record.imgBlob || t.record.img))
          .map((t) => t.record.imgBlob ?? t.record.img)
          .sort(() => Math.random() - 0.5) // Shuffle
          .slice(0, 30)}
        <!-- Limit to 30 items -->

        {#if artworks.length > 0}
          <div
            class="absolute inset-0 flex flex-col justify-center opacity-30 select-none pointer-events-none"
          >
            <!-- Row 1: Left to Right -->
            <div class="flex gap-4 animate-marquee whitespace-nowrap mb-6">
              {#each [...artworks, ...artworks] as art}
                <img
                  src={art.replace("100x100", "600x600")}
                  alt="bg"
                  class="w-48 h-48 object-cover rounded-xl shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                />
              {/each}
            </div>
            <!-- Row 2: Right to Left -->
            <div
              class="flex gap-4 animate-marquee-reverse whitespace-nowrap mb-6"
            >
              {#each [...artworks, ...artworks].reverse() as art}
                <img
                  src={art.replace("100x100", "600x600")}
                  alt="bg"
                  class="w-48 h-48 object-cover rounded-xl shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                />
              {/each}
            </div>
            <!-- Row 3: Left to Right (slower) -->
            <div class="flex gap-4 animate-marquee-slow whitespace-nowrap">
              {#each [...artworks, ...artworks].sort(() => Math.random() - 0.5) as art}
                <img
                  src={art.replace("100x100", "600x600")}
                  alt="bg"
                  class="w-48 h-48 object-cover rounded-xl shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                />
              {/each}
            </div>
          </div>
        {:else}
          <!-- Fallback animated blobs if no data -->
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
        {/if}
      {:catch}
        <!-- Fallback on error -->
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
      {/await}
    </div>

    <!-- Login Card -->
    <div
      class="relative z-20 bg-black/60 backdrop-blur-xl p-10 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl"
    >
      <div class="text-center mb-10">
        <h1
          class="text-4xl sm:text-5xl font-black tracking-tighter text-white mb-2 whitespace-nowrap"
        >
          なうぷれ<span class="text-green-500">あっと</span>
        </h1>
        <p class="text-gray-400 text-lg">Share your vibe on AT protocol.</p>
        <div class="flex justify-center mt-4">
          <LangToggle />
        </div>
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
            <Loader2 class="animate-spin" size={24} /> {$t('redirect')}
          {:else}
            {$t('signin')}
          {/if}
        </button>
      </form>
      <div class="mt-8 text-center text-xs text-gray-500 font-medium">
        Powered by AT protocol, iTunes and Discogs
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

  /* Marquee Animations */
  @keyframes marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
  @keyframes marquee-reverse {
    0% {
      transform: translateX(-50%);
    }
    100% {
      transform: translateX(0);
    }
  }

  .animate-marquee {
    animation: marquee 40s linear infinite;
    width: max-content;
  }
  .animate-marquee-reverse {
    animation: marquee-reverse 50s linear infinite; /* Slightly different speed */
    width: max-content;
  }
  .animate-marquee-slow {
    animation: marquee 60s linear infinite;
    width: max-content;
  }
</style>
