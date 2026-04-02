import type { MetadataRoute } from 'next'

import { PUBLIC_SITE } from '@/lib/site/public-config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PUBLIC_SITE.brandName} - Telegram Bot Builder`,
    short_name: PUBLIC_SITE.brandName,
    description: 'Create Telegram bots for leads, booking, FAQ, funnels, and business automation.',
    start_url: '/ru',
    display: 'standalone',
    background_color: '#05070A',
    theme_color: '#05070A',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

