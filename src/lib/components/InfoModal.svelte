<script lang="ts">
    import { X, Info } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";

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
                class="text-xl font-bold text-white mb-4 flex items-center gap-2 flex-shrink-0"
            >
                <Info size={24} class="text-green-500" />
                なうぷれあっと について
            </h2>

            <div
                class="space-y-4 text-sm text-gray-300 leading-relaxed overflow-y-auto pr-2 custom-scrollbar"
            >
                <div>
                    <p>
                        なうぷれあっと（以下、本アプリ）は AT protocol
                        の音楽共有サービスです。
                    </p>
                    <ul class="list-disc pl-5 mt-1">
                        <li>自分の再生した曲を検索してシェアしよう！</li>
                        <li>オリジナルのプレイリストを作ってシェアしよう！</li>
                        <li>
                            ビビッときた曲、プレイリストには絵文字リアクションを送ろう！
                        </li>
                    </ul>
                </div>

                <hr class="border-gray-800" />

                <p>
                    本アプリは
                    <a
                        href="https://bsky.app/profile/suibari.com"
                        target="_blank"
                        class="text-green-500 hover:underline">すいばり</a
                    >
                    個人が趣味で開発しています。
                </p>
                <p>
                    本アプリは専用のサーバーは持たず、認証情報はユーザーの端末に保存され、データはユーザーのPDSに保存されます。
                </p>
                <p>
                    個人開発のため手厚いサポートはできず、突如サービスを終了する可能性があります。
                    ただし、データはユーザーのPDSに置くため、サービスが終了してもデータそのものは消えません。
                </p>

                <hr class="border-gray-800" />

                <div>
                    <h3 class="font-bold text-white mb-1">その他</h3>
                    <p>
                        このページに記載される文章は予告なく変更することがあります。
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-white mb-1">リンク</h3>
                    <ul class="list-disc pl-5 space-y-1">
                        <li>
                            <a
                                href="https://bsky.app/profile/suibari.com"
                                target="_blank"
                                class="text-green-500 hover:underline"
                                >すいばり (@suibari.com)</a
                            >
                        </li>
                        <li>
                            <a
                                href="https://github.com/suibari/bsky_NowPlayingAt"
                                target="_blank"
                                class="text-green-500 hover:underline"
                                >GitHub (Source Code)</a
                            >
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Custom scrollbar for Webkit browsers */
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
