/** robots.txt — dynamic route for Next.js App Router */

import { MetadataRoute } from 'next'

const host = process.env.SITE_HOST ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/canvas/', '/_next/'],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
  }
}
