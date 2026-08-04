import { describe, test, expect } from 'bun:test'
import { validateHoneypot, honeypotInputProps } from '@/lib/honeypot'

describe('honeypot', () => {
  test('returns props with hidden styling', () => {
    const props = honeypotInputProps()
    expect(props.name).toBe('website_url')
    expect(props.tabIndex).toBe(-1)
    expect(props['aria-hidden']).toBe('true')
    expect(props.style.position).toBe('absolute')
  })

  test('validHoneypot accepts empty field + slow submission', () => {
    const result = validateHoneypot({}, Date.now() - 5000)
    expect(result.ok).toBe(true)
  })

  test('validateHoneypot rejects filled honeypot field', () => {
    const result = validateHoneypot({ website_url: 'http://spam.com' }, Date.now() - 5000)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('honeypot_filled')
  })

  test('validateHoneypot rejects too-fast submission', () => {
    const result = validateHoneypot({}, Date.now() - 500)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('too_fast')
  })
})

describe('LiveRegion', () => {
  test('renders with role=status and aria-live', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { LiveRegion } = await import('@/components/AccessibleForm')
    const html = renderToStaticMarkup(LiveRegion({ message: 'Form submitted' }))
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Form submitted')
  })
})

describe('AccessibleForm', () => {
  test('component is a function', async () => {
    const mod = await import('@/components/AccessibleForm')
    expect(typeof mod.AccessibleForm).toBe('function')
  })
})
