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
