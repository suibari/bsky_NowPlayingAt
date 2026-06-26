import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function PUT(event) {
    const authHeader = event.request.headers.get('authorization');
    const secret = env.NOWPLAYINGAT_SHARED_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await event.request.json();
        const { key, data } = body;

        if (key !== 'hot' && key !== 'timeline' && key !== 'stats') {
            return json({ error: 'Invalid key' }, { status: 400 });
        }

        if (event.platform?.env?.CACHE) {
            await event.platform.env.CACHE.put(key, JSON.stringify(data), {
                metadata: { updatedAt: Date.now() }
            });
            return json({ success: true });
        } else {
            console.warn('CACHE binding not found in platform.env');
            return json({ error: 'Cache binding missing' }, { status: 500 });
        }
    } catch (e) {
        console.error('Failed to update cache', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
