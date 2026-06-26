<script lang="ts">
    import { X, HelpCircle } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";
    import { t } from "$lib/i18n";

    export let show = false;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
        show = false;
    }
</script>

{#if show}
    <div
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        on:click|self={close}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === "Escape" && close()}
    >
        <div
            class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl relative max-h-[85vh] flex flex-col"
        >
            <button
                on:click={close}
                class="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
            >
                <X size={24} />
            </button>

            <h2
                class="text-xl font-bold text-white mb-6 flex items-center gap-2 flex-shrink-0"
            >
                <HelpCircle size={24} class="text-green-500" />
                {$t('setup.modal.title')}
            </h2>

            <ol class="space-y-6 text-sm text-gray-300 leading-relaxed overflow-y-auto pr-2 custom-scrollbar">
                <li>
                    <p class="font-bold text-white mb-1">{$t('setup.modal.step1.title')}</p>
                    <p>{$t('setup.modal.step1.desc')}</p>
                    <a
                        href="https://www.last.fm/join"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-green-400 hover:underline mt-2 inline-block"
                    >{$t('setup.modal.step1.link')}</a>
                    <p class="text-gray-500 text-xs mt-2">{$t('setup.modal.step1.skip')}</p>
                </li>

                <hr class="border-gray-800" />

                <li>
                    <p class="font-bold text-white mb-1">{$t('setup.modal.step2.title')}</p>
                    <p>{$t('setup.modal.step2.desc')}</p>
                    <a
                        href="https://www.last.fm/settings/applications"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-green-400 hover:underline mt-2 inline-block"
                    >{$t('setup.modal.step2.link')}</a>
                    <p class="text-gray-500 text-xs mt-2">{$t('setup.modal.step2.skip')}</p>
                </li>

                <hr class="border-gray-800" />

                <li>
                    <p class="font-bold text-white mb-1">{$t('setup.modal.step3.title')}</p>
                    <p>{$t('setup.modal.step3.desc')}</p>
                </li>
            </ol>

            <button
                on:click={close}
                class="w-full mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded-lg transition-colors flex-shrink-0"
            >
                {$t('setup.modal.btn.close')}
            </button>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
</style>
