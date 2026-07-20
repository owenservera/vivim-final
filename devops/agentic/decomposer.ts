// devops/agentic/decomposer.ts
// ObjectiveDecomposer — breaks a natural-language objective into a bounded,
// context-fitting task DAG with per-task file scoping.
//
// Each task fits within a ~30K-token context budget: the agent reads exactly
// the listed source files, implements, verifies, and produces a compact handoff.
// The DAG encodes dependency order; parallel-ready tasks are explicitly marked.
//
// Input:  "fully wire chatgpt.com for full frontend multiturn messaging with full features"
// Output: TaskDAG with 5-15 tasks, each with: id, description, requiredFiles, producesFiles,
//         dependsOn[], verification, contextBudget (token estimate)

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface AgenticTask {
  id: string
  objective: string
  description: string
  /** Files the agent MUST read before implementing. Paths relative to repo root. */
  requiredFiles: string[]
  /** Files the agent will create or modify. */
  producesFiles: string[]
  /** Task IDs that must complete before this one starts. */
  dependsOn: string[]
  /** How to verify this task is done. A concrete check, not "make it work." */
  verification: string
  /** Estimated token cost for required files (~4 chars = 1 token for code). */
  estimatedTokens: number
  /** Whether this task can run in parallel with siblings at the same depth. */
  parallelizable: boolean
}

export interface TaskDAG {
  objective: string
  tasks: AgenticTask[]
  /** Total estimated token budget across all tasks. */
  totalEstimatedTokens: number
  /** Which phase each task belongs to (phase 1 tasks have no deps). */
  phases: number[][]
}

// Provider families and their known seed files — used for pattern matching.
// NOTE: provider manifests were consolidated into the single in-repo module
// seeds/providers/manifests.ts (no more per-provider *.json files on disk).
const PROVIDER_SEED_PATTERNS: Record<string, string[]> = {
  chatgpt: ['seeds/providers/manifests.ts'],
  claude: ['seeds/providers/manifests.ts'],
  gemini: ['seeds/providers/manifests.ts'],
  deepseek: ['seeds/providers/manifests.ts'],
  qwen: ['seeds/providers/manifests.ts'],
  zai: ['seeds/providers/manifests.ts'],
  slack: ['seeds/providers/manifests.ts'],
  telegram: ['seeds/providers/manifests.ts'],
  whatsapp: ['seeds/providers/manifests.ts'],
  facebook: ['seeds/providers/manifests.ts'],
}

