# Universal Input Card — Atomic TextEntryBox + Pluggable Capability Drawer

> **Date:** 2026-07-26
> **Status:** v3 — atomic-unit-first architecture
> **Philosophy:** The text entry box + send button is the **minimal atomic unit**. Everything else is a **pluggable add-on** the user layers on. Users start with a bare input and toggle chrome on/off like lego bricks.

---

## 1. Goal

Replace the current `Composer.tsx` (single `<textarea>` + `<button>`, ~400 lines monolithic) with a **minimal text entry box** as the irreducible unit, wrapped in a **shell component** that accepts pluggable add-ons:

1. **Atomic unit** = `TextEntryBox` + `SendButton` — that's it. No model, no chips, no slash.
2. **Everything else is a "Capability Drawer" add-on** — model pills, toggle chips, slash commands, @ mentions, attachments, quoted messages, streaming status. Each is a **self-contained sub-component** that can be mounted/unmounted independently.
3. **User controls the chrome** — stored in localStorage or a `ComposerConfig` DB row. Default is bare minimum (just text + send). Users toggle features on when they need them.
4. **Add-ons register into a `chat.composerAddons` slot array** — each add-on has a key, a position (top/bottom/inline), and renders only when enabled.
5. **Uses `style={{}}` + CSS variables** (`--bg`, `--accent`, `--text`, `--border`, etc.) matching the codebase convention. No Tailwind.
6. **Is slot-compatible** — registers as `chat.composer` default, can be hot-swapped by any provider/capability.

---

## 2. Architecture: Atomic Unit + Pluggable Drawer

### 2.1 The Atomic Unit

```
┌────────────────────────────────────────────────┐
│  TextEntryBox + SendButton                     │
│  ─────────────────────────────                 │
│  ┌────────────────────────────────┐ [▶ Send]  │
│  │ textarea (auto-resize)         │           │
│  │ placeholder="Message..."       │           │
│  └────────────────────────────────┘           │
│                                                │
│  That's it. 60 lines. Pure input.              │
└────────────────────────────────────────────────┘
```

This is what renders when ALL add-ons are disabled. No toolbar, no footer, no model pill, no chips.

### 2.2 The Capability Drawer (Add-On Layer)

Everything else is an **optional add-on** mounted above, below, or inline with the atomic unit:

```
┌────────────────────────────────────────────────┐
│  [G2.5 Pro ▾]      ModelSelector add-on        │  ← top
├────────────────────────────────────────────────┤
│  [Web] [Think] [Voice]    CapabilityChips      │  ← top (second row)
├────────────────────────────────────────────────┤
│  ↪ "quoted message..."     QuoteBar add-on     │  ← top
├────────────────────────────────────────────────┤
│  📎 file.png ✕              Attachments add-on │  ← top
├────────────────────────────────────────────────┤
│  /search                    SlashBar add-on     │  ← inline
├────────────────────────────────────────────────┤
│  ┌────────────────────────┐ [▶ Send]           │
│  │ textarea               │  ← ATOMIC UNIT     │
│  └────────────────────────┘                    │
├────────────────────────────────────────────────┤
│  ■ Stop    StreamingStatus add-on              │  ← bottom
├────────────────────────────────────────────────┤
│  ⌘K · ⌘/ · Enter          FooterHints add-on   │  ← bottom
└────────────────────────────────────────────────┘
```

Each add-on is a function component with a standard interface:

```typescript
interface ComposerAddOn {
  key: string
  position: 'top' | 'bottom' | 'inline'
  Component: React.ComponentType<AddOnProps>
  /** If false, add-on is not rendered */
  enabled: boolean | ((state: AddOnState) => boolean)
}
```

### 2.3 Stateful Role Context — The Box Knows Whose Input It Is

**There is not one TextEntryBox. There can be many.** Each lives at a specific position in the workspace taxonomy (workspace → surface → region) and a specific Z-layer depth. The box must know **whose input it is** — its role context — to resolve the right provider, capabilities, add-ons, and behavior.

#### 2.3.1 Workspace Taxonomy

```
workspace (room in 3D z-depth space)
  └── surface (2D plane inside workspace)
       ├── region (named slot inside surface)
       │    └── node (rendered card / component)
       └── ...
```

Source: `frontend/src/shared/workspace.ts:6-12`

