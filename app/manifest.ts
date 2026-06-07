import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'UchiLog',
        short_name: 'UchiLog',
        description: '身内向けのライフログ共有サービス',
        start_url: '/timeline',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f1e8',
        theme_color: '#fbf9f4',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/uchilog-icon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'maskable',
            },
        ],
    }
}
