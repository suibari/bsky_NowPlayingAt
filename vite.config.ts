import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit(),
        SvelteKitPWA({
            manifest: {
                name: 'なうぷれあっと',
                short_name: 'NowPlayingAt',
                description: '音楽共有ATprotoサービス',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'favicon.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'favicon.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ]
});
