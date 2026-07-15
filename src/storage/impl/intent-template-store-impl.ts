// src/storage/impl/intent-template-store-impl.ts
// Unit 3.1 — in-memory IntentTemplateStore impl backed by the seed catalog.
// Engines depend only on the IntentTemplateStore contract; this is the dev/test impl.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IntentTemplate } from '../../engines/intent-decomposer.js'
import type { IntentTemplateStore } from '../contracts/intent-template-store.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const CATALOG_PATH = resolve(HERE, '../../../seeds/intent-templates/catalog.json')

interface CatalogFile {
  version: number
  templates: IntentTemplate[]
}

/** Loads the seed catalog. Throws a clear error if the catalog is malformed. */
export async function loadCatalog(): Promise<IntentTemplate[]> {
  const raw = await readFile(CATALOG_PATH, 'utf8')
  const parsed = JSON.parse(raw) as CatalogFile
  if (!Array.isArray(parsed.templates)) {
    throw new Error('intent-templates catalog missing templates[]')
  }
  return parsed.templates
}

export class InMemoryIntentTemplateStore implements IntentTemplateStore {
  private cache: IntentTemplate[] = []

  constructor(seed?: IntentTemplate[]) {
    this.cache = seed ?? []
  }

  static async fromCatalog(): Promise<InMemoryIntentTemplateStore> {
    const templates = await loadCatalog()
    return new InMemoryIntentTemplateStore(templates)
  }

  async listTemplates(): Promise<IntentTemplate[]> {
    return this.cache
  }

  async getTemplate(id: string): Promise<IntentTemplate | null> {
    return this.cache.find((t) => t.id === id) ?? null
  }

  async upsertTemplate(tpl: IntentTemplate): Promise<IntentTemplate> {
    const idx = this.cache.findIndex((t) => t.id === tpl.id)
    if (idx >= 0) this.cache[idx] = tpl
    else this.cache.push(tpl)
    return tpl
  }
}