Each level has **its own TextEntryBox if it takes text input** — and each box has a **different role**:

| Surface Kind | Surface Slug | Possible Input Boxes | Role |
|---|---|---|---|
| Chat | `chat` | `chat.composer` — primary message input | Send messages to provider |
| Chat | `chat` | `chat.search` — conversation search (overlay layer) | Filter conversation list |
| Docs | `docs` | `docs.search` — document search | Search documents |
| Docs | `docs` | `docs.comment` — comment input | Add comment to document |
| Docs | `docs` | `docs.viewer` — URL/embed bar | Navigate to document |
| Automation | `automation` | `automation.builder` — code/automation input | Write automation script |
| Agents | `agents` | `agents.canvas` — agent instruction input | Prompt an agent |
| Agents | `agents` | `agents.chat` — agent chat composer | Chat with an agent |
| Shell | `shell` | `shell.terminal` — command line | Run shell commands |

#### 2.3.2 Z-Layer Binding (the "Z LAYERS" dimension)

The **6 canonical Z-layers** (`frontend/src/shared/z-layer.ts:15`) define which depth an input lives at:

| Layer | Depth | Input Role | Example |
|---|---|---|---|
| `background` | -100 | Ambient/contextual input | Doc inline annotations |
| `base` | 0 | Primary input | Chat composer, shell terminal |
| `content` | 10 | Interactive content input | Agent instructions, automation builder |
| `overlay` | 50 | Temporary input overlays | Search bar, quick-find dialog |
| `modal` | 100 | Blocking modal input | Confirm dialog text field, rename prompt |
| `cursor` | 1000 | Floating mini-input | Slash command bar, quick action box |

A workspace has a `zDepth` (workspace stack depth). A surface within a workspace has another `zDepth`. The **effective Z-depth of a TextEntryBox** is the sum: `workspace.zDepth + surface.zDepth + Z_LAYER_DEFAULTS[layer].depth`.

Two workspaces at different zDepth may each have their own chat composer — they are physically stacked in 3D space and logically independent.

#### 2.3.3 Role Context → ComposerShellScope

Every TextEntryBox receives a scope that identifies **exactly who it is**:

```typescript
interface ComposerInstanceScope {
  workspaceId: string
  surfaceSlug: 'chat' | 'docs' | 'media' | 'automation' | 'agents' | 'shell' | string
  regionSlotId: string          // e.g. "chat.composer", "docs.search", "agents.canvas"
  activeZLayer: ZLayerId        // which canonical z-layer this instance binds to
  instanceId: string            // unique per-mounted-instance
}
```

This scope drives:
- **Provider resolution** — which provider is bound to this workspace+surface+region
- **Default add-ons** — each (surface, region) pair can have a different default add-on set
- **Placeholder text** — "Message...", "Search documents...", "Run command..."
- **Capability filtering** — what capabilities are available at this Z-depth
- **Behavior mode** — chat send vs search submit vs terminal execute vs agent prompt
- **Keyboard shortcut scope** — `Enter` = send/search/execute depending on role

#### 2.3.4 Role-Specific Wiring Example

```
Workspace "Research" (zDepth=0)
  └── Surface "Chat" (zDepth=0)
       └── Region "chat.composer" (layer=base)
            └── TextEntryBox #1
                scope: { ws: "ws:research", surface: "chat", region: "chat.composer", zLayer: "base" }
                defaults: { addOns: ["modelSelector","capabilityChips"], placeholder: "Message..." }
                submit: → POST /api/conversations/:id/send

Workspace "Code Review" (zDepth=1)
  └── Surface "Agents" (zDepth=0)
       └── Region "agents.canvas" (layer=content)
            └── TextEntryBox #2
                scope: { ws: "ws:code-review", surface: "agents", region: "agents.canvas", zLayer: "content" }
                defaults: { addOns: ["attachments"], placeholder: "What should the agent do?" }
                submit: → POST /api/agents/:id/execute
```

Two TextEntryBoxes, completely different behavior, same atomic component. The scope tells each which add-ons to show, what placeholder to use, and where to send the text.

### 2.4 User Control Surface

### 2.4 Add-On Registry

