<script lang="ts">
  import { X, LogIn } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";
  import { t } from "$lib/i18n";
  import SignInForm from "$lib/components/SignInForm.svelte";
  import LangToggle from "$lib/components/LangToggle.svelte";

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
      class="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
    >
      <button
        on:click={close}
        class="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
      >
        <X size={24} />
      </button>

      <h2
        class="text-xl font-bold text-white mb-5 flex items-center gap-2"
      >
        <LogIn size={22} class="text-green-500" />
        {$t("signin.modal.title")}
      </h2>

      <SignInForm />

      <div class="flex justify-center mt-6">
        <LangToggle />
      </div>
    </div>
  </div>
{/if}
