# 07 — Composable Interface + Adaptive Workspace: Unified Registry, Plugin System, Workspace Modes

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Objectives:** 4 (Composable Interface) + 5 (Adaptive Workspace)

---

## Part 1: The Composable Interface (Objective 4)

### Problem Statement

The current system has two parallel registries:
- `CommandRegistry` (cli/command-registry.ts, 36 lines) — CLI commands
- `ActionRegistry` (web/ui/src/actions/registry.ts, 50 lines) — UI actions

These have nearly identical APIs but no shared definition. A capability registered in one is invisible to the other. Workflows can't call CLI commands. MCP tools can't trigger UI actions.

### Solution: UnifiedCapabilityRegistry

A single registry where every capability is defined once and automatically exported to all surfaces:

```typescript
// Example: Register a capability once, use everywhere

registry.register({
  id: newId(),
  slug: 'send_message',
  name: 'Send Message',
  description: 'Send a message to a provider conversation',
  category: 'conversation',
  surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  inputSchema: {
    type: 'object',
    properties: {
      conversationId: { type: 'string', description: 'Conversation ID' },
      message: { type: 'string', description: 'Message text' },
    },
    required: ['conversationId', 'message'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      messageId: { type: 'string' },
    },
  },
  handler: async (input, ctx) => {
    return conversationManager.send(input.conversationId, input.message)
  },
  cliCommand: {
    name: 'send',
    aliases: ['s', 'msg'],
    examples: ['vivim send --conversationId abc123 "Hello"'],
  },
  uiAction: {
    component: 'action_button',
    position: 'composer',
    order: 1,
  },
  workflowNodeType: 'action',
  mcpToolName: 'send_message',
  apiEndpoint: { method: 'POST', path: '/api/conversations/:id/send' },
  isAsync: true,
  requiresConfirmation: false,
  tags: ['conversation', 'messaging'],
})
```

### Plugin Hot-Reload System

```typescript
// src/engines/plugin-hot-reload.ts

export interface PluginWatcher {
  start(directory: string): void
  stop(): void
  onPluginLoaded(handler: (plugin: ProviderPlugin) => void): void
  onPluginUnloaded(handler: (pluginId: string) => void): void
  onPluginError(handler: (error: Error, filePath: string) => void): void
}

export class PluginHotReload implements PluginWatcher {
  private watcher: ReturnType<typeof watch> | null = null
  private loadedPlugins = new Map<string, { plugin: ProviderPlugin; filePath: string }>()
  private loadHandlers: Array<(p: ProviderPlugin) => void> = []
  private unloadHandlers: Array<(id: string) => void> = []
  private errorHandlers: Array<(e: Error, f: string) => void> = []

  start(directory: string): void {
    // Initial load
    this.loadAll(directory)

    // Watch for changes
    this.watcher = watch(directory, { recursive: true }, async (event, filename) => {
      if (!filename?.endsWith('.ts') && !filename?.endsWith('.js')) return
      const fullPath = join(directory, filename)

      if (event === 'rename' || event === 'change') {
        try {
          // Unload old version if exists
          const existing = this.findByPath(fullPath)
          if (existing) {
            this.unloadHandlers.forEach(h => h(existing.plugin.providerId))
            this.loadedPlugins.delete(existing.plugin.providerId)
          }

          // Load new version
          await this.loadFile(fullPath)
        } catch (err) {
          this.errorHandlers.forEach(h =>
            h(err instanceof Error ? err : new Error(String(err)), fullPath)
          )
        }
      }
    })
  }

  private async loadAll(directory: string): Promise<void> {
    try {
      const entries = await readdir(directory, { recursive: true })
      for (const entry of entries) {
        const fullPath = join(directory, entry)
        if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
          await this.loadFile(fullPath).catch(() => {})
        }
      }
    } catch {
      // Directory doesn't exist yet — that's fine
    }
  }

  private async loadFile(filePath: string): Promise<void> {
    // Clear module cache for hot reload
    const timestampedPath = `${filePath}?t=${Date.now()}`
    const imported = await import(timestampedPath)
    const plugin = (imported.default ?? imported) as ProviderPlugin

    if (!plugin?.providerId) {
      throw new Error(`Plugin at ${filePath} has no providerId`)
    }

    this.loadedPlugins.set(plugin.providerId, { plugin, filePath })
    this.loadHandlers.forEach(h => h(plugin))
  }

  private findByPath(filePath: string): { plugin: ProviderPlugin; filePath: string } | null {
    for (const entry of this.loadedPlugins.values()) {
      if (entry.filePath === filePath) return entry
    }
    return null
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  onPluginLoaded(handler: (p: ProviderPlugin) => void): void {
    this.loadHandlers.push(handler)
  }

  onPluginUnloaded(handler: (id: string) => void): void {
    this.unloadHandlers.push(handler)
  }

  onPluginError(handler: (e: Error, f: string) => void): void {
    this.errorHandlers.push(handler)
  }

  listLoaded(): string[] {
    return [...this.loadedPlugins.keys()]
  }
}
```

