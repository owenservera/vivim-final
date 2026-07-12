# VIVIM-HOME: Infinite Canvas with Layer Swapping (SOTA 2026)

## Vision Synthesis

The vivim-home canvas is a **self-modifying, agentic-native platform** where:
- HTML is the shell — programmable by design, not compiled
- Infinite layers swap on demand (system settings, chat, automation, agents, etc.)
- Users design the canvas from within the canvas
- Agents can be created/vized/chained directly in the UI

## Core Architecture

### Layers System
```
┌─────────────────────────────────────────────┐
│           CANVAS LAYERS                     │
├─────────────────────────────────────────────┤
│  system: Layer 0 — System visibility, core    │
│          settings, store registry, health     │
│                                             │
│  chat:    Layer 1 — Traditional chat layer   │
│          conversations, agents, streaming     │
│                                             │
│  auto:    Layer 2 — Automation layer         │
│          workflow builder, triggers, rules    │
│                                             │
│  agents:  Layer 3 — Agent studio             │
│          create, configure, visualize flows   │
│                                             │
│  projects: Layer 4 — Project layer           │
│          workspace, files, context           │
│                                             │
│  knowledge: Layer 5 — Knowledge layer      │
│          personal knowledge store, graphs      │
└─────────────────────────────────────────────┘
```

### Layer Swapping Engine
```typescript
// src/engines/layer-swapper.ts
interface CanvasLayer {
  id: string
  name: string
  slug: string
  description: string
  htmlTemplate: string
  cssTemplate: string
  jsTemplate?: string | null
  bindingSpecJson: string
  requiredCapabilities: string[]
  version: number
  isActive: boolean
  createdBy: 'agent' | 'user' | 'system'
}

interface LayerSwapRequest {
  layerSlug: string
  transition: 'instant' | 'fade' | 'slide' | 'morph'
  preserveState?: boolean
  context?: Record<string, unknown>
}

class LayerSwapper {
  private currentLayer: string | null = null
  private layerCache: Map<string, { html: string; css: string; js?: string }> = new Map()
  
  // Swap to a different layer
  async swapTo(request: LayerSwapRequest): Promise<LayerSwapResult>
  
  // Register a new layer
  async registerLayer(layer: CanvasLayer): Promise<string>
  
  // Get current layer
  getCurrentLayer(): Promise<CanvasLayer | null>
  
  // List available layers
  listLayers(): Promise<CanvasLayer[]>
  
  // Create layer from within canvas (meta-programming)
  async createLayerFromCanvas(dsl: LayerDSL): Promise<CanvasLayer>
}
```

## SOTA 2026 Best Practices

### 1. Zero-Build Architecture
- **No build step required** — HTML/JS/CSS runs directly in browser
- TypeScript transpilation via esbuild in worker thread (background)
- Hot module replacement via WebSocket from server
- Plugin system loads `.html` files dynamically into canvas

### 2. Layer State Management
```typescript
// Each layer maintains isolated state
interface LayerState {
  ui: Record<string, unknown>      // DOM-bound state
  data: Record<string, unknown>    // Application data
  context: Record<string, unknown> // Cross-layer context
  viewport: { x: number; y: number; zoom: number } // Canvas position
}

// State preservation during swaps
interface LayerSwapOptions {
  preserveScroll?: boolean
  preserveInputs?: boolean
  preserveViewport?: boolean
  transitionAnimation?: string
}
```

### 3. Agent Creation DSL
```html
<!-- Within canvas: create agents via declarative DSL -->
<agent-dsl>
  <agent id="researcher" name="Deep Research" provider="perplexity">
    <model>sonar-pro</model>
    <temperature>0.2</temperature>
    <capabilities>
      <capability-ref slug="web.search"/>
      <capability-ref slug="knowledge.extract"/>
    </capabilities>
    <triggers>
      <on-event type="user.message" pattern="research.*"/>
    </triggers>
  </agent>
</agent-dsl>
```

### 4. Canvas-as-Code Pattern
From the harvested v4 HTML files, the proven patterns:
- **Manifest-driven** — `@region` tags for self-description
- **IndexedDB as VFS** — File system abstraction in browser
- **BroadcastChannel P2P** — Cross-tab communication
- **Plugin mount points** — `#pluginsMount`, `#canvas`, `#app`

