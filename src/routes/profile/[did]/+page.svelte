<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { agent } from "$lib/stores";
  import { getHistory, getPlaylists } from "$lib/bsky";
  import { Loader2, Music, Disc } from "lucide-svelte";

  // $page.params is reactive but derived, so we react to it.
  $: did = $page.params.did;

  let profile: any = null;
  let history: any[] = [];
  let playlists: any[] = [];
  let loading = true;
  let activeTab = "playlists"; // 'playlists' | 'history'

  onMount(async () => {
    // loadData handled by reactivity below
  });

  $: if ($agent && did) {
    loadData(did);
  }

  async function loadData(actorDid: string) {
    if (!$agent || !actorDid) return;
    loading = true;
    try {
      // 1. Get Profile
      const pRes = await $agent.getProfile({ actor: actorDid });
      profile = pRes.data;

      // 2. Get Playlists
      const plRes = await getPlaylists(actorDid);
      playlists = plRes;

      // 3. Get History
      const hRes = await getHistory(actorDid);
      history = hRes;
    } catch (e) {
      console.error("Failed to load profile data", e);
    }
    loading = false;
  }
</script>

<div class="min-h-screen p-6 max-w-4xl mx-auto">
  {#if loading}
    <div class="flex justify-center mt-20">
      <Loader2 class="animate-spin text-green-500" />
    </div>
  {:else if profile}
    <!-- Profile Header -->
    <div class="mb-8 flex items-center gap-6">
      {#if profile.avatar}
        <img
          src={profile.avatar}
          alt={profile.handle}
          class="w-24 h-24 rounded-full border-2 border-gray-700 shadow-xl"
        />
      {/if}
      <div>
        <h1 class="text-3xl font-bold text-white mb-1">
          {profile.displayName || profile.handle}
        </h1>
        <p class="text-gray-400">@{profile.handle}</p>
        <p class="text-gray-500 text-sm mt-2">{profile.description || ""}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 border-b border-gray-800 mb-6">
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'playlists'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "playlists")}
      >
        Playlists
      </button>
      <button
        class="px-4 py-2 pb-3 font-medium transition-colors border-b-2 {activeTab ===
        'history'
          ? 'border-green-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-200'}"
        on:click={() => (activeTab = "history")}
      >
        History
      </button>
    </div>

    <!-- Content -->
    <div>
      {#if activeTab === "playlists"}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each playlists as pl}
            <a
              href={`/playlist/${did}/${pl.uri.split("/").pop()}`}
              class="block bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-green-500/50 hover:bg-gray-800 transition-all group"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Disc
                    class="text-green-500 group-hover:rotate-12 transition-transform"
                  />
                  <h3 class="font-bold text-lg text-white">{pl.value.name}</h3>
                </div>
                <span class="text-xs text-gray-500"
                  >{pl.value.tracks?.length || 0} tracks</span
                >
              </div>
              <div class="text-xs text-gray-400 truncate">
                {pl.value.tracks?.map((t: any) => t.track).join(", ") ||
                  "Empty playlist"}
              </div>
            </a>
          {/each}
          {#if playlists.length === 0}
            <p class="text-gray-500 italic">No playlists found.</p>
          {/if}
        </div>
      {:else}
        <div class="space-y-2">
          {#each history as item}
            <div
              class="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800/50"
            >
              <div
                class="bg-gray-800 w-10 h-10 rounded flex items-center justify-center text-gray-500"
              >
                <Music size={16} />
              </div>
              <div>
                <p class="text-sm font-bold text-white">{item.value.track}</p>
                <p class="text-xs text-gray-400">{item.value.artist}</p>
              </div>
              <div class="ml-auto text-xs text-gray-600">
                {new Date(item.value.postedAt).toLocaleDateString()}
              </div>
            </div>
          {/each}
          {#if history.length === 0}
            <p class="text-gray-500 italic">No history yet.</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
