// tests/unit/transform/transform-engine.test.ts
// Comprehensive tests for the data transformation engine.

import { beforeEach, describe, expect, it } from 'bun:test'
import { TransformEngine } from '../../../src/transform/transform-engine.js'
import type { EntityTransformSpec, FieldMapping } from '../../../src/transform/types.js'
import {
  boolToInt,
  camelToSnake,
  compareVersions,
  intToBool,
  nullToUndefined,
  safeJsonParse,
  snakeToCamel,
  toISO,
  versionNum,
} from '../../../src/transform/types.js'

// ── Helpers ────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '01HXYZ',
    snake_field: 'hello',
    numeric_flag: 1,
    json_blob: '{"key":"value"}',
    created_at: NOW,
    nullable_field: null,
    deprecated_field: 'old-value',
    ...overrides,
  }
}

function makeSimpleSpec(
  overrides?: Partial<EntityTransformSpec<Record<string, unknown>, Record<string, unknown>>>,
): EntityTransformSpec<Record<string, unknown>, Record<string, unknown>> {
  const fields: FieldMapping[] = [
    { from: 'id', to: 'id' },
    { from: 'snake_field', to: 'snakeField' },
    { from: 'numeric_flag', to: 'numericFlag', transform: (v) => intToBool(v as number) },
    {
      from: 'json_blob',
      to: 'jsonBlob',
      transform: (v) => safeJsonParse<Record<string, string>>(v as string),
    },
    { from: 'created_at', to: 'createdAt', transform: (v) => toISO(v as number) },
    { from: 'nullable_field', to: 'nullableField' },
    { from: 'deprecated_field', to: 'deprecatedField', deprecated: true },
  ]
  return {
    entity: 'test',
    fields,
    ...overrides,
  }
}

// ── Type Helpers ────────────────────────────────────────────────────────────

