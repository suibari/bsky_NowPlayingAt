<script lang="ts">
  import { ListMusic, User } from "lucide-svelte";
  import type { PlaylistRecord } from "$lib/schema";

  export let playlist: PlaylistRecord;
  export let author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  export let rkey: string; // Needed for linking

  function handleClick() {
    window.location.href = `/playlist/${author.did}/${rkey}`;
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all duration-300 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-900/10 cursor-pointer group flex items-center gap-4"
  on:click={handleClick}
  role="article"
>
  <!-- Icon / Art Placeholder -->
  <div
    class="w-16 h-16 bg-gray-800 rounded-md flex items-center justify-center flex-shrink-0 group-hover:bg-gray-700 transition-colors"
  >
    <ListMusic size={32} class="text-green-500" />
  </div>

  <div class="flex-grow min-w-0">
    <h3
      class="font-bold text-white text-lg truncate group-hover:text-green-400 transition-colors"
    >
      {playlist.name}
    </h3>

    <div class="flex items-center gap-2 mt-1">
      {#if author.avatar}
        <img
          src={author.avatar}
          alt={author.handle}
          class="w-5 h-5 rounded-full bg-gray-700"
        />
      {:else}
        <div
          class="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center"
        >
          <User size={12} class="text-gray-400" />
        </div>
      {/if}
      <span class="text-sm text-gray-400 truncate">
        {author.displayName || author.handle}
      </span>
    </div>

    {#if playlist.tracks}
      <p class="text-xs text-gray-500 mt-1">{playlist.tracks.length} 曲</p>
    {/if}
  </div>
</div>
