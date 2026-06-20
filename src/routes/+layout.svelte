<script lang="ts">
	import "../routes/layout.css";
	import { onMount } from "svelte";
	import { publicAgent } from "$lib/atproto";
	import { ensureConfig } from "$lib/bsky";
	import { agent, userProfile, authState } from "$lib/stores";
	import { Agent } from "@atproto/api";

	let mounted = false;

	onMount(async () => {
		mounted = true;

		try {
			// Check session via server-side cookie
			const res = await fetch("/api/me");

			if (res.ok) {
				const data = await res.json();
				// Set a minimal agent-like object for client code that checks authState
				// Actual Bluesky calls go through server routes
				agent.set(new Agent({ service: 'https://public.api.bsky.app' }) as any);

				const profileRes = await publicAgent.getProfile({ actor: data.did });
				userProfile.set(profileRes.data);

				authState.set({ isLoading: false, error: null, isAuthenticated: true });
				console.log("Authenticated as:", data.did);

				ensureConfig();
			} else {
				authState.set({ isLoading: false, error: null, isAuthenticated: false });
				console.log("Not authenticated");
			}
		} catch (e) {
			console.error("Auth init error:", e);
			authState.set({ isLoading: false, error: String(e), isAuthenticated: false });
		}
	});
</script>

<div class="min-h-screen flex flex-col">
	<main class="flex-grow">
		<slot />
	</main>
</div>