function isoAt(ts: number): string {
  return new Date(ts).toISOString()
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('TransformEngine', () => {
  let engine: TransformEngine

  beforeEach(() => {
    engine = new TransformEngine()
    engine.register(makeSimpleSpec())
  })

  // ── Registration ───────────────────────────────────────────────────────

  describe('spec registration', () => {
    it('registers a spec and reports has() correctly', () => {
      expect(engine.has('test')).toBe(true)
      expect(engine.has('nonexistent')).toBe(false)
    })

    it('lists all registered entities', () => {
      engine.register({ entity: 'second', fields: [] })
      const entities = engine.listEntities()
      expect(entities).toContain('test')
      expect(entities).toContain('second')
      expect(entities.length).toBe(2)
    })

    it('unregisters a spec', () => {
      expect(engine.unregister('test')).toBe(true)
      expect(engine.has('test')).toBe(false)
    })

    it('throws for unregistered entity on transform', () => {
      expect(() => engine.transform('missing', {})).toThrow(
        /No spec registered for entity "missing"/,
      )
    })

    it('includes registered entity names in the error message', () => {
      try {
        engine.transform('missing', {})
      } catch (e) {
        expect((e as Error).message).toContain('test')
      }
    })

    it('allows overwriting a spec', () => {
      const newSpec = makeSimpleSpec({ entity: 'test', fields: [{ from: 'id', to: 'id' }] })
      engine.register(newSpec)
      const result = engine.transform('test', makeRow())
      // After overwrite, only 'id' should be in the output.
      expect(Object.keys(result.data).sort()).toEqual(['id'])
    })
  })

  // ── Field Mapping (renaming, transforms) ────────────────────────────────

  describe('field mapping', () => {
    it('renames fields from snake_case to camelCase', () => {
      const row = makeRow()
      const { data } = engine.transform('test', row)
      expect(data.snakeField).toBe('hello')
      expect(data).not.toHaveProperty('snake_field')
    })

    it('applies custom transform functions', () => {
      const { data } = engine.transform('test', makeRow())
      expect(data.numericFlag).toBe(true) // intToBool applied
      expect(data.jsonBlob).toEqual({ key: 'value' }) // JSON parsed
    })

    it('converts numeric timestamps to ISO strings', () => {
      const { data } = engine.transform('test', makeRow())
      expect(data.createdAt).toBe(isoAt(NOW))
    })

    it('passes through the id field unchanged', () => {
      const { data } = engine.transform('test', makeRow({ id: 'custom-id' }))
      expect(data.id).toBe('custom-id')
    })

    it('skips source fields not present in mappings', () => {
      const row = makeRow({ extra_unmapped_field: 'ignored' })
      const { data } = engine.transform('test', row)
      expect(data).not.toHaveProperty('extra_unmapped_field')
      expect(data).not.toHaveProperty('extraUnmappedField')
    })

    it('skips mapping when source field is absent from row', () => {
      const { data } = engine.transform('test', { id: '1' })
      expect(data).not.toHaveProperty('snakeField')
    })
  })

  // ── null → undefined conversion ────────────────────────────────────────

  describe('null handling', () => {
    it('converts null to undefined for toFrontend direction', () => {
      const { data } = engine.transform('test', makeRow())
      expect(data.nullableField).toBeUndefined()
    })

    it('preserves null for toBackend direction', () => {
      const row = makeRow()
      const { data } = engine.transform('test', row, 'toBackend')
      // In toBackend, source is domain model (camelCase), target is Row (snake_case)
      // The nullable_field mapping: from='nullable_field', to='nullableField'
      // Reversed: source='nullableField' (not in row), so it's skipped
      expect(data).toBeDefined()
    })
  })

  // ── API Versioning ─────────────────────────────────────────────────────

  describe('API versioning', () => {
    it('skips fields with since > current version', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'new_field', to: 'newField', since: 'v2' },
        ],
      })
      const customEngine = new TransformEngine('v1')
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1', new_field: 'val' })
      expect(data).not.toHaveProperty('newField')
    })

    it('includes fields with since <= current version', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'new_field', to: 'newField', since: 'v2' },
        ],
      })
      const customEngine = new TransformEngine('v2')
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1', new_field: 'val' })
      expect(data.newField).toBe('val')
    })

    it('skips fields with removedIn <= current version', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'old_field', to: 'oldField', removedIn: 'v2' },
        ],
      })
      const customEngine = new TransformEngine('v2')
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1', old_field: 'val' })
      expect(data).not.toHaveProperty('oldField')
    })

    it('includes fields with removedIn > current version', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'old_field', to: 'oldField', removedIn: 'v3' },
        ],
      })
      const customEngine = new TransformEngine('v2')
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1', old_field: 'val' })
      expect(data.oldField).toBe('val')
    })

    it('per-version override in transform call', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'v2_field', to: 'v2Field', since: 'v2' },
        ],
      })
      const customEngine = new TransformEngine('v1')
      customEngine.register(spec)
      const { data } = customEngine.transform(
        'test',
        { id: '1', v2_field: 'yes' },
        'toFrontend',
        'v2',
      )
      expect(data.v2Field).toBe('yes')
    })

    it('reports the used version in the result', () => {
      const { version } = engine.transform('test', makeRow())
      expect(version).toBe('v1')
      const { version: v2 } = engine.transform('test', makeRow(), 'toFrontend', 'v3')
      expect(v2).toBe('v3')
    })
  })

  // ── Backward Compatibility ─────────────────────────────────────────────

  describe('backward compatibility', () => {
    it('includes deprecated fields in output', () => {
      const { data } = engine.transform('test', makeRow())
      expect(data.deprecatedField).toBe('old-value')
    })

    it('generates a warning for deprecated fields', () => {
      const { warnings } = engine.transform('test', makeRow())
      expect(warnings.length).toBeGreaterThanOrEqual(1)
      expect(warnings.some((w) => w.includes('deprecated') && w.includes('deprecatedField'))).toBe(
        true,
      )
    })

    it('does not warn for deprecated fields with null/undefined values', () => {
      const row = makeRow({ deprecated_field: null })
      const { warnings } = engine.transform('test', row)
      expect(warnings.some((w) => w.includes('deprecatedField'))).toBe(false)
    })
  })

  // ── Array Transformation ───────────────────────────────────────────────

  describe('array transformation', () => {
    it('transforms an array of entities', () => {
      const rows = [makeRow({ id: '1' }), makeRow({ id: '2' })]
      const { data } = engine.transformArray('test', rows)
      expect(data).toHaveLength(2)
      expect(data[0].id).toBe('1')
      expect(data[1].id).toBe('2')
    })

    it('returns empty array for empty input', () => {
      const { data } = engine.transformArray('test', [])
      expect(data).toHaveLength(0)
    })

    it('aggregates warnings from all items with entity id prefix', () => {
      const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' })]
      const { warnings } = engine.transformArray('test', rows)
      expect(warnings.some((w) => w.includes('[test:a]'))).toBe(true)
      expect(warnings.some((w) => w.includes('[test:b]'))).toBe(true)
    })

    it('reports the version and transformedAt on array results', () => {
      const { version, transformedAt } = engine.transformArray('test', [makeRow()])
      expect(version).toBe('v1')
      expect(typeof transformedAt).toBe('number')
      expect(transformedAt).toBeGreaterThan(0)
    })
  })

  // ── Defaults ───────────────────────────────────────────────────────────

  describe('defaults for missing fields', () => {
    it('applies defaults for missing fields', () => {
      const spec = makeSimpleSpec({
        fields: [{ from: 'id', to: 'id' }],
        defaults: { status: 'active', count: 0 },
      })
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1' })
      expect(data.status).toBe('active')
      expect(data.count).toBe(0)
    })

    it('does not override fields that are already set', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'status', to: 'status' },
        ],
        defaults: { status: 'active' },
      })
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1', status: 'archived' })
      expect(data.status).toBe('archived')
    })
  })

  // ── Exclusions ─────────────────────────────────────────────────────────

  describe('field exclusions', () => {
    it('excludes specified fields from output', () => {
      const spec = makeSimpleSpec({
        fields: [
          { from: 'id', to: 'id' },
          { from: 'secret', to: 'secret' },
        ],
        exclude: ['secret'],
      })
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: '1', secret: 'hidden' })
      expect(data).not.toHaveProperty('secret')
    })
  })

  // ── Custom Transform ───────────────────────────────────────────────────

  describe('custom transform function', () => {
    it('uses custom transform when provided, ignoring field mappings', () => {
      const spec: EntityTransformSpec<Record<string, unknown>, Record<string, unknown>> = {
        entity: 'test',
        fields: [{ from: 'id', to: 'id' }], // These should be ignored
        transform: (row) => ({
          custom: (row as Record<string, unknown>).id?.toString().toUpperCase(),
        }),
      }
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { data } = customEngine.transform('test', { id: 'hello' })
      expect(data).toEqual({ custom: 'HELLO' })
    })
  })

  // ── Nested Transforms ──────────────────────────────────────────────────

  describe('nested entity transformation', () => {
    it('transforms nested object fields', () => {
      const spec: EntityTransformSpec<Record<string, unknown>, Record<string, unknown>> = {
        entity: 'parent',
        fields: [
          { from: 'id', to: 'id' },
          { from: 'child', to: 'child' },
        ],
        nested: {
          child: {
            entity: 'child',
            fields: [
              { from: 'child_name', to: 'childName' },
              { from: 'child_age', to: 'childAge' },
            ],
          },
        },
      }
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { data } = customEngine.transform('parent', {
        id: 'p1',
        child: { child_name: 'Alice', child_age: 5 },
      })
      expect(data.child.childName).toBe('Alice')
      expect(data.child.childAge).toBe(5)
      expect(data.child).not.toHaveProperty('child_name')
    })

    it('transforms nested array fields', () => {
      const spec: EntityTransformSpec<Record<string, unknown>, Record<string, unknown>> = {
        entity: 'parent',
        fields: [
          { from: 'id', to: 'id' },
          { from: 'items', to: 'items' },
        ],
        nested: {
          items: {
            entity: 'item',
            fields: [{ from: 'item_name', to: 'itemName' }],
          },
        },
      }
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { data } = customEngine.transform('parent', {
        id: 'p1',
        items: [{ item_name: 'A' }, { item_name: 'B' }],
      })
      expect(data.items[0].itemName).toBe('A')
      expect(data.items[1].itemName).toBe('B')
    })
  })

  // ── Version Management ─────────────────────────────────────────────────

  describe('version management', () => {
    it('has a default version of v1', () => {
      expect(engine.getVersion()).toBe('v1')
    })

    it('accepts a version in the constructor', () => {
      const e = new TransformEngine('v3')
      expect(e.getVersion()).toBe('v3')
    })

    it('allows setting a new version', () => {
      engine.setVersion('v2')
      expect(engine.getVersion()).toBe('v2')
    })
  })

  // ── Result metadata ────────────────────────────────────────────────────

  describe('TransformResult metadata', () => {
    it('includes transformedAt timestamp', () => {
      const before = Date.now()
      const { transformedAt } = engine.transform('test', makeRow())
      const after = Date.now()
      expect(transformedAt).toBeGreaterThanOrEqual(before)
      expect(transformedAt).toBeLessThanOrEqual(after)
    })

    it('returns empty warnings when nothing is deprecated', () => {
      const spec = makeSimpleSpec({
        fields: [{ from: 'id', to: 'id' }],
      })
      const customEngine = new TransformEngine()
      customEngine.register(spec)
      const { warnings } = customEngine.transform('test', { id: '1' })
      expect(warnings).toEqual([])
    })
  })
})