### Workflow Builder Integration

The `WorkflowEngine` gains new node types that reference capabilities from the `UnifiedCapabilityRegistry`:

```typescript
// Extended WorkflowNode types

export interface CapabilityCallNode {
  type: 'capability_call'
  capabilitySlug: string
  inputMapping: Record<string, string>  // variable → input field
  outputMapping: Record<string, string> // output field → variable
}

export interface CliCommandNode {
  type: 'cli_command'
  command: string
  args: string[]
  outputVariable: string
}

export interface PluginCallNode {
  type: 'plugin_call'
  providerId: string
  hook: string
  input: Record<string, unknown>
}

// In WorkflowEngine.executeNode():
private async executeNode(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  switch (node.type) {
    case 'capability_call': {
      const input = this.mapVariables(node.inputMapping, variables)
      const result = await this.registry.execute(
        node.capabilitySlug, input, { metadata: variables }
      )
      return this.mapOutput(node.outputMapping, result)
    }
    case 'cli_command': {
      const result = await this.cli.execute(node.command, node.args)
      return { [node.outputVariable]: result }
    }
    case 'plugin_call': {
      const plugin = this.pluginManager.getPlugin(node.providerId)
      if (!plugin) throw new EngineError(`Plugin not loaded: ${node.providerId}`)
      const result = await plugin.onAction(node.input)
      return { pluginResult: result }
    }
    // ... existing node types
  }
}
```

### WebSocket Agent Bridge V2

Expands the existing `AgentBridge` to a full bidirectional protocol:

```typescript
// Agent → Frontend commands
type AgentCommand =
  | { type: 'agent:command'; actionId: string; params: Record<string, unknown>; correlationId: string }
  | { type: 'agent:discover' }
  | { type: 'agent:subscribe'; entityType: string; entityId: string }
  | { type: 'agent:unsubscribe'; entityType: string; entityId: string }
  | { type: 'agent:query_state'; conversationId: string }
  | { type: 'agent:execute_workflow'; workflowId: string; input: Record<string, unknown> }
  | { type: 'agent:autonomous'; goal: string }

// Frontend → Agent responses
type AgentResponse =
  | { type: 'agent:result'; correlationId: string; ok: boolean; data?: unknown; error?: string }
  | { type: 'agent:state'; conversationId: string; state: Record<string, unknown> }
  | { type: 'agent:event'; eventType: string; data: unknown }
```

---

## Part 2: The Adaptive Workspace (Objective 5)

### Workspace Modes

Three modes that progressively reveal complexity:

