<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { authState, userProfile } from "$lib/stores";
  import {
    createHistoryRecord,
    postToFeed,
    getPlaylists,
    addToPlaylist,
    getGlobalTimeline,
    getFolloweesFeed,
    getHotContent,
    songKey,
  } from "$lib/bsky";
  import { searchTracks, type Track } from "$lib/music";
  import { resolveArtworkUrl } from "$lib/artwork";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import ActivityCard from "$lib/components/ActivityCard.svelte";
  import PlaylistCard from "$lib/components/PlaylistCard.svelte";
  import InfoModal from "$lib/components/InfoModal.svelte";
  import LangToggle from "$lib/components/LangToggle.svelte";
  import GlobalStats from "$lib/components/GlobalStats.svelte";
  import SignInForm from "$lib/components/SignInForm.svelte";
  import SignInModal from "$lib/components/SignInModal.svelte";
  import { Loader2, Music, X, Plus, Info, LogIn } from "lucide-svelte";
  import { swipe } from "$lib/actions/swipe";
  import { t } from "$lib/i18n";

  // Default to the "everyone" tab so guests (no DID) see content immediately.
  // Once auth resolves, switch to "recommend" unless the user already picked a tab.
  let activeTab: "recommend" | "everyone" | "search" = "everyone";
  let tabManuallySet = false;
  let showSignInModal = false;
  let everyoneTab: "realtime" | "tracks" | "playlists" | "users" = "realtime";

  // Data State
  let recommendFeed: any[] = [];
  let hotTracks: any[] = [];
  let hotPlaylists: any[] = [];
  let hotUsers: any[] = [];
  let discoveryTimeline: any[] = [];

  // Display limits ("load more" pagination so we don't render hundreds of nodes)
  const PAGE_SIZE = 20;
  let recommendLimit = PAGE_SIZE;
  let hotLimit = PAGE_SIZE;
  let discoveryLimit = PAGE_SIZE;

  let loadingRecommend = true;
  let recommendLoaded = false;
  let loadingHot = true;
  let loadingDiscovery = true;
  let showSettingsBanner = false;
  let bannerChecked = false;

  onMount(() => {
    // Start background fetches
    loadHotContent();
    loadDiscoveryContent();
  });

  // Recommend feed needs the signed-in user's DID, which may not be ready at
  // mount time — load it once the profile resolves.
  $: if ($userProfile?.did && !recommendLoaded) {
    recommendLoaded = true;
    loadRecommendFeed($userProfile.did);
  }

  // Once auth confirms a signed-in user, default them to the recommend tab
  // (unless they already switched tabs themselves).
  $: if ($authState.isAuthenticated && !tabManuallySet) {
    activeTab = "recommend";
  }

  function selectTab(tab: "recommend" | "everyone" | "search") {
    tabManuallySet = true;
    activeTab = tab;
  }

  function setEveryoneTab(tab: "realtime" | "tracks" | "playlists" | "users") {
    everyoneTab = tab;
    hotLimit = PAGE_SIZE; // reset pagination when switching sub-tab
    discoveryLimit = PAGE_SIZE;
  }

  function goHome() {
    activeTab = $authState.isAuthenticated ? "recommend" : "everyone";
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
      // 1. Try to load from KV cache first for immediate display
      const cacheRes = await fetch("/api/hot").catch(() => null);
      if (cacheRes && cacheRes.ok) {
        const { data, stale } = await cacheRes.json();
        if (data && !stale) {
          hotTracks = data.tracks;
          hotPlaylists = data.playlists;
          hotUsers = data.users;
          loadingHot = false; // Show cached UI immediately
        }
      }
    } catch (e) {
      console.error("Failed to load hot cache", e);
    }

    // 2. Fetch fresh data in the background (fire and forget)
    getHotContent().then((data) => {
      hotTracks = data.tracks;
      hotPlaylists = data.playlists;
      hotUsers = data.users;
      loadingHot = false; // Turn off spinner if cache wasn't available
    }).catch(e => {
      console.error("Failed to load fresh hot content", e);
      loadingHot = false;
    });
  }

  async function loadRecommendFeed(did: string) {
    loadingRecommend = true;
    try {
      recommendFeed = await getFolloweesFeed(did);
    } catch (e) {
      console.error("Failed to load recommend feed", e);
    } finally {
      loadingRecommend = false;
    }
  }

  async function loadDiscoveryContent() {
    loadingDiscovery = true;
    try {
      // 1. Try to load from KV cache first for immediate display
      const cacheRes = await fetch("/api/timeline").catch(() => null);
      if (cacheRes && cacheRes.ok) {
        const { data, stale } = await cacheRes.json();
        if (data && !stale) {
          discoveryTimeline = mergeTimeline(data);
          loadingDiscovery = false; // Show cached UI immediately
        }
      }
    } catch (e) {
      console.error("Failed to load discovery cache", e);
    }

    // 2. Fetch fresh data in the background
    getGlobalTimeline().then((items) => {
      discoveryTimeline = mergeTimeline(items);
      loadingDiscovery = false;
    }).catch(e => {
      console.error("Failed to load fresh discovery content", e);
      loadingDiscovery = false;
    });
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
  // historyUri: AT-URI of the nowplayingat history record (used as item key for dedup).
  // postUri: AT-URI of the Bluesky post, if the user also posted to Bluesky.
  function reflectHistoryToDiscovery(track: Track, imgBlob?: string, historyUri?: string, postUri?: string) {
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
        postUri,
      },
      uri: historyUri ?? `optimistic:history:${track.trackUri}:${Date.now()}`,
      indexedAt: new Date().toISOString(),
    });
  }

  // Reflect the current user's just-now reaction into Discover (no reload).
  function handleDiscoveryReaction(e: CustomEvent) {
    const me = get(userProfile);
    const track = e.detail?.track;
    const emoji = e.detail?.emoji;
    if (!me || !track || !emoji) return;
    const historyUri = e.detail?.historyUri;
    const subjectUri = historyUri || track.trackUri || songKey(track.artist, track.title);
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
  let processingItemUri: string | null = null;

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

        // 1. Post to Feed (blob upload happens here, get post URI back)
        const { uri: bskyPostUri } = await postToFeed(track, track.comment);

        // 2. Write to History (PDS) with postUri so Bluesky likes can be aggregated later.
        const histRes = await createHistoryRecord(track, undefined, bskyPostUri);

        reflectHistoryToDiscovery(track, undefined, histRes.uri, bskyPostUri);
        alert(get(t)('alert.posted'));
      } else {
        // No confirmation dialog when just saving to history
        const histRes = await createHistoryRecord(track);

        reflectHistoryToDiscovery(track, undefined, histRes.uri);
        alert(get(t)('alert.history'));
      }
    } catch (e) {
      console.error(e);
      alert(get(t)('alert.failed') + e);
    } finally {
      processingTrackId = null;
      processingItemUri = null;
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
    if (activeTab === "recommend") {
      selectTab("everyone");
    } else if (activeTab === "everyone") {
      selectTab("search");
    }
  }

  function handleSwipeRight() {
    if (activeTab === "search") {
      selectTab("everyone");
    } else if (activeTab === "everyone" && $authState.isAuthenticated) {
      // Guests have no recommend tab — keep them on "everyone".
      selectTab("recommend");
    }
  }
