<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { agent, userProfile } from "$lib/stores";
  import {
    getHistory,
    getPlaylists,
    createPlaylist,
    createReactionRecord,
    addToPlaylist,
    deleteHistoryRecord,
  } from "$lib/bsky";
  import { Loader2, Music, Disc, Plus, X, Settings } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import type { Track } from "$lib/music";
  import type {
    HistoryRecord,
    PlaylistRecord,
    Track as SchemaTrack,
  } from "$lib/schema";
  import { publicAgent } from "$lib/atproto";

  // $page.params is reactive but derived, so we react to it.
  $: did = $page.params.did;

  // Check ownership
  $: isOwner = $userProfile?.did === did;

  let profile: any = null;
  let history: { uri: string; value: HistoryRecord }[] = [];
  let playlists: { uri: string; cid: string; value: PlaylistRecord }[] = [];
  let loading = true;
  let activeTab = "playlists"; // 'playlists' | 'history'

  // Playlist Modal State (For 'Add to Playlist' from History)
  let showPlaylistModal = false;
  let targetTrackForPlaylist: Track | null = null;
  let myPlaylists: { uri: string; cid: string; value: PlaylistRecord }[] = [];

  onMount(async () => {
    // loadData handled by reactivity below
  });

  $: if ($agent && did) {
    loadData(did);
  }

  async function loadData(actorDid: string) {
    if (!$agent || !actorDid) return;
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
      history = hRes;
    } catch (e) {
      console.error("Failed to load profile data", e);
    }
    loading = false;
  }

  async function handleCreatePlaylist() {
    const name = prompt("プレイリスト名を入力してください:");
    if (!name) return;

    try {
      await createPlaylist(name);
      // Refresh playlists
      playlists = await getPlaylists(did!);
      alert("プレイリストを作成しました！");
    } catch (e) {
      alert("作成に失敗しました: " + e);
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
      title: val.track,
      artist: val.artist,
      album: val.album,
      artworkUrl: val.img || "", // Fallback handled by Card
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
      alert(`"${playlist.value.name}" に追加しました！`);
      showPlaylistModal = false;
    } catch (e) {
      alert("追加に失敗しました: " + e);
    }
  }

  async function handleDeleteHistory(idx: number) {
    if (!confirm("再生履歴から削除しますか？")) return;
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
      alert("再生履歴の削除に失敗しました");
      history = oldHistory; // Revert
    }
  }
</script>

<div class="min-h-screen p-6 max-w-4xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <a
      href="/"
      class="inline-flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors"
    >
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
        ><line x1="19" y1="12" x2="5" y2="12" /><polyline
          points="12 19 5 12 12 5"
        /></svg
      >
      ホームに戻る
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

  {#if loading}
    <div class="flex justify-center mt-20">
      <Loader2 class="animate-spin text-green-500" />
    </div>
  {:else if profile}
    <!-- Profile Header -->
    <div class="mb-8 flex items-center gap-6">
      {#if profile.avatar}
        <img
          src={profile.avatar}
          alt={profile.handle}
          class="w-24 h-24 rounded-full border-2 border-gray-700 shadow-xl"
        />
      {/if}
      <div>
        <h1 class="text-3xl font-bold text-white mb-1">
          {profile.displayName || profile.handle}
        </h1>
        <p class="text-gray-400">@{profile.handle}</p>
        <p class="text-gray-500 text-sm mt-2">{profile.description || ""}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 border-b border-gray-800 mb-6">
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'playlists'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "playlists")}
      >
        プレイリスト
      </button>
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'history'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "history")}
      >
        履歴
      </button>
    </div>

    <!-- Content -->
    <div>
      {#if activeTab === "playlists"}
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
                >新規プレイリスト作成</span
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
                  >{pl.value.tracks?.length || 0} 曲</span
                >
              </div>
              <div class="text-xs text-gray-400 truncate">
                {pl.value.tracks?.map((t: SchemaTrack) => t.track).join(", ") ||
                  "空のプレイリスト"}
              </div>
            </a>
          {/each}
          {#if playlists.length === 0 && !isOwner}
            <p class="text-gray-500 italic">プレイリストが見つかりません。</p>
          {/if}
        </div>
      {:else}
        <!-- HISTORY LIST -->
        <div class="space-y-4">
          {#each history as item, i}
            <TrackCard
              track={mapHistoryToTrack(item)}
              showDelete={isOwner}
              index={i}
              on:addToPlaylist={(e) => openPlaylistModal(e.detail)}
              on:delete={(e) => handleDeleteHistory(e.detail)}
            />
          {/each}
          {#if history.length === 0}
            <p class="text-gray-500 italic">履歴がまだありません。</p>
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
          <h2 class="text-xl font-bold text-white">プレイリストに追加</h2>
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
                  >{pl.value.tracks?.length || 0} 曲</span
                >
              </button>
            {/each}
          </div>
        {:else}
          <div class="text-center text-gray-500 py-6">
            プレイリストが見つかりません。
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
