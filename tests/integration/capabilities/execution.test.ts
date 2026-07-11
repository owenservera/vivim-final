// tests/integration/capabilities/execution.test.ts
// Integration tests for capability execution through real (fake) Chrome

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createFakeChrome } from '../helpers/fake-chrome.js'

const TEST_PORT = 9340

describe('Capability Execution Integration', () => {
  let fakeChrome: ReturnType<typeof createFakeChrome>

  beforeAll(() => {
    fakeChrome = createFakeChrome({ port: TEST_PORT })
  })

  afterAll(() => {
    fakeChrome?.stop()
  })

  test('fake Chrome serves version endpoint', async () => {
    const resp = await fetch(`http://127.0.0.1:${TEST_PORT}/json/version`)
    expect(resp.ok).toBe(true)

    const data = (await resp.json()) as { Browser: string; ProtocolVersion: string }
    expect(data).toHaveProperty('Browser')
    expect(data).toHaveProperty('ProtocolVersion')
  })

  test('fake Chrome serves protocol endpoint', async () => {
    const resp = await fetch(`http://127.0.0.1:${TEST_PORT}/json/protocol`)
    expect(resp.ok).toBe(true)

    const data = (await resp.json()) as { domains: Array<{ name: string }> }
    expect(data).toHaveProperty('domains')
    const domainNames = data.domains.map((d) => d.name)
    expect(domainNames).toContain('DOM')
    expect(domainNames).toContain('Runtime')
  })
})