// Known capability templates — maps objective keywords to task patterns
const CAPABILITY_TEMPLATES: Record<string, Partial<AgenticTask>> = {
  compose: {
    requiredFiles: [
      'src/engines/composer-typing.ts',
      'src/engines/provider-selectors.ts',
      'src/engines/conversation-manager.ts',
      'src/executor/cdp-transport.ts',
    ],
    producesFiles: [],
    verification: 'bun test tests/unit/engines/composer-typing.test.ts',
    estimatedTokens: 12000,
  },
  capture: {
    requiredFiles: [
      'src/engines/conversation-manager.ts',
      'src/executor/cdp-transport.ts',
      'src/engines/chrome-governor.ts',
    ],
    producesFiles: [],
    verification: 'bun test tests/unit/engines/conversation-manager.test.ts',
    estimatedTokens: 15000,
  },
  parse: {
    requiredFiles: [
      'src/engines/stream-parser.ts',
      'src/storage/contracts/parser-store.ts',
      'src/storage/impl/parser-store-impl.ts',
      'seeds/parsers/',
    ],
    producesFiles: [],
    verification: 'bun test tests/unit/engines/stream-parser.test.ts',
    estimatedTokens: 10000,
  },
  stream: {
    requiredFiles: [
      'src/engines/stream-block-store.ts',
      'src/storage/contracts/stream-block-store.ts',
      'src/storage/impl/stream-block-store-impl.ts',
    ],
    producesFiles: [],
    verification: 'bun test tests/unit/storage/impl/stream-block-store-impl.test.ts',
    estimatedTokens: 8000,
  },
  selector: {
    requiredFiles: [
      'src/engines/provider-selectors.ts',
      'src/engines/selector-healer.ts',
      'src/storage/contracts/capability-store.ts',
    ],
    producesFiles: [],
    verification: 'bun test tests/unit/engines/provider-selectors.test.ts',
    estimatedTokens: 8000,
  },
  manifest: {
    requiredFiles: [
      'src/schema/provider-manifest.ts',
      'src/engines/provider-registrar.ts',
      'src/storage/contracts/provider-store.ts',
      'seeds/providers/manifests.ts',
    ],
    producesFiles: [],
    verification: 'bun test tests/unit/engines/provider-registrar.test.ts',
    estimatedTokens: 10000,
  },
  frontend: {
    requiredFiles: [
      'web/ui/src/features/chat/ChatPage.tsx',
      'web/ui/src/features/chat/Composer.tsx',
      'web/ui/src/features/chat/MessageBubble.tsx',
      'web/ui/src/ui/registry.ts',
      'web/ui/src/ui/slots.ts',
    ],
    producesFiles: [],
    verification: 'cd web/ui && bun run typecheck',
    estimatedTokens: 15000,
  },
  canvas: {
    requiredFiles: [
      'web/ui/src/features/canvas/CanvasSurface.tsx',
      'web/ui/src/features/canvas/SandboxedLayer.tsx',
      'src/engines/conceptual-model-service.ts',
      'shared/canvas-types.ts',
    ],
    producesFiles: [],
    verification: 'cd web/ui && bun run typecheck',
    estimatedTokens: 18000,
  },
  test: {
    requiredFiles: ['tests/unit/engines/', 'tests/integration/', 'tests/helpers/'],
    producesFiles: [],
    verification: 'bun test',
    estimatedTokens: 5000,
  },
  // ── UI / Frontend (from vivi-frontend skill) ─────────────────────────
  'canvas-layer': {
    requiredFiles: [
      'web/ui/src/features/canvas/CanvasSurface.tsx',
      'web/ui/src/features/canvas/SandboxedLayer.tsx',
      'web/ui/src/features/canvas/BrowserLayerHost.tsx',
      'src/engines/canvas-layer-mounter.ts',
      'shared/canvas-types.ts',
    ],
    producesFiles: ['web/ui/src/features/canvas/'],
    verification: 'cd web/ui && bun run typecheck',
    estimatedTokens: 18000,
  },
  'conceptual-component': {
    requiredFiles: [
      'seeds/conceptual-model/seed.ts',
      'src/schema/conceptual-model.ts',
      'src/engines/conceptual-model-service.ts',
      'shared/ui-component.ts',
      'shared/conceptual-model.ts',
      'src/storage/impl/ui-component-store-impl.ts',
    ],
    producesFiles: ['seeds/conceptual-model/seed.ts', 'web/ui/src/ui/defaults/'],
    verification:
      'bunx tsc --noEmit 2>&1 | grep -q "conceptual-model|ui-component" && exit 1 || exit 0',
    estimatedTokens: 14000,
  },
  'slot-hotswap': {
    requiredFiles: [
      'web/ui/src/ui/registry.ts',
      'web/ui/src/ui/slots.ts',
      'web/ui/src/ui/context.tsx',
      'web/ui/src/ui/useSlot.ts',
      'web/ui/src/ui/defaults/index.tsx',
    ],
    producesFiles: ['web/ui/src/ui/registry.ts', 'web/ui/src/ui/defaults/'],
    verification: 'cd web/ui && bun run typecheck',
    estimatedTokens: 10000,
  },
  'frontend-test': {
    requiredFiles: ['web/ui/src/features/', 'tests/unit/ui/', 'web/ui/package.json'],
    producesFiles: ['tests/unit/ui/', 'web/ui/src/features/'],
    verification: 'cd web/ui && bun run typecheck && bun test tests/unit/ui/',
    estimatedTokens: 12000,
  },
  'canvas-conceptual-verify': {
    requiredFiles: [
      'src/engines/conceptual-model-service.ts',
      'shared/conceptual-model.ts',
      'seeds/conceptual-model/seed.ts',
      'src/schema/conceptual-model.ts',
    ],
    producesFiles: [],
    verification:
      'bun run devops agentic probe 2>/dev/null || bun test tests/unit/storage/ui-component-store-impl.test.ts',
    estimatedTokens: 8000,
  },
}

