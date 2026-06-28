// Recommendation score for the ActivityCard "おすすめ度 N%" badge.
// Final score = 0.5 * trackScore + 0.5 * userScore
//   trackScore = 0.6 * artistScore + 0.4 * genreScore
//   userScore  = 0.6 * artistSim   + 0.4 * genreCosine
// Profiles are built server-side (poller getHotContent → KV 'user_profiles').
// artistFreq/genreFreq keys are normalized & lowercased. songKeys is kept for
// backward compatibility but is no longer used in scoring.
export type UserProfile = {
  songKeys: string[];
  genreFreq: Record<string, number>;
  artistFreq: Record<string, number>;
};

// Mirrors server-side normalizeArtist (normalize.ts): NFKC + Discogs strip + lowercase.
function normalizeArtistStr(raw: string): string {
  let s = raw.normalize('NFKC');
  s = s.replace(/\s*\(\d+\)\s*$/, '').replace(/\*+\s*$/, '');
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Split compound artist strings on common delimiters (feat., ×, &, with, vs., ,).
const ARTIST_SPLIT_RE = /\s*(?:feat\.?|ft\.?|[××]|&|with|vs\.?|,)\s*/gi;
const MIN_PARTIAL_LEN = 3;

function splitArtistParts(normalized: string): string[] {
  return normalized.split(ARTIST_SPLIT_RE).map(p => p.trim()).filter(p => p.length >= 2);
}

// Two artist parts match when equal, or one is a substring of the other (min 3 chars).
function partsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_PARTIAL_LEN && longer.includes(shorter);
}

// Artist strings match when any of their parts cross-match.
function artistMatches(a: string, b: string): boolean {
  const pa = splitArtistParts(a);
  const pb = splitArtistParts(b);
  return pa.some(x => pb.some(y => partsMatch(x, y)));
}

// Soft cosine between two artist-freq vectors: partial matches count as the same dimension.
function computeUserArtistSim(
  myFreq: Record<string, number>,
  theirFreq: Record<string, number>
): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [a, fa] of Object.entries(myFreq)) {
    for (const [b, fb] of Object.entries(theirFreq)) {
      if (artistMatches(a, b)) dot += fa * fb;
    }
    normA += fa * fa;
  }
  for (const fb of Object.values(theirFreq)) normB += fb * fb;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Standard cosine similarity between two genre-freq vectors.
function computeGenreCosine(
  myFreq: Record<string, number>,
  theirFreq: Record<string, number>
): number {
  const allGenres = new Set([...Object.keys(myFreq), ...Object.keys(theirFreq)]);
  let dot = 0, normA = 0, normB = 0;
  for (const g of allGenres) {
    const a = myFreq[g] ?? 0;
    const b = theirFreq[g] ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// User-to-user compatibility: 60% artist similarity + 40% genre similarity. Returns 0–100.
export function computeScore(myProfile: UserProfile, theirProfile: UserProfile): number {
  const artistSim = computeUserArtistSim(myProfile.artistFreq, theirProfile.artistFreq);
  const genreCosine = computeGenreCosine(myProfile.genreFreq, theirProfile.genreFreq);
  return Math.round((0.6 * artistSim + 0.4 * genreCosine) * 100);
}

// How well a track's artist matches the user's artist listening history. Returns 0–100.
export function computeTrackArtistScore(
  trackArtist: string,
  myArtistFreq: Record<string, number>
): number {
  const normalized = normalizeArtistStr(trackArtist);
  if (!normalized) return 0;
  const maxFreq = Math.max(...Object.values(myArtistFreq), 0);
  if (maxFreq === 0) return 0;
  let match = 0;
  for (const [artist, freq] of Object.entries(myArtistFreq)) {
    if (artistMatches(normalized, artist)) match += freq;
  }
  return Math.round(match / maxFreq * 100);
}

// How well a track's genres match the user's genre listening history. Returns 0–100.
export function computeTrackGenreScore(
  trackGenres: string[],
  myGenreFreq: Record<string, number>
): number {
  if (trackGenres.length === 0) return 0;
  const total = Object.values(myGenreFreq).reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const match = trackGenres.reduce(
    (s, g) => s + (myGenreFreq[g.trim().toLowerCase()] ?? 0),
    0
  );
  return Math.round(match / total * 100);
}
