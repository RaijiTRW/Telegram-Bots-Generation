import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/site/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/ru',
          '/en',
          '/ru/pricing',
          '/en/pricing',
          '/ru/docs',
          '/en/docs',
        ],
        disallow: [
          '/auth/',
          '/dashboard/',
          '/maintenance',
          '/api/',
          '/ru/auth/',
          '/en/auth/',
          '/ru/dashboard/',
          '/en/dashboard/',
          '/ru/maintenance',
          '/en/maintenance',
        ],
      },
    ],
    sitemap: `${absoluteUrl()}/sitemap.xml`,
    host: absoluteUrl(),
  }
}

