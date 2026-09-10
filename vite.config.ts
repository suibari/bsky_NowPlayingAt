import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    // ATProto requires the loopback client's redirect_uri to use 127.0.0.1 (never
    // "localhost"), so serve dev on 127.0.0.1 as well: the OAuth callback then lands
    // on the same origin the session cookie was issued for.
    server: {
        host: '127.0.0.1'
    },
    plugins: [
        tailwindcss(),
        sveltekit(),
        SvelteKitPWA({
            manifest: {
                name: 'なうぷれあっと',
                short_name: 'NowPlayingAt',
                description: '音楽共有ATprotoサービス',
                theme_color: '#000000',
                background_color: '#000000',
                icons: [
                    {
                        src: 'favicon.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'favicon.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ]
});
