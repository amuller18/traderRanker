import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://traderranker.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/account/',
          '/watchlist/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
