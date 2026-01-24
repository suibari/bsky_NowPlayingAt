<script lang="ts">
	import "../routes/layout.css";
	import { onMount } from "svelte";
	import { getClient, publicAgent } from "$lib/atproto";
	import { ensureConfig } from "$lib/bsky";
	import { agent, userProfile, authState } from "$lib/stores";
	import { Agent } from "@atproto/api";

	let mounted = false;

	onMount(async () => {
		mounted = true;
		const client = getClient();
		if (!client) return;

		try {
			// 1. Init Client
			const res = await client.init();

			if (res && res.session) {
				const { session } = res;
				// 2. Create Agent with session
				const newAgent = new Agent(session);
				agent.set(newAgent);

				// 3. Fetch Profile
				const profileRes = await publicAgent.getProfile({ actor: session.did });
				userProfile.set(profileRes.data);

				authState.set({ isLoading: false, error: null, isAuthenticated: true });
				console.log("Authenticated as:", session.did);

				// 4. Ensure Config & Favorites Playlist
				ensureConfig(); // Fire and forget, or await if critical for UI
			} else {
				authState.set({
					isLoading: false,
					error: null,
					isAuthenticated: false,
				});
				console.log("Not authenticated");
			}
		} catch (e) {
			console.error("Auth init error:", e);
			authState.set({
				isLoading: false,
				error: String(e),
				isAuthenticated: false,
			});
		}
	});

	$: if (typeof window !== "undefined" && mounted && $authState.isLoading) {
		// Optional: loading spinner logic
	}
</script>

<div class="min-h-screen flex flex-col">
	<main class="flex-grow">
		<slot />
	</main>
</div>
