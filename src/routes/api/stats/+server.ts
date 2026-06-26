import { json } from '@sveltejs/kit';
import type { PlayStats } from '$lib/server/stats';

// Public endpoint: global cumulative play count + last 30 days of daily counts.
export async function GET(event) {
    const empty = { totalPlays: 0, daily: [] as { date: string; count: number }[] };

    if (!event.platform?.env?.CACHE) {
        return json(empty, { status: 200 });
    }

    try {
        const stats = (await event.platform.env.CACHE.get('stats', 'json')) as PlayStats | null;
        if (!stats) return json(empty, { status: 200 });

        const daily = Object.entries(stats.daily ?? {})
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)); // ascending

        return json(
            { totalPlays: stats.totalPlays ?? 0, daily },
            { headers: { 'Cache-Control': 'public, max-age=60' } }
        );
    } catch (e) {
        console.error('Failed to get stats cache', e);
        return json(empty, { status: 200 });
    }
}
