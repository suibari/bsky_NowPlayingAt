<script lang="ts">
  import { userProfile, authState, agent } from "$lib/stores";
  import { signOut } from "$lib/atproto";
  import { LogOut, ArrowLeft, Music, Loader2, Globe } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { t } from "$lib/i18n";
  import LangToggle from "$lib/components/LangToggle.svelte";

  let lastfmUsername = "";
  let autoEnabled = false;
  let customText = "";
  let savingLastfm = false;
  let lastfmSaved = false;
  let lastfmError = "";

  onMount(async () => {
    // Load existing Last.fm registration
    try {
      const res = await fetch("/api/register");
      if (res.ok) {
        const data = await res.json();
        lastfmUsername = data.lastfm_username ?? "";
        autoEnabled = data.enabled ?? false;
        customText = data.custom_text ?? "";
      }
    } catch {
      // not registered yet
    }
  });

  async function handleSignOut() {
    if (!confirm(get(t)('settings.signout.confirm'))) return;
    await signOut();

    authState.set({ isLoading: false, error: null, isAuthenticated: false });
    userProfile.set(null);
    agent.set(null);

    goto("/");
  }

  async function saveLastfm() {
    if (!lastfmUsername.trim()) return;
    savingLastfm = true;
    lastfmSaved = false;
    lastfmError = "";

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastfm_username: lastfmUsername.trim(),
          enabled: autoEnabled,
          custom_text: customText.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        lastfmError = err.error ?? get(t)('settings.error.save');
      } else {
        lastfmSaved = true;
      }
    } catch {
      lastfmError = get(t)('settings.error.network');
    } finally {
      savingLastfm = false;
    }
  }
</script>

<div class="min-h-screen p-6 max-w-2xl mx-auto">
  <a
    href="/"
    class="inline-flex items-center gap-2 text-gray-500 hover:text-green-500 mb-8 transition-colors"
  >
    <ArrowLeft size={20} />
    {$t('settings.back')}
  </a>

  <h1 class="text-3xl font-black text-white mb-8">{$t('settings.title')}</h1>

  {#if $authState.isLoading}
    <div class="flex items-center justify-center h-64">
      <Loader2 class="w-8 h-8 animate-spin text-green-500" />
    </div>
  {:else if $userProfile}
    <!-- Profile header -->
    <div class="flex items-center gap-4 mb-8">
      {#if $userProfile.avatar}
        <img
          src={$userProfile.avatar}
          alt="avatar"
          class="w-14 h-14 rounded-full border-2 border-gray-700"
        />
      {/if}
      <div>
        <h2 class="text-lg font-bold text-white">
          {$userProfile.displayName || $userProfile.handle}
        </h2>
        <p class="text-gray-400 text-sm">@{$userProfile.handle}</p>
      </div>
    </div>

    <div class="space-y-4">
      <!-- 1. Auto Now Playing -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <Music size={22} class="text-green-400" />
          <h2 class="text-xl font-bold text-white">{$t('settings.autopost.title')}</h2>
        </div>
        <p class="text-gray-400 text-sm mb-6">
          {$t('settings.autopost.desc1')}<br />
          {$t('settings.autopost.desc2')}
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1" for="lastfm">{$t('settings.lastfm.label')}</label>
            <input
              id="lastfm"
              type="text"
              bind:value={lastfmUsername}
              placeholder="your_lastfm_username"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-1" for="customText">{$t('settings.customtext.label')}</label>
            <input
              id="customText"
              type="text"
              bind:value={customText}
              placeholder={$t('settings.customtext.placeholder')}
              maxlength="100"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            />
            <p class="text-xs text-gray-600 mt-1">{$t('settings.customtext.hint')}</p>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-400">{$t('settings.autopost.toggle')}</span>
            <button
              on:click={() => (autoEnabled = !autoEnabled)}
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {autoEnabled ? 'bg-green-500' : 'bg-gray-600'}"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {autoEnabled ? 'translate-x-6' : 'translate-x-1'}"
              ></span>
            </button>
          </div>

          {#if lastfmError}
            <p class="text-red-400 text-sm">{lastfmError}</p>
          {/if}
          {#if lastfmSaved}
            <p class="text-green-400 text-sm">{$t('settings.saved')}</p>
          {/if}

          <button
            on:click={saveLastfm}
            disabled={savingLastfm || !lastfmUsername.trim()}
            class="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {savingLastfm ? $t('settings.saving') : $t('settings.save')}
          </button>
        </div>
      </div>

      <!-- 2. Language -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <Globe size={22} class="text-green-400" />
          <h2 class="text-xl font-bold text-white">{$t('settings.language.title')}</h2>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400">{$t('settings.language.label')}</span>
          <LangToggle />
        </div>
      </div>

      <!-- 3. Sign Out -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <button
          on:click={handleSignOut}
          class="w-full flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 font-bold py-3 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          {$t('settings.signout')}
        </button>
      </div>
    </div>
  {:else}
    <div class="text-center text-gray-500">
      <p>{$t('settings.noauth')}</p>
      <a href="/" class="text-green-500 hover:underline mt-2 inline-block">{$t('settings.gotologin')}</a>
    </div>
  {/if}
</div>
