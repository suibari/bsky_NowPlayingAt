<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { Plus, Loader2 } from "lucide-svelte";
  import { getBacklinks, getPostLikes } from "$lib/constellation";
  import {
    hydrateReactions,
    createReactionRecord,
    deleteReactionRecord,
    getMyRecentReaction,
  } from "$lib/bsky";
  import { REACTION_SOURCE } from "$lib/schema";
  import { publicAgent } from "$lib/atproto";
  import type { Track } from "$lib/music";
  import type { PlaylistRecord } from "$lib/schema";
  import { userProfile } from "$lib/stores";
  import { get } from "svelte/store";

  export let subjectUri: string;
  // AT-URI of the Bluesky post backing this track, if any. When set, the post's
  // app.bsky.feed.like likers are merged into the ❤️ reaction group.
  export let postUri: string | undefined = undefined;
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

  export let initialReactions: ReactionGroup[] = [];

  const dispatch = createEventDispatcher();

  // Reaction State (Grouped)
  interface ReactionUser {
    did: string;
    handle: string;
    avatar?: string;
    displayName?: string;
    reactionUri?: string;
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
    if (initialReactions && initialReactions.length > 0) {
      reactions = initialReactions;
    } else {
      loadReactions();
    }
  });

  async function loadReactions() {
    // Auto-post (Last.fm) tracks have no trackUri => no subjectUri, but they
    // still have a postUri whose Bluesky likes we can show.
    if (!subjectUri && !postUri) return;
    loadingReactions = true;
    try {
      // Parallel fetch: Indexer (Everyone) + PDS (Me) + Bluesky post likes
      const [res, myReaction, likes] = await Promise.all([
        subjectUri
          ? getBacklinks(subjectUri, REACTION_SOURCE)
          : Promise.resolve([] as Awaited<ReturnType<typeof getBacklinks>>),
        subjectUri ? getMyRecentReaction(subjectUri) : Promise.resolve(null),
        postUri
          ? getPostLikes(postUri)
          : Promise.resolve({ count: 0, dids: [] as string[] }),
      ]);

      const hydrated = await hydrateReactions(res);

      // Group by emoji -> [{did, uri}]
      const groups: Record<string, { did: string; uri: string }[]> = {};
      hydrated.forEach(({ record, authorDid, uri }) => {
        if (record.emoji) {
          if (!groups[record.emoji]) groups[record.emoji] = [];
          groups[record.emoji].push({ did: authorDid, uri });
        }
      });

      // Merge Bluesky post likes (app.bsky.feed.like) into the ❤️ group.
      // Likes are not our reaction records, so they carry no reactionUri (not toggleable here).
      if (likes.dids.length > 0) {
        if (!groups["❤️"]) groups["❤️"] = [];
        for (const likerDid of likes.dids) {
          if (!groups["❤️"].find((r) => r.did === likerDid)) {
            groups["❤️"].push({ did: likerDid, uri: "" });
          }
        }
      }

      // Merge My Reaction if missing
      if (myReaction) {
        const me = get(userProfile);
        if (me) {
          const emoji = myReaction.value.emoji || "👍";
          if (!groups[emoji]) groups[emoji] = [];
          // Check if already present
          if (!groups[emoji].find((r) => r.did === me.did)) {
            groups[emoji].push({ did: me.did, uri: myReaction.uri });
          }
        }
      }

      const allDids = Array.from(
        new Set(
          Object.values(groups)
            .flat()
            .map((i) => i.did),
        ),
      );
      let profilesMap = new Map<string, ReactionUser>();

      // Ensure we have 'my' profile locally to avoid fetch if possible
      const currentUser = get(userProfile);
      if (currentUser) {
        profilesMap.set(currentUser.did, {
          did: currentUser.did,
          handle: currentUser.handle,
          avatar: currentUser.avatar,
          displayName: currentUser.displayName,
        });
      }

      const didsToFetch = allDids.filter((did) => !profilesMap.has(did));

      if (didsToFetch.length > 0) {
        try {
          const chunks = [];
          for (let i = 0; i < didsToFetch.length; i += 25) {
            chunks.push(didsToFetch.slice(i, i + 25));
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

      reactions = Object.entries(groups).map(([emoji, items]) => ({
        emoji,
        users: items
          .map((item) => {
            // Priority: profilesMap, then fallback
            const p = profilesMap.get(item.did);
            const user = p
              ? { ...p }
              : { did: item.did, handle: "Unknown", displayName: "Unknown" };
            return { ...user, reactionUri: item.uri } as ReactionUser;
          })
          .filter((u): u is ReactionUser => !!u),
      }));
    } catch (e) {
      console.warn("Failed to load reactions", e);
    }
    loadingReactions = false;
  }

  async function handleToggleReaction(emoji: string) {
    if (!track && !playlist) return;

    // Optimistic Update
    showPicker = false;
    const currentUser = get(userProfile);
    if (currentUser) {
      const existingGroup = reactions.find((r) => r.emoji === emoji);
      const optimisticUser = {
        did: currentUser.did,
        handle: currentUser.handle,
        avatar: currentUser.avatar,
        displayName: currentUser.displayName,
      };

      let existingUserIndex = -1;
      let existingUser: ReactionUser | undefined;

      if (existingGroup) {
        existingUserIndex = existingGroup.users.findIndex(
          (u) => u.did === currentUser.did,
        );
        existingUser = existingGroup.users[existingUserIndex];
      }

      if (existingUser && existingGroup) {
        // REMOVE
        const oldUsers = [...existingGroup.users];
        existingGroup.users.splice(existingUserIndex, 1);
        if (existingGroup.users.length === 0) {
          reactions.splice(reactions.indexOf(existingGroup), 1);
        }
        reactions = reactions;

        try {
          if (existingUser.reactionUri) {
            const rkey = existingUser.reactionUri.split("/").pop();
            if (rkey) await deleteReactionRecord(rkey);
          } else {
            console.warn("No URI for reaction, cannot delete remotely yet.");
            loadReactions();
          }
        } catch (e) {
          console.error("Failed to delete reaction", e);
          alert("Failed to remove reaction.");
          loadReactions();
        }
      } else {
        // ADD
        if (existingGroup) {
          existingGroup.users = [...existingGroup.users, optimisticUser];
          reactions = reactions;
        } else {
          reactions = [...reactions, { emoji, users: [optimisticUser] }];
        }

        try {
          const res = await createReactionRecord({
            subjectUri,
            emoji,
            track,
            playlist,
          });
          // Update optimistic user with URI
          const g = reactions.find((r) => r.emoji === emoji);
          const u = g?.users.find((u) => u.did === currentUser.did);
          if (u) {
            u.reactionUri = (res as any).uri;
          }
          dispatch("reaction", emoji);
        } catch (e) {
          console.error("Failed to save reaction:", e);
          alert("Failed to save reaction.");
          loadReactions();
        }
      }
    }
  }

  const handleAddReaction = handleToggleReaction;
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
      <button
        class="relative group"
        on:mouseenter={() => (hoveredEmoji = rx.emoji)}
        on:mouseleave={() => (hoveredEmoji = null)}
        on:click={() => handleToggleReaction(rx.emoji)}
      >
        <div
          class="flex items-center gap-1 bg-gray-800/80 rounded-full px-3 py-1 border border-gray-700 font-bold text-white shadow-sm cursor-pointer select-none hover:border-green-500/50 transition-colors"
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
      </button>
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
