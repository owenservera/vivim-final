// src/engines/memory/memory-backend.ts
// MemoryBackend - the vivim port of Hermes's `MemoryProvider` ABC
// (agent/memory_provider.py). A pluggable agentic-memory backend.
//
// The built-in "node" backend (NodeBackend) is always registered and wraps
// vivim's Node-layer v2 store contracts. At most ONE external backend
// (mem0, hindsight, honcho, ...) may be registered at a time (one-external
// guard, decision D3). External backends are runtime-discovered modules,
// never hardcoded in core engines (decision D9).
//
// See docs/harvest/HERMES-MEMORY-HARVEST.md and specs/024-hermes-memory-harvest.

/** Minimal OpenAI-style function-tool schema shape used by memory backends. */
export interface ToolSchema {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

/** Init context injected into every backend at initialize() time. */
export interface BackendInitContext {
  /** Vivim data dir (Hermes analog: hermes_home). Use for profile-scoped storage. */
  dataDir: string
  /** Active profile name (e.g. "default", "coder"). */
  profile: string
  /** Shared workspace name. */
  workspace: string
  /** Platform: "cli", "telegram", "cron", etc. */
  platform: string
  /** Stable platform user identifier (gateway sessions). */
  userId?: string
  /** Agent context. External backends must skip writes for non-primary contexts. */
  agentContext: 'primary' | 'subagent' | 'cron' | 'flush'
}

export interface PrefetchOpts {
  sessionId: string
}

export interface SyncTurnArgs {
  userContent: string
  assistantContent: string
  sessionId: string
  /** OpenAI-style message list as of the completed turn (may be omitted). */
  messages?: unknown[]
}

export interface MemoryWriteMetadata {
  writeOrigin?: string
  executionContext?: string
  sessionId?: string
  parentSessionId?: string
  platform?: string
  toolName?: string
  oldText?: string
  [key: string]: unknown
}

export interface SessionSwitchOpts {
  sessionId: string
  parentSessionId?: string
  reset?: boolean
  rewound?: boolean
}

export interface PreCompressArgs {
  messages: unknown[]
}

/**
 * A pluggable memory backend. Implementations must depend only on store
 * contracts, never on `src/storage/impl/*` (Store Contracts invariant).
 */
export interface MemoryBackend {
  /** Short identifier: 'node' | 'mem0' | 'hindsight' | 'honcho' | ... */
  readonly name: string

  /** Config + deps only — NO network calls. */
  isAvailable(): boolean

  initialize(sessionId: string, ctx: BackendInitContext): void | Promise<void>

  /** Static text for context assembly. Prefetched recall is injected separately. */
  systemPromptBlock(): string

  /** Recall relevant context for the upcoming turn. Fast; backgrounded internally. */
  prefetch(query: string, opts: PrefetchOpts): string | Promise<string>

  /** Queue a background recall for the NEXT turn. Default no-op. */
  queuePrefetch?(query: string, opts: PrefetchOpts): void

  /** Persist a completed turn. Should be non-blocking (orchestrator backgrounds it). */
  syncTurn(args: SyncTurnArgs): void | Promise<void>

  /** Tool schemas this backend exposes (OpenAI function-calling format). */
  getToolSchemas(): ToolSchema[]

  /** Dispatch one of this backend's tool calls. Returns JSON string. */
  handleToolCall(name: string, args: Record<string, unknown>): Promise<string> | string

  /** Called at the start of each turn with the user message. */
  onTurnStart?(turn: number, message: string): void

  /** Called when a session ends (extraction / summarization). */
  onSessionEnd?(messages: unknown[]): void

  /** Called when the agent switches session_id mid-process. */
  onSessionSwitch?(opts: SessionSwitchOpts): void

  /** Called before context compression discards old messages. */
  onPreCompress?(args: PreCompressArgs): string

  /** Mirror a built-in memory write to this backend. */
  onMemoryWrite?(
    action: 'add' | 'replace' | 'remove',
    target: string,
    content: string,
    metadata?: MemoryWriteMetadata,
  ): void

  /** Extra on-disk paths this backend stores outside dataDir (for backup). */
  backupPaths?(): string[]

  shutdown(): void
}

/**
 * Reserved tool names. A backend tool whose name collides with a vivim
 * UnifiedCapability slug (or core tool) is dropped at registration so it
 * never enters the routing table (decision D3 / FR-012).
 */
export const RESERVED_TOOL_NAMES: ReadonlySet<string> = new Set([
  'memory',
  'clarify',
  'delegate_task',
  'send_message',
  'execute_code',
  'read_file',
  'patch',
  'search_files',
  'browser_navigate',
  'terminal',
  'todo',
])

/**
 * Return a bare function-tool dict with a resolvable top-level `name`.
 * Some backends return an entry already wrapped as
 * `{ type: 'function', function: {...} }`; wrapping that twice breaks strict
 * providers, so unwrap it (port of MemoryManager.normalize_tool_schema,
 * memory_manager.py:50).
 */
export function normalizeToolSchema(
  schema: unknown,
): { name: string; description: string; parameters: unknown } | null {
  if (!schema || typeof schema !== 'object') return null
  let s = schema as Record<string, unknown>
  if (s.type === 'function' && s.function && typeof s.function === 'object') {
    s = s.function as Record<string, unknown>
  }
  const name = s.name
  if (typeof name !== 'string' || !name) return null
  return {
    name,
    description: typeof s.description === 'string' ? s.description : '',
    parameters: s.parameters ?? {},
  }
}
