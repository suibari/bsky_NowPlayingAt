<script lang="ts">
  import { userProfile, authState, agent } from "$lib/stores";
  import { signOut } from "$lib/atproto";
  import { LogOut, ArrowLeft } from "lucide-svelte";
  import { goto } from "$app/navigation";

  async function handleSignOut() {
    if (!confirm("サインアウトしますか？")) return;
    await signOut($userProfile?.did || "");

    // Clear stores
    authState.set({ isLoading: false, error: null, isAuthenticated: false });
    userProfile.set(null);
    agent.set(null);

    goto("/");
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

  {#if $userProfile}
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
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
  {:else}
    <div class="text-center text-gray-500">
      <p>サインインしていません。</p>
      <a href="/" class="text-green-500 hover:underline mt-2 inline-block"
        >ログイン画面へ</a
      >
    </div>
  {/if}
</div>
