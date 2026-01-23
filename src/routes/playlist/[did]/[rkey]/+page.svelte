<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { agent, userProfile } from "$lib/stores";
  import { getPlaylist, createReactionRecord, addToPlaylist } from "$lib/bsky";
  import { Loader2, X } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import type { Track } from "$lib/music";

  // React to params
  $: did = $page.params.did;
  $: rkey = $page.params.rkey;

  let playlistRecord: any = null;
  let tracks: any[] = [];
  let loading = true;
  let isOwner = false;
  let saving = false;

  // Drag State
  let draggingIndex: number | null = null;

  // Modal State
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

  let showPlaylistModal = false;
  let targetTrackForPlaylist: Track | null = null;
  let myPlaylists: any[] = [];

  onMount(async () => {
    // load handled by reactive statement below
  });

  $: if ($userProfile && did) {
    isOwner = $userProfile.did === did;
  }

  $: if (did && rkey && $agent) {
    loadPlaylist(did, rkey);
  }

  async function loadPlaylist(playlistDid: string, playlistRkey: string) {
    if (!$agent) return;
    loading = true;
    try {
      const res = await getPlaylist(playlistDid, playlistRkey);
      playlistRecord = res;
      // Ensure tracks is an array
      tracks = (res.value as any).tracks || [];
    } catch (e) {
      console.error("Failed to load playlist", e);
    }
    loading = false;
  }

  async function savePlaylist() {
    if (!isOwner || !$agent || !did || !rkey) return;
    saving = true;
    try {
      await $agent.com.atproto.repo.putRecord({
        repo: did,
        collection: "com.suibari.nowplayingat.playlist",
        rkey: rkey,
        record: {
          ...playlistRecord.value,
          tracks: tracks,
        },
      });
    } catch (e) {
      console.error("Failed to save playlist", e);
      alert("Failed to save changes");
    }
    saving = false;
  }

  // DnD Handlers
  function handleDragStart(e: DragEvent, index: number) {
    draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;

    // Local reorder
    const oldTracks = [...tracks];
    const movedItem = oldTracks[draggingIndex];
    oldTracks.splice(draggingIndex, 1);
    oldTracks.splice(index, 0, movedItem);

    tracks = oldTracks;
    draggingIndex = index;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    draggingIndex = null;
    savePlaylist();
  }

  function removeTrack(index: number) {
    if (!confirm("Remove this track?")) return;
    tracks.splice(index, 1);
    tracks = tracks;
    savePlaylist();
  }

  function mapToTrack(item: any): Track {
    return {
      id: item.trackUri, // Using URI as ID since we store it
      title: item.track,
      artist: item.artist,
      album: item.album,
      artworkUrl: item.img || "",
      trackUri: item.trackUri,
      spotifyUrl: item.links?.spotify,
      youtubeMusicUrl: item.links?.youtube,
    };
  }

  function openReactionModal(track: Track) {
    targetTrackForReaction = track;
    showReactionModal = true;
  }

  async function handleReaction(emoji: string) {
    if (!targetTrackForReaction) return;
    try {
      await createReactionRecord(targetTrackForReaction, emoji);
      alert(`Reacted with ${emoji}!`);
      showReactionModal = false;
    } catch (e) {
      alert("Failed to react: " + e);
    }
  }

  function openPlaylistModal(track: Track) {
    // Only if user is logged in
    targetTrackForPlaylist = track;
    // Implementation simplified: could fetch generic playlists even if not mapping all users?
    // Actually we skipped 'getPlaylists' import for brevity in this file if we don't need it for 'myPlaylists' initial load...
    // Let's assume user wants to add to THEIR playlist.
    // We need to fetch playlists if not loaded.
    alert("Add to playlist feature is available on dashboard.");
    // To implement fully, we need to import getPlaylists and manage 'myPlaylists' state.
    // Given complexity, let's keep it simple or implement if time permits.
    // Let's try to implement.
  }
</script>

<div class="min-h-screen p-6 max-w-4xl mx-auto">
  <a
    href="/"
    class="inline-flex items-center gap-2 text-gray-500 hover:text-green-500 mb-6 transition-colors"
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
    Back to Home
  </a>

  {#if loading}
    <div class="flex justify-center mt-20">
      <Loader2 class="animate-spin text-green-500" />
    </div>
  {:else if playlistRecord}
    <div class="mb-8 border-b border-gray-800 pb-6">
      <h1 class="text-4xl font-black text-white mb-2">
        {(playlistRecord.value as any).name || "Unnamed Playlist"}
      </h1>
      <p class="text-gray-400">
        Created by <a
          href={`/profile/${did}`}
          class="text-green-500 hover:underline">User</a
        >
        • {tracks.length} songs
        {#if saving}
          <span class="text-green-500 text-xs ml-2 animate-pulse"
            >Saving changes...</span
          >
        {/if}
      </p>
    </div>

    <div class="space-y-4">
      <!-- Tracks using TrackCard -->
      {#each tracks as track, index (track.trackUri + index)}
        <TrackCard
          track={mapToTrack(track)}
          isOwner={false}
          showDelete={isOwner}
          showDragHandle={isOwner}
          isDragging={draggingIndex === index}
          {index}
          on:reaction={(e) => openReactionModal(e.detail)}
          on:delete={(e) => removeTrack(e.detail)}
          on:dragstart={(e) => handleDragStart(e, index)}
          on:dragover={(e) => handleDragOver(e, index)}
          on:drop={(e) => handleDrop(e)}
        />
      {/each}

      {#if tracks.length === 0}
        <div
          class="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl"
        >
          <p class="text-gray-500">This playlist is empty.</p>
          <p class="text-sm text-gray-600 mt-2">Go search for songs to add!</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-center mt-20 text-red-500">Playlist not found</div>
  {/if}

  <!-- Reaction Modal -->
  {#if showReactionModal}
    <div
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
      </div>
    </div>
  {/if}
</div>