</script>

{#if $authState.isLoading}
  <div class="flex items-center justify-center h-screen bg-black text-white">
    <Loader2 class="w-8 h-8 animate-spin text-green-500" />
  </div>
{:else}
  <!-- UNIFIED VIEW (auth + guest share the same layout) -->
  <div class="max-w-6xl mx-auto p-6 min-h-screen">
    <!-- Header (full width, above both columns) -->
    <div
      class="topbar-layout sticky top-0 bg-black/95 backdrop-blur-md z-20 border-b border-gray-800/50"
    >
      <button
        on:click={goHome}
        class="flex flex-col items-center hover:opacity-80 transition-opacity group"
        title="ホーム"
      >
        <div class="text-3xl font-black text-white tracking-tighter leading-none group-hover:underline decoration-green-500 underline-offset-4">
          なうぷれ<span class="text-green-500">あっと</span>
        </div>
        <div class="text-[10px] text-gray-400 font-bold tracking-widest mt-1 uppercase">#NowPlaying on ATprotocol</div>
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

        {#if $authState.isAuthenticated}
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
        {:else}
          <!-- Sign-in button (opens modal; the PC right pane has the inline form) -->
          <button
            on:click={() => (showSignInModal = true)}
            class="lg:hidden flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-4 py-2 rounded-full transition-colors"
          >
            <LogIn size={18} />
            <span class="hidden sm:inline">{$t('signin')}</span>
          </button>
        {/if}

        <!-- Language switcher (guests only, top-right; hidden on mobile) -->
        {#if !$authState.isAuthenticated}
          <div class="hidden lg:block">
            <LangToggle />
          </div>
        {/if}
      </div>
    </div>

    <!-- Below topbar: central pane + right pane -->
    <div class="flex gap-8 mt-2">
    <main class="flex-1 min-w-0">

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
        {#if $authState.isAuthenticated}
          <button
            on:click={() => selectTab("recommend")}
            class="flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all {activeTab ===
            'recommend'
              ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
              : 'text-gray-400 hover:text-white'}"
          >
            {$t('tab.recommend')}
          </button>
        {/if}
        <button
          on:click={() => selectTab("everyone")}
          class="flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all {activeTab ===
          'everyone'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          {$t('tab.discovery')}
        </button>
        <button
          on:click={() => selectTab("search")}
          class="flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all {activeTab ===
          'search'
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
            : 'text-gray-400 hover:text-white'}"
        >
          {$t('tab.search')}
        </button>
      </div>
    </div>

    <div
      use:swipe
      on:swipeLeft={handleSwipeLeft}
      on:swipeRight={handleSwipeRight}
      class="min-h-[50vh] touch-pan-y"
    >
      {#if activeTab === "recommend"}
        <!-- RECOMMEND SECTION (followees' plays, randomized) -->
        <div class="max-w-4xl mx-auto animate-fade-in pb-20">
          {#if loadingRecommend}
            <div class="text-center py-20 text-gray-500">
              <Loader2
                class="w-8 h-8 animate-spin mx-auto mb-4 text-green-500"
              />
              <p>{$t('recommend.loading')}</p>
            </div>
          {:else if recommendFeed.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {#each recommendFeed.slice(0, recommendLimit) as item (item.uri ?? `${item.type}:${item.indexedAt}`)}
                <ActivityCard
                  {item}
                  {processingItemUri}
                  on:nowPlaying={(e) => {
                    processingItemUri = e.detail.itemUri ?? null;
                    executeNowPlaying(e.detail.track, e.detail.postToBsky);
                  }}
                  on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                  on:reaction={handleDiscoveryReaction}
                />
              {/each}
            </div>
            {#if recommendFeed.length > recommendLimit}
              <div class="flex justify-center mt-8">
                <button
                  on:click={() => (recommendLimit += PAGE_SIZE)}
                  class="px-6 py-2 rounded-full bg-gray-800 text-gray-300 text-sm font-bold hover:bg-gray-700 transition-colors"
                >
                  {$t('hot.loadmore')}
                </button>
              </div>
            {/if}
          {:else}
            <div class="text-center py-20 text-gray-500">
              <Music size={48} class="mx-auto mb-4 opacity-30" />
              <p>{$t('recommend.empty')}</p>
            </div>
          {/if}
        </div>
      {:else if activeTab === "search"}
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
      {:else if activeTab === "everyone"}
        <!-- EVERYONE'S NOWPLAYING (realtime + chart) -->
        <div class="max-w-4xl mx-auto animate-fade-in pb-20">
          <!-- Sub Tabs -->
          <div class="flex justify-center mb-8 max-w-full">
            <div
              class="flex flex-nowrap overflow-x-auto justify-start sm:justify-center bg-black/40 border border-gray-800 rounded-lg p-1 max-w-full scrollbar-none"
            >
              <button
                on:click={() => setEveryoneTab("realtime")}
                class="px-3 sm:px-5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 transition-all {everyoneTab ===
                'realtime'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('everyone.realtime')}
              </button>
              <button
                on:click={() => setEveryoneTab("tracks")}
                class="px-3 sm:px-5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 transition-all {everyoneTab ===
                'tracks'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('hot.toptracks')}
              </button>
              <button
                on:click={() => setEveryoneTab("playlists")}
                class="px-3 sm:px-5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 transition-all {everyoneTab ===
                'playlists'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('hot.topplaylists')}
              </button>
              <button
                on:click={() => setEveryoneTab("users")}
                class="px-3 sm:px-5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 transition-all {everyoneTab ===
                'users'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'}"
              >
                {$t('hot.topusers')}
              </button>
            </div>
          </div>

          {#if everyoneTab === "realtime"}
            <!-- REALTIME (= former everyone's nowplaying timeline) -->
            {#if loadingDiscovery}
              <div class="text-center py-20 text-gray-500">
                <Loader2
                  class="w-8 h-8 animate-spin mx-auto mb-4 text-green-500"
                />
                <p>{$t('discovery.loading')}</p>
              </div>
            {:else if discoveryTimeline.length > 0}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {#each discoveryTimeline.slice(0, discoveryLimit) as item (item.uri ?? `${item.type}:${item.indexedAt}`)}
                  <ActivityCard
                    {item}
                    {processingItemUri}
                    on:nowPlaying={(e) => {
                      processingItemUri = e.detail.itemUri ?? null;
                      executeNowPlaying(e.detail.track, e.detail.postToBsky);
                    }}
                    on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
                    on:reaction={handleDiscoveryReaction}
                  />
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
          {:else if loadingHot}
            <div class="text-center py-20 text-gray-500">
              <Loader2
                class="w-8 h-8 animate-spin mx-auto mb-4 text-green-500"
              />
              <p>{$t('hot.loading')}</p>
            </div>
          {:else if everyoneTab === "tracks"}
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
                        artworkUrl: resolveArtworkUrl(track.imgBlob, track.img),
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
          {:else if everyoneTab === "playlists"}
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
    </main>

    <!-- Right pane (PC only) -->
    <aside class="hidden lg:block w-80 shrink-0">
      <div class="sticky top-6 space-y-6">
        {#if !$authState.isAuthenticated}
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <LogIn size={20} class="text-green-500" />
              {$t('signin.modal.title')}
            </h2>
            <SignInForm />
          </div>
        {/if}
        <GlobalStats />
      </div>
    </aside>
    </div>
  </div>
{/if}

<!-- Info Modal -->
<InfoModal
  bind:show={showInfoModal}
  on:close={() => (showInfoModal = false)}
/>

<!-- Sign-in Modal (mobile guests) -->
<SignInModal
  bind:show={showSignInModal}
  on:close={() => (showSignInModal = false)}
/>

<style>
  .scrollbar-none {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;  /* Chrome, Safari and Opera */
  }

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