```typescript
export type WorkspaceMode = 'chat' | 'expert' | 'agent'

export interface ModeConfig {
  mode: WorkspaceMode
  panels: PanelConfig[]
  features: string[]
  defaultProvider?: string
  contextAssembly: boolean
  muxEnabled: boolean
  autonomousEnabled: boolean
}

const MODE_CONFIGS: Record<WorkspaceMode, ModeConfig> = {
  chat: {
    mode: 'chat',
    panels: [
      { id: 'messages', visible: true, position: 'center', minWidth: 400 },
      { id: 'composer', visible: true, position: 'bottom', minWidth: 400 },
    ],
    features: ['send_message', 'select_provider'],
    contextAssembly: false,
    muxEnabled: false,
    autonomousEnabled: false,
  },
  expert: {
    mode: 'expert',
    panels: [
      { id: 'messages', visible: true, position: 'center', minWidth: 400 },
      { id: 'composer', visible: true, position: 'bottom', minWidth: 400 },
      { id: 'capabilities', visible: true, position: 'left', minWidth: 200 },
      { id: 'context', visible: true, position: 'right', minWidth: 250 },
      { id: 'memory', visible: false, position: 'right', minWidth: 250 },
      { id: 'provider_health', visible: false, position: 'right', minWidth: 200 },
    ],
    features: [
      'send_message', 'select_provider', 'execute_capability',
      'view_context', 'search_memory', 'mux', 'create_workflow',
    ],
    contextAssembly: true,
    muxEnabled: true,
    autonomousEnabled: false,
  },
  agent: {
    mode: 'agent',
    panels: [
      { id: 'messages', visible: true, position: 'center', minWidth: 400 },
      { id: 'composer', visible: true, position: 'bottom', minWidth: 400 },
      { id: 'capabilities', visible: true, position: 'left', minWidth: 200 },
      { id: 'context', visible: true, position: 'right', minWidth: 300 },
      { id: 'memory', visible: true, position: 'right', minWidth: 300 },
      { id: 'provider_health', visible: true, position: 'bottom', minWidth: 200 },
      { id: 'workflow_builder', visible: false, position: 'left', minWidth: 400 },
      { id: 'autonomous_status', visible: true, position: 'bottom', minWidth: 300 },
      { id: 'trace', visible: false, position: 'bottom', minWidth: 400 },
    ],
    features: [
      'send_message', 'select_provider', 'execute_capability',
      'view_context', 'search_memory', 'mux', 'create_workflow',
      'autonomous_execute', 'view_trace', 'manage_plugins', 'view_cost',
    ],
    contextAssembly: true,
    muxEnabled: true,
    autonomousEnabled: true,
  },
}
```

### Mode Promotion Logic

```typescript
// Auto-promote user to higher modes based on usage patterns
async function checkModePromotion(userId: string): Promise<WorkspaceMode | null> {
  const usage = await getUsageStats(userId)

  // Chat → Expert: user has > 50 conversations OR uses capabilities > 10 times
  if (usage.totalConversations > 50 || usage.capabilityExecutions > 10) {
    if (usage.currentMode === 'chat') return 'expert'
  }

  // Expert → Agent: user has created workflows OR uses autonomous execution
  if (usage.workflowsCreated > 0 || usage.autonomousExecutions > 0) {
    if (usage.currentMode === 'expert') return 'agent'
  }

  return null // No promotion needed
}
```

### Conversation Organization

```typescript
// Conversations organize into projects and topics

export interface ConversationTreeNode {
  type: 'project' | 'topic' | 'conversation'
  id: string
  name: string
  children: ConversationTreeNode[]
  conversationCount: number
  lastActivity: number
}

// Auto-assign conversations to topics based on content
async function autoAssignTopic(conversationId: string): Promise<string | null> {
  const messages = await conversationStore.getMessages(conversationId, { limit: 20 })
  const combinedText = messages.map(m => m.content ?? '').join(' ')

  // Use semantic search to find matching topic
  const results = await searchEngine.search({
    text: combinedText.slice(0, 1000),
    entityType: 'topic',
    limit: 1,
    threshold: 0.7,
  })

  if (results.length > 0) {
    const topicId = results[0]!.id
    await topicStore.assignConversation(conversationId, topicId, 'auto')
    return topicId
  }

  // No matching topic — create new one from first message
  const firstMessage = messages[0]?.content ?? 'Untitled'
  const topicName = firstMessage.slice(0, 50)
  const topic = await topicStore.create({ name: topicName, description: null })
  await topicStore.assignConversation(conversationId, topic.id, 'auto')
  return topic.id
}
```

