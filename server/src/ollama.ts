// Ollama client (poller-only; Cloudflare can't reach the LAN host).
// Used solely to map free-form Last.fm tags to canonical genres.
// Returns MULTIPLE genres on purpose: a track/artist is often composite
// (e.g. 米津玄師 → J-Pop + Rock), and collapsing to one loses signal for the
// genre-cosine half of the recommendation score.
// Embeddings (snowflake-arctic-embed2) were evaluated and abandoned — see
// normalize.ts. All failures here are non-fatal: callers fall back to no genre.

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1';
const CHAT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b';
const TIMEOUT_MS = 20_000;
const MAX_GENRES = 3;

// Fixed taxonomy. normalizeGenres only ever returns members of this list.
export const GENRES = [
  'Pop', 'Rock', 'Electronic', 'Hip-Hop', 'R&B', 'Jazz', 'Classical',
  'Anime', 'J-Pop', 'K-Pop', 'Metal', 'Folk', 'Country', 'Reggae',
  'Latin', 'Ambient', 'Funk', 'Soul', 'Punk', 'Instrumental',
] as const;

const CANON = new Map(GENRES.map((g) => [g.toLowerCase(), g]));

const SYSTEM_PROMPT =
  'You are a music genre classifier. Given a list of Last.fm tags for a track or artist, ' +
  'respond with 1 to 3 genres from this list that best apply, as a comma-separated list, ' +
  'most relevant first, and nothing else: ' +
  GENRES.join(', ') +
  '. If none apply, respond with "Other". Output only genre words separated by commas.';

// Maps free-form tags to up to MAX_GENRES canonical genres (most relevant first).
// Returns [] when nothing applies or on any failure.
export async function normalizeGenres(tags: string[]): Promise<string[]> {
  const clean = tags.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Tags: ${clean.join(', ')}` },
        ],
        temperature: 0,
        stream: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const out: string[] = [];
    for (const part of raw.split(',')) {
      const canon = CANON.get(part.trim().toLowerCase());
      if (canon && !out.includes(canon)) out.push(canon);
      if (out.length >= MAX_GENRES) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
