<script lang="ts">
  import { page } from "$app/stores";
  import { Loader2, Disc, User } from "lucide-svelte";
  import TrackCard from "$lib/components/TrackCard.svelte";
  import PromotionBanner from "$lib/components/PromotionBanner.svelte";
  import { publicAgent } from "$lib/atproto";
  import { mutedDidsStore } from "$lib/stores";
  import { normalizeArtistStr } from "$lib/recommendation";
  import { historyRecordToTrack } from "$lib/userStats";
  import { resolveArtworkUrl } from "$lib/artwork";
  import { t } from "$lib/i18n";
  import type { ArtistResponse } from "$lib/server/artists";
  import type { Track } from "$lib/music";

  // The slug is the artist's display name. Normalizing it yields the index key
  // directly (same rule as the poller's normalizeArtist), so there is no lookup
  // table to keep in sync and any casing or width variant lands on this page.
  $: slug = $page.params.slug;
  $: slugName = decodeURIComponent(slug ?? "");
  $: artistKey = normalizeArtistStr(slugName);

  type Listener = {
    did: string;
    plays: number;
    handle?: string;
    displayName?: string;
    avatar?: string;
  };

  let artist: ArtistResponse | null = null;
  let listeners: Listener[] = [];
  let loading = true;
  let loadedKey = "";

  $: if (artistKey && artistKey !== loadedKey) {
    loadedKey = artistKey;
    load(artistKey);
  }

  // Muting is per-viewer, so it is applied here rather than baked into the index.
  $: visibleListeners = listeners.filter((l) => !$mutedDidsStore.dids.has(l.did));
  $: displayName = artist?.name || slugName;
  $: tracks = (artist?.tracks ?? []).map((entry) => ({
    key: entry.key,
    plays: entry.plays,
    // The representative play's Bluesky post, so its likes feed the reaction bar.
    postUri: entry.record.postUri,
    // Artwork blobs live in the owner's repo, so resolution needs their DID.
    track: historyRecordToTrack(entry.record, entry.did) as Track,
  }));
  $: heroArtwork = artist?.tracks?.length
    ? resolveArtworkUrl(
        artist.tracks[0].record.imgBlob,
        artist.tracks[0].record.img,
        artist.tracks[0].did,
      )
    : "";

  async function load(key: string) {
    loading = true;
    artist = null;
    listeners = [];
    try {
      const res = await fetch(`/api/artists?key=${encodeURIComponent(key)}`);
      const { data } = await res.json();
      if (key !== loadedKey) return; // a newer navigation won the race
      artist = data ?? null;
      listeners = (data?.listeners ?? []).map((l: any) => ({ did: l.did, plays: l.plays }));
    } catch (e) {
      console.error("Failed to load artist page", e);
    }
    loading = false;

    if (listeners.length > 0) hydrateListeners(key);
  }

  // Bluesky profiles come from the AppView 25 at a time, the same chunk size the
  // poller uses. Failures leave the DID rendered without a handle rather than
  // dropping the listener.
  async function hydrateListeners(key: string) {
    const dids = listeners.map((l) => l.did);
    const chunks: string[][] = [];
    for (let i = 0; i < dids.length; i += 25) chunks.push(dids.slice(i, i + 25));

    const profiles = new Map<string, any>();
    for (const chunk of chunks) {
      try {
        const res = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
        res.data.profiles.forEach((p: any) => profiles.set(p.did, p));
      } catch (e) {
        console.warn("Failed to hydrate listener profiles", e);
      }
    }
    if (key !== loadedKey) return;

    listeners = listeners.map((l) => {
      const p = profiles.get(l.did);
      return p
        ? { ...l, handle: p.handle, displayName: p.displayName, avatar: p.avatar }
        : l;
    });
  }
</script>

<svelte:head>
  <title>{displayName} のなうぷれ | なうぷれあっと</title>
  <meta
    name="description"
    content={`${displayName} をなうぷれあっとで聴いている人と、よく聴かれている曲。`}
  />
</svelte:head>

<div class="min-h-screen p-6 max-w-4xl mx-auto">
  <div class="topbar-layout">
    <a
      href="/"
      class="flex flex-col items-center hover:opacity-80 transition-opacity group"
    >
      <div class="inline-block text-3xl font-black tracking-tighter leading-none group-hover:underline decoration-green-500 underline-offset-4">
        <span class="text-white">なうぷれ</span><span class="text-green-500">あっと</span>
      </div>
      <div class="text-[10px] text-gray-400 font-bold tracking-widest mt-1 uppercase">#NowPlaying on ATprotocol</div>
    </a>
  </div>

  <PromotionBanner />

  {#if loading}
    <div class="flex justify-center mt-20">
      <Loader2 class="animate-spin text-green-500" />
    </div>
  {:else}
    <!-- Artist Header -->
    <div class="mb-8 border-b border-gray-800 pb-6 relative overflow-hidden rounded-xl">
      {#if heroArtwork}
        <img
          src={heroArtwork}
          alt=""
          aria-hidden="true"
          class="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110 pointer-events-none"
        />
      {/if}
      <div class="relative p-4 sm:p-6">
        <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
          {$t("artist.label")}
        </p>
        <h1 class="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-white break-words">
          {displayName}
        </h1>
        {#if artist}
          <p class="mt-2 text-sm text-gray-300">
            {$t("artist.summary", {
              plays: String(artist.plays),
              listeners: String(artist.listeners.length),
            })}
          </p>
        {/if}
      </div>
    </div>

    {#if !artist}
      <div class="text-center mt-16 text-gray-400 flex flex-col items-center gap-3">
        <Disc size={32} class="text-gray-600" />
        <p class="text-sm">{$t("artist.empty")}</p>
      </div>
    {:else}
      <!-- Top tracks -->
      <section class="mb-10">
        <h2 class="text-lg font-bold text-white mb-3">{$t("artist.tracks")}</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          {#each tracks as item (item.key)}
            <div class="relative">
              <TrackCard track={item.track} postUri={item.postUri} />
              <span
                class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-bold text-green-300"
                title={$t("profile.report.tooltip.plays", { count: String(item.plays) })}
              >
                {item.plays}
              </span>
            </div>
          {/each}
        </div>
      </section>

      <!-- Listeners -->
      <section>
        <h2 class="text-lg font-bold text-white mb-3">{$t("artist.listeners")}</h2>
        {#if visibleListeners.length === 0}
          <p class="text-sm text-gray-500">{$t("artist.listeners.empty")}</p>
        {:else}
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {#each visibleListeners as listener (listener.did)}
              <li>
                <a
                  href="/profile/{listener.did}"
                  class="flex items-center gap-3 p-2 rounded-lg border border-gray-800 bg-gray-900/60 hover:bg-gray-800/70 transition-colors"
                >
                  {#if listener.avatar}
                    <img
                      src={listener.avatar}
                      alt=""
                      class="w-9 h-9 shrink-0 rounded-full object-cover border border-gray-700"
                    />
                  {:else}
                    <div
                      class="w-9 h-9 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-500"
                    >
                      <User size={16} />
                    </div>
                  {/if}
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm text-white truncate">
                      {listener.displayName || listener.handle || listener.did}
                    </span>
                    {#if listener.handle}
                      <span class="block text-xs text-gray-500 truncate">@{listener.handle}</span>
                    {/if}
                  </span>
                  <span class="shrink-0 text-xs font-bold text-green-300">{listener.plays}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  {/if}
</div>
