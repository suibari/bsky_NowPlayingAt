<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { get } from "svelte/store";
  import { Loader2, Music } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import { getHistory, songKey } from "$lib/bsky";
  import { resolveArtworkUrl } from "$lib/artwork";
  import type { HistoryRecord } from "$lib/schema";
  import type { Track } from "$lib/music";
  import { t } from "$lib/i18n";

  export let did: string | undefined = undefined;

  let loading = true;
  let totalPlays = 0;
  let top5: { track: Track; count: number }[] = [];
  let hourly: number[] = new Array(24).fill(0);

  // Count-up animation for the total play number.
  const tweenedTotal = tweened(0, { duration: 600, easing: cubicOut });

  let canvas: HTMLCanvasElement;
  let chart: any = null;

  // Grid placement per rank (0-indexed). On mobile (base) the #1 card spans the
  // full width and the rest flow 2-per-row; on md+ the #1 card is a 2x2 block and
  // 2/3 stack in col 3, 4/5 stack in col 4.
  const PLACEMENT = [
    "col-span-2 md:row-span-2",
    "md:col-start-3 md:row-start-1",
    "md:col-start-3 md:row-start-2",
    "md:col-start-4 md:row-start-1",
    "md:col-start-4 md:row-start-2",
  ];

  // Resolve artwork URL the same way profile/[did]/+page.svelte's mapHistoryToTrack does.
  function recordToTrack(val: HistoryRecord): Track {
    const artworkUrl = resolveArtworkUrl(val.imgBlob, val.img, did);
    return {
      id: val.trackUri,
      // @ts-ignore – provider is a loose string on history records
      provider: val.provider || "itunes",
      title: val.track,
      artist: val.artist,
      album: val.album,
      artworkUrl,
      trackUri: val.trackUri,
      spotifyUrl: val.links?.spotify,
      youtubeMusicUrl: val.links?.youtube,
      comment: val.comment,
    };
  }

  function aggregate(records: HistoryRecord[]) {
    const counts = new Map<string, { track: Track; count: number }>();
    const hours = new Array(24).fill(0);
    for (const val of records) {
      // Group by artist + title (normalized). trackUri is unreliable here — some
      // records share the same trackUri across different songs, which would
      // wrongly collapse distinct tracks into one bucket.
      const key = songKey(val.artist, val.track, val.trackUri);
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { track: recordToTrack(val), count: 1 });

      if (val.postedAt) {
        const h = new Date(val.postedAt).getHours();
        if (h >= 0 && h < 24) hours[h]++;
      }
    }
    const sorted = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { total: records.length, top5: sorted, hourly: hours };
  }

  function applyAggregate(records: HistoryRecord[]) {
    const agg = aggregate(records);
    totalPlays = agg.total;
    top5 = agg.top5;
    hourly = agg.hourly;
    tweenedTotal.set(agg.total);
    if (chart) {
      chart.data.datasets[0].data = hourly;
      chart.update();
    }
  }

  onMount(async () => {
    if (!did) {
      loading = false;
      return;
    }

    // 1. Seed from the TOP page timeline cache (latest ~5 records per user) for an
    //    instant first paint, before the full PDS fetch lands.
    try {
      const res = await fetch("/api/timeline");
      const { data } = await res.json();
      if (Array.isArray(data)) {
        const seed = data
          .filter((i: any) => i.author?.did === did && i.type === "history")
          .map((i: any) => i.record as HistoryRecord);
        if (seed.length > 0) applyAggregate(seed);
      }
    } catch (e) {
      console.warn("Failed to seed report from timeline cache", e);
    }

    // 2. Init Chart.js (browser-only, dynamic import to avoid SSR issues).
    const { default: Chart } = await import("chart.js/auto");
    chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: Array.from({ length: 24 }, (_, h) => h),
        datasets: [
          {
            data: hourly,
            backgroundColor: "#1db954",
            hoverBackgroundColor: "#1ed760",
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutCubic" },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items: any) =>
                get(t)("profile.report.tooltip.hour", {
                  hour: String(items[0]?.label ?? ""),
                }),
              label: (item: any) =>
                get(t)("profile.report.tooltip.plays", {
                  count: String(item.parsed.y),
                }),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#9ca3af",
              maxRotation: 0,
              // Show only every 6th hour (0/6/12/18) to keep the axis readable.
              callback: (value: any) =>
                Number(value) % 6 === 0 ? String(value) : "",
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#9ca3af", precision: 0 },
          },
        },
      },
    });
    chart.update();

    // 3. Full fetch from the PDS, updating aggregates progressively so the number
    //    counts up and the bars grow as data streams in.
    try {
      const all: HistoryRecord[] = [];
      let cursor: string | undefined;
      do {
        const { records, cursor: next } = await getHistory(did, cursor);
        all.push(...records.map((r) => r.value));
        applyAggregate(all);
        cursor = next;
      } while (cursor);
    } catch (e) {
      console.error("Failed to load full history for report", e);
    }
    loading = false;
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="relative">
  <!-- Live-update indicator -->
  {#if loading}
    <div
      class="absolute -top-1 right-0 z-10 flex items-center gap-2 text-xs text-gray-400 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-800"
    >
      <Loader2 class="w-3.5 h-3.5 animate-spin text-green-500" />
      {$t("profile.report.updating")}
    </div>
  {/if}

  {#if !loading && totalPlays === 0}
    <p class="text-gray-500 italic">{$t("profile.report.empty")}</p>
  {:else}
    <!-- Total plays -->
    <div
      class="mb-8 flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      <div
        class="w-12 h-12 shrink-0 rounded-full bg-green-500/15 flex items-center justify-center"
      >
        <Music class="text-green-500" size={24} />
      </div>
      <div>
        <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">
          {$t("profile.report.totalplays")}
        </p>
        <p class="text-4xl font-black text-white tabular-nums">
          {Math.round($tweenedTotal).toLocaleString()}
        </p>
      </div>
    </div>

    <!-- Top 5 tracks -->
    {#if top5.length > 0}
      <h2 class="text-lg font-bold text-white mb-3">
        {$t("profile.report.toptracks")}
      </h2>
      <div class="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 mb-8">
        {#each top5 as item, i (songKey(item.track.artist, item.track.title, item.track.trackUri))}
          <div class="relative {PLACEMENT[i]}">
            <div
              class="absolute top-2 right-2 z-10 pointer-events-none w-7 h-7 rounded-full bg-black/70 text-green-400 text-sm font-black flex items-center justify-center shadow"
            >
              {i + 1}
            </div>
            <TrackCard variant="square" track={item.track} />
          </div>
        {/each}
      </div>
    {/if}

    <!-- Plays by hour -->
    <h2 class="text-lg font-bold text-white mb-3">
      {$t("profile.report.timeline")}
    </h2>
    <div
      class="bg-gray-900 border border-gray-800 rounded-xl p-4 h-64 sm:h-72"
    >
      <canvas bind:this={canvas}></canvas>
    </div>
  {/if}
</div>
