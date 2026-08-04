/** sitemap.xml — dynamic route for Next.js App Router */

import type { MetadataRoute } from 'next'

const host = process.env.SITE_HOST ?? 'http://localhost:3000'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const routes: MetadataRoute.Sitemap = [
    {
      url: host,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  return routes
}
