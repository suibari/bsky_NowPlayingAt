// Recommendation score for the ActivityCard "おすすめ度 N%" badge.
// score = 0.6 * Jaccard(song sets) + 0.4 * cosine(genre frequency vectors).
// Profiles are built server-side (poller getHotContent → KV 'user_profiles') so
// songKeys/genreFreq keys are already normalized & lowercased consistently; this
// only does math. See bsky_nowplayingat_server/src/{normalize,ollama}.ts for how
// the keys are derived (deterministic artist normalization, no embeddings).
export type UserProfile = {
  songKeys: string[];
  genreFreq: Record<string, number>;
};

export function computeScore(myProfile: UserProfile, theirProfile: UserProfile): number {
  const mySet = new Set(myProfile.songKeys);
  const theirSet = new Set(theirProfile.songKeys);
  const intersection = [...mySet].filter(k => theirSet.has(k)).length;
  const union = new Set([...mySet, ...theirSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const allGenres = new Set([
    ...Object.keys(myProfile.genreFreq),
    ...Object.keys(theirProfile.genreFreq),
  ]);
  let dot = 0, normA = 0, normB = 0;
  for (const g of allGenres) {
    const a = myProfile.genreFreq[g] ?? 0;
    const b = theirProfile.genreFreq[g] ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const genreCosine = normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));

  return Math.round((0.6 * jaccard + 0.4 * genreCosine) * 100);
}
