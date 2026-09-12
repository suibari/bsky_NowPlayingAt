<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import {
    ArrowRight,
    ChevronDown,
    Github,
    Headphones,
    ListMusic,
    Loader2,
    Radio,
    Repeat2,
    ServerCog,
    Smile,
    Sparkles,
    UserPlus,
  } from "lucide-svelte";
  import { signUp } from "$lib/atproto";
  import { authState, userProfile } from "$lib/stores";
  import { t } from "$lib/i18n";
  import { reveal } from "$lib/actions/reveal";
  import ArtworkBackdrop from "$lib/components/ArtworkBackdrop.svelte";
  import SignInForm from "$lib/components/SignInForm.svelte";
  import LangToggle from "$lib/components/LangToggle.svelte";

  const GITHUB_URL = "https://github.com/suibari/bsky_NowPlayingAt";

  // --- OAuth signup ----------------------------------------------------------
  // bsky.social は prompt_values_supported に 'create' を含むので、認可サーバーの
  // アカウント作成画面から入って、そのまま同意まで進める。
  let isSigningUp = false;

  async function handleSignUp() {
    isSigningUp = true;
    try {
      await signUp();
    } catch (e) {
      console.error(e);
      isSigningUp = false;
      alert(get(t)("alert.signinfailed") + e);
    }
  }

  // --- Stats -----------------------------------------------------------------
  let totalPlays = 0;
  let daily: { date: string; count: number }[] = [];
  let statsLoaded = false;

  const tweenedTotal = tweened(0, { duration: 1600, easing: cubicOut });

  let canvas: HTMLCanvasElement | null = null;
  let chart: any = null;
  let statsSection: HTMLElement;
  let statsObserver: IntersectionObserver | null = null;

  function shortLabel(date: string): string {
    const [, m, d] = date.split("-");
    return `${Number(m)}/${Number(d)}`;
  }

  async function loadStats() {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      totalPlays = data.totalPlays ?? 0;
      daily = Array.isArray(data.daily) ? data.daily : [];
    } catch (e) {
      console.warn("Failed to load stats", e);
    } finally {
      statsLoaded = true;
    }
  }

  // 数字とグラフは、そのセクションが視界に入ってから動き出す。
  async function playStats() {
    if (!statsLoaded) await loadStats();
    tweenedTotal.set(totalPlays);
    if (chart || !canvas) return;

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
            backgroundColor: "rgba(29,185,84,0.18)",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#1ed760",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200, easing: "easeOutCubic" },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: any) =>
                get(t)("stats.tooltip.plays", { count: String(item.parsed.y) }),
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
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: { color: "#9ca3af", precision: 0 },
          },
        },
      },
    });
  }

  // --- Scroll progress -------------------------------------------------------
  let scrollProgress = 0;

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  onMount(() => {
    loadStats();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    statsObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          playStats();
          statsObserver?.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    if (statsSection) statsObserver.observe(statsSection);
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("scroll", onScroll);
    }
    statsObserver?.disconnect();
    chart?.destroy();
  });

  const whatCards = [
    { icon: Headphones, key: "1" },
    { icon: Radio, key: "2" },
    { icon: Smile, key: "3" },
  ];

  const whyCards = [
    { icon: ServerCog, key: "1" },
    { icon: Repeat2, key: "2" },
    { icon: ListMusic, key: "3" },
    { icon: Github, key: "4" },
  ];
</script>

<svelte:head>
  <title>{$t("about.head.title")}</title>
  <meta name="description" content={$t("about.head.desc")} />
</svelte:head>

<ArtworkBackdrop />

<!-- スクロール進捗バー -->
<div
  class="fixed top-0 left-0 h-[3px] bg-green-500 z-40"
  style="width: {scrollProgress * 100}%"
></div>

<!-- 追従ヘッダー -->
<header
  class="fixed top-0 inset-x-0 z-30 backdrop-blur-md border-b transition-colors duration-300"
  class:scrolled={scrollProgress > 0.02}
