// Deterministic, source-agnostic normalization for building recommendation keys.
// No embeddings / no CV extraction (see plan): Jaccard needs artist AND track to
// match, so CV-name unification doesn't change the score; NFKC + lowercase already
// unifies identical character-song renderings. We only strip Discogs disambiguation
// noise (trailing `*` or `(N)`) which is a real cross-source mismatch.

export function normalizeArtist(raw?: string): string {
  if (!raw) return '';
  let s = raw.normalize('NFKC');
  // Discogs disambiguation: "Nirvana (2)" / "米津玄師*"
  s = s.replace(/\s*\(\d+\)\s*$/, '').replace(/\*+\s*$/, '');
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

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
