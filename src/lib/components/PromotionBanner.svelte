<script lang="ts">
  import { Music, Sparkles } from "lucide-svelte";
  import { authState, userProfile } from "$lib/stores";
  import { t } from "$lib/i18n";

  let showSettingsBanner = false;
  let checkedDid: string | null = null;

  $: currentDid = $userProfile?.did ?? null;

  $: if (!$authState.isAuthenticated) {
    checkedDid = null;
    showSettingsBanner = false;
  }

  $: if ($authState.isAuthenticated && currentDid && checkedDid !== currentDid) {
    checkedDid = currentDid;
    checkSettings(currentDid);
  }

  async function checkSettings(did: string) {
    try {
      const res = await fetch("/api/register");
      if (!res.ok) {
        showSettingsBanner = false;
        return;
      }

      const data = await res.json();
      // Ignore a response for a user who has since signed out or changed.
      if (!$authState.isAuthenticated || $userProfile?.did !== did) return;
      showSettingsBanner = !data.enabled || !data.lastfm_username;
    } catch {
      showSettingsBanner = false;
    }
  }
</script>

{#if !$authState.isLoading && !$authState.isAuthenticated}
  <a
    href="/about"
    class="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-green-500/10 border border-green-500/40 rounded-xl text-sm text-green-300 hover:bg-green-500/20 hover:border-green-400 transition-all group"
  >
    <div class="flex items-center gap-3">
      <Sparkles size={18} class="text-green-400 shrink-0" />
      <span>
        <span class="font-bold text-green-400">{$t('about.banner.bold')}</span>{$t('about.banner.desc')}
      </span>
    </div>
    <span class="text-green-400 font-bold whitespace-nowrap group-hover:underline">{$t('about.banner.cta')}</span>
  </a>
{:else if $authState.isAuthenticated && showSettingsBanner}
  <a
    href="/settings"
    class="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-green-500/10 border border-green-500/40 rounded-xl text-sm text-green-300 hover:bg-green-500/20 hover:border-green-400 transition-all group"
  >
    <div class="flex items-center gap-3">
      <Music size={18} class="text-green-400 shrink-0" />
      <span>
        <span class="font-bold text-green-400">{$t('banner.bold')}</span>{$t('banner.desc')}
      </span>
    </div>
    <span class="text-green-400 font-bold whitespace-nowrap group-hover:underline">{$t('banner.cta')}</span>
  </a>
{/if}
