<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { publicAgent } from "$lib/atproto";
  import { RichText } from "@atproto/api";
  import { agent, userProfile } from "$lib/stores";
  import { getPlaylist, addToPlaylist, deletePlaylist } from "$lib/bsky";
  import { Loader2, X, Share2, Trash2 } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import ReactionBar from "$lib/components/ReactionBar.svelte";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { generatePlaylistThumbnail } from "$lib/thumbnail";
  import type { Track } from "$lib/music";

  const flipDurationMs = 300;

  // React to params
  $: did = $page.params.did;
  $: rkey = $page.params.rkey;

  let playlistRecord: any = null;
  let authorProfile: any = null;
  let tracks: any[] = [];
  let loading = true;
  let isOwner = false;
  let saving = false;

  // Share Modal State
  let showShareModal = false;
  let shareText = "";
  let sharing = false;
  let shareStatus = ""; // To show detailed status "Generating image...", "Uploading...", etc.

  // Drag State (Handled by dndzone)

  async function handleShare() {
    if (!$agent) {
      alert("Please sign in to share.");
      return;
    }
    sharing = true;
    shareStatus = "Generating thumbnail...";

    try {
      const playlistName = (playlistRecord.value as any).name;
      const authorName = authorProfile.displayName || authorProfile.handle;

      // Generate Thumbnail
      let thumbBlob = undefined;
      try {
        const mappedTracks = tracks.map(mapToTrack);
        const blob = await generatePlaylistThumbnail(mappedTracks);
        if (blob) {
          shareStatus = "Uploading image...";
          const uploadRes = await $agent.uploadBlob(blob, {
            encoding: "image/jpeg",
          });
          thumbBlob = uploadRes.data.blob;
        }
      } catch (e) {
        console.warn(
          "Thumbnail generation/upload failed, proceeding without it",
          e,
        );
      }

      shareStatus = "Posting...";
      const rt = new RichText({ text: shareText });
      await rt.detectFacets($agent);

      const embed: any = {
        $type: "app.bsky.embed.external",
        external: {
          uri: window.location.href,
          title: playlistName,
          description: `Playlist created by ${authorName} on なうぷれあっと`,
        },
      };

      if (thumbBlob) {
        embed.external.thumb = thumbBlob;
      }

      await $agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: embed,
        createdAt: new Date().toISOString(),
        langs: ["ja"],
      });

      alert("Shared to Bluesky!");
      showShareModal = false;
    } catch (e) {
      console.error("Failed to share:", e);
      alert("Failed to share: " + e);
    }
    sharing = false;
    shareStatus = "";
  }

  // Playlist Modal State (Add to OTHER playlist)
  let showPlaylistModal = false;
  let targetTrackForPlaylist: Track | null = null;
  let myPlaylists: any[] = [];

  onMount(async () => {
    // load handled by reactive statement below
  });

  $: if ($userProfile && did) {
    isOwner = $userProfile.did === did;
  }

  $: if (did && rkey) {
    loadPlaylist(did, rkey);
  }

  async function loadPlaylist(playlistDid: string, playlistRkey: string) {
    // if (!$agent) return; // Allow public access
    loading = true;
    try {
      const [res, profileRes] = await Promise.all([
        getPlaylist(playlistDid, playlistRkey),
        publicAgent.getProfile({ actor: playlistDid }),
      ]);

      playlistRecord = res;
      authorProfile = profileRes.data;

      // Ensure tracks is an array and has IDs for dnd
      tracks = ((res.value as any).tracks || []).map((t: any) => ({
        ...t,
        id: t.trackUri + Math.random().toString(36).substring(7), // Ensure unique ID
      }));
    } catch (e) {
      console.error("Failed to load playlist", e);
    }
    loading = false;
  }

  function openShareModal() {
    if (!playlistRecord || !authorProfile) return;
    const playlistName = (playlistRecord.value as any).name;
    const authorName = authorProfile.displayName || authorProfile.handle;
    // URL will be in the embed, not the text
    shareText = `Check out this playlist: "${playlistName}" by ${authorName} 🎵\n\n#なうぷれあっと`;
    showShareModal = true;
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

  function handleDndConsider(e: CustomEvent<DndEvent<any>>) {
    tracks = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<any>>) {
    tracks = e.detail.items;
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
      // @ts-ignore
      provider: item.provider || "itunes",
      trackUri: item.trackUri,
      title: item.track,
      artist: item.artist,
      album: item.album,
      artworkUrl: (() => {
        if (item.imgBlob?.ref) {
          const cid = item.imgBlob.ref.$link || item.imgBlob.ref.toString();
          return `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`;
        }
        if (typeof item.imgBlob === 'string' && !item.imgBlob.includes('cid=undefined')) {
          return item.imgBlob;
        }
        return item.img ?? "";
      })(),
      spotifyUrl: item.links?.spotify,
      youtubeMusicUrl: item.links?.youtube,
    };
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

  async function handleDeletePlaylist() {
    if (
      !confirm(
        "Are you sure you want to delete this playlist? This cannot be undone.",
      )
    )
      return;
    try {
      if (rkey) {
        await deletePlaylist(rkey);
        alert("Playlist deleted.");
        window.location.href = `/profile/${did}`;
      }
    } catch (e) {
      alert("Failed to delete playlist: " + e);
    }
  }
</script>

<div class="min-h-screen p-6 max-w-4xl mx-auto relative">
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

    <!-- Share Button -->
    <div class="flex items-center gap-2">
      <button
        on:click={openShareModal}
        class="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        title="Share Playlist"
      >
        <Share2 size={24} />
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center mt-20">
      <Loader2 class="animate-spin text-green-500" />
    </div>
  {:else if playlistRecord}
    <div class="mb-8 border-b border-gray-800 pb-6 relative">
      <div class="flex justify-between items-start gap-4">
        <h1 class="text-4xl font-black text-white mb-2 pr-12 break-words">
          {(playlistRecord.value as any).name || "Unnamed Playlist"}
        </h1>
        {#if isOwner}
          <button
            on:click={handleDeletePlaylist}
            class="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors shrink-0 mt-1"
            title="Delete Playlist"
          >
            <Trash2 size={24} />
          </button>
        {/if}
      </div>
      <p class="text-gray-400 mb-4 flex items-center gap-1">
        Created by
        <a
          href={`/profile/${did}`}
          class="text-green-500 hover:underline font-bold"
        >
          {authorProfile?.displayName || authorProfile?.handle || "User"}
        </a>
        <span>• {tracks.length} songs</span>
        {#if saving}
          <span class="text-green-500 text-xs ml-2 animate-pulse"
            >Saving changes...</span
          >
        {/if}
      </p>

      <!-- Playlist Reaction -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 uppercase font-bold tracking-wider"
          >Reactions:</span
        >
        <ReactionBar
          subjectUri={playlistRecord.uri}
          playlist={{
            record: playlistRecord.value,
            author: authorProfile || {
              did: did || "",
              handle: "User",
            },
          }}
        />
      </div>
    </div>

    <section
      use:dndzone={{ items: tracks, flipDurationMs, dragDisabled: !isOwner }}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
      class="space-y-4"
    >
      {#each tracks as track, index (track.id)}
        <div animate:flip={{ duration: flipDurationMs }}>
          <TrackCard
            variant="bar"
            track={mapToTrack(track)}
            showDelete={isOwner}
            showDragHandle={isOwner}
            isDragging={false}
            {index}
            on:delete={(e) => removeTrack(e.detail)}
          />
        </div>
      {/each}
    </section>

    {#if tracks.length === 0}
      <div
        class="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl"
      >
        <p class="text-gray-500">This playlist is empty.</p>
        <p class="text-sm text-gray-600 mt-2">Go search for songs to add!</p>
      </div>
    {/if}
  {:else}
    <div class="text-center mt-20 text-red-500">Playlist not found</div>
  {/if}

  <!-- Share Modal -->
  {#if showShareModal}
    <div
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      on:click|self={() => (showShareModal = false)}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === "Escape" && (showShareModal = false)}
    >
      <div
        class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
      >
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-white">Share Playlist</h2>
          <button
            on:click={() => (showShareModal = false)}
            class="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div class="mb-4">
          <label for="shareText" class="block text-sm text-gray-400 mb-2"
            >Message</label
          >
          <textarea
            id="shareText"
            bind:value={shareText}
            class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none min-h-[100px]"
          ></textarea>
        </div>

        <button
          on:click={handleShare}
          disabled={sharing}
          class="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {#if sharing}
            <Loader2 class="animate-spin" size={18} /> Sharing...
          {:else}
            <Share2 size={18} /> Share to Bluesky
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>
