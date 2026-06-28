import { writable } from 'svelte/store';
import type { Agent } from '@atproto/api';

export interface UserProfile {
  did: string;
  handle: string;
  avatar?: string;
  displayName?: string;
  description?: string;
}

export const agent = writable<Agent | null>(null);
export const userProfile = writable<UserProfile | null>(null);
export const authState = writable<{
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}>({
  isLoading: true,
  error: null,
  isAuthenticated: false,
});

// Shared timeline store — single source of truth for /api/timeline data.
// All components subscribe here instead of fetching independently.
const TIMELINE_REFRESH_MS = 3 * 60 * 1000;
const TIMELINE_STALE_MS = 30 * 1000;

export type TimelineState = {
  data: any[] | null; // null = not yet loaded
  loading: boolean;
  error: boolean;
};

function createTimelineStore() {
  const { subscribe: _sub, set, update } = writable<TimelineState>({
    data: null,
    loading: true,
    error: false,
  });

  let subscriberCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastFetchedAt = 0;

  async function doFetch() {
    try {
      const res = await fetch('/api/timeline');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          set({ data: json.data, loading: false, error: false });
        } else {
          update((s) => ({ ...s, loading: false, error: true }));
        }
      } else {
        update((s) => ({ ...s, loading: false, error: true }));
      }
    } catch {
      update((s) => ({ ...s, loading: false, error: true }));
    }
    lastFetchedAt = Date.now();
  }

  function onVisChange() {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastFetchedAt > TIMELINE_STALE_MS) doFetch();
  }

  function start() {
    doFetch();
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') doFetch();
    }, TIMELINE_REFRESH_MS);
    document.addEventListener('visibilitychange', onVisChange);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener('visibilitychange', onVisChange);
  }

  return {
    subscribe(
      run: (value: TimelineState) => void,
      invalidate?: (value?: TimelineState) => void,
    ): () => void {
      const unsub = _sub(run, invalidate);
      subscriberCount++;
      if (subscriberCount === 1 && typeof window !== 'undefined') start();
      return () => {
        unsub();
        subscriberCount--;
        if (subscriberCount === 0) stop();
      };
    },
  };
}

export const timelineStore = createTimelineStore();