```typescript
// frontend/src/features/composer-addons/index.ts
const BUILTIN_ADDONS: ComposerAddOn[] = [
  { key: 'modelSelector',    position: 'top',    Component: ModelSelectorPill,    enabled: false },
  { key: 'capabilityChips',  position: 'top',    Component: CapabilityChips,      enabled: false },
  { key: 'quoteBar',         position: 'top',    Component: QuoteBar,             enabled: false },
  { key: 'attachments',      position: 'top',    Component: AttachmentPreview,    enabled: false },
  { key: 'slashCommands',    position: 'inline', Component: SlashPopover,         enabled: false },
  { key: 'mentionPopover',   position: 'inline', Component: MentionPopover,       enabled: false },
  { key: 'streamingStatus',  position: 'bottom', Component: StreamingStatusBar,   enabled: false },
  { key: 'footerHints',      position: 'bottom', Component: FooterHints,          enabled: false },
]
```

This registry is extensible — plugins/capabilities can register additional add-ons via `registerComposerAddOn(key, addOn)`.

---

## 3. Data Flow

```
  ┌────────────────────────────────────────────────────────────┐
  │               WORKSPACE / Z-LAYER CONTEXT                   │
  │  routeSyncWorkspace(ctx) → ResolvedWorkspaceSurface         │
  │    ├── workspaceId         ← which workspace "room"         │
  │    ├── surfaceSlug         ← which 2D plane (chat/docs/…)   │
  │    ├── regionSlotId        ← which named slot                │
  │    ├── activeZLayer        ← which depth (base/content/…)   │
  │    └── zDepth              ← 3D stack position              │
  │                                                              │
  │  Each (workspace, surface, region, layer) combo = ONE       │
  │  unique TextEntryBox instance with its own role scope.      │
  └─────────────────────┬──────────────────────────────────────┘
                        │ ComposerInstanceScope
                        ▼
  ┌────────────────────────────────────────────────────────────┐
  │                   PROVIDER / DB LAYER                       │
  │  GET /api/providers/:id            → ProviderDefinition    │
  │  GET /api/providers/:id/capabilities → ResolvedCapabilities│
  │  GET /api/providers/:id/models     → ProviderModel[]       │
  └─────────────────────┬──────────────────────────────────────┘
                        │ useIO().get() / sendMessage()
                        ▼
  ┌────────────────────────────────────────────────────────────┐
  │              SHELL: ComposerShell (parent)                  │
  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   │
  │  scope: ComposerInstanceScope   ← tells the box its role   │
  │  ├── loads provider models & capabilities per scope        │
  │  ├── manages WS streaming (forward to atomic unit via cb)  │
  │  ├── reads localStorage for enabledAddOns[scope.key]       │
  │  └── renders:                                               │
  │      ├── ADDON_SLOT_TOP ── modelSelector, chips, quote...  │
  │      ├── ADDON_SLOT_INLINE ── slashPopover, mentionPopover │
  │      ├── <TextEntryBox + SendButton>  ← ATOMIC UNIT        │
  │      └── ADDON_SLOT_BOTTOM ── streamingStatus, hints       │
  └────────────────────────────────────────────────────────────┘
```

The `ComposerShell` is the new default for ANY text-input slot (`chat.composer`, `docs.search`, `agents.canvas`, `shell.terminal`, etc.). Each shell instance is **bound to a unique scope** — the same atomic component renders differently depending on which workspace + surface + region + Z-layer it belongs to.

The atomic `TextEntryBox` never knows about add-ons or scope — it just handles text input and calls `onSubmit(text)`.

---

## 4. COMPONENT SPECIFICATION

### 4.0 Critical Gaps

| # | Finding | Impact | Fix Required in Impl |
|---|---------|--------|---------------------|
| 1 | `ChatSlotSurface` places `chat.composer` in a **narrow right column**. | If `ComposerShell` replaces `Composer`, layout breaks. | Keep `ComposerShell` as input-only and change `ChatSlotSurface` grid to `'header header' 'thread thread' 'composer composer'` or keep `Composer` as parent that delegates to `ComposerShell`. |
| 2 | **No `/api/capabilities?surface=ui` endpoint.** | Add-ons that read capabilities must fetch per-provider. | Each add-on reads from `providerContext` provided by shell. |
| 3 | **`GET /api/providers` returns no nested `models[]`.** | ModelSelector add-on has no data. | Add `include: { models: true }` to `listProviders()` in `db.ts`. |
| 4 | **WS events are FLAT**, not `payload`-wrapped. | `msg.payload` is undefined in old Composer. | Shell reads top-level fields. Fix in integration. |
| 5 | **ContentBlock dual type system.** | Backend `ContentPart` vs frontend `{kind,content,index}`. | Normalize in shell. |
| 6 | **Tailwind vs inline styles.** | Spec used `className`. Codebase uses `style={{}}` + CSS variables. | All components use `style={{}}` + `var(--*)`. |
| 7 | **StreamingProtocol emits 4 event types** (`stream_start`, `block`, `stream_end`, `complete`). | Old handler only handles 3. | Shell handles all 4. |
| 8 | **ML prerouter `classify()` must be called on submit.** | Must preserve. | `TextEntryBox` calls `onSubmit(text)` → shell calls `classify(text)`. |

