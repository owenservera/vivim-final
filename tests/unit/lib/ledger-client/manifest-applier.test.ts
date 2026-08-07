// tests/unit/lib/ledger-client/manifest-applier.test.ts
// ManifestApplier — cloud entries → local Prisma DB upserts

import { describe, expect, it, mock } from 'bun:test'
import { applyManifestEntries } from '../../../../src/lib/ledger-client/manifest-applier.js'
import type { LedgerEntry } from '../../../../src/lib/ledger-client/types.js'

function makeMockDb() {
  const store: Record<string, unknown[]> = {
    providerDefinition: [],
    providerEndpoint: [],
    providerParser: [],
    providerCapability: [],
    capabilityBinding: [],
    capabilityTaxonomy: [],
  }

  const _upsert = mock(async (table: string, _opts: Record<string, unknown>) => {
    const id = (_opts.where as Record<string, unknown>)?.id ?? 'new-id'
    store[table] = [...(store[table] ?? []), { id }]
    return { id }
  })

  return {
    prisma: {
      providerDefinition: { upsert: mock(async () => ({})) },
      providerEndpoint: { upsert: mock(async () => ({})) },
      providerParser: { upsert: mock(async () => ({})) },
      providerCapability: { upsert: mock(async () => ({})) },
      capabilityBinding: { upsert: mock(async () => ({})) },
      capabilityTaxonomy: { upsert: mock(async () => ({})) },
    },
    store,
  }
}

function makeEntry(contentJson: string, overrides?: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: 'entry-1',
    providerId: 'prov-1',
    manifestFile: 'provider.json',
    version: 1,
    hash: 'abc123',
    prevHash: null,
    signature: 'sig',
    status: 'verified',
    contentJson,
    changeSummary: null,
    actor: 'system',
    contributorId: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('manifest-applier', () => {
  it('processes empty entries', async () => {
    const db = makeMockDb()
    const result = await applyManifestEntries(db as never, [])
    expect(result.entriesProcessed).toBe(0)
    expect(result.upserted).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('upserts provider_definition entries', async () => {
    const db = makeMockDb()
    const entry = makeEntry(
      JSON.stringify({
        type: 'provider_definition',
        id: 'prov-1',
        slug: 'gemini',
        name: 'Gemini',
        description: 'Google Gemini',
        homepage: 'https://gemini.google.com',
        category: 'ai',
      }),
    )

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.upserted).toBe(1)
    expect(db.prisma.providerDefinition.upsert).toHaveBeenCalledTimes(1)
  })

  it('upserts provider_endpoint entries', async () => {
    const db = makeMockDb()
    const entry = makeEntry(
      JSON.stringify({
        type: 'provider_endpoint',
        id: 'ep-1',
        providerId: 'prov-1',
        endpointType: 'chat',
        url: 'https://gemini.google.com/app',
        method: 'POST',
      }),
    )

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.upserted).toBe(1)
    expect(db.prisma.providerEndpoint.upsert).toHaveBeenCalledTimes(1)
  })

  it('upserts provider_parser entries', async () => {
    const db = makeMockDb()
    const entry = makeEntry(
      JSON.stringify({
        type: 'provider_parser',
        id: 'parser-1',
        providerId: 'prov-1',
        parserName: 'gemini-batchexecute',
        parserVersion: 1,
        logicCode: 'exports.default = { parse(raw) { return [] } }',
        logicType: 'inline',
      }),
    )

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.upserted).toBe(1)
    expect(db.prisma.providerParser.upsert).toHaveBeenCalledTimes(1)
  })

  it('upserts provider_capability entries', async () => {
    const db = makeMockDb()
    const entry = makeEntry(
      JSON.stringify({
        type: 'provider_capability',
        id: 'cap-1',
        providerId: 'prov-1',
        capabilitySlug: 'send_message',
        capabilityType: 'action',
        authScope: 'session',
        description: 'Send a message',
      }),
    )

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.upserted).toBe(1)
    expect(db.prisma.providerCapability.upsert).toHaveBeenCalledTimes(1)
  })

  it('upserts capability_binding entries', async () => {
    const db = makeMockDb()
    const entry = makeEntry(
      JSON.stringify({
        type: 'capability_binding',
        id: 'bind-1',
        providerId: 'prov-1',
        capabilityId: 'global-cap-1',
        bindingConfig: '{}',
      }),
    )

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.upserted).toBe(1)
    expect(db.prisma.capabilityBinding.upsert).toHaveBeenCalledTimes(1)
  })

  it('upserts capability_taxonomy entries', async () => {
    const db = makeMockDb()
    const entry = makeEntry(
      JSON.stringify({
        type: 'capability_taxonomy',
        id: 'tax-1',
        providerId: 'prov-1',
        platformCategory: 'chat',
        interactionPattern: 'streaming',
        messageTypesJson: '["text"]',
        capabilitiesJson: '[]',
        constraintsJson: '{}',
        authRequirementsJson: '{}',
        discoveryHintsJson: '[]',
        nlpEntityTypesJson: '[]',
        nlpIntentPatternsJson: '[]',
        entityHierarchyJson: '{}',
        syncCapabilitiesJson: '[]',
      }),
    )

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.upserted).toBe(1)
    expect(db.prisma.capabilityTaxonomy.upsert).toHaveBeenCalledTimes(1)
  })

  it('reports errors for malformed contentJson', async () => {
    const db = makeMockDb()
    const entry = makeEntry('not-json{{')

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]?.entryId).toBe('entry-1')
  })

  it('skips unknown content types', async () => {
    const db = makeMockDb()
    const entry = makeEntry(JSON.stringify({ type: 'unknown_type', id: 'x' }))

    const result = await applyManifestEntries(db as never, [entry])
    expect(result.skipped).toBe(1)
  })

  it('processes mixed entry types in one batch', async () => {
    const db = makeMockDb()
    const entries = [
      makeEntry(JSON.stringify({ type: 'provider_definition', id: 'p1', slug: 'a', name: 'A' }), {
        id: 'e1',
      }),
      makeEntry(
        JSON.stringify({
          type: 'provider_endpoint',
          id: 'ep1',
          providerId: 'p1',
          endpointType: 'chat',
          url: 'http://a',
          method: 'GET',
        }),
        { id: 'e2' },
      ),
      makeEntry(
        JSON.stringify({
          type: 'provider_parser',
          id: 'pr1',
          providerId: 'p1',
          parserName: 'p',
          parserVersion: 1,
          logicCode: '//',
          logicType: 'inline',
        }),
        { id: 'e3' },
      ),
    ]

    const result = await applyManifestEntries(db as never, entries)
    expect(result.upserted).toBe(3)
    expect(result.errors).toEqual([])
  })
})
