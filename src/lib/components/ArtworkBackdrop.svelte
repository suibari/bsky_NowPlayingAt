<script lang="ts">
  import { onMount } from "svelte";
  import { resolveArtworkUrl } from "$lib/artwork";

  /** 縦に流すカラム数（画面幅に応じて about ページ側から渡す） */
  export let columns = 5;
  /** 1カラムあたりの最小ジャケット枚数 */
  const MIN_PER_COLUMN = 6;
  /** 背景に使うジャケットの上限。タイムラインは1000件以上返るので絞らないとDOMが膨らむ。 */
  const MAX_ARTWORKS = 40;

  let urls: string[] = [];
  let ready = false;

  function collect(items: any[]): string[] {
    const out: string[] = [];
    for (const item of items) {
      const record = item?.record ?? item;
      if (!record) continue;
      const url = resolveArtworkUrl(
        record.imgBlob,
        record.img,
        item?.author?.did
      );
      if (url) out.push(url);
    }
    return out;
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  onMount(async () => {
    const collected: string[] = [];
    try {
      const [timelineRes, hotRes] = await Promise.all([
        fetch("/api/timeline").catch(() => null),
        fetch("/api/hot").catch(() => null),
      ]);

      if (timelineRes && timelineRes.ok) {
        const { data } = await timelineRes.json();
        if (Array.isArray(data)) {
          collected.push(...collect(data.filter((i: any) => i.type === "history")));
        }
      }
      if (hotRes && hotRes.ok) {
        const { data } = await hotRes.json();
        if (Array.isArray(data?.tracks)) collected.push(...collect(data.tracks));
      }
    } catch (e) {
      console.warn("Failed to load backdrop artwork", e);
    }

    urls = shuffle([...new Set(collected)]).slice(0, MAX_ARTWORKS);
    ready = urls.length > 0;
  });

  // カラムごとに配分し、ループが途切れないよう各カラムを2周分に増やす。
  $: columnData = (() => {
    if (!ready) return [] as { images: string[]; duration: number }[];
    const buckets: string[][] = Array.from({ length: columns }, () => []);
    urls.forEach((url, i) => buckets[i % columns].push(url));
    return buckets
      .filter((b) => b.length > 0)
      .map((b, i) => {
        let images = b;
        while (images.length < MIN_PER_COLUMN) images = [...images, ...b];
        return {
          images: [...images, ...images],
          // カラムごとに速度を変えて視差を出す
          duration: 70 + (i % 4) * 22,
        };
      });
  })();
</script>

<div class="backdrop" aria-hidden="true">
  {#if columnData.length > 0}
    <div class="rail">
      {#each columnData as col, i}
        <div class="column">
          <div
            class="track"
            class:reverse={i % 2 === 1}
            style="animation-duration: {col.duration}s"
          >
            {#each col.images as url}
              <img src={url} alt="" loading="lazy" decoding="async" />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  <div class="veil"></div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background: #000;
  }

  .rail {
    position: absolute;
    /* 斜めに傾けたぶん、画面外まで広げて余白を作らない */
    top: -25%;
    left: -20%;
    width: 140%;
    height: 150%;
    display: flex;
    gap: 1.25rem;
    transform: rotate(-8deg);
    opacity: 0.4;
    filter: blur(1px) saturate(0.9);
  }

  .column {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
  }

  .track {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    animation-name: scroll-up;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform;
  }

  .track.reverse {
    animation-name: scroll-down;
  }

  .track img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 0.75rem;
    background: #111827;
  }

  @keyframes scroll-up {
    from {
      transform: translateY(0);
    }
    to {
      /* 画像列を2周分並べているので、半分進んだ時点で同じ絵柄に戻る */
      transform: translateY(calc(-50% - 0.625rem));
    }
  }

  @keyframes scroll-down {
    from {
      transform: translateY(calc(-50% - 0.625rem));
    }
    to {
      transform: translateY(0);
    }
  }

  /* 前景テキストの可読性を確保する暗幕 */
  .veil {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        ellipse at 50% 30%,
        rgba(0, 0, 0, 0.55) 0%,
        rgba(0, 0, 0, 0.88) 60%,
        rgba(0, 0, 0, 0.96) 100%
      ),
      linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .track {
      animation: none;
    }
  }
</style>
