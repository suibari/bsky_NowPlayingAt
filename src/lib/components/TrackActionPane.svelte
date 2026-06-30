<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import ReactionBar from "$lib/components/ReactionBar.svelte";
  import { t } from "$lib/i18n";
  import type { Track } from "$lib/music";
  import { Loader2, Share2, Plus } from "lucide-svelte";

  // リアクション主語 URI（AT-URI of history record または trackUri）
  export let subjectUri: string;
  export let postUri: string | undefined = undefined;
  export let track: Track;
  export let initialReactions: any[] = [];
  export let isProcessing: boolean = false;

  const dispatch = createEventDispatcher();

  let comment = "";
  let postToBsky = false;

  function handleReaction(e: CustomEvent) {
    dispatch("reaction", { track, emoji: e.detail, historyUri: subjectUri });
  }

  function handleNowPlaying() {
    const trackWithComment = { ...track, comment: comment || track.comment };
    dispatch("nowPlaying", { track: trackWithComment, postToBsky });
  }

  function handleAddToPlaylist() {
    dispatch("addToPlaylist", track);
  }
</script>

<!-- リアクション -->
<ReactionBar
  {subjectUri}
  {postUri}
  {track}
  {initialReactions}
  on:reaction={handleReaction}
/>

<!-- コメント + 投稿 -->
<div class="bg-gray-800/50 p-3 rounded-lg flex flex-col gap-3">
  <div class="w-full">
    <input
      type="text"
      bind:value={comment}
      placeholder={$t('track.comment.placeholder')}
      class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none placeholder-gray-600"
      on:click|stopPropagation
      on:keydown|stopPropagation
    />
  </div>

  <div class="flex justify-between items-center flex-wrap gap-2">
    <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-300 select-none">
      <input
        type="checkbox"
        bind:checked={postToBsky}
        class="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700"
      />
      {$t('track.post.bsky')}
    </label>

    <button
      on:click={handleNowPlaying}
      disabled={isProcessing}
      class="bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 disabled:cursor-not-allowed text-black font-bold px-4 py-1.5 rounded-full text-sm flex items-center gap-2 transition-transform active:scale-95 disabled:active:scale-100"
      title={$t('track.nowplaying.btn')}
    >
      {#if isProcessing}
        <Loader2 size={16} class="animate-spin" />
        {$t('track.processing')}
      {:else}
        <Share2 size={16} /> #NowPlaying
      {/if}
    </button>
  </div>
</div>

<!-- プレイリストに追加 -->
<div class="flex gap-2">
  <button
    on:click={handleAddToPlaylist}
    class="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
  >
    <Plus size={16} /> {$t('track.add.playlist')}
  </button>
</div>
