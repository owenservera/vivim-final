// tests/unit/engines/cdp-discovery.test.ts
// Unit coverage for CDP protocol discovery (U1).

import { describe, expect, it } from 'bun:test'
import {
  CDP_PROTOCOL_CATALOG,
  type CdpProtocolJson,
  discoverCdpMethods,
  listCdpDomains,
  parseCdpProtocolJson,
} from '../../../src/engines/cdp-discovery.js'

describe('cdp-discovery', () => {
  it('parses a protocol.json descriptor into flat method descriptors', () => {
    const protocol: CdpProtocolJson = {
      domains: [
        {
          name: 'Runtime',
          commands: [
            { name: 'enable', description: 'Enables reporting.' },
            {
              name: 'evaluate',
              description: 'Evaluates expression.',
              parameters: [{ name: 'expression', type: 'string', description: 'expr' }],
              returns: [{ name: 'result', type: 'RemoteObject' }],
            },
          ],
        },
      ],
    }
    const methods = parseCdpProtocolJson(protocol)
    expect(methods).toHaveLength(2)
    expect(methods[1]?.fullName).toBe('Runtime.evaluate')
    expect(methods[1]?.parameters[0]?.name).toBe('expression')
    expect(methods[1]?.returns[0]?.name).toBe('result')
  })

  it('throws on a non-object protocol', () => {
    expect(() => parseCdpProtocolJson(null)).toThrow()
  })

  it('ships a non-empty curated catalog', () => {
    expect(CDP_PROTOCOL_CATALOG.length).toBeGreaterThan(20)
    expect(CDP_PROTOCOL_CATALOG.every((m) => m.fullName.includes('.'))).toBe(true)
  })

  it('lists distinct domains', () => {
    const domains = listCdpDomains(CDP_PROTOCOL_CATALOG)
    expect(domains).toContain('Runtime')
    expect(domains).toContain('Page')
    expect(new Set(domains).size).toBe(domains.length)
  })

  it('dedupes by fullName', () => {
    const dup = [
      ...CDP_PROTOCOL_CATALOG,
      CDP_PROTOCOL_CATALOG[0] ?? ({} as (typeof CDP_PROTOCOL_CATALOG)[number]),
    ]
    const out = discoverCdpMethods(dup)
    expect(out.length).toBe(CDP_PROTOCOL_CATALOG.length)
  })
})
