# Data Model: Universal Atomic TextEntryBox

## Entity: ComposerInstanceScope

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| workspaceId | `string` | Workspace this box belongs to | `WorkspaceRouteContext.workspaceId` |
| surfaceSlug | `string` | Surface kind (chat, docs, media, ...) | `WorkspaceRouteContext.surfaceSlug` |
| regionSlotId | `string` | Region slot (chat.composer, docs.search, ...) | `WorkspaceRouteContext.regionSlotId` |
| activeZLayer | `ZLayerId` | Canonical Z-layer the box lives in | Active layer from workspace ZLayerConfig |
| instanceId | `string` | Unique per-mount identifier | `crypto.randomUUID()` at mount time |
| behavior | `'chat' \| 'search' \| 'execute' \| 'prompt' \| 'command' \| 'comment'` | Determines placeholder + submit behavior | Derived from (surfaceSlug, regionSlotId) |

**Invariants**:
- Two mounts at the same workspace/surface/region produce different `instanceId`s
- `behavior` is derived; callers SHOULD NOT override it

## Entity: ComposerUserConfig

| Field | Type | Description | Persistence |
|-------|------|-------------|-------------|
| enabledAddOns | `string[]` | Keys of active add-ons | localStorage key `vivim:composer-addons:{instanceId}` |
| showToggleMenu | `boolean` | Whether the gear toggle menu is open | Same localStorage key |

**Default**: `{ enabledAddOns: [], showToggleMenu: false }`

## Entity: ComposerAddOn

| Field | Type | Description |
|-------|------|-------------|
| key | `string` | Unique add-on identifier (e.g. "modelSelector") |
| position | `'top' \| 'bottom' \| 'inline'` | Where in the shell layout this add-on renders |
| Component | `React.ComponentType<AddOnProps>` | The add-on React component |
| enabled | `boolean` | Static default enabled state (not used for runtime; runtime state is in `ComposerUserConfig.enabledAddOns`) |
| label | `string` | Human-readable toggle label |
| icon | `string \| undefined` | Toggle icon (emoji or text) |

## Entity: ComposerShellContext

Passed to every add-on. Contains all shared state:

| Field | Type | Description |
|-------|------|-------------|
| scope | `ComposerInstanceScope` | The box's role identity |
| providerId | `string \| null` | Active provider |
| models | `ModelOption[]` | Available models for this provider |
| selectedModel | `ModelOption \| null` | Currently selected model |
| setModel | `(m: ModelOption) => void` | Select a model |
| capabilities | `CapabilityToggle[]` | Available capability toggles |
| toggleCapability | `(slug: string) => void` | Toggle a capability |
| attachments | `Attachment[]` | Current attachments |
| addAttachment | `(file: File) => void` | Add an attachment |
| removeAttachment | `(id: string) => void` | Remove an attachment |
| quotedMessage | `QuotedMessage \| null` | Currently quoted message |
| setQuote | `(msg: QuotedMessage \| null) => void` | Set/clear quote |
| isStreaming | `boolean` | Whether a send is in flight |
| stopStreaming | `() => void` | Cancel streaming |
| enabledAddOns | `string[]` | Currently enabled add-on keys |
| toggleAddOn | `(key: string) => void` | Toggle an add-on |

## Relationships

```
ComposerShell 1 ──> 1 ComposerInstanceScope  (role identity)
ComposerShell 1 ──> N ComposerAddOn          (plugged in)
ComposerShell 1 ──> 1 ComposerUserConfig     (persisted in localStorage)
ComposerShell 1 ──> 1 ComposerShellContext   (shared state, passed to add-ons)

TextEntryBox         (no dependencies — pure input)
SendButton           (no dependencies — pure button)
```