>
  <div class="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
    <a
      href="/"
      class="flex flex-col leading-none no-underline hover:no-underline hover:opacity-80 transition-opacity"
    >
      <span class="text-xl font-black text-white tracking-tighter">
        なうぷれ<span class="text-green-500">あっと</span>
      </span>
      <span
        class="text-[9px] text-gray-400 font-bold tracking-widest uppercase mt-0.5"
      >
        #NowPlaying on ATprotocol
      </span>
    </a>
    <div class="flex items-center gap-3">
      <LangToggle />
      {#if $authState.isAuthenticated}
        <a
          href="/"
          class="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-4 py-2 rounded-full transition-colors no-underline hover:no-underline"
        >
          {$t("about.cta.home")}
        </a>
      {:else}
        <button
          on:click={() => scrollTo("start")}
          class="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-4 py-2 rounded-full transition-colors"
        >
          {$t("signin")}
        </button>
      {/if}
    </div>
  </div>
</header>

<div class="relative z-10">
  <!-- ============ HERO ============ -->
  <section
    class="min-h-[100svh] flex flex-col items-center justify-center text-center px-5 pt-24 pb-16"
  >
    <p
      use:reveal
      class="text-green-400 text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mb-6"
    >
      {$t("about.hero.label")}
    </p>
    <h1
      use:reveal={{ delay: 100 }}
      class="text-4xl sm:text-6xl md:text-7xl font-black text-white leading-[1.15] tracking-tight max-w-3xl"
    >
      {$t("about.hero.tagline")}
    </h1>
    <p
      use:reveal={{ delay: 250 }}
      class="mt-8 text-base sm:text-lg text-gray-300 leading-relaxed max-w-xl"
    >
      {$t("about.hero.sub")}
    </p>
    <div
      use:reveal={{ delay: 400 }}
      class="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
    >
      <button
        on:click={() => scrollTo("start")}
        class="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-extrabold text-base px-8 py-4 rounded-full transition-all transform hover:scale-[1.03] active:scale-[0.98]"
      >
        {$t("about.hero.cta.start")}
        <ArrowRight size={18} />
      </button>
      <button
        on:click={() => scrollTo("what")}
        class="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-600 hover:border-gray-400 text-white font-bold text-base px-8 py-4 rounded-full transition-colors"
      >
        {$t("about.hero.cta.explore")}
      </button>
    </div>

    <button
      on:click={() => scrollTo("what")}
      class="mt-16 text-gray-500 hover:text-gray-300 transition-colors animate-bounce-slow"
      aria-label={$t("about.hero.scroll")}
    >
      <ChevronDown size={28} />
    </button>
  </section>

  <!-- ============ WHAT ============ -->
  <section id="what" class="px-5 py-24 sm:py-32 scroll-mt-16">
    <div class="max-w-5xl mx-auto">
      <p
        use:reveal
        class="text-green-400 text-xs font-bold tracking-[0.3em] uppercase mb-4 text-center"
      >
        {$t("about.what.label")}
      </p>
      <h2
        use:reveal={{ delay: 80 }}
        class="text-3xl sm:text-5xl font-black text-white text-center leading-tight"
      >
        {$t("about.what.title")}
      </h2>
      <p
        use:reveal={{ delay: 160 }}
        class="mt-6 text-center text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
      >
        {$t("about.what.lead")}
      </p>

      <div class="mt-14 grid gap-5 sm:grid-cols-3">
        {#each whatCards as card, i}
          <div use:reveal={{ delay: 120 * i }} class="glass-card p-6 sm:p-7">
            <div
              class="w-12 h-12 rounded-2xl bg-green-500/15 flex items-center justify-center mb-5"
            >
              <svelte:component
                this={card.icon}
                size={24}
                class="text-green-400"
              />
            </div>
            <h3 class="text-lg font-bold text-white mb-2">
              {$t(`about.what.${card.key}.title`)}
            </h3>
            <p class="text-sm text-gray-400 leading-relaxed">
              {$t(`about.what.${card.key}.desc`)}
            </p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ============ WHY ============ -->
  <section id="why" class="px-5 py-24 sm:py-32 scroll-mt-16">
    <div class="max-w-5xl mx-auto">
      <p
        use:reveal
        class="text-green-400 text-xs font-bold tracking-[0.3em] uppercase mb-4 text-center"
      >
        {$t("about.why.label")}
      </p>
      <h2
        use:reveal={{ delay: 80 }}
        class="text-3xl sm:text-5xl font-black text-white text-center leading-tight"
      >
        {$t("about.why.title")}
      </h2>

      <div class="mt-14 grid gap-5 sm:grid-cols-2">
        {#each whyCards as card, i}
          <div use:reveal={{ delay: 100 * i }} class="glass-card p-6 sm:p-8 flex gap-5">
            <div
              class="w-11 h-11 shrink-0 rounded-2xl bg-green-500/15 flex items-center justify-center"
            >
              <svelte:component
                this={card.icon}
                size={22}
                class="text-green-400"
              />
            </div>
            <div class="min-w-0">
              <h3 class="text-lg font-bold text-white mb-2">
                {$t(`about.why.${card.key}.title`)}
              </h3>
              <p class="text-sm text-gray-400 leading-relaxed">
                {$t(`about.why.${card.key}.desc`)}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ============ NUMBERS ============ -->
  <section
    id="numbers"
    bind:this={statsSection}
    class="px-5 py-24 sm:py-32 scroll-mt-16"
  >
    <div class="max-w-4xl mx-auto">
      <p
        use:reveal
        class="text-green-400 text-xs font-bold tracking-[0.3em] uppercase mb-4 text-center"
      >
        {$t("about.stats.label")}
      </p>
      <h2
        use:reveal={{ delay: 80 }}
        class="text-3xl sm:text-5xl font-black text-white text-center leading-tight"
      >
        {$t("about.stats.title")}
      </h2>

      <div use:reveal={{ delay: 160 }} class="mt-12 text-center">
        <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em]">
          {$t("about.stats.total")}
        </p>
        <p
          class="mt-3 text-6xl sm:text-8xl font-black text-white tabular-nums leading-none"
        >
          {Math.round($tweenedTotal).toLocaleString()}<span
            class="text-2xl sm:text-4xl text-green-500 ml-2 align-baseline"
            >{$t("about.stats.unit")}</span
          >
        </p>
        <p class="mt-4 text-sm text-gray-500">{$t("about.stats.note")}</p>
      </div>

      <div use:reveal={{ delay: 240 }} class="mt-14 glass-card p-5 sm:p-7">
        <p
          class="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-4"
        >
          {$t("about.stats.daily")}
        </p>
        <div class="relative h-56 sm:h-72">
          <canvas bind:this={canvas}></canvas>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ START ============ -->
  <section id="start" class="px-5 py-24 sm:py-32 scroll-mt-16">
    <div class="max-w-lg mx-auto text-center">
      <div
        use:reveal
        class="w-14 h-14 mx-auto rounded-2xl bg-green-500/15 flex items-center justify-center mb-7"
      >
        <Sparkles size={28} class="text-green-400" />
      </div>
      <h2
        use:reveal={{ delay: 80 }}
        class="text-3xl sm:text-5xl font-black text-white leading-tight"
      >
        {$t("about.cta.title")}
      </h2>
      <p use:reveal={{ delay: 160 }} class="mt-5 text-gray-300 leading-relaxed">
        {$t("about.cta.desc")}
      </p>

      <div use:reveal={{ delay: 240 }} class="mt-10 glass-card p-6 sm:p-8 text-left">
        {#if $authState.isAuthenticated}
          <p class="text-sm text-gray-300 mb-5 text-center">
            {$t("about.cta.signedin", {
              name: $userProfile?.displayName || $userProfile?.handle || "",
            })}
          </p>
          <a
            href="/"
            class="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-extrabold text-lg py-3.5 rounded-xl transition-all no-underline hover:no-underline"
          >
            {$t("about.cta.home")}
            <ArrowRight size={20} />
          </a>
        {:else}
          <SignInForm />

          <div class="mt-7 pt-6 border-t border-gray-800">
            <p class="text-sm text-gray-400 mb-3">{$t("about.cta.nosignup")}</p>
            <button
              on:click={handleSignUp}
              disabled={isSigningUp}
              class="flex items-center justify-center gap-2 w-full border border-gray-700 hover:border-green-500 text-white hover:text-green-400 font-bold py-3 rounded-xl transition-colors disabled:opacity-70"
            >
              {#if isSigningUp}
                <Loader2 class="animate-spin" size={18} />
                {$t("redirect")}
              {:else}
                <UserPlus size={18} />
                {$t("about.cta.signup")}
              {/if}
            </button>
            <p class="mt-3 text-xs text-gray-500">
              {$t("about.cta.signup.hint")}
            </p>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- ============ FOOTER ============ -->
  <footer class="px-5 pb-16 pt-8">
    <div
      class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
    >
      <a
        href="/"
        class="text-gray-400 hover:text-white no-underline transition-colors"
      >
        {$t("about.footer.home")}
      </a>
      <div class="flex items-center gap-5">
        <a
          href="/terms"
          class="text-gray-400 hover:text-white transition-colors no-underline"
        >
          {$t('legal.terms')}
        </a>
        <a
          href="/privacy"
          class="text-gray-400 hover:text-white transition-colors no-underline"
        >
          {$t('legal.privacy')}
        </a>
        <a
          href="https://bsky.app/profile/suibari.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-gray-400 hover:text-white transition-colors no-underline"
        >
          {$t("about.footer.dev")}
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors no-underline"
        >
          <Github size={16} />
          GitHub
        </a>
      </div>
    </div>
  </footer>
</div>

<style>
  header {
    background-color: transparent;
    border-color: transparent;
  }
  header.scrolled {
    background-color: rgba(0, 0, 0, 0.85);
    border-color: rgba(31, 41, 55, 0.8);
  }

  /* 背景のジャケットを透かすカード */
  .glass-card {
    background-color: rgba(17, 24, 39, 0.72);
    border: 1px solid rgba(55, 65, 81, 0.8);
    border-radius: 1rem;
    backdrop-filter: blur(12px);
  }

  /* reveal アクションが付与するクラス。子要素にも当たるので :global。 */
  :global(.reveal) {
    opacity: 0;
    transform: translateY(28px);
    transition:
      opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }
  :global(.reveal-visible) {
    opacity: 1;
    transform: none;
  }

  .animate-bounce-slow {
    animation: bounce-slow 2.2s infinite;
  }
  @keyframes bounce-slow {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(8px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-bounce-slow {
      animation: none;
    }
  }
</style>