### 5. On-Demand Loading (Critical)
```typescript
// Engine swaps layers on demand
class OnDemandLoader {
  // Load layer only when requested
  async loadLayer(slug: string): Promise<CanvasLayer> {
    if (!this.cache.has(slug)) {
      const layer = await this.fetchLayerDefinition(slug)
      this.cache.set(slug, layer)
    }
    return this.cache.get(slug)!
  }
  
  // Lazy load capability bindings
  async instantiateLayer(layer: CanvasLayer): Promise<HTMLElement> {
    // 1. Inject HTML template
    // 2. Apply CSS (scoped via shadow DOM)
    // 3. Initialize JS in sandboxed iframe
    // 4. Bind capabilities via CanvasBinder (3.4)
    // 5. Emit 'layer:ready' event
  }
}
```

## Required Capabilities Integration

### Layer-Specific Capabilities
| Layer | Required Capabilities |
|-------|----------------------|
| system | `chrome.launch`, `provider.health`, `config.read`, `config.write` |
| chat | `conversation.create`, `conversation.send`, `message.render`, `agent.select` |
| auto | `workflow.create`, `workflow.execute`, `trigger.register`, `schedule.set` |
| agents | `agent.create`, `agent.configure`, `agent.visualize`, `agent.chain` |
| projects | `project.create`, `project.context`, `file.read`, `file.write` |
| knowledge | `knowledge.ingest`, `knowledge.query`, `graph.visualize`, `memory.store` |

### Cross-Layer Events
```typescript
// From CapabilityEventBus (SOTA-01)
type LayerEvent =
  | { type: 'layer:swapped'; from: string; to: string; durationMs: number }
  | { type: 'layer:created'; layerId: string; creator: string }
  | { type: 'layer:destroyed'; layerId: string }
  | { type: 'layer:state'; layerId: string; state: Record<string, unknown> }
```

## Implementation Path

### Phase A: Core Layer Engine (New Units Needed)
1. **LayerDefinition model** — Extend CanvasDefinition with layer metadata
2. **LayerRegistry engine** — Manage layer CRUD + lookup
3. **LayerSwapper engine** — Handle swap transitions + state
4. **LayerRenderer** — Inject HTML/CSS/JS into canvas container
5. **LayerDSL parser** — Parse declarative agent/canvas definitions

### Phase B: Built-in Layers
1. **SystemLayer** — Settings, health, store registry
2. **ChatLayer** — Conversation interface (from harvest files)
3. **AgentsLayer** — Agent studio with chain visualization
4. **AutomationLayer** — n8n-style workflow builder (SOTA-04)

### Phase C: Meta-Programming
1. **CanvasDesigner tool** — UI to create layers from within canvas
2. **AgentComposer tool** — Drag-drop agent flow builder
3. **LiveBinding editor** — Edit capability bindings visually
4. **SchemaGenerator** — Generate Prisma schema from layer state

## Technical Constraints (Non-Negotiable)

| Constraint | Source | Rationale |
|------------|--------|-----------|
| No inline `<script>` in templates | CanvasRegistry (3.1) | CSP enforcement |
| Layer JS runs in sandboxed iframe | Canvas security (3.12) | Isolation |
| Governor Canon applies | INVARIANT | Only ChromeGovernor touches CDP |
| Store contracts only | INVARIANT | Engines depend on contracts |

## Key Insights from Harvest Files

1. **v1 (2025-11-19)** — Kernel pattern: bootloader → IndexedDB → plugins
2. **v6 (2026-02-09)** — Multi-agent, multi-API support with full component library
3. **Layer concepts** — Already present in `vivim-canvas` harvest files as "regions"
4. **P2P foundation** — BroadcastChannel for cross-tab, WebRTC for peer-to-peer
5. **Self-modification** — Snapshot engine can export/import system state

## Next Steps

1. Create GAP units for LayerDefinition, LayerRegistry, LayerSwapper
2. Design layer DSL schema (JSON or HTML custom elements)
3. Prototype layer swap with fade transition
4. Integrate with existing EventBus for cross-layer events
5. Wire Governor for system layer (read-only health/state)