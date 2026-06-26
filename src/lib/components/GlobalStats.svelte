<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { get } from "svelte/store";
  import { Loader2, Music } from "lucide-svelte";
  import { t } from "$lib/i18n";

  let loading = true;
  let totalPlays = 0;
  let daily: { date: string; count: number }[] = [];

  // Count-up animation for the cumulative total.
  const tweenedTotal = tweened(0, { duration: 600, easing: cubicOut });

  let canvas: HTMLCanvasElement;
  let chart: any = null;

  // "YYYY-MM-DD" -> "M/D" for compact axis labels.
  function shortLabel(date: string): string {
    const [, m, d] = date.split("-");
    return `${Number(m)}/${Number(d)}`;
  }

  onMount(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      totalPlays = data.totalPlays ?? 0;
      daily = Array.isArray(data.daily) ? data.daily : [];
      tweenedTotal.set(totalPlays);
    } catch (e) {
      console.warn("Failed to load global stats", e);
    }

    // Chart.js is browser-only — dynamic import avoids SSR issues.
    const { default: Chart } = await import("chart.js/auto");
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: daily.map((d) => shortLabel(d.date)),
        datasets: [
          {
            data: daily.map((d) => d.count),
            borderColor: "#1db954",
            backgroundColor: "rgba(29,185,84,0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "#1ed760",
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
                get(t)("stats.tooltip.plays", {
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
              autoSkip: true,
              maxTicksLimit: 6,
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
    loading = false;
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
  <h2 class="text-sm font-bold text-white mb-4 uppercase tracking-wider">
    {$t("stats.title")}
  </h2>

  <!-- Cumulative total -->
  <div class="flex items-center gap-3 mb-5">
    <div
      class="w-11 h-11 shrink-0 rounded-full bg-green-500/15 flex items-center justify-center"
    >
      <Music class="text-green-500" size={22} />
    </div>
    <div class="min-w-0">
      <p class="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
        {$t("stats.total")}
      </p>
      <p class="text-3xl font-black text-white tabular-nums leading-tight">
        {Math.round($tweenedTotal).toLocaleString()}
      </p>
    </div>
  </div>

  <!-- Daily chart -->
  <p class="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2">
    {$t("stats.daily")}
  </p>
  <div class="relative h-40">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <Loader2 class="w-5 h-5 animate-spin text-green-500" />
      </div>
    {/if}
    <canvas bind:this={canvas}></canvas>
  </div>
</div>
