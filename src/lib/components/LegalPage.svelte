<script lang="ts">
  import { ArrowLeft, ExternalLink, ShieldCheck, ScrollText } from 'lucide-svelte';
  import LangToggle from '$lib/components/LangToggle.svelte';
  import { locale } from '$lib/i18n';
  import { legalDocuments, type LegalDocumentKind } from '$lib/legal';

  export let kind: LegalDocumentKind;

  $: copy = legalDocuments[$locale][kind];
  $: otherKind = (kind === 'terms' ? 'privacy' : 'terms') as LegalDocumentKind;
  $: otherTitle = legalDocuments[$locale][otherKind].title;
</script>

<svelte:head>
  <title>{copy.title} | なうぷれあっと</title>
  <meta name="description" content={copy.description} />
</svelte:head>

<div class="min-h-screen bg-black">
  <header class="sticky top-0 z-20 border-b border-gray-800/80 bg-black/90 backdrop-blur-md">
    <div class="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
      <a
        href="/"
        class="flex flex-col leading-none no-underline hover:no-underline hover:opacity-80 transition-opacity"
      >
        <span class="text-xl font-black text-white tracking-tighter">
          なうぷれ<span class="text-green-500">あっと</span>
        </span>
        <span class="text-[9px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
          #NowPlaying on ATprotocol
        </span>
      </a>
      <LangToggle />
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-5 py-10 sm:py-16">
    <a
      href="/"
      class="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white no-underline transition-colors"
    >
      <ArrowLeft size={16} />
      {$locale === 'ja' ? 'ホームに戻る' : 'Back to home'}
    </a>

    <div class="mt-8 flex items-start gap-4">
      <div class="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">
        {#if kind === 'terms'}
          <ScrollText size={23} />
        {:else}
          <ShieldCheck size={23} />
        {/if}
      </div>
      <div>
        <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight">{copy.title}</h1>
        <p class="mt-2 text-sm text-gray-500">{copy.updatedLabel}: {copy.updatedAt}</p>
      </div>
    </div>

    <nav class="mt-8 flex gap-2" aria-label={$locale === 'ja' ? '法的情報' : 'Legal information'}>
      <a
        href="/terms"
        aria-current={kind === 'terms' ? 'page' : undefined}
        class="px-4 py-2 rounded-full text-sm font-bold no-underline transition-colors {kind === 'terms' ? 'bg-green-500 text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}"
      >
        {legalDocuments[$locale].terms.title}
      </a>
      <a
        href="/privacy"
        aria-current={kind === 'privacy' ? 'page' : undefined}
        class="px-4 py-2 rounded-full text-sm font-bold no-underline transition-colors {kind === 'privacy' ? 'bg-green-500 text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}"
      >
        {legalDocuments[$locale].privacy.title}
      </a>
    </nav>

    <article class="mt-8 rounded-2xl border border-gray-800 bg-gray-900/65 p-6 sm:p-10 shadow-2xl">
      <p class="text-gray-300 leading-8">{copy.introduction}</p>

      <div class="mt-10 space-y-10">
        {#each copy.sections as section}
          <section>
            <h2 class="text-xl font-bold text-white border-l-2 border-green-500 pl-4">{section.title}</h2>
            {#if section.paragraphs}
              <div class="mt-4 space-y-3 text-sm sm:text-base text-gray-300 leading-7">
                {#each section.paragraphs as paragraph}
                  <p>{paragraph}</p>
                {/each}
              </div>
            {/if}
            {#if section.bullets}
              <ul class="mt-4 list-disc space-y-2 pl-6 text-sm sm:text-base text-gray-300 leading-7 marker:text-green-500">
                {#each section.bullets as item}
                  <li>{item}</li>
                {/each}
              </ul>
            {/if}

            {#if section === copy.sections[copy.sections.length - 1]}
              <a
                href="https://bsky.app/profile/suibari.com"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-4 inline-flex items-center gap-1.5 text-sm font-bold"
              >
                @suibari.com <ExternalLink size={14} />
              </a>
            {/if}
          </section>
        {/each}
      </div>
    </article>

    <footer class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
      <a href="/" class="text-gray-400 hover:text-white no-underline">
        {$locale === 'ja' ? '← ホームに戻る' : '← Back to home'}
      </a>
      <a href={`/${otherKind}`} class="text-gray-400 hover:text-white no-underline">
        {otherTitle}
      </a>
    </footer>
  </main>
</div>
