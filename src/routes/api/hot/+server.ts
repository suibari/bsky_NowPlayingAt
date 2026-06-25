import { json } from '@sveltejs/kit';

export async function GET(event) {
    if (!event.platform?.env?.CACHE) {
        return json({ data: null, stale: true }, { status: 200 });
    }

    try {
        const { value, metadata } = await event.platform.env.CACHE.getWithMetadata('hot', 'json');
        
        if (value) {
            return json(
                { data: value, updatedAt: metadata?.updatedAt, stale: false },
                {
                    headers: {
                        'Cache-Control': 'public, max-age=60'
                    }
                }
            );
        } else {
            return json({ data: null, stale: true }, { status: 200 });
        }
    } catch (e) {
        console.error('Failed to get hot cache', e);
        return json({ data: null, stale: true }, { status: 200 });
    }
}
