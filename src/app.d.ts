// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'svelte/elements' {
	export interface HTMLAttributes<T> {
		"on:swipeLeft"?: (event: CustomEvent<void>) => void;
		"on:swipeRight"?: (event: CustomEvent<void>) => void;
	}
}

export { };
