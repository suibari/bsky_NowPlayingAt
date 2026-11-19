// Deterministic, source-agnostic normalization for building recommendation keys.
// No embeddings / no CV extraction (see plan): Jaccard needs artist AND track to
// match, so CV-name unification doesn't change the score; NFKC + lowercase already
// unifies identical character-song renderings. We only strip Discogs disambiguation
// noise (trailing `*` or `(N)`) which is a real cross-source mismatch.

// normalizeArtist is shared with the web app (artist pages look keys up with it).
import { normalizeArtist } from '../../shared/keys.js';
export { normalizeArtist };

export function normalizeTitle(raw?: string): string {
  if (!raw) return '';
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Stable per-song key used only for the recommendation profiles (Jaccard).
// Independent from bsky.ts `songKey` (which feeds the hot ranking).
export function recommendSongKey(artist?: string, track?: string): string {
  const a = normalizeArtist(artist);
  const t = normalizeTitle(track);
  if (!a && !t) return '';
  return `song:${a}::${t}`;
}