function tokenEstimate(files: string[]): number {
  let total = 0
  const repoRoot = process.cwd()
  for (const file of files) {
    try {
      const full = join(repoRoot, file)
      if (existsSync(full) && !full.includes('*')) {
        const stat = readFileSync(full, 'utf8')
        total += Math.ceil(stat.length / 4)
      } else if (file.endsWith('/')) {
        // Directory — estimate from file count
        const d = join(repoRoot, file)
        if (existsSync(d)) {
          const entries = readdirSync(d)
          total += entries.length * 500 // rough per-file estimate
        }
      }
    } catch {
      total += 500
    }
  }
  return total
}

function detectProvider(objective: string): string | null {
  const lower = objective.toLowerCase()
  const known = [
    'chatgpt',
    'claude',
    'gemini',
    'deepseek',
    'qwen',
    'grok',
    'slack',
    'telegram',
    'whatsapp',
    'facebook',
    'z-ai',
    'copilot',
    'perplexity',
    'mistral',
    'ollama',
  ]
  for (const p of known) {
    if (lower.includes(p)) return p
  }
  return null
}

function detectKeywords(objective: string): string[] {
  const lower = objective.toLowerCase()
  const keywords: string[] = []
  const map: Record<string, string[]> = {
    compose: ['compose', 'type', 'input', 'message', 'write', 'text', 'messaging', 'send'],
    capture: ['capture', 'response', 'receive', 'stream', 'listen', 'api'],
    parse: ['parse', 'parser', 'extract', 'content', 'block'],
    stream: ['stream', 'progressive', 'chunk', 'sse', 'real-time'],
    selector: ['selector', 'find', 'locate', 'target', 'button', 'element'],
    manifest: ['manifest', 'register', 'seed', 'provider', 'capability'],
    frontend: ['frontend', 'ui', 'render', 'display', 'component', 'react', 'multiturn'],
    canvas: ['canvas', 'layer', 'node', 'surface', '3d'],
    test: ['test', 'verify', 'validate', 'check'],
    'conceptual-component': [
      'conceptual',
      'model',
      'family',
      'primitive',
      'component',
      'zod',
      'schema',
      'seed',
    ],
    'slot-hotswap': ['slot', 'hotswap', 'override', 'registry', 'bespoke'],
  }
  for (const [key, terms] of Object.entries(map)) {
    if (terms.some((t) => lower.includes(t))) keywords.push(key)
  }
  return keywords
}

