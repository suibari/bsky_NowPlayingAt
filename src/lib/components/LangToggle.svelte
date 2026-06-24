<script lang="ts">
  import { locale, toggleLocale } from '$lib/i18n';
</script>

<button
  on:click={toggleLocale}
  class="relative flex items-center w-[72px] h-8 rounded-full bg-gray-800 border border-gray-600 p-1 cursor-pointer select-none hover:border-green-500 transition-all text-xs font-bold"
  title={$locale === 'ja' ? 'Switch to English' : '日本語に切り替え'}
  aria-label="Toggle language"
>
  <!-- トグルスライダー -->
  <div 
    class="absolute left-1 top-1 w-[31px] h-[22px] bg-gray-600 rounded-full transition-transform duration-200 ease-in-out"
    style="transform: translateX({$locale === 'en' ? '31px' : '0'})"
  ></div>

  <!-- ラベル -->
  <span 
    class="relative z-10 flex-1 text-center transition-colors duration-200 {$locale === 'ja' ? 'text-white drop-shadow-md' : 'text-gray-400'}"
  >
    JA
  </span>
  <span 
    class="relative z-10 flex-1 text-center transition-colors duration-200 {$locale === 'en' ? 'text-white drop-shadow-md' : 'text-gray-400'}"
  >
    EN
  </span>
</button>
