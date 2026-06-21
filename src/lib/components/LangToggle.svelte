<script lang="ts">
  import { Globe } from 'lucide-svelte';
  import { locale, toggleLocale } from '$lib/i18n';
</script>

<button
  on:click={toggleLocale}
  class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full bg-gray-800 border border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-green-500 hover:text-white transition-all"
  title={$locale === 'ja' ? 'Switch to English' : '日本語に切り替え'}
  aria-label="Toggle language"
>
  <Globe size={14} />
  {$locale === 'ja' ? 'EN' : 'JA'}
</button>
