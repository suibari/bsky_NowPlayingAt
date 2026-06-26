<script lang="ts">
  import { get } from "svelte/store";
  import { Loader2 } from "lucide-svelte";
  import { signIn } from "$lib/atproto";
  import { t } from "$lib/i18n";

  let handleInput = "";
  let isSigningIn = false;

  async function handleSignIn() {
    handleInput = handleInput.replace(/^@/, "").trim();
    if (!handleInput) return;
    if (!handleInput.includes(".")) {
      handleInput += ".bsky.social";
    }
    isSigningIn = true;
    try {
      await signIn(handleInput);
    } catch (e) {
      console.error(e);
      isSigningIn = false;
      alert(get(t)("alert.signinfailed") + e);
    }
  }
</script>

<form on:submit|preventDefault={handleSignIn} class="space-y-4">
  <div>
    <label for="handle" class="block text-sm font-medium text-gray-400 mb-2 ml-1">
      Bluesky Handle
    </label>
    <div class="relative">
      <span class="absolute left-4 top-3.5 text-gray-500">@</span>
      <input
        type="text"
        id="handle"
        bind:value={handleInput}
        placeholder="username.bsky.social"
        class="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none transition-all placeholder-gray-600 shadow-inner"
      />
    </div>
  </div>

  <button
    type="submit"
    disabled={isSigningIn}
    class="w-full bg-green-500 hover:bg-green-400 text-black font-extrabold text-lg py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
  >
    {#if isSigningIn}
      <Loader2 class="animate-spin" size={22} /> {$t("redirect")}
    {:else}
      {$t("signin")}
    {/if}
  </button>
</form>
