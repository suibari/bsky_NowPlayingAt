<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { agent, userProfile, authState } from "$lib/stores";
  import {
    getHistory,
    getPlaylists,
    createPlaylist,
    createReactionRecord,
    addToPlaylist,
    deleteHistoryRecord,
  } from "$lib/bsky";
  import { Loader2, Music, Disc, Plus, X, Settings, BarChart3 } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import ReportTab from "$lib/components/ReportTab.svelte";
  import { resolveArtworkUrl } from "$lib/artwork";
  import type { Track } from "$lib/music";
  import type {
    HistoryRecord,
    PlaylistRecord,
    Track as SchemaTrack,
  } from "$lib/schema";
  import { publicAgent } from "$lib/atproto";
  import { get } from "svelte/store";
  import { t } from "$lib/i18n";

  // $page.params is reactive but derived, so we react to it.
  $: did = $page.params.did;

  // Check ownership
  $: isOwner = $userProfile?.did === did;

  let profile: any = null;
  let history: { uri: string; value: HistoryRecord }[] = [];
  let playlists: { uri: string; cid: string; value: PlaylistRecord }[] = [];
  let historyCursor: string | undefined = undefined;
  let loadingMoreHistory = false;
  let loading = true;
  let activeTab = "report"; // 'report' | 'history' | 'playlists'

  // Playlist Modal State (For 'Add to Playlist' from History)
  let showPlaylistModal = false;
  let targetTrackForPlaylist: Track | null = null;
  let myPlaylists: { uri: string; cid: string; value: PlaylistRecord }[] = [];

  onMount(async () => {
    // loadData handled by reactivity below
  });

  $: if (did) {
    loadData(did);
  }

  async function loadData(actorDid: string) {
    if (!actorDid) return;
    loading = true;
    try {
      // 1. Get Profile
      const pRes = await publicAgent.getProfile({ actor: actorDid });
      profile = pRes.data;

      // 2. Get Playlists
      const plRes = await getPlaylists(actorDid);
      playlists = plRes;

      // 3. Get History
      const hRes = await getHistory(actorDid);
      history = hRes.records;
      historyCursor = hRes.cursor;
    } catch (e) {
      console.error("Failed to load profile data", e);
    }
    loading = false;
  }

  async function loadMoreHistory() {
    if (!did || !historyCursor || loadingMoreHistory) return;
    loadingMoreHistory = true;
    try {
      const hRes = await getHistory(did, historyCursor);
      history = [...history, ...hRes.records];
      historyCursor = hRes.cursor;
    } catch (e) {
      console.error("Failed to load more history", e);
    }
    loadingMoreHistory = false;
  }

  async function handleCreatePlaylist() {
    const name = prompt(get(t)('profile.playlist.prompt'));
    if (!name) return;

    try {
      await createPlaylist(name);
      // Refresh playlists
      playlists = await getPlaylists(did!);
      alert(get(t)('profile.playlist.created'));
    } catch (e) {
      alert(get(t)('profile.playlist.createfailed') + e);
    }
  }

  // --- Handlers for TrackCard ---

  function mapHistoryToTrack(item: {
    uri: string;
    value: HistoryRecord;
  }): Track {
    const val = item.value;
    return {
      id: val.trackUri, // Using URI as ID since we store it
      // @ts-ignore
      provider: val.provider || "itunes",
      title: val.track,
      artist: val.artist,
      album: val.album,
      artworkUrl: resolveArtworkUrl(val.imgBlob, val.img, did),
      trackUri: val.trackUri,
      spotifyUrl: val.links?.spotify,
      youtubeMusicUrl: val.links?.youtube,
      comment: val.comment,
    };
  }

  // Playlist Add Logic (from History)
  async function openPlaylistModal(track: Track) {
    if (!$userProfile) return;
    targetTrackForPlaylist = track;
    showPlaylistModal = true;
    try {
      if (isOwner && playlists.length > 0) {
        myPlaylists = playlists; // Reuse loaded if owner
      } else {
        myPlaylists = await getPlaylists($userProfile.did);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddToPlaylist(playlist: {
    uri: string;
    cid: string;
    value: PlaylistRecord;
  }) {
    if (!targetTrackForPlaylist) return;
    try {
      await addToPlaylist(playlist.uri, targetTrackForPlaylist, playlist);
      alert(get(t)('alert.addedto', { name: playlist.value.name }));
      showPlaylistModal = false;
    } catch (e) {
      alert(get(t)('alert.addfailed') + e);
    }
  }

  async function handleDeleteHistory(idx: number) {
    if (!confirm(get(t)('profile.history.delete.confirm'))) return;
    const item = history[idx];
    if (!item) return;

    // Optimistic update
    const oldHistory = [...history];
    history = history.filter((_, i) => i !== idx);

    try {
      const rkey = item.uri.split("/").pop();
      if (rkey) {
        await deleteHistoryRecord(rkey);
      }
    } catch (e) {
      console.error(e);
      alert(get(t)('profile.history.delete.failed'));
      history = oldHistory; // Revert
    }
  }
</script>

<div class="min-h-screen p-6 max-w-4xl mx-auto">
  <div class="topbar-layout">
    <a
      href="/"
      class="flex flex-col items-center hover:opacity-80 transition-opacity group"
    >
      <div class="inline-block text-3xl font-black tracking-tighter leading-none group-hover:underline decoration-green-500 underline-offset-4">
        <span class="text-white">なうぷれ</span><span class="text-green-500">あっと</span>
      </div>
      <div class="text-[10px] text-gray-400 font-bold tracking-widest mt-1 uppercase">#NowPlaying on ATprotocol</div>
    </a>

    {#if isOwner}
      <a
        href="/settings"
        class="text-gray-400 hover:text-white transition-colors p-2"
        title="Settings"
      >
        <Settings size={20} />
      </a>
    {/if}
  </div>

  {#if !$authState.isAuthenticated}
    <a
      href="/"
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

  {#if loading}
    <div class="flex justify-center mt-20">
      <Loader2 class="animate-spin text-green-500" />
    </div>
  {:else if profile}
    <!-- Profile Header -->
    <div class="mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
      {#if profile.avatar}
        <a
          href="https://bsky.app/profile/{profile.handle}"
          target="_blank"
          rel="noopener noreferrer"
          title="@{profile.handle} on Bluesky"
          class="shrink-0"
        >
          <img
            src={profile.avatar}
            alt={profile.handle}
            class="w-24 h-24 rounded-full border-2 border-gray-700 shadow-xl hover:opacity-80 transition-opacity cursor-pointer"
          />
        </a>
      {/if}
      <div class="min-w-0">
        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-1 wrap-break-word">
          {profile.displayName || profile.handle}
        </h1>
        <p class="text-gray-400 break-all">@{profile.handle}</p>
        <p class="text-gray-500 text-sm mt-2">{profile.description || ""}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 border-b border-gray-800 mb-6">
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'report'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "report")}
      >
        {$t('profile.tab.report')}
      </button>
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'history'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "history")}
      >
        {$t('profile.tab.history')}
      </button>
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'playlists'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "playlists")}
      >
        {$t('profile.tab.playlists')}
      </button>
    </div>

    <!-- Content -->
    <div>
      {#if activeTab === "report"}
        <ReportTab {did} />
      {:else if activeTab === "playlists"}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Create New Card (Owner Only) -->
          {#if isOwner}
            <button
              on:click={handleCreatePlaylist}
              class="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-800 hover:border-green-500 hover:bg-gray-900 transition-all group h-full min-h-[120px]"
            >
              <Plus
                class="text-gray-500 group-hover:text-green-500 mb-2 transition-colors"
                size={32}
              />
              <span class="text-gray-500 group-hover:text-white font-medium"
                >{$t('profile.playlist.new')}</span
              >
            </button>
          {/if}

          {#each playlists as pl}
            <a
              href={`/playlist/${did}/${pl.uri.split("/").pop()}`}
              class="block bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-green-500/50 hover:bg-gray-800 transition-all group"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Disc
                    class="text-green-500 group-hover:rotate-12 transition-transform"
                  />
                  <h3 class="font-bold text-lg text-white">{pl.value.name}</h3>
                </div>
                <span class="text-xs text-gray-500"
                  >{$t('tracks.count', { count: String(pl.value.tracks?.length || 0) })}</span
                >
              </div>
              <div class="text-xs text-gray-400 truncate">
                {pl.value.tracks?.map((trk: SchemaTrack) => trk.track).join(", ") ||
                  $t('profile.playlist.empty')}
              </div>
            </a>
          {/each}
          {#if playlists.length === 0 && !isOwner}
            <p class="text-gray-500 italic">{$t('profile.playlist.notfound')}</p>
          {/if}
        </div>
      {:else}
        <!-- HISTORY LIST -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {#each history as item, i}
            <TrackCard
              variant="square"
              track={mapHistoryToTrack(item)}
              postUri={item.value.postUri}
              showDelete={isOwner}
              index={i}
              on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
              on:delete={(e) => handleDeleteHistory(e.detail)}
            />
          {/each}
          {#if history.length === 0}
            <p class="text-gray-500 italic col-span-full">{$t('profile.history.empty')}</p>
          {:else if historyCursor}
            <div class="flex justify-center pt-4 col-span-full">
              <button
                on:click={loadMoreHistory}
                disabled={loadingMoreHistory}
                class="px-6 py-2 rounded-full bg-gray-800 text-gray-300 text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {#if loadingMoreHistory}
                  <span class="inline-flex items-center gap-2">
                    <Loader2 class="w-4 h-4 animate-spin" />
                    {$t('hot.loading')}
                  </span>
                {:else}
                  {$t('hot.loadmore')}
                {/if}
              </button>
            </div>
          {/if}
        </div>
      {/if}
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
          <h2 class="text-xl font-bold text-white">{$t('playlist.modal.title')}</h2>
          <button
            on:click={() => (showPlaylistModal = false)}
            class="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        {#if myPlaylists.length > 0}
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
          <div class="text-center text-gray-500 py-6">
            {$t('profile.playlist.modal.empty')}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
