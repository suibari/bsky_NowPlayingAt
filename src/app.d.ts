// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: {
				CACHE: KVNamespace;
			};
		}
	}
}

declare module 'svelte/elements' {
	export interface HTMLAttributes<T> {
		"on:swipeLeft"?: (event: CustomEvent<void>) => void;
		"on:swipeRight"?: (event: CustomEvent<void>) => void;
	}
}

export { };
