import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsonLd } from '@/components/JsonLd'

describe('JsonLd', () => {
  test('renders valid JSON-LD script tag', () => {
    const html = renderToStaticMarkup(JsonLd())
    expect(html).toContain('application/ld+json')
    expect(html).toContain('@context')
    expect(html).toContain('schema.org')
    expect(html).toContain('SoftwareApplication')
  })

  test('contains required fields', () => {
    const html = renderToStaticMarkup(JsonLd())
    expect(html).toContain('"name":"Vivim"')
    expect(html).toContain('"applicationCategory"')
    expect(html).toContain('"operatingSystem":"Web"')
  })
})

describe('robots.ts', () => {
  test('exports a function returning robots config', async () => {
    const { default: robots } = await import('@/app/robots')
    const result = robots()
    expect(result.rules).toBeDefined()
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0]).toHaveProperty('userAgent')
    expect(result.sitemap).toContain('/sitemap.xml')
  })
})

describe('sitemap.ts', () => {
  test('exports a function returning sitemap entries', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const result = sitemap()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('lastModified')
  })
})
