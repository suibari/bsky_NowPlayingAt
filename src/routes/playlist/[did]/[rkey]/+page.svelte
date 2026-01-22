<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { agent, userProfile } from "$lib/stores";
  import { getPlaylist } from "$lib/bsky";
  import { Loader2, GripVertical, Trash2, Play } from "lucide-svelte";

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
</script>

<div class="min-h-screen p-6 max-w-4xl mx-auto">
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
      </p>
    </div>

    <div class="space-y-2">
      {#each tracks as track, index (track.trackUri + index)}
        <div
          class="flex items-center gap-4 bg-gray-900 border border-gray-800 p-3 rounded-lg group transition-colors hover:border-gray-700"
          draggable={isOwner}
          on:dragstart={(e) => handleDragStart(e, index)}
          on:dragover={(e) => handleDragOver(e, index)}
          on:drop={handleDrop}
          role="listitem"
          class:cursor-move={isOwner}
          class:opacity-50={draggingIndex === index}
        >
          {#if isOwner}
            <div class="text-gray-600 cursor-grab active:cursor-grabbing p-1">
              <GripVertical size={20} />
            </div>
          {/if}

          <span class="text-gray-500 font-mono w-6 text-center"
            >{index + 1}</span
          >

          <div
            class="w-12 h-12 bg-gray-800 rounded flex-shrink-0 overflow-hidden relative"
          >
            <img
              src={track.img || track.artworkUrl}
              alt={track.track}
              class="w-full h-full object-cover"
            />
            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center"
            >
              <Play class="text-white fill-white w-4 h-4" />
            </div>
          </div>

          <div class="flex-grow min-w-0">
            <p class="font-bold text-white truncate">{track.track}</p>
            <p class="text-sm text-gray-400 truncate">
              {track.artist} - {track.album}
            </p>
          </div>

          {#if isOwner}
            <button
              on:click={() => removeTrack(index)}
              class="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove track"
            >
              <Trash2 size={18} />
            </button>
          {/if}

          {#if saving}
            <div class="text-xs text-green-500 animate-pulse">Saving...</div>
          {/if}
        </div>
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
</div>
