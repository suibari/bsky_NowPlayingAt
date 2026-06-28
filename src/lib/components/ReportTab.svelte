<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { get } from "svelte/store";
  import { Loader2 } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import { getHistory, songKey } from "$lib/bsky";
  import { resolveArtworkUrl } from "$lib/artwork";
  import type { HistoryRecord } from "$lib/schema";
  import type { Track } from "$lib/music";
  import { t } from "$lib/i18n";
  import { GENRES } from "$lib/genres";
  import { normalizeArtistStr, type UserProfile } from "$lib/recommendation";

  export let did: string | undefined = undefined;

  let loading = true;
  let totalPlays = 0;
  // Each TOP5 entry carries the representative record's track + postUri. The
  // representative is always the LATEST play of that song (see aggregate()), so
  // a card consistently shows the most recent record's data.
  let top5: { track: Track; count: number; postUri?: string }[] = [];
  let hourly: number[] = new Array(24).fill(0);

  // All-time genre listen counts (lowercased genre key → count) and a map from
  // normalized artist key → original display casing, both derived from full
  // history. Used for the radar chart and the listener "title".
  let genreFreqAll: Record<string, number> = {};
  let artistDisplay = new Map<string, string>();
  // Per-user listening profiles from KV (7-day window, all app users) — the
  // source for the cross-user artist title determination.
  let userProfilesMap: Record<string, UserProfile> | null = null;
  // The computed listener title words (0–2 entries: artists and/or genres).
  let titleWords: string[] = [];

  // Number of axes shown on the genre radar (top-N by listen count, zeros incl).
  const RADAR_AXES = 10;

  // Count-up animation for the total play number.
  const tweenedTotal = tweened(0, { duration: 600, easing: cubicOut });

  let canvas: HTMLCanvasElement;
  let chart: any = null;
  let radarCanvas: HTMLCanvasElement;
  let radarChart: any = null;

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

  // Map a history record to a TrackCard track. Artwork is resolved via the
  // shared resolveArtworkUrl helper (legacy getBlob URLs fall back to img).
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
    // Unified philosophy: the record shown for a TOP5 song is always the LATEST
    // play of that song. The representative track (artwork) and its postUri are
    // both taken from the most recent record — so the card's jacket and the
    // Bluesky post likes (aggregated by postUri) match the same, newest record.
    const counts = new Map<
      string,
      { track: Track; count: number; postUri?: string; postedAt: string }
    >();
    const hours = new Array(24).fill(0);
    // All-time genre counts and normalized-artist → display-name map.
    const genreFreq: Record<string, number> = {};
    const display = new Map<string, { name: string; postedAt: string }>();
    for (const val of records) {
      // Genre listen counts (lowercased keys, all-time).
      const gs: string[] = Array.isArray(val.genres) ? val.genres : [];
      for (const g of gs) {
        const gk = String(g).trim().toLowerCase();
        if (gk) genreFreq[gk] = (genreFreq[gk] || 0) + 1;
      }
      // Keep the latest original artist casing per normalized key.
      const ak = normalizeArtistStr(val.artist || "");
      if (ak) {
        const prev = display.get(ak);
        if (!prev || (val.postedAt || "") > prev.postedAt) {
          display.set(ak, { name: val.artist, postedAt: val.postedAt || "" });
        }
      }
      // Group by artist + title (normalized). trackUri is unreliable here — some
      // records share the same trackUri across different songs, which would
      // wrongly collapse distinct tracks into one bucket.
      const key = songKey(val.artist, val.track, val.trackUri);
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
        // Keep the latest record as the representative (postedAt is ISO 8601, so
        // a lexicographic compare is chronological).
        if ((val.postedAt || "") > (existing.postedAt || "")) {
          existing.track = recordToTrack(val);
          existing.postUri = val.postUri;
          existing.postedAt = val.postedAt;
        }
      } else {
        counts.set(key, {
          track: recordToTrack(val),
          count: 1,
          postUri: val.postUri,
          postedAt: val.postedAt,
        });
      }

      if (val.postedAt) {
        const h = new Date(val.postedAt).getHours();
        if (h >= 0 && h < 24) hours[h]++;
      }
    }
    const sorted = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ track, count, postUri }) => ({ track, count, postUri }));
    const artistMap = new Map<string, string>();
    for (const [k, v] of display) artistMap.set(k, v.name);
    return {
      total: records.length,
      top5: sorted,
      hourly: hours,
      genreFreq,
      artistDisplay: artistMap,
    };
  }

  // Top-N canonical genres by all-time listen count (zeros included to pad).
  function topGenres(n: number): { genre: string; count: number }[] {
    return GENRES.map((g) => ({ genre: g, count: genreFreqAll[g.toLowerCase()] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  // Listener title: up to 2 artists where the user has ≥2 plays AND is the top
  // listener across all app users (KV 7-day data); remaining slots filled by the
  // user's top all-time genres. Returns 0–2 display words.
  function computeTitleWords(): string[] {
    const words: string[] = [];
    const myFreq =
      did && userProfilesMap?.[did]?.artistFreq
        ? userProfilesMap[did].artistFreq
        : null;
    if (myFreq && userProfilesMap) {
      const candidates: { key: string; count: number }[] = [];
      for (const [artist, count] of Object.entries(myFreq)) {
        if (count < 2) continue;
        let isTop = true;
        for (const [otherDid, prof] of Object.entries(userProfilesMap)) {
          if (otherDid === did) continue;
          if ((prof.artistFreq?.[artist] ?? 0) > count) {
            isTop = false;
            break;
          }
        }
        if (isTop) candidates.push({ key: artist, count });
      }
      candidates.sort((a, b) => b.count - a.count);
      for (const c of candidates.slice(0, 2)) {
        words.push(artistDisplay.get(c.key) ?? c.key);
      }
    }
    // Fill remaining slots (up to 2 total) with top genres that have plays.
    if (words.length < 2) {
      for (const { genre, count } of topGenres(GENRES.length)) {
        if (words.length >= 2) break;
        if (count > 0) words.push(genre);
      }
    }
    return words;
  }

  function applyAggregate(records: HistoryRecord[]) {
    const agg = aggregate(records);
    totalPlays = agg.total;
    top5 = agg.top5;
    hourly = agg.hourly;
    genreFreqAll = agg.genreFreq;
    artistDisplay = agg.artistDisplay;
    tweenedTotal.set(agg.total);
    if (chart) {
      chart.data.datasets[0].data = hourly;
      chart.update();
    }
    updateRadar();
    titleWords = computeTitleWords();
  }

  function updateRadar() {
    if (!radarChart) return;
    const top = topGenres(RADAR_AXES);
    radarChart.data.labels = top.map((t) => t.genre);
    radarChart.data.datasets[0].data = top.map((t) => t.count);
    radarChart.update();
  }

  onMount(async () => {
    if (!did) {
      loading = false;
      return;
    }

    // 0. Load per-user listening profiles (KV, 7-day, all users) for the title.
    try {
      const res = await fetch("/api/user-profiles");
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          userProfilesMap = data;
          titleWords = computeTitleWords();
        }
      }
    } catch (e) {
      console.warn("Failed to load user profiles for report title", e);
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

    // 2b. Genre radar chart (top-10 genres by all-time listen count).
    radarChart = new Chart(radarCanvas, {
      type: "radar",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: "rgba(29,185,84,0.2)",
            borderColor: "#1db954",
            borderWidth: 2,
            pointBackgroundColor: "#1ed760",
            pointRadius: 2,
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
              label: (item: any) =>
                get(t)("profile.report.tooltip.plays", {
                  count: String(item.parsed.r),
                }),
            },
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            angleLines: { color: "rgba(255,255,255,0.08)" },
            grid: { color: "rgba(255,255,255,0.08)" },
            pointLabels: { color: "#9ca3af", font: { size: 10 } },
            ticks: {
              display: false,
              precision: 0,
              backdropColor: "transparent",
            },
          },
        },
      },
    });
    updateRadar();

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
    radarChart?.destroy();
  });

  // Build the localized listener-title string from the computed words.
  $: titleText =
    titleWords.length >= 2
      ? $t("profile.report.title.two", { a: titleWords[0], b: titleWords[1] })
      : titleWords.length === 1
        ? $t("profile.report.title.one", { a: titleWords[0] })
        : $t("profile.report.title.none");
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
    <!-- Listener title card: genre radar (left) + total plays & title (right) -->
    <div
      class="mb-8 flex flex-col md:flex-row items-center gap-5 md:gap-6 bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      <!-- Genre radar -->
      <div class="w-full md:w-1/2 max-w-xs shrink-0 h-56 sm:h-64">
        <canvas bind:this={radarCanvas}></canvas>
      </div>
      <!-- Total plays + title -->
      <div
        class="w-full md:w-1/2 flex flex-col justify-center gap-5 text-center md:text-left"
      >
        <div>
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">
            {$t("profile.report.totalplays")}
          </p>
          <p class="text-4xl font-black text-white tabular-nums">
            {Math.round($tweenedTotal).toLocaleString()}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
            {$t("profile.report.title.label")}
          </p>
          <p
            class="text-2xl sm:text-3xl font-black text-green-400 leading-tight wrap-break-word"
          >
            {titleText}
          </p>
        </div>
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
            <TrackCard
              variant="square"
              track={item.track}
              postUri={item.postUri}
            />
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
