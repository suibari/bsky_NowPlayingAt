// The poller writes 'hot', 'timeline' and 'user_profiles' as a single 'snapshot'
// KV entry to stay under the 1000 writes/day limit. Read endpoints use this helper
// to pull one field back out while keeping their original response shape.
export type SnapshotField = 'hot' | 'timeline' | 'user_profiles';

type Cache = App.Platform['env']['CACHE'];

export async function readSnapshotField(
  cache: Cache,
  field: SnapshotField,
): Promise<{ data: unknown; updatedAt: number | undefined }> {
  const { value, metadata } = await cache.getWithMetadata<Record<string, unknown>, { updatedAt: number }>(
    'snapshot',
    'json',
  );
  return { data: value?.[field] ?? null, updatedAt: metadata?.updatedAt };
}
