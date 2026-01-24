<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { Plus, Loader2 } from "lucide-svelte";
  import { getBacklinks } from "$lib/constellation";
  import { hydrateReactions, createReactionRecord } from "$lib/bsky";
  import { REACTION_SOURCE } from "$lib/schema";
  import { publicAgent } from "$lib/atproto";
  import type { Track } from "$lib/music";
  import type { PlaylistRecord } from "$lib/schema";

  export let subjectUri: string;
  // Metadata for creating the reaction record
  export let track: Track | undefined = undefined;
  export let playlist:
    | {
        record: PlaylistRecord;
        author: {
          did: string;
          handle: string;
          avatar?: string;
          displayName?: string;
        };
      }
    | undefined = undefined;

  const dispatch = createEventDispatcher();

  // Reaction State (Grouped)
  interface ReactionUser {
    did: string;
    handle: string;
    avatar?: string;
    displayName?: string;
  }
  interface ReactionGroup {
    emoji: string;
    users: ReactionUser[];
  }
  let reactions: ReactionGroup[] = [];
  let loadingReactions = false;
  let hoveredEmoji: string | null = null;

  // Emoji Picker State
  let showPicker = false;
  const popularEmojis = [
    "🔥",
    "❤️",
    "🥺",
    "🎧",
    "🕺",
    "🤘",
    "🎹",
    "✨",
    "💯",
    "😭",
    "😴",
    "🍺",
    "💿",
    "🚀",
  ];

  onMount(() => {
    loadReactions();
  });

  async function loadReactions() {
    if (!subjectUri) return;
    loadingReactions = true;
    try {
      const res = await getBacklinks(subjectUri, REACTION_SOURCE);
      const hydrated = await hydrateReactions(res);

      const groups: Record<string, string[]> = {};
      hydrated.forEach(({ record, authorDid }) => {
        if (record.emoji) {
          if (!groups[record.emoji]) groups[record.emoji] = [];
          groups[record.emoji].push(authorDid);
        }
      });

      const allDids = Array.from(new Set(Object.values(groups).flat()));
      let profilesMap = new Map<string, ReactionUser>();

      if (allDids.length > 0) {
        try {
          const chunks = [];
          for (let i = 0; i < allDids.length; i += 25) {
            chunks.push(allDids.slice(i, i + 25));
          }
          for (const chunk of chunks) {
            const pRes = await publicAgent.app.bsky.actor.getProfiles({
              actors: chunk,
            });
            pRes.data.profiles.forEach((p) => {
              profilesMap.set(p.did, {
                did: p.did,
                handle: p.handle,
                avatar: p.avatar,
                displayName: p.displayName,
              });
            });
          }
        } catch (e) {
          console.error("Failed to fetch profiles", e);
        }
      }

      reactions = Object.entries(groups).map(([emoji, dids]) => ({
        emoji,
        users: dids
          .map((did) => profilesMap.get(did) || { did, handle: "Unknown" })
          .filter((u): u is ReactionUser => !!u),
      }));
    } catch (e) {
      console.warn("Failed to load reactions", e);
    }
    loadingReactions = false;
  }

  async function handleAddReaction(emoji: string) {
    if (!track && !playlist) return; // Need metadata
    try {
      showPicker = false;
      // Optimistic update? Maybe later. For now, fetch after.
      await createReactionRecord({
        subjectUri,
        emoji,
        track,
        playlist,
      });
      loadReactions();
      dispatch("reaction", emoji);
    } catch (e) {
      alert("Failed to react: " + e);
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2 min-h-[2rem]">
  <!-- Add Button -->
  <div class="relative">
    <button
      on:click={() => (showPicker = !showPicker)}
      class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
      title="Add Reaction"
    >
      <Plus size={16} />
    </button>

    <!-- Emoji Picker Popover -->
    {#if showPicker}
      <div
        class="absolute bottom-full left-0 mb-2 p-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-[60] grid grid-cols-5 gap-1 w-48 animate-fade-in"
      >
        {#each popularEmojis as emoji}
          <button
            on:click={() => handleAddReaction(emoji)}
            class="text-xl hover:bg-white/10 rounded p-1 transition-colors"
          >
            {emoji}
          </button>
        {/each}
        <!-- Transparent backdrop to close -->
        <div
          class="fixed inset-0 z-[-1]"
          on:click={() => (showPicker = false)}
        ></div>
      </div>
    {/if}
  </div>

  {#if loadingReactions && reactions.length === 0}
    <div class="flex items-center gap-2 text-xs text-gray-500">
      <Loader2 size={12} class="animate-spin" />
    </div>
  {:else if reactions.length > 0}
    {#each reactions as rx}
      <div
        class="relative group"
        on:mouseenter={() => (hoveredEmoji = rx.emoji)}
        on:mouseleave={() => (hoveredEmoji = null)}
        role="group"
      >
        <div
          class="flex items-center gap-1 bg-gray-800/80 rounded-full px-3 py-1 border border-gray-700 font-bold text-white shadow-sm cursor-help select-none hover:border-green-500/50 transition-colors"
        >
          <span class="text-sm">{rx.emoji}</span>
          <span class="text-xs text-green-500 ml-1">{rx.users.length}</span>
        </div>

        {#if hoveredEmoji === rx.emoji}
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pb-2 animate-fade-in"
          >
            <div
              class="w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 flex flex-col gap-1"
            >
              <div
                class="text-xs text-gray-500 font-bold px-1 mb-1 border-b border-gray-800 pb-1"
              >
                Reacted by:
              </div>
              {#each rx.users as user}
                <a
                  href={`/profile/${user.did}`}
                  class="flex items-center gap-2 p-1 hover:bg-gray-800 rounded transition-colors group/user"
                >
                  {#if user.avatar}
                    <img
                      src={user.avatar}
                      alt={user.handle}
                      class="w-5 h-5 rounded-full bg-gray-800"
                    />
                  {:else}
                    <div class="w-5 h-5 rounded-full bg-gray-700"></div>
                  {/if}
                  <span
                    class="text-xs font-bold text-white truncate group-hover/user:text-green-400"
                  >
                    {user.displayName || user.handle}
                  </span>
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    <span class="text-xs text-gray-600 italic ml-1">No reactions yet</span>
  {/if}
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.1s ease-out forwards;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