### 4.1 Types (frontend/src/types/api.ts)

Existing types stay. Add these:

```typescript
// ── Add-on system ──

export type ComposerAddOnPosition = 'top' | 'bottom' | 'inline'

export interface ComposerAddOn {
  key: string
  position: ComposerAddOnPosition
  Component: React.ComponentType<AddOnProps>
  enabled: boolean
  label: string       // human-readable toggle label
  icon?: string       // toggle icon
}

export interface AddOnProps {
  context: ComposerShellContext
}

export interface ComposerShellContext {
  scope: ComposerInstanceScope       // ← role identity of this box
  providerId: string | null
  models: ModelOption[]
  selectedModel: ModelOption | null
  setModel: (m: ModelOption) => void
  capabilities: CapabilityToggle[]
  toggleCapability: (slug: string) => void
  attachments: Attachment[]
  addAttachment: (file: File) => void
  removeAttachment: (id: string) => void
  quotedMessage: QuotedMessage | null
  setQuote: (msg: QuotedMessage | null) => void
  isStreaming: boolean
  stopStreaming: () => void
  enabledAddOns: string[]
  toggleAddOn: (key: string) => void
}

// ── Existing types (unchanged) ──
export interface ModelOption { ... }
export interface CapabilityToggle { ... }
export interface SlashCommand { ... }
export interface MentionTarget { ... }
export interface Attachment { ... }
export interface QuotedMessage { ... }

// ── New: Instance scope (role context) ──
export interface ComposerInstanceScope {
  workspaceId: string
  surfaceSlug: 'chat' | 'docs' | 'media' | 'automation' | 'agents' | 'shell' | string
  regionSlotId: string        // e.g. "chat.composer", "docs.search", "agents.canvas"
  activeZLayer: ZLayerId      // which canonical Z-layer this box binds to
  instanceId: string           // unique per mount
  behavior: 'chat' | 'search' | 'execute' | 'prompt' | 'command' | 'comment'
}

// ── New: User config ──
export interface ComposerUserConfig {
  enabledAddOns: string[]
  /** true = show gear toggle menu */
  showToggleMenu: boolean
}
```

### 4.2 Atomic Unit: TextEntryBox

```tsx
// frontend/src/components/chat/TextEntryBox.tsx
'use client'

interface TextEntryBoxProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (text: string) => void
  placeholder?: string
  disabled?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  /** Called on keydown for add-on integration (/, @ detection) */
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function TextEntryBox({ value, onChange, onSubmit, placeholder, disabled, textareaRef, onKeyDown }: TextEntryBoxProps) {
  const ref = textareaRef ?? useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit(value.trim())
    }
    onKeyDown?.(e)
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder ?? 'Message...'}
      rows={1}
      style={{
        width: '100%',
        resize: 'none',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--text)',
        fontSize: 13,
        fontFamily: 'inherit',
        lineHeight: 1.5,
        minHeight: 20,
        maxHeight: 200,
        opacity: disabled ? 0.5 : 1,
      }}
    />
  )
}
```

### 4.3 Atomic Unit: SendButton

```tsx
// frontend/src/components/chat/SendButton.tsx
'use client'

interface SendButtonProps {
  onClick: () => void
  disabled?: boolean
  label?: string
}

export function SendButton({ onClick, disabled, label }: SendButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        border: 'none',
        fontSize: 12,
        fontWeight: 500,
        background: disabled ? 'transparent' : 'var(--accent)',
        color: disabled ? 'var(--text-muted)' : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >
      {label ?? 'Send'}
    </button>
  )
}
```