export function decomposeObjective(objective: string): TaskDAG {
  const provider = detectProvider(objective)
  const keywords = detectKeywords(objective)

  if (!provider && keywords.length === 0) {
    // Generic: produce a single discovery-first task
    return {
      objective,
      tasks: [
        {
          id: '0.discover',
          objective: `discover current state for: ${objective.slice(0, 80)}`,
          description:
            'Run discovery to understand what exists before building. Read the discover output, identify gaps, and propose concrete next steps.',
          requiredFiles: [
            'src/engines/',
            'src/server/',
            'web/ui/src/features/',
            'seeds/providers/manifests.ts',
          ],
          producesFiles: [],
          dependsOn: [],
          verification: 'bun run devops runtime-test discover --offline',
          estimatedTokens: 5000,
          parallelizable: false,
        },
        {
          id: '0.plan',
          objective: `plan implementation for: ${objective.slice(0, 80)}`,
          description:
            'Based on the discovery output, create a concrete implementation plan. List every file to create/modify and every test to write.',
          requiredFiles: [],
          producesFiles: ['.runtime/plan.md'],
          dependsOn: ['0.discover'],
          verification: 'Check that .runtime/plan.md exists with >200 chars of content',
          estimatedTokens: 2000,
          parallelizable: false,
        },
      ],
      totalEstimatedTokens: 7000,
      phases: [[0], [1]],
    }
  }

  const tasks: AgenticTask[] = []
  let tid = 0

  // Task 0: State probe — always first
  const stateFiles = provider ? (PROVIDER_SEED_PATTERNS[provider] ?? []) : []
  stateFiles.push(
    'src/engines/provider-selectors.ts',
    'src/engines/composer-typing.ts',
    'src/storage/contracts/conversation-store.ts',
  )
  const stateTask: AgenticTask = {
    id: `${tid}.state`,
    objective: `assess current ${provider ? provider + ' ' : ''}harness state`,
    description: provider
      ? `Check what already exists for ${provider}: selectors, composer config, capture patterns, stream config, manifest. Read only the relevant files. Produce a compact state snapshot.`
      : 'Run discovery across all providers. Identify what providers are seeded and wired.',
    requiredFiles: stateFiles,
    producesFiles: ['.runtime/state-snapshot.json'],
    dependsOn: [],
    verification: 'Check that .runtime/state-snapshot.json exists with valid JSON',
    estimatedTokens: tokenEstimate(stateFiles),
    parallelizable: false,
  }
  tasks.push(stateTask)
  tid++

  // Task 1: Provider manifest/seeding (if provider detected and needs seeding)
  if (provider && PROVIDER_SEED_PATTERNS[provider]) {
    const tmpl = CAPABILITY_TEMPLATES['manifest']!
    tasks.push({
      id: `${tid}.seed`,
      objective: `ensure ${provider} provider manifest is seeded`,
      description: `Verify the ${provider} provider manifest entry in seeds/providers/manifests.ts has all required fields: endpoints (with correct selector JSON), parser config, stream config, models, capabilities. Update if incomplete.`,
      requiredFiles: [
        ...(PROVIDER_SEED_PATTERNS[provider] ?? []),
        ...(tmpl.requiredFiles ?? []).filter((f) => !f.includes('*')),
      ],
      producesFiles: PROVIDER_SEED_PATTERNS[provider] ?? [],
      dependsOn: [`0.state`],
      verification: `bun test tests/unit/engines/provider-registrar.test.ts --test-name-pattern="${provider}" 2>/dev/null || bun run seed`,
      estimatedTokens: tmpl.estimatedTokens ?? 0,
      parallelizable: false,
    })
    tid++
  }

  // Task 2: Composer/typing (if objective mentions compose/type/message)
  if (keywords.includes('compose') || keywords.includes('selector')) {
    const tmpl = CAPABILITY_TEMPLATES['compose']!
    tasks.push({
      id: `${tid}.compose`,
      objective: `wire ${provider ?? 'provider'} composer typing`,
      description: provider
        ? `Update COMPOSER_SELECTORS in provider-selectors.ts for ${provider}. Verify composerType in provider-registrar maps correctly. Add compose test.`
        : `Audit all provider composer selectors. Add missing entries to COMPOSER_SELECTORS and SEND_BUTTON_SELECTORS.`,
      requiredFiles: [
        'src/engines/composer-typing.ts',
        'src/engines/provider-selectors.ts',
        'src/engines/conversation-manager.ts',
      ],
      producesFiles: [
        'src/engines/provider-selectors.ts',
        'tests/unit/engines/composer-typing.test.ts',
      ],
      dependsOn: provider ? [`1.seed`] : [`0.state`],
      verification:
        'bun test tests/unit/engines/composer-typing.test.ts tests/unit/engines/provider-selectors.test.ts',
      estimatedTokens: tmpl.estimatedTokens ?? 0,
      parallelizable: false,
    })
    tid++
  }

  // Task 3: Capture patterns (if objective mentions capture/stream)
  if (keywords.includes('capture') || keywords.includes('stream')) {
    const tmpl = CAPABILITY_TEMPLATES['capture']!
    tasks.push({
      id: `${tid}.capture`,
      objective: `verify ${provider ?? 'provider'} capture/stream patterns`,
      description: provider
        ? `Verify CAPTURE_PATTERNS for ${provider} in conversation-manager.ts. Check cdp-transport.ts DOM fallback selectors work for ${provider}. Add per-provider capture DOM selectors.`
        : `Audit CAPTURE_PATTERNS for all providers. Wire per-provider DOM selectors through cdp-transport capture().`,
      requiredFiles: [
        'src/engines/conversation-manager.ts',
        'src/executor/cdp-transport.ts',
        'src/engines/chrome-governor.ts',
      ],
      producesFiles: [
        'src/engines/conversation-manager.ts',
        'src/executor/cdp-transport.ts',
        'tests/unit/engines/conversation-manager.test.ts',
      ],
      dependsOn: provider ? [`1.seed`] : [`0.state`],
      verification: 'bun test tests/unit/engines/conversation-manager.test.ts',
      estimatedTokens: tmpl.estimatedTokens ?? 0,
      parallelizable: false,
    })
    tid++
  }

  // Task 4: Parser (if objective mentions parse/content)
  if (keywords.includes('parse')) {
    const tmpl = CAPABILITY_TEMPLATES['parse']!
    tasks.push({
      id: `${tid}.parse`,
      objective: `ensure ${provider ?? 'provider'} response parsing`,
      description: provider
        ? `Verify parser exists for ${provider} in seeds/parsers/. Check stream-parser.ts loads it correctly. Add parser test with sample response.`
        : `Audit parser coverage for all providers. Ensure every provider has a parser with fallback chain.`,
      requiredFiles: (tmpl.requiredFiles ?? []).filter((f) => !f.endsWith('/')),
      producesFiles: [
        provider ? `seeds/parsers/${provider}-parser.ts` : 'seeds/parsers/',
        'tests/unit/engines/stream-parser.test.ts',
      ],
      dependsOn: provider ? [`1.seed`] : [`0.state`],
      verification: 'bun test tests/unit/engines/stream-parser.test.ts',
      estimatedTokens: tmpl.estimatedTokens ?? 0,
      parallelizable: true,
    })
    tid++
  }

  // Task 5: Frontend component (if objective mentions frontend/ui/render/display)
  if (keywords.includes('frontend') || keywords.includes('canvas')) {
    const tmpl = CAPABILITY_TEMPLATES['frontend']!
    tasks.push({
      id: `${tid}.frontend`,
      objective: `wire ${provider ?? 'provider'} frontend messaging UI`,
      description: provider
        ? `Verify chat UI components render correctly for ${provider}. Ensure MessageBubble, Composer, and ConversationSidebar handle ${provider} provider context. Update useSlot resolution if needed.`
        : `Audit frontend provider coverage. Ensure every active provider has UI components registered.`,
      requiredFiles: tmpl.requiredFiles ?? [],
      producesFiles: ['web/ui/src/features/chat/', 'web/ui/src/ui/registry.ts'],
      dependsOn: [
        `${tasks.length > 0 ? tasks.length - 1 : 0}.${tasks.length > 0 ? 'state' : 'state'}`,
      ],
      verification: 'cd web/ui && bun run typecheck',
      estimatedTokens: tmpl.estimatedTokens ?? 0,
      parallelizable: false,
    })
    tid++
  }

  // Task N: Integration test (always last)
  if (provider) {
    tasks.push({
      id: `${tid}.integration`,
      objective: `end-to-end integration test for ${provider}`,
      description: `Write an integration test that verifies the full pipeline for ${provider}: resolve capabilities → resolve selectors → verify compose → verify capture patterns → verify parse. Use mock CDP transport.`,
      requiredFiles: [
        'tests/integration/',
        'tests/helpers/',
        'src/engines/conversation-manager.ts',
        'src/engines/chrome-governor.ts',
      ],
      producesFiles: [`tests/integration/providers/${provider}.test.ts`],
      dependsOn: tasks.map((t) => t.id),
      verification: `bun test tests/integration/providers/${provider}.test.ts`,
      estimatedTokens: 8000,
      parallelizable: false,
    })
    tid++
  }

  // Final: gate
  tasks.push({
    id: `${tid}.gate`,
    objective: 'run quality gate on all changes',
    description:
      'Run typecheck + lint + unit tests on all changes from this objective. Fix any failures.',
    requiredFiles: ['tests/'],
    producesFiles: [],
    dependsOn: tasks.map((t) => t.id),
    verification: 'bun run devops gate',
    estimatedTokens: 1000,
    parallelizable: false,
  })

  // Compute phases (BFS on dependency DAG)
  const phases: number[][] = []
  const assigned = new Set<string>()
  while (assigned.size < tasks.length) {
    const phase: number[] = []
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!
      if (assigned.has(t.id)) continue
      if (t.dependsOn.every((d) => assigned.has(d))) {
        phase.push(i)
        assigned.add(t.id)
      }
    }
    if (phase.length === 0) break
    phases.push(phase)
  }

  return {
    objective,
    tasks,
    totalEstimatedTokens: tasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
    phases,
  }
}
