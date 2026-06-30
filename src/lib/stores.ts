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

// Per-viewer muted-did set. Lazily fetched on first subscribe (mirrors
// timelineStore's lazy-subscribe pattern) but with no polling timer, since
// mutes only change via direct user action (handled with local optimistic
// updates via add()/remove()).
export type MutedDidsState = {
  dids: Set<string>;
  loaded: boolean;
};

function createMutedDidsStore() {
  const { subscribe: _sub, update } = writable<MutedDidsState>({
    dids: new Set(),
    loaded: false,
  });

  let subscriberCount = 0;
  let fetched = false;

  async function doFetch() {
    try {
      const res = await fetch('/api/mutes');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.mutedDids)) {
          update(() => ({ dids: new Set(json.mutedDids), loaded: true }));
          return;
        }
      }
      update((s) => ({ ...s, loaded: true }));
    } catch {
      update((s) => ({ ...s, loaded: true }));
    }
  }

  return {
    subscribe(
      run: (value: MutedDidsState) => void,
      invalidate?: (value?: MutedDidsState) => void,
    ): () => void {
      const unsub = _sub(run, invalidate);
      subscriberCount++;
      if (subscriberCount === 1 && !fetched && typeof window !== 'undefined') {
        fetched = true;
        doFetch();
      }
      return () => {
        unsub();
        subscriberCount--;
      };
    },
    add(did: string) {
      update((s) => ({ ...s, dids: new Set(s.dids).add(did) }));
    },
    remove(did: string) {
      update((s) => {
        const next = new Set(s.dids);
        next.delete(did);
        return { ...s, dids: next };
      });
    },
    reset() {
      fetched = false;
      update(() => ({ dids: new Set(), loaded: false }));
    },
  };
}

export const mutedDidsStore = createMutedDidsStore();
