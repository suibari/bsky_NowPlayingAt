<script lang="ts">
  import { userProfile, authState, agent } from "$lib/stores";
  import { signOut } from "$lib/atproto";
  import { LogOut, ArrowLeft, Music, Loader2 } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

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
    if (!confirm("サインアウトしますか？")) return;
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
        lastfmError = err.error ?? "保存に失敗しました";
      } else {
        lastfmSaved = true;
      }
    } catch {
      lastfmError = "ネットワークエラーが発生しました";
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
    ホームに戻る
  </a>

  <h1 class="text-3xl font-black text-white mb-8">設定</h1>

  {#if $authState.isLoading}
    <div class="flex items-center justify-center h-64">
      <Loader2 class="w-8 h-8 animate-spin text-green-500" />
    </div>
  {:else if $userProfile}
    <!-- Profile -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
      <div class="flex items-center gap-4 mb-6">
        {#if $userProfile.avatar}
          <img
            src={$userProfile.avatar}
            alt="avatar"
            class="w-16 h-16 rounded-full border-2 border-gray-700"
          />
        {/if}
        <div>
          <h2 class="text-xl font-bold text-white">
            {$userProfile.displayName || $userProfile.handle}
          </h2>
          <p class="text-gray-400">@{$userProfile.handle}</p>
        </div>
      </div>

      <div class="border-t border-gray-800 pt-6">
        <button
          on:click={handleSignOut}
          class="w-full flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 font-bold py-3 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          サインアウト
        </button>
      </div>
    </div>

    <!-- Auto Now Playing -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div class="flex items-center gap-3 mb-4">
        <Music size={22} class="text-green-400" />
        <h2 class="text-xl font-bold text-white">自動Now Playing投稿（β）</h2>
      </div>
      <p class="text-gray-400 text-sm mb-6">
        Last.fm と連携することで、スマートフォン・PC で再生した曲を Bluesky に自動で投稿できます。<br />
        対応サービス: Spotify / Amazon Music / Apple Music など Last.fm スクロブル対応アプリ全般
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1" for="lastfm">Last.fm ユーザー名</label>
          <input
            id="lastfm"
            type="text"
            bind:value={lastfmUsername}
            placeholder="your_lastfm_username"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-sm text-gray-400 mb-1" for="customText">カスタムテキスト（任意）</label>
          <input
            id="customText"
            type="text"
            bind:value={customText}
            placeholder="例: #聴いてる #music"
            maxlength="100"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
          />
          <p class="text-xs text-gray-600 mt-1">投稿本文に追加される1行テキスト。ハッシュタグも使えます。</p>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400">自動投稿</span>
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
          <p class="text-green-400 text-sm">保存しました</p>
        {/if}

        <button
          on:click={saveLastfm}
          disabled={savingLastfm || !lastfmUsername.trim()}
          class="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-colors"
        >
          {savingLastfm ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  {:else}
    <div class="text-center text-gray-500">
      <p>サインインしていません。</p>
      <a href="/" class="text-green-500 hover:underline mt-2 inline-block">ログイン画面へ</a>
    </div>
  {/if}
</div>