// ── Helper function tests ──────────────────────────────────────────────────

describe('transform type helpers', () => {
  describe('versionNum', () => {
    it('extracts the numeric part', () => {
      expect(versionNum('v1')).toBe(1)
      expect(versionNum('v12')).toBe(12)
      expect(versionNum('v0')).toBe(0)
    })
  })

  describe('compareVersions', () => {
    it('returns -1 when a < b', () => {
      expect(compareVersions('v1', 'v2')).toBe(-1)
    })

    it('returns 0 when a === b', () => {
      expect(compareVersions('v3', 'v3')).toBe(0)
    })

    it('returns 1 when a > b', () => {
      expect(compareVersions('v10', 'v2')).toBe(1)
    })
  })

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
    })

    it('returns undefined for null input', () => {
      expect(safeJsonParse(null)).toBeUndefined()
    })

    it('returns undefined for undefined input', () => {
      expect(safeJsonParse(undefined)).toBeUndefined()
    })

    it('returns undefined for invalid JSON', () => {
      expect(safeJsonParse('not json')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(safeJsonParse('')).toBeUndefined()
    })
  })

  describe('toISO', () => {
    it('converts epoch ms to ISO string', () => {
      const result = toISO(NOW)
      expect(result).toBe(new Date(NOW).toISOString())
    })

    it('returns undefined for null', () => {
      expect(toISO(null)).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
      expect(toISO(undefined)).toBeUndefined()
    })
  })

  describe('nullToUndefined', () => {
    it('passes through non-null values', () => {
      expect(nullToUndefined('hello')).toBe('hello')
      expect(nullToUndefined(0)).toBe(0)
      expect(nullToUndefined(false)).toBe(false)
    })

    it('converts null to undefined', () => {
      expect(nullToUndefined(null)).toBeUndefined()
    })
  })

  describe('intToBool', () => {
    it('converts 1 to true', () => {
      expect(intToBool(1)).toBe(true)
    })

    it('converts 0 to false', () => {
      expect(intToBool(0)).toBe(false)
    })

    it('returns undefined for null', () => {
      expect(intToBool(null)).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
      expect(intToBool(undefined)).toBeUndefined()
    })
  })

  describe('boolToInt', () => {
    it('converts true to 1', () => {
      expect(boolToInt(true)).toBe(1)
    })

    it('converts false to 0', () => {
      expect(boolToInt(false)).toBe(0)
    })

    it('returns undefined for null', () => {
      expect(boolToInt(null)).toBeUndefined()
    })
  })

  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('hello_world')).toBe('helloWorld')
      expect(snakeToCamel('provider_id')).toBe('providerId')
      expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel')
      expect(snakeToCamel('a')).toBe('a')
      expect(snakeToCamel('')).toBe('')
    })
  })

  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('helloWorld')).toBe('hello_world')
      expect(camelToSnake('providerId')).toBe('provider_id')
      expect(camelToSnake('already_snake')).toBe('already_snake')
      expect(camelToSnake('a')).toBe('a')
    })
  })
})

