// src/engines/reprogrammability/__tests__/version-store.test.ts
// Phase 8 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Provenance & Versioning.

import { beforeEach, describe, expect, test } from 'bun:test'
import type { SurfaceSpec } from '../../../reprogrammability/schema/spec.js'
import {
  PROVENANCE_WEIGHTS,
  type VersionStore,
  provenanceWeight,
  versionStore,
} from '../version-store.js'

function panelSpec(title: string): SurfaceSpec {
  return {
    kind: 'panel',
    variant: 'default',
    title,
    dock: 'left',
    visible: true,
    collapsed: false,
  } as SurfaceSpec
}

describe('VersionStore', () => {
  let store: VersionStore

  beforeEach(() => {
    // Use a fresh store for each test (the singleton is shared).
    store = versionStore
    store.clear()
  })

  test('saveVersion + listVersions returns versions in order', () => {
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V1'),
      provenance: 'manual',
    })
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V2'),
      provenance: 'nlcl',
    })
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V3'),
      provenance: 'llm-harness',
    })

    const list = store.listVersions('panel:conversations')
    expect(list).toHaveLength(3)
    expect(list[0]?.version).toBe(1)
    expect(list[1]?.version).toBe(2)
    expect(list[2]?.version).toBe(3)
    expect((list[0]?.spec as { title: string }).title).toBe('V1')
    expect((list[2]?.spec as { title: string }).title).toBe('V3')
  })

  test('listVersions limit returns most recent N', () => {
    for (let i = 0; i < 5; i++) {
      store.saveVersion({
        surfaceId: 'panel:conversations',
        spec: panelSpec(`V${i + 1}`),
        provenance: 'manual',
      })
    }
    const list = store.listVersions('panel:conversations', 2)
    expect(list).toHaveLength(2)
    expect(list[0]?.version).toBe(4)
    expect(list[1]?.version).toBe(5)
  })

  test('getVersionByNumber returns the right version', () => {
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V1'),
      provenance: 'manual',
    })
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V2'),
      provenance: 'manual',
    })

    const v2 = store.getVersionByNumber('panel:conversations', 2)
    expect(v2).not.toBeNull()
    expect((v2?.spec as { title: string }).title).toBe('V2')
  })

  test('getRestoreSpec returns the version spec', () => {
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('Original'),
      provenance: 'manual',
    })
    const list = store.listVersions('panel:conversations')
    const spec = store.getRestoreSpec(list[0]!.id)
    expect(spec).not.toBeNull()
    expect((spec as { title: string }).title).toBe('Original')
  })

  test('diffVersions returns a structured diff', () => {
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V1'),
      provenance: 'manual',
    })
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V2'),
      provenance: 'manual',
    })
    const list = store.listVersions('panel:conversations')
    const diff = store.diffVersions(list[0]!.id, list[1]!.id)
    expect(diff).not.toBeNull()
    expect(diff?.versionA).toBe(1)
    expect(diff?.versionB).toBe(2)
    expect(diff?.jsonDiff).toContain('V1')
    expect(diff?.jsonDiff).toContain('V2')
  })

  test('diffVersions returns null for different surfaces', () => {
    store.saveVersion({
      surfaceId: 'panel:conversations',
      spec: panelSpec('V1'),
      provenance: 'manual',
    })
    store.saveVersion({
      surfaceId: 'panel:providers',
      spec: panelSpec('V1'),
      provenance: 'manual',
    })
    const a = store.listVersions('panel:conversations')[0]!
    const b = store.listVersions('panel:providers')[0]!
    const diff = store.diffVersions(a.id, b.id)
    expect(diff).toBeNull()
  })

  test('createBackup + restoreBackup round-trips', () => {
    const snapshot = { surfaces: [{ id: 'panel:conversations', spec: panelSpec('Backup') }] }
    const backup = store.createBackup(snapshot, 'manual')
    expect(backup.id).toBeDefined()
    expect(backup.source).toBe('manual')

    const restored = store.restoreBackup(backup.id)
    expect(restored).not.toBeNull()
    expect((restored as { surfaces: unknown[] }).surfaces).toHaveLength(1)
  })

  test('listBackups returns most recent first', () => {
    store.createBackup({ a: 1 }, 'manual')
    store.createBackup({ a: 2 }, 'cron')
    store.createBackup({ a: 3 }, 'manual')

    const list = store.listBackups()
    expect(list).toHaveLength(3)
    // Most recent first (later createdAt = first).
    expect(list[0]?.source).toBe('manual')
    expect(list[2]?.source).toBe('manual')
  })

  test('provenanceWeight returns the expected order', () => {
    expect(provenanceWeight('manual')).toBeGreaterThan(provenanceWeight('nlcl'))
    expect(provenanceWeight('nlcl')).toBeGreaterThan(provenanceWeight('prefix'))
    expect(provenanceWeight('prefix')).toBeGreaterThan(provenanceWeight('plugin'))
    expect(provenanceWeight('plugin')).toBeGreaterThan(provenanceWeight('llm-harness'))
    expect(provenanceWeight('llm-harness')).toBeGreaterThan(provenanceWeight('system'))
  })

  test('PROVENANCE_WEIGHTS has all 6 tags', () => {
    expect(Object.keys(PROVENANCE_WEIGHTS).sort()).toEqual([
      'llm-harness',
      'manual',
      'nlcl',
      'plugin',
      'prefix',
      'system',
    ])
  })

  test('maxVersionsPerSurface caps the version list (oldest dropped)', () => {
    // The store caps at 100 versions. Save 105 versions; the first 5 should be dropped.
    for (let i = 0; i < 105; i++) {
      store.saveVersion({
        surfaceId: 'panel:conversations',
        spec: panelSpec(`V${i + 1}`),
        provenance: 'manual',
      })
    }
    const list = store.listVersions('panel:conversations')
    expect(list).toHaveLength(100)
    // Oldest 5 dropped — list[0] should be V6.
    expect(list[0]?.version).toBe(6)
    expect(list[99]?.version).toBe(105)
  })
})
