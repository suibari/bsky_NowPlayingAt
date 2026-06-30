<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import ReactionBar from "$lib/components/ReactionBar.svelte";
  import { resolveArtworkUrl } from "$lib/artwork";
  import { songKey } from "$lib/bsky";
  import { t } from "$lib/i18n";
  import { Play } from "lucide-svelte";

  // 2〜9件の同一ユーザー連続 history アイテム（新しい順）
  export let items: any[];
  // 各アイテムのおすすめ度（undefined = 非表示）
  export let recommendScores: (number | undefined)[] = [];

  const dispatch = createEventDispatcher();

  // 選択中のジャケットインデックス（null = 折りたたみ）
  let expandedIndex: number | null = null;

  function toggleExpand(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
  }

  function playItem(item: any, e: MouseEvent) {
    e.stopPropagation();
    const links = item.record?.links;
    const url = links?.spotify ?? links?.youtube ?? links?.appleMusic;
    if (url) {
      window.open(url, "_blank");
    } else {
      const q = encodeURIComponent(`${item.record.artist} ${item.record.track}`);
      window.open(`https://open.spotify.com/search/${q}`, "_blank");
    }
  }

  // n 枚のジャケットを余白なしで並べるための行ごとのアイテム数
  function getRowConfig(n: number): number[] {
    const configs: Record<number, number[]> = {
      2: [2],
      3: [3],
      4: [2, 2],
      5: [3, 2],
      6: [3, 3],
      7: [3, 2, 2],
      8: [3, 3, 2],
      9: [3, 3, 3],
    };
    return configs[n] ?? [Math.min(n, 3)];
  }

  $: rowConfig = getRowConfig(items.length);

  $: rows = (() => {
    const result: { item: any; index: number }[][] = [];
    let idx = 0;
    for (const count of rowConfig) {
      const row: { item: any; index: number }[] = [];
      for (let c = 0; c < count; c++) {
        if (idx < items.length) row.push({ item: items[idx], index: idx });
        idx++;
      }
      result.push(row);
    }
    return result;
  })();

  $: author = items[0]?.author;
  $: selectedItem = expandedIndex !== null ? items[expandedIndex] : null;

  $: selectedTrack = selectedItem
    ? {
        id: selectedItem.record.trackUri,
        title: selectedItem.record.track,
        artist: selectedItem.record.artist,
        album: selectedItem.record.album,
        artworkUrl: resolveArtworkUrl(
          selectedItem.record.imgBlob,
          selectedItem.record.img,
          author?.did,
        ),
        trackUri: selectedItem.record.trackUri,
        spotifyUrl: selectedItem.record.links?.spotify,
        youtubeMusicUrl: selectedItem.record.links?.youtube,
        appleMusicUrl: selectedItem.record.links?.appleMusic,
        provider: selectedItem.record.provider || "itunes",
      }
    : null;

  $: reactionSubjectUri = selectedItem
    ? selectedItem.uri ??
      selectedItem.record.trackUri ??
      songKey(selectedItem.record.artist, selectedItem.record.track)
    : "";

  function handleReaction(e: CustomEvent) {
    if (!selectedItem || !selectedTrack) return;
    dispatch("reaction", {
      track: selectedTrack,
      emoji: e.detail,
      historyUri: selectedItem.uri,
    });
  }
</script>

<div class="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
  <!-- Header: User + 曲数バッジ -->
  <div class="flex items-center gap-3 mb-3">
    <a href={`/profile/${author?.did}`} class="flex-shrink-0">
      {#if author?.avatar}
        <img
          src={author.avatar}
          alt={author.handle}
          class="w-10 h-10 rounded-full border border-gray-700"
        />
      {:else}
        <div class="w-10 h-10 rounded-full bg-gray-800 border border-gray-700"></div>
      {/if}
    </a>
    <div class="flex-1 min-w-0 flex items-center justify-between gap-2">
      <div class="text-sm text-gray-300 min-w-0 truncate">
        <a
          href={`/profile/${author?.did}`}
          class="font-bold text-white! hover:underline"
        >
          {author?.displayName || author?.handle}
        </a>
        <span class="text-gray-500">{$t('discovery.listening')}</span>
      </div>
      <span class="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold border border-gray-700">
        {$t('group.count', { count: String(items.length) })}
      </span>
    </div>
  </div>

  <!-- Jacket mosaic grid -->
  <div class="flex flex-col gap-0.5 rounded-xl overflow-hidden">
    {#each rows as row}
      <div
        style="display: grid; grid-template-columns: repeat({row.length}, 1fr); gap: 2px;"
      >
        {#each row as { item, index }}
          {@const artworkUrl = resolveArtworkUrl(item.record.imgBlob, item.record.img, author?.did)}
          {@const score = recommendScores[index]}
          <div
            class="relative overflow-hidden group/jacket"
            style="aspect-ratio: 1;"
          >
            <!-- Jacket (クリックでリアクションペイン開閉) -->
            <button
              class="absolute inset-0 focus:outline-none"
              class:ring-2={expandedIndex === index}
              class:ring-inset={expandedIndex === index}
              class:ring-green-500={expandedIndex === index}
              on:click={() => toggleExpand(index)}
              title={item.record.track}
              aria-label={item.record.track}
            >
              <img
                src={artworkUrl || "/placeholder_art.png"}
                alt={item.record.track}
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <!-- Hover darken -->
              <div class="absolute inset-0 bg-black/0 group-hover/jacket:bg-black/25 transition-colors"></div>
            </button>

            <!-- 再生ボタン (左上) -->
            <button
              class="absolute top-1 left-1 bg-black/60 hover:bg-black/85 text-white rounded-full p-1.5 transition-all z-10 opacity-0 group-hover/jacket:opacity-100 active:scale-95"
              on:click={(e) => playItem(item, e)}
              title={$t('track.play')}
            >
              <Play size={13} class="fill-current" />
            </button>

            <!-- おすすめ度バッジ (右上) -->
            {#if score !== undefined && score > 0}
              <span
                class="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-900/80 text-purple-300 font-bold z-10 leading-none pointer-events-none"
              >
                {score}%
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- リアクションペイン（ジャケット選択時） -->
  {#if selectedItem !== null && selectedTrack !== null}
    <div class="mt-2 p-3 bg-gray-900 border border-gray-800 rounded-xl animate-fade-in">
      <div class="mb-2">
        <p class="font-bold text-white text-sm truncate">{selectedItem.record.track}</p>
        <p class="text-gray-400 text-xs truncate">{selectedItem.record.artist}</p>
      </div>
      <ReactionBar
        subjectUri={reactionSubjectUri}
        postUri={selectedItem.record.postUri}
        track={selectedTrack}
        initialReactions={[]}
        on:reaction={handleReaction}
      />
    </div>
  {/if}
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.15s ease-out forwards;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