### 4.4 Shell: ComposerShell (replaces DenseCapabilityBar)

```tsx
// frontend/src/components/chat/ComposerShell.tsx
'use client'

// Default slot component for ANY text-input region (chat.composer,
// docs.search, agents.canvas, shell.terminal, etc.). Each instance
// is scoped to its workspace+surface+region+Z-layer combo so the
// same atomic component renders differently per role context.

interface ComposerShellProps {
  scope: ComposerInstanceScope                 // ← who this box is
  conversationId: string | null
  providerId: string | null
  onSendResult?: (ok: boolean, error?: string) => void
  onStreamingChange?: (streaming: boolean) => void
}

export function ComposerShell({
  scope,
  conversationId,
  providerId,
  onSendResult,
  onStreamingChange,
}: ComposerShellProps) {
  const [value, setValue] = useState('')
  const [isStreaming, setStreaming] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null)
  const [capabilities, setCapabilities] = useState<CapabilityToggle[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null)

  // Derive placeholder from scope
  const placeholder = {
    chat: 'Message...',
    search: 'Search...',
    execute: 'Run command...',
    prompt: 'What should the agent do?',
    command: 'Type a command...',
    comment: 'Add a comment...',
  }[scope.behavior] ?? 'Type here...'

  // Per-instance localStorage key (different workspaces/surfaces/layers
  // can each have their own add-on config)
  const storageKey = `vivim:composer-addons:${scope.instanceId}`

  // Read user's add-on config from localStorage (per-instance scope)
  const [config, setConfig] = useState<ComposerUserConfig>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : { enabledAddOns: [], showToggleMenu: false }
    } catch {
      return { enabledAddOns: [], showToggleMenu: false }
    }
  })

  const toggleAddOn = (key: string) => {
    const next = config.enabledAddOns.includes(key)
      ? config.enabledAddOns.filter(k => k !== key)
      : [...config.enabledAddOns, key]
    const newConfig = { ...config, enabledAddOns: next }
    setConfig(newConfig)
    localStorage.setItem(storageKey, JSON.stringify(newConfig))
  }

  // Build context for add-ons
  const shellContext: ComposerShellContext = {
    scope,      // ← every add-on receives the box's role context
    providerId,
    models,
    selectedModel,
    setModel: setSelectedModel,
    capabilities,
    toggleCapability: (slug) => setCapabilities(prev =>
      prev.map(c => c.slug === slug ? { ...c, isActive: !c.isActive } : c)
    ),
    attachments,
    addAttachment: (file) => setAttachments(prev => [...prev, {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
    }]),
    removeAttachment: (id) => setAttachments(prev => prev.filter(a => a.id !== id)),
    quotedMessage,
    setQuote: setQuotedMessage,
    isStreaming,
    stopStreaming: () => setStreaming(false),
    enabledAddOns: config.enabledAddOns,
    toggleAddOn,
  }

  // ── Fetch models + capabilities (same as before) ──
  useEffect(() => {
    if (!providerId) return
    fetch(`/api/providers/${providerId}`)
      .then(r => r.json().catch(() => null))
      .then(data => {
        if (!data) return
        const parsed: ModelOption[] = []
        if (data.modelsJson) {
          try {
            JSON.parse(data.modelsJson).forEach((m: any, i: number) => {
              parsed.push({
                id: `${providerId}:${m.slug}`,
                providerId,
                modelSlug: m.slug,
                displayName: m.display_name ?? m.displayName ?? m.slug,
                shortLabel: genShortLabel(m.display_name ?? m.displayName ?? m.slug),
                color: PROVIDER_COLORS[providerId] ?? 'gray',
                contextWindow: m.context_window ?? undefined,
                supportsStreaming: !!m.supports_streaming,
                supportsThinking: !!m.supports_thinking,
                supportsTools: !!m.supports_tools,
                isDefault: !!m.is_default,
              })
            })
          } catch {}
        }
        setModels(parsed)
        setSelectedModel(parsed.find(m => m.isDefault) ?? parsed[0] ?? null)
      })
  }, [providerId])

  useEffect(() => {
    if (!providerId) return
    fetch(`/api/providers/${providerId}/capabilities?planTier=free`)
      .then(r => r.json().catch(() => null))
      .then(data => {
        if (!data?.capabilities) return
        setCapabilities(data.capabilities.map((c: any, i: number) => ({
          id: c.id,
          slug: c.slug,
          label: c.uiLabel ?? c.name,
          icon: c.uiIcon,
          category: c.category ?? 'command',
          isActive: false,
          group: c.uiGroup ?? 'default',
          order: c.uiOrder ?? i,
        })).filter((c: CapabilityToggle) => c.label))
      })
  }, [providerId])

  // ── Submit ──
  const submit = useCallback(async () => {
    if (!conversationId || !value.trim()) return
    const text = value.trim()
    setValue('')
    setStreaming(true)
    onStreamingChange?.(true)

    const route = classify(text)
    if (route.route === 'local' && route.action) {
      useMlStore.getState().recordLocalAction()
    }

    const res = await sendMessage(conversationId, text).catch(() => null)
    if (!res?.ok) {
      setStreaming(false)
      onStreamingChange?.(false)
      onSendResult?.(false, res?.error ?? 'Send failed')
    } else {
      onSendResult?.(true)
    }
  }, [conversationId, value, onSendResult, onStreamingChange])

  // ── Render ──
  const topAddOns = BUILTIN_ADDONS.filter(a => a.position === 'top' && config.enabledAddOns.includes(a.key))
  const inlineAddOns = BUILTIN_ADDONS.filter(a => a.position === 'inline' && config.enabledAddOns.includes(a.key))
  const bottomAddOns = BUILTIN_ADDONS.filter(a => a.position === 'bottom' && config.enabledAddOns.includes(a.key))

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--bg)',
    }}>
      {/* ── TOP ADD-ONS ── */}
      {topAddOns.map(addon => (
        <addon.Component key={addon.key} context={shellContext} />
      ))}

      {/* ── INPUT ROW (atomic unit + inline add-ons) ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '10px 14px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {inlineAddOns.map(addon => (
            <addon.Component key={addon.key} context={shellContext} />
          ))}
          <TextEntryBox
            value={value}
            onChange={setValue}
            onSubmit={submit}
            placeholder={placeholder}
            disabled={isStreaming || !conversationId}
          />
        </div>
        <SendButton onClick={submit} disabled={!value.trim() && attachments.length === 0} />
      </div>

      {/* ── BOTTOM ADD-ONS ── */}
      {bottomAddOns.map(addon => (
        <addon.Component key={addon.key} context={shellContext} />
      ))}

      {/* ── GEAR TOGGLE (always visible) ── */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        padding: '4px 14px 6px',
      }}>
        <button
          onClick={() => toggleAddOn('__menu__')}
          title="Toggle add-ons"
          style={{
            background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)',
            fontSize: 14, padding: 2,
          }}
        >
          ⚙
        </button>
      </div>

      {/* ── ADD-ON MENU ── */}
      {config.enabledAddOns.includes('__menu__') && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
        }}>
          {BUILTIN_ADDONS.map(addon => (
            <label key={addon.key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 0', fontSize: 12, cursor: 'pointer',
              color: 'var(--text)',
            }}>
              <input
                type="checkbox"
                checked={config.enabledAddOns.includes(addon.key)}
                onChange={() => toggleAddOn(addon.key)}
                style={{ accentColor: 'var(--accent)' }}
              />
              {addon.icon && <span>{addon.icon}</span>}
              {addon.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 4.5 Add-On: ModelSelectorPill

```tsx
// Renders as a small pill in the TOP add-on slot
export function ModelSelectorPill({ context }: AddOnProps) {
  const [open, setOpen] = useState(false)
  if (!context.selectedModel) return null
  return (
    <div style={{ padding: '8px 14px 0', display: 'flex', gap: 6 }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', fontSize: 11,
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-elevated)', color: 'var(--text)',
            cursor: 'pointer', fontWeight: 500,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          {context.selectedModel.shortLabel}
          <svg width={12} height={12} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            width: 220, background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, padding: 4,
          }}>
            {context.models.map(m => (
              <button key={m.id} onClick={() => { context.setModel(m); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', border: 'none', borderRadius: 6,
                  background: m.id === context.selectedModel?.id ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--text)', cursor: 'pointer', fontSize: 11, textAlign: 'left',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: m.id === context.selectedModel?.id ? 600 : 400 }}>{m.displayName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {m.contextWindow ? `${m.contextWindow}k` : ''}
                    {m.supportsThinking ? ' · Think' : ''}
                    {m.supportsTools ? ' · Tools' : ''}
                  </div>
                </div>
                {m.id === context.selectedModel?.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 4.6 Add-On: CapabilityChips

```tsx
export function CapabilityChips({ context }: AddOnProps) {
  if (context.capabilities.length === 0) return null
  return (
    <div style={{ padding: '4px 14px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {context.capabilities.filter(c => c.group !== 'hidden').slice(0, 6).map(cap => (
        <button key={cap.slug} onClick={() => context.toggleCapability(cap.slug)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6, fontSize: 11,
            border: '1px solid var(--border)',
            background: cap.isActive ? 'var(--accent)' : 'transparent',
            color: cap.isActive ? 'white' : 'var(--text-muted)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {cap.icon && <span>{cap.icon}</span>}
          {cap.label}
        </button>
      ))}
    </div>
  )
}
```

### 4.7 Add-On: StreamingStatusBar

```tsx
export function StreamingStatusBar({ context }: AddOnProps) {
  if (!context.isStreaming) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      borderTop: '1px solid var(--border)',
      fontSize: 11,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#ef4444', animation: 'pulse 1s infinite',
      }} />
      <span style={{ color: 'var(--text-muted)', flex: 1 }}>Streaming...</span>
      <button onClick={context.stopStreaming}
        style={{
          padding: '4px 10px', borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)', color: 'var(--text)',
          cursor: 'pointer', fontSize: 11,
        }}
      >
        ■ Stop
      </button>
    </div>
  )
}
```

### 4.8 Add-On: FooterHints

```tsx
export function FooterHints({ context }: AddOnProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      borderTop: '1px solid var(--border)',
      fontSize: 10, color: 'var(--text-muted)',
    }}>
      <span><kbd style={kbdStyle}>⌘K</kbd> Commands</span>
      <span><kbd style={kbdStyle}>⌘/</kbd> Slash</span>
      <span><kbd style={kbdStyle}>Enter</kbd> Send</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent)',
        }} />
        Ready
      </span>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 4px', borderRadius: 4,
  background: 'var(--bg-elevated)', fontSize: 9, fontFamily: 'monospace',
}
```

### 4.9 Add-On Registry Constant

```typescript
// frontend/src/features/composer-addons/registry.ts

export const BUILTIN_ADDONS: ComposerAddOn[] = [
  { key: 'modelSelector',  position: 'top',    Component: ModelSelectorPill, enabled: false, label: 'Model Selector', icon: '🧠' },
  { key: 'capabilityChips', position: 'top',   Component: CapabilityChips,   enabled: false, label: 'Capability Toggles', icon: '⚡' },
  { key: 'quoteBar',       position: 'top',    Component: QuoteBar,          enabled: false, label: 'Quote/Reply', icon: '↪' },
  { key: 'attachments',    position: 'top',    Component: AttachmentPreview, enabled: false, label: 'Attachments', icon: '📎' },
  { key: 'streamingStatus', position: 'bottom',Component: StreamingStatusBar,enabled: false, label: 'Streaming Status', icon: '▶' },
  { key: 'footerHints',    position: 'bottom', Component: FooterHints,       enabled: false, label: 'Footer Hints', icon: '💡' },
]
```

---

## 5. Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/chat/TextEntryBox.tsx` | **Create** | Atomic textarea unit (~40 lines) |
| `frontend/src/components/chat/SendButton.tsx` | **Create** | Atomic send button (~30 lines) |
| `frontend/src/components/chat/ComposerShell.tsx` | **Create** | Shell wrapping atomic unit + add-on slots (~180 lines) |
| `frontend/src/components/chat/addons/ModelSelectorPill.tsx` | **Create** | Model pill add-on |
| `frontend/src/components/chat/addons/CapabilityChips.tsx` | **Create** | Toggle chip add-on |
| `frontend/src/components/chat/addons/StreamingStatusBar.tsx` | **Create** | Streaming status add-on |
| `frontend/src/components/chat/addons/FooterHints.tsx` | **Create** | Keyboard hint add-on |
| `frontend/src/components/chat/addons/QuoteBar.tsx` | **Create** | Quoted message add-on |
| `frontend/src/components/chat/addons/AttachmentPreview.tsx` | **Create** | Attachment preview add-on |
| `frontend/src/features/composer-addons/registry.ts` | **Create** | Add-on constant definitions |
| `frontend/src/features/composer-addons/index.ts` | **Create** | Barrel + registerComposerAddOn() |
| `frontend/src/types/api.ts` | **Modify** | Add `ComposerInstanceScope`, `ComposerAddOn`, `ComposerAddOnPosition`, `AddOnProps`, `ComposerShellContext`, `ComposerUserConfig` |
| `frontend/src/components/chat/Composer.tsx` | **Modify** | Replace textarea+send with `<ComposerShell>`, keep WS/message/error logic |
| `frontend/src/ml/ml-boot.ts` | **Modify** | Register `ComposerShell` as `chat.composer` default (replaces `Composer`) |

---

## 6. User Config Persistence

```typescript
// localStorage key: "vivim:composer-addons"
// Shape:
interface ComposerUserConfig {
  enabledAddOns: string[]        // keys of active add-ons
  showToggleMenu: boolean       // true = show gear toggle
}
```

Default state (clean install, no localStorage entry):
```json
{ "enabledAddOns": [], "showToggleMenu": false }
```
→ Only `TextEntryBox` + `SendButton` render. No chrome.

---

## 7. Implementation Order

1. **Scope type** — Add `ComposerInstanceScope` with `workspaceId`, `surfaceSlug`, `regionSlotId`, `activeZLayer`, `instanceId`, `behavior` to `frontend/src/types/api.ts`
2. **Types** — Add `ComposerAddOn`, `ComposerAddOnPosition`, `AddOnProps`, `ComposerShellContext`, `ComposerUserConfig`
3. **Atomic unit** — Create `TextEntryBox.tsx` + `SendButton.tsx` (pure input, knows nothing about scope)
4. **Add-on registry** — Create `frontend/src/features/composer-addons/registry.ts` with `BUILTIN_ADDONS`
5. **Add-on components** — Create each add-on component file (ModelSelectorPill, CapabilityChips, StreamingStatusBar, FooterHints, QuoteBar, AttachmentPreview)
6. **Shell** — Create `ComposerShell.tsx` with:
    - `scope` prop typed as `ComposerInstanceScope`
    - Per-instance localStorage key `vivim:composer-addons:{instanceId}`
    - `placeholder` derived from `scope.behavior`
    - `submit` behavior derived from `scope.behavior` (send vs search vs execute)
    - Add-on slot rendering with role-aware defaults
7. **Catalog** — Register `ComposerShell` in `frontend/src/ml/ml-boot.ts`
8. **Integrate** — Wire `ComposerShell` into existing `Composer.tsx` with the correct scope from its workspace/surface/region context
9. **API** — Add `include: { models: true }` to `listProviders()` in `src/storage/db.ts`
10. **Seeds** — Update browser provider manifests with `models[]`
11. **Typecheck + test**

---

## 8. Known Issues / Future Work

- **Multi-instance state isolation**: Each `ComposerShell` instance is keyed by `scope.instanceId` — localStorage, text value, streaming state, and add-on config are all per-instance. When a workspace is dismissed and re-mounted, its instanceId changes. Add-on state should survive remounting by falling back to `(workspaceId, surfaceSlug, regionSlotId)` for persistence keys.
- **Behavior dispatch**: `scope.behavior` determines what `submit()` does — send to conversation, execute agent, search documents. The shell currently hardcodes `sendMessage()`. Future: dispatch to a capability registered for that `(surfaceSlug, regionSlotId)` combo via the `CapabilityResolutionEngine`.
- **Add-on ordering**: Currently sorted by key. Future: add `uiOrder` field per add-on + drag-to-reorder in toggle menu.
- **Provider-specific add-ons**: A provider could register its own add-on (e.g. `gemini/thinking-depth`). Need `registerComposerAddOn(providerSlug, addOn)` API.
- **Add-on state persistence**: Only the enabled/disabled state is persisted. Future: persist each add-on's own state (e.g. which model was selected).
- **WS streaming**: Shell manages streaming state. TextEntryBox never knows about it. Clean separation.
- **ContentBlock dual type system**: Backend `ContentPart` vs frontend `{kind,content,index}` legacy. Normalize in shell or migration layer.
- **`GET /api/providers` returns no models**: Until the API is updated, read `modelsJson` from `ProviderDefinition`. See §4.4.
