import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const BASE = 'https://gocart.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/delivery/', '/sell', '/ride', '/terms', '/privacy', '/refunds'],
        disallow: [
          '/home',
          '/checkout',
          '/orders',
          '/wallet',
          '/account',
          '/vendor',
          '/rider',
          '/admin',
          '/login',
          '/start',
          '/welcome',
          '/pay',
          '/api/',
          '/track/',
        ],
      },
      // Let AI crawlers index public pages
      { userAgent: 'GPTBot', allow: ['/'] },
      { userAgent: 'ClaudeBot', allow: ['/'] },
      { userAgent: 'PerplexityBot', allow: ['/'] },
      { userAgent: 'Google-Extended', allow: ['/'] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
