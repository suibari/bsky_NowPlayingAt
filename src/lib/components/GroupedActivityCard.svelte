<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import { resolveArtworkUrl } from "$lib/artwork";
  import { t } from "$lib/i18n";

  // 2〜9件の同一ユーザー連続 history アイテム（新しい順）
  export let items: any[];
  export let processingItemUri: string | null = null;

  const dispatch = createEventDispatcher();

  function forward(name: string) {
    return (e: CustomEvent) => dispatch(name, e.detail);
  }

  function forwardNowPlayingWithUri(item: any) {
    return (e: CustomEvent) => dispatch("nowPlaying", { ...e.detail, itemUri: item.uri });
  }

  // 選択中のジャケットインデックス（null = 折りたたみ）
  let expandedIndex: number | null = null;

  function toggleExpand(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
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

  // 行ごとのアイテム配列と、各行の先頭インデックスを計算
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
      <div class="text-sm text-gray-300 min-w-0">
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
          <button
            class="relative overflow-hidden focus:outline-none group/jacket transition-all"
            style="aspect-ratio: 1;"
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
            <!-- Hover overlay with track title -->
            <div
              class="absolute inset-0 bg-black/0 group-hover/jacket:bg-black/30 transition-colors pointer-events-none"
            ></div>
            <div
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 translate-y-full group-hover/jacket:translate-y-0 transition-transform pointer-events-none"
            >
              <p class="text-white text-[10px] font-bold truncate leading-tight">
                {item.record.track}
              </p>
            </div>
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Expanded track detail (reaction pane pre-opened) -->
  {#if selectedItem !== null}
    <div class="mt-2 animate-fade-in">
      <TrackCard
        track={{
          id: selectedItem.record.trackUri,
          title: selectedItem.record.track,
          artist: selectedItem.record.artist,
          album: selectedItem.record.album,
          artworkUrl: resolveArtworkUrl(selectedItem.record.imgBlob, selectedItem.record.img, author?.did),
          trackUri: selectedItem.record.trackUri,
          spotifyUrl: selectedItem.record.links?.spotify,
          youtubeMusicUrl: selectedItem.record.links?.youtube,
          appleMusicUrl: selectedItem.record.links?.appleMusic,
          comment: selectedItem.record.comment,
          provider: selectedItem.record.provider || "itunes",
        }}
        fallbackArtworkUrl={selectedItem.record.img}
        subjectUriOverride={selectedItem.uri}
        postUri={selectedItem.record.postUri}
        isProcessing={processingItemUri === selectedItem.uri}
        autoExpand={true}
        on:nowPlaying={forwardNowPlayingWithUri(selectedItem)}
        on:addToPlaylist={forward("addToPlaylist")}
        on:reaction={forward("reaction")}
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
