<script lang="ts">
  import { userProfile } from "$lib/stores";
  import { signOut } from "$lib/atproto";
  import { LogOut, ArrowLeft } from "lucide-svelte";

  function handleSignOut() {
    if (!confirm("Are you sure you want to sign out?")) return;
    signOut($userProfile?.did || "");
  }
</script>

<div class="min-h-screen p-6 max-w-2xl mx-auto">
  <a
    href="/"
    class="inline-flex items-center gap-2 text-gray-500 hover:text-green-500 mb-8 transition-colors"
  >
    <ArrowLeft size={20} />
    Back to Home
  </a>

  <h1 class="text-3xl font-black text-white mb-8">Settings</h1>

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
          Sign Out
        </button>
      </div>
    </div>
  {:else}
    <div class="text-center text-gray-500">
      <p>Not signed in.</p>
      <a href="/" class="text-green-500 hover:underline mt-2 inline-block"
        >Go to Login</a
      >
    </div>
  {/if}
</div>
