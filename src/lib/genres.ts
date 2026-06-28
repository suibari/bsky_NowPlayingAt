// Canonical genre taxonomy. Must stay in sync with the server-side definition
// in `bsky_nowplayingat_server/src/ollama.ts` (GENRES). History records store
// genres normalized to this list; report charts/titles use it for axes.
export const GENRES = [
  'Pop', 'Rock', 'Electronic', 'Hip-Hop', 'R&B', 'Jazz', 'Classical',
  'Anime', 'J-Pop', 'K-Pop', 'Metal', 'Folk', 'Country', 'Reggae',
  'Latin', 'Ambient', 'Funk', 'Soul', 'Punk', 'Instrumental',
] as const;
