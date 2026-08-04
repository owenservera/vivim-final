import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setStoragePaths } from '../../../src/config.js'
import { StorageRelocationEngine } from '../../../src/engines/storage-relocation-engine.js'
import type {
  ArchivedLocation,
  RelocationStore,
} from '../../../src/engines/storage-relocation-engine.js'

function createMockStore(overrides?: Partial<RelocationStore>): RelocationStore {
  const archivedLocations: ArchivedLocation[] = []
  return {
    async getStorageConfig() {
      return null
    },
    async setStorageConfig() {},
    async getArchivedLocations() {
      return archivedLocations
    },
    async markArchived(path, archivedAt, sizeBytes) {
      archivedLocations.push({ path, archivedAt, sizeBytes })
    },
    async removeArchived(path) {
      const idx = archivedLocations.findIndex((a) => a.path === path)
      if (idx >= 0) archivedLocations.splice(idx, 1)
    },
    ...overrides,
  }
}

describe('StorageRelocationEngine', () => {
  let targetDir: string
  let engine: StorageRelocationEngine
  let sourceDir: string

  beforeEach(() => {
    // Reset global mutable state from previous tests
    setStoragePaths(undefined)

    // Create a source dir with test files (simulates a data directory)
    sourceDir = mkdtempSync(join(tmpdir(), 'vivim-source-'))
    writeFileSync(join(sourceDir, 'cap-store.sqlite'), 'fake db content')
    writeFileSync(join(sourceDir, 'test-file.txt'), 'hello world')

    // Set the mutable data dir to our source
    setStoragePaths(sourceDir)

    targetDir = mkdtempSync(join(tmpdir(), 'vivim-target-'))
    rmSync(targetDir, { recursive: true, force: true })

    engine = new StorageRelocationEngine(createMockStore(), {
      minFreeSpaceMultiplier: 1,
      retainOldDays: 7,
      switchPauseMs: 100,
    })
  })

  afterEach(() => {
    setStoragePaths(undefined)
    try {
      rmSync(sourceDir, { recursive: true, force: true })
    } catch {}
    try {
      rmSync(targetDir, { recursive: true, force: true })
    } catch {}
  })

  it('should copy all files from source to target', async () => {
    const result = await engine.relocate(targetDir)
    expect(result.ok).toBe(true)
    expect(result.phase).toBe('done')
    expect(result.fileCount).toBeGreaterThanOrEqual(2)
    expect(existsSync(join(targetDir, 'cap-store.sqlite'))).toBe(true)
    expect(existsSync(join(targetDir, 'test-file.txt'))).toBe(true)
  })

  it('should produce correct bytes copied', async () => {
    const result = await engine.relocate(targetDir)
    expect(result.ok).toBe(true)
    expect(result.bytesCopied).toBeGreaterThan(0)
  })

  it('should handle nonexistent source gracefully', async () => {
    setStoragePaths('/nonexistent/path/that/does/not/exist')
    const e = new StorageRelocationEngine(createMockStore(), { minFreeSpaceMultiplier: 1 })
    const result = await e.relocate(targetDir)
    expect(result.ok).toBe(false)
  })

  it('should track migration status', async () => {
    const p = engine.relocate(targetDir)
    const status = engine.getStatus()
    expect(status).toHaveProperty('phase')
    expect(status).toHaveProperty('sourceDir')
    expect(status).toHaveProperty('targetDir')
    await p
  })

  it('should return storage status with breakdown', async () => {
    const status = await engine.getStorageStatus()
    expect(status).toHaveProperty('dataDir')
    expect(status).toHaveProperty('dbPath')
    expect(status).toHaveProperty('totalBytes')
    expect(status).toHaveProperty('breakdown')
    expect(status.breakdown).toHaveProperty('database')
    expect(status.breakdown).toHaveProperty('chromeProfiles')
    expect(status.breakdown).toHaveProperty('parserCache')
    expect(status.breakdown).toHaveProperty('logs')
    expect(status.breakdown).toHaveProperty('other')
  })

  it('should produce identical file contents after copy', async () => {
    const result = await engine.relocate(targetDir)
    expect(result.ok).toBe(true)

    // Read the copied file and verify contents match
    const { readFileSync } = require('node:fs')
    const copied = readFileSync(join(targetDir, 'test-file.txt'), 'utf-8')
    expect(copied).toBe('hello world')
  })

  it('should report failure gracefully when target is invalid', async () => {
    const e = new StorageRelocationEngine(createMockStore(), { minFreeSpaceMultiplier: 1 })
    const result = await e.relocate('Z:\\nonexistent\\drive\\path')
    expect(result.ok).toBe(false)
  })
})
