// devops/llm-testing/knowledge-store.ts
// JSON flat-file knowledge store for LLM-as-Human testing system.
// Persists patterns, provider knowledge, surface coverage, errors, and priorities.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLogger } from '../../src/lib/logger.js'
import type {
  ErrorEntry,
  KnowledgeDelta,
  PatternsFile,
  PrioritiesFile,
  PriorityEntry,
  ProviderKnowledge,
  ProvidersFile,
  SurfaceCoverage,
  SurfacesFile,
  TestSurface,
} from './types.js'

const log = getLogger('knowledge-store')

const DEFAULT_BASE_DIR = join(process.cwd(), '.runtime', 'llm-testing', 'knowledge')

// ── Default data ──────────────────────────────────────────────────────────

const DEFAULT_PROVIDERS: ProvidersFile = {
  gemini: {
    composerSelector: "div.ql-editor[contenteditable='true']",
    sendMethod: 'click-send-button',
    sendButtonSelector: "button[aria-label='Send message']",
    enterKeyBroken: true,
    streamFormat: 'batchexecute',
    quirks: ['Quill editor — Enter inserts newline, must click send'],
    lastTested: '',
    successRate: 0,
  },
  chatgpt: {
    composerSelector: '#prompt-textarea',
    sendMethod: 'enter-or-click',
    enterKeyBroken: false,
    streamFormat: 'openai-sse',
    quirks: [],
    lastTested: '',
    successRate: 0,
  },
  claude: {
    composerSelector: "div[contenteditable='true']",
    sendMethod: 'enter-or-click',
    enterKeyBroken: false,
    streamFormat: 'anthropic-sse',
    quirks: ['ProseMirror contenteditable'],
    lastTested: '',
    successRate: 0,
  },
}

const SURFACES: TestSurface[] = ['cli', 'ui', 'api', 'mcp', 'workflow', 'provider']

// ── KnowledgeStore ────────────────────────────────────────────────────────

