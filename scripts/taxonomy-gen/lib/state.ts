// scripts/taxonomy-gen/lib/state.ts
// Progress/resume state for taxonomy generation sessions.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = join(import.meta.dir, '..', 'output')
const STATE_FILE = join(OUTPUT_DIR, 'state.json')

export interface PlatformState {
  slug: string
  category: string
  status: 'skeleton' | 'drilling' | 'complete'
  sectionsDone: string[]
  sourceConfidence: string
}

export interface GenState {
  skeletonDone: boolean
  sharedPoolDone: boolean // Round 0: shared capabilities/protocols/techstacks/parsers generated
  platforms: PlatformState[]
  probabilityTables: string[] // slugs of harvested probability tables
}

const EMPTY_STATE: GenState = {
  skeletonDone: false,
  sharedPoolDone: false,
  platforms: [],
  probabilityTables: [],
}

export function getState(): GenState {
  return loadState()
}

export function loadState(): GenState {
  if (!existsSync(STATE_FILE)) return { ...EMPTY_STATE }
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as Partial<GenState>
    return { ...EMPTY_STATE, ...s, platforms: s.platforms ?? [] }
  } catch {
    return { ...EMPTY_STATE }
  }
}

export function saveState(state: GenState): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

export function getPlatformState(slug: string): PlatformState | undefined {
  return loadState().platforms.find((p) => p.slug === slug)
}

export function upsertPlatform(platform: PlatformState): void {
  const state = loadState()
  const idx = state.platforms.findIndex((p) => p.slug === platform.slug)
  if (idx >= 0) state.platforms[idx] = platform
  else state.platforms.push(platform)
  saveState(state)
}

export function updatePlatform(state: GenState, platform: PlatformState): void {
  const idx = state.platforms.findIndex((p) => p.slug === platform.slug)
  if (idx >= 0) state.platforms[idx] = platform
  else state.platforms.push(platform)
}

export function markSectionDone(slug: string, section: string): void {
  const state = loadState()
  const p = state.platforms.find((pl) => pl.slug === slug)
  if (!p) return
  if (!p.sectionsDone.includes(section)) p.sectionsDone.push(section)
  saveState(state)
}

export function setSkeletonDone(done: boolean): void {
  const state = loadState()
  state.skeletonDone = done
  saveState(state)
}

export function setSharedPoolDone(done: boolean): void {
  const state = loadState()
  state.sharedPoolDone = done
  saveState(state)
}

export function addProbabilityTable(slug: string): void {
  const state = loadState()
  if (!state.probabilityTables.includes(slug)) state.probabilityTables.push(slug)
  saveState(state)
}
