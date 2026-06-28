import { json } from '@sveltejs/kit';
import { readSnapshotField } from '$lib/server/snapshot';

export async function GET(event) {
  if (!event.platform?.env?.CACHE) {
    return json({ data: null, stale: true }, { status: 200 });
  }

  try {
    const { data, updatedAt } = await readSnapshotField(event.platform.env.CACHE, 'user_profiles');

    if (data) {
      return json(
        { data, updatedAt, stale: false },
        { headers: { 'Cache-Control': 'public, max-age=60' } },
      );
    } else {
      return json({ data: null, stale: true }, { status: 200 });
    }
  } catch (e) {
    console.error('Failed to get user_profiles cache', e);
    return json({ data: null, stale: true }, { status: 200 });
  }
}
