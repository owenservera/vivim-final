// frontend/src/components/JsonLd.tsx
// Server component — renders JSON-LD structured data for search engines.

export function JsonLd() {
  const siteUrl = process.env.SITE_HOST ?? 'http://localhost:3000'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Vivim',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Plugin-based, hot-swappable, live-configurable AI conversation UI system.',
    url: siteUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Vivim',
      url: siteUrl,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