export class KnowledgeStore {
  private patterns: PatternsFile
  private providers: ProvidersFile
  private surfaces: SurfacesFile
  private errors: ErrorEntry[]
  private priorities: PrioritiesFile
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? DEFAULT_BASE_DIR
    this.ensureDir()
    this.patterns = this.loadPatterns()
    this.providers = this.loadProviders()
    this.surfaces = this.loadSurfaces()
    this.errors = this.loadErrors()
    this.priorities = this.loadPriorities()
  }

  // ── Patterns ────────────────────────────────────────────────────────────

  getPatterns(): Pattern[] {
    return this.patterns.patterns
  }

  getPatternById(id: string) {
    return this.patterns.patterns.find((p) => p.id === id)
  }

  getPatternsBySurface(surface: TestSurface) {
    return this.patterns.patterns.filter((p) => p.surface === surface)
  }

  getPatternsByCapability(surface: TestSurface, capability: string) {
    return this.patterns.patterns.filter(
      (p) => p.surface === surface && p.capability === capability,
    )
  }

  upsertPattern(pattern: Omit<Pattern, 'id' | 'failures'> & { id?: string; failures?: PatternFailure[] }) {
    const id = pattern.id ?? this.nextPatternId()
    const existing = this.patterns.patterns.find((p) => p.id === id)
    if (existing) {
      existing.pattern = pattern.pattern
      existing.confidence = pattern.confidence
      existing.lastVerified = pattern.lastVerified
      existing.tags = pattern.tags
      if (pattern.failures) existing.failures = pattern.failures
    } else {
      this.patterns.patterns.push({
        ...pattern,
        id,
        failures: pattern.failures ?? [],
      })
    }
    this.patterns.lastUpdated = new Date().toISOString()
    this.savePatterns()
    return id
  }

  // ── Providers ───────────────────────────────────────────────────────────

  getProviderKnowledge(slug: string): ProviderKnowledge | undefined {
    return this.providers[slug]
  }

  getAllProviderKnowledge(): ProvidersFile {
    return { ...this.providers }
  }

  updateProviderKnowledge(slug: string, patch: Partial<ProviderKnowledge>) {
    const existing = this.providers[slug]
    if (existing) {
      Object.assign(existing, patch)
    } else {
      this.providers[slug] = {
        composerSelector: '',
        sendMethod: 'enter-or-click',
        enterKeyBroken: false,
        streamFormat: '',
        quirks: [],
        lastTested: '',
        successRate: 0,
        ...patch,
      }
    }
    this.saveProviders()
  }

  // ── Surfaces ────────────────────────────────────────────────────────────

  getSurfaceCoverage(surface: TestSurface): SurfaceCoverage | undefined {
    return this.surfaces[surface]
  }

  getAllCoverage(): SurfacesFile {
    return { ...this.surfaces }
  }

  updateCoverage(surface: TestSurface, coverage: Partial<SurfaceCoverage>) {
    const existing = this.surfaces[surface] ?? {
      totalCapabilities: 0,
      testedCapabilities: 0,
      coverage: 0,
      lastFullRun: '',
      gaps: [],
    }
    Object.assign(existing, coverage)
    this.surfaces[surface] = existing
    this.saveSurfaces()
  }

  // ── Errors ──────────────────────────────────────────────────────────────

  getErrors(): ErrorEntry[] {
    return this.errors
  }

  getErrorsBySurface(surface: TestSurface) {
    return this.errors.filter((e) => e.surface === surface)
  }

  upsertError(entry: Omit<ErrorEntry, 'id' | 'occurrences'> & { id?: string; occurrences?: number }) {
    const id = entry.id ?? this.nextErrorId()
    const existing = this.errors.find((e) => e.id === id)
    if (existing) {
      existing.occurrences = (existing.occurrences ?? 0) + 1
      existing.lastSeen = entry.lastSeen
      existing.fix = entry.fix
      existing.resolved = entry.resolved
    } else {
      this.errors.push({ ...entry, id, occurrences: entry.occurrences ?? 1 })
    }
    this.saveErrors()
    return id
  }

  // ── Priorities ──────────────────────────────────────────────────────────

  getPriorities(): PriorityEntry[] {
    return this.priorities.queue
  }

  setPriorities(queue: PriorityEntry[]) {
    this.priorities = {
      version: 1,
      lastComputed: new Date().toISOString(),
      queue,
    }
    this.savePriorities()
  }

  // ── Delta merge ─────────────────────────────────────────────────────────

  mergeDelta(delta: KnowledgeDelta) {
    for (const p of delta.newPatterns) {
      this.patterns.patterns.push(p)
    }
    for (const p of delta.updatedPatterns) {
      const idx = this.patterns.patterns.findIndex((x) => x.id === p.id)
      if (idx >= 0) this.patterns.patterns[idx] = p
    }
    for (const e of delta.newErrors) {
      this.errors.push(e)
    }
    for (const e of delta.updatedErrors) {
      const idx = this.errors.findIndex((x) => x.id === e.id)
      if (idx >= 0) this.errors[idx] = e
    }
    this.patterns.lastUpdated = new Date().toISOString()
    this.savePatterns()
    this.saveErrors()
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private ensureDir() {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
  }

  private loadPatterns(): PatternsFile {
    try {
      const raw = readFileSync(join(this.baseDir, 'patterns.json'), 'utf8')
      return JSON.parse(raw) as PatternsFile
    } catch {
      return { version: 1, lastUpdated: new Date().toISOString(), patterns: [] }
    }
  }

  private loadProviders(): ProvidersFile {
    try {
      const raw = readFileSync(join(this.baseDir, 'providers.json'), 'utf8')
      return JSON.parse(raw) as ProvidersFile
    } catch {
      return { ...DEFAULT_PROVIDERS }
    }
  }

  private loadSurfaces(): SurfacesFile {
    try {
      const raw = readFileSync(join(this.baseDir, 'surfaces.json'), 'utf8')
      return JSON.parse(raw) as SurfacesFile
    } catch {
      const init: SurfacesFile = {}
      for (const s of SURFACES) {
        init[s] = {
          totalCapabilities: 0,
          testedCapabilities: 0,
          coverage: 0,
          lastFullRun: '',
          gaps: [],
        }
      }
      return init
    }
  }

  private loadErrors(): ErrorEntry[] {
    try {
      const raw = readFileSync(join(this.baseDir, 'errors.json'), 'utf8')
      const parsed = JSON.parse(raw) as { errors: ErrorEntry[] }
      return parsed.errors ?? []
    } catch {
      return []
    }
  }

  private loadPriorities(): PrioritiesFile {
    try {
      const raw = readFileSync(join(this.baseDir, 'priorities.json'), 'utf8')
      return JSON.parse(raw) as PrioritiesFile
    } catch {
      return { version: 1, lastComputed: '', queue: [] }
    }
  }

  private savePatterns() {
    writeFileSync(join(this.baseDir, 'patterns.json'), JSON.stringify(this.patterns, null, 2), 'utf8')
  }

  private saveProviders() {
    writeFileSync(join(this.baseDir, 'providers.json'), JSON.stringify(this.providers, null, 2), 'utf8')
  }

  private saveSurfaces() {
    writeFileSync(join(this.baseDir, 'surfaces.json'), JSON.stringify(this.surfaces, null, 2), 'utf8')
  }

  private saveErrors() {
    writeFileSync(join(this.baseDir, 'errors.json'), JSON.stringify({ errors: this.errors }, null, 2), 'utf8')
  }

  private savePriorities() {
    writeFileSync(join(this.baseDir, 'priorities.json'), JSON.stringify(this.priorities, null, 2), 'utf8')
  }

  private nextPatternId(): string {
    const max = this.patterns.patterns.reduce((acc, p) => {
      const num = parseInt(p.id.replace('P', ''), 10)
      return num > acc ? num : acc
    }, 0)
    return `P${String(max + 1).padStart(3, '0')}`
  }

  private nextErrorId(): string {
    const max = this.errors.reduce((acc, e) => {
      const num = parseInt(e.id.replace('E', ''), 10)
      return num > acc ? num : acc
    }, 0)
    return `E${String(max + 1).padStart(3, '0')}`
  }
}