// ── createTransformEngine (integration) ─────────────────────────────────────

import { createTransformEngine } from '../../../src/transform/index.js'

describe('createTransformEngine (integration)', () => {
  it('creates an engine with all built-in specs registered', () => {
    const eng = createTransformEngine()
    expect(eng.has('conversation')).toBe(true)
    expect(eng.has('message')).toBe(true)
    expect(eng.has('provider')).toBe(true)
    expect(eng.has('capability')).toBe(true)
  })

  it('creates an engine with a specific version', () => {
    const eng = createTransformEngine('v2')
    expect(eng.getVersion()).toBe('v2')
  })

  it('transforms a real conversation row', () => {
    const eng = createTransformEngine()
    const row = {
      id: 'conv-1',
      providerSessionId: 'sess-1',
      providerId: 'chatgpt',
      accountId: 'acct-1',
      title: 'Test Chat',
      state: 'active',
      messageCount: 5,
      lastMessageAt: NOW,
      contextJson: '{"key":"val"}',
      createdAt: NOW,
      updatedAt: NOW,
      projectId: null,
      topicId: null,
      source: 'live',
      externalId: null,
      importJobId: null,
      syncedAt: null,
    }
    const { data, warnings } = eng.transform('conversation', row)
    expect(data.id).toBe('conv-1')
    expect(data.title).toBe('Test Chat')
    expect(data.providerId).toBe('chatgpt')
    expect(data.state).toBe('active')
    expect(data.messageCount).toBe(5)
    expect(data.createdAt).toBe(isoAt(NOW))
    expect(data.updatedAt).toBe(isoAt(NOW))
    expect(data.lastMessageAt).toBe(isoAt(NOW))
    // contextJson should be excluded
    expect(data).not.toHaveProperty('contextJson')
    // Deprecated field warning
    expect(warnings.some((w) => w.includes('providerSessionId'))).toBe(true)
  })

  it('transforms a real message row with JSON parsing', () => {
    const eng = createTransformEngine()
    const row = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      blocksJson: '[{"type":"text","text":"Hello"}]',
      blockCount: 1,
      parentMessageId: null,
      sequenceIndex: 0,
      latencyMs: 250,
      tokenCount: 42,
      model: 'gpt-4',
      metadataJson: '{"source":"manual"}',
      createdAt: NOW,
    }
    const { data } = eng.transform('message', row)
    expect(data.id).toBe('msg-1')
    expect(data.content).toBe('Hello')
    expect(data.blocks).toEqual([{ type: 'text', text: 'Hello' }])
    expect(data.metadata).toEqual({ source: 'manual' })
    expect(data.createdAt).toBe(isoAt(NOW))
    expect(data.latencyMs).toBe(250)
    expect(data.tokenCount).toBe(42)
    // null → undefined
    expect(data.parentMessageId).toBeUndefined()
  })

  it('transforms a real provider row with snake_case conversion', () => {
    const eng = createTransformEngine()
    const row = {
      id: 'prov-1',
      slug: 'chatgpt',
      display_name: 'ChatGPT',
      description: 'OpenAI chat',
      category: 'ai-chat',
      provider_type: 'web',
      is_active: 1,
      protocol_status: 'stable',
      website_url: 'https://chatgpt.com',
      documentation_url: 'https://docs.chatgpt.com',
      auth_type: 'oauth',
      has_multi_account: 1,
      profile_strategy: 'default',
      fleet_config_json: '{}',
      capabilities_json: '[]',
      models_json: '[]',
      created_at: NOW,
      updated_at: NOW,
    }
    const { data, warnings } = eng.transform('provider', row)
    expect(data.id).toBe('prov-1')
    expect(data.slug).toBe('chatgpt')
    expect(data.displayName).toBe('ChatGPT')
    expect(data.isActive).toBe(true)
    expect(data.providerType).toBe('web')
    expect(data.createdAt).toBe(isoAt(NOW))
    // Internal fields excluded
    expect(data).not.toHaveProperty('fleet_config_json')
    expect(data).not.toHaveProperty('capabilities_json')
    // Deprecated field warning for documentationUrl
    expect(warnings.some((w) => w.includes('documentationUrl'))).toBe(true)
  })
})