### Memory Visualization API

```typescript
// API endpoints for memory visualization

// GET /api/memory/graph?entityId=X
// Returns: entity + connected entities + mentions
{
  entity: { id, name, type, description, confidence },
  connectedEntities: [
    { entity: {...}, relationship: "mentioned_together", strength: 0.8 },
  ],
  mentions: [
    { conversationId, messageId, snippet, ts },
  ],
}

// GET /api/memory/timeline?from=&to=&type=
// Returns: chronological list of memory events
{
  events: [
    { type: 'fact_extracted', id, subject, predicate, object, conversationId, ts },
    { type: 'decision_made', id, text, conversationId, ts },
    { type: 'entity_discovered', id, name, type, conversationId, ts },
    { type: 'pattern_found', id, name, occurrences, ts },
  ],
}

// GET /api/memory/stats
// Returns: aggregate statistics
{
  totalFacts: 234,
  totalDecisions: 45,
  totalEntities: 89,
  totalPatterns: 12,
  totalTopics: 8,
  totalProjects: 3,
  memorySizeBytes: 4567890,
  embeddingsCount: 1234,
  oldestEntry: 1700000000,
  newestEntry: 1700000100,
}
```

### Progressive Disclosure UI Components

```typescript
// Panels that appear/disappear based on mode and context

interface PanelProps {
  mode: WorkspaceMode
  visible: boolean
  conversationId?: string
}

// Context Panel (expert/agent mode)
function ContextPanel({ mode, conversationId }: PanelProps) {
  const context = useApi(`/api/context/assemble?conversationId=${conversationId}`)
  return (
    <div>
      <h3>Assembled Context</h3>
      <ContextLayers layers={context.layers} />
      <SituationBadge type={context.situation.type} confidence={context.situation.confidence} />
      <TokenBudgetBar used={context.totalTokens} budget={context.budget} />
    </div>
  )
}

// Memory Panel (expert/agent mode)
function MemoryPanel({ mode, conversationId }: PanelProps) {
  const [tab, setTab] = useState<'facts' | 'entities' | 'decisions'>('facts')
  const data = useApi(`/api/memory/${tab}`)
  return (
    <div>
      <h3>Memory</h3>
      <Tabs value={tab} onChange={setTab}>
        <Tab value="facts">Facts ({data.totalFacts})</Tab>
        <Tab value="entities">Entities ({data.totalEntities})</Tab>
        <Tab value="decisions">Decisions ({data.totalDecisions})</Tab>
      </Tabs>
      <MemoryList items={data.items} editable={mode === 'agent'} />
    </div>
  )
}
```

---

## Server API Endpoints

| Method | Path | Purpose | Mode |
|--------|------|---------|------|
| GET | `/api/capabilities/all` | List all unified capabilities | Any |
| GET | `/api/workspace/mode` | Get current workspace mode | Any |
| PUT | `/api/workspace/mode` | Set workspace mode | Any |
| GET | `/api/workspace/panels` | Get panel configuration | Any |
| GET | `/api/projects` | List projects | Expert+ |
| POST | `/api/projects` | Create project | Expert+ |
| GET | `/api/topics` | List topics | Expert+ |
| POST | `/api/topics` | Create topic | Expert+ |
| GET | `/api/memory/graph?entityId=X` | Entity graph | Expert+ |
| GET | `/api/memory/timeline` | Memory timeline | Expert+ |
| GET | `/api/memory/stats` | Memory statistics | Expert+ |
| GET | `/api/memory/curated` | Curated memory | Expert+ |
| PUT | `/api/memory/:type/:id` | Edit memory entry | Expert+ |
| DELETE | `/api/memory/:type/:id` | Delete memory entry | Expert+ |
| GET | `/api/plugins` | List plugins | Agent |
| POST | `/api/plugins/install` | Install plugin | Agent |
| DELETE | `/api/plugins/:id` | Remove plugin | Agent |
| POST | `/api/plugins/:id/reload` | Reload plugin | Agent |
