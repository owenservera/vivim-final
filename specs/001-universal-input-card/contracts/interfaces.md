# Interface Contracts: Universal Atomic TextEntryBox

## Contract: ComposerShell → Parent

The `ComposerShell` accepts the following interface from whatever component mounts it:

```
Input:
  scope: ComposerInstanceScope      — role identity (required)
  conversationId: string | null      — active conversation (required for send)
  providerId: string | null          — active provider (required for model/capability fetch)
  onSendResult?: (ok: boolean, error?: string) => void
  onStreamingChange?: (streaming: boolean) => void

Output:
  Renders atomic TextEntryBox + SendButton + enabled add-ons
  Calls onSendResult(true) after successful send
  Calls onStreamingChange(true/false) on streaming state change
```

## Contract: TextEntryBox → Parent

```
Input:
  value: string                          — controlled value
  onChange: (value: string) => void      — value change callback
  onSubmit: (text: string) => void       — submit handler
  placeholder?: string                   — default "Message..."
  disabled?: boolean                     — disables input
  textareaRef?: RefObject                — external ref (optional)
  onKeyDown?: (e: KeyboardEvent) => void — external key handler (for slash/mention)

Output:
  Calls onSubmit(text) on Enter (without Shift) or on external trigger
  Calls onChange(newValue) on every keystroke
  Auto-resizes height between minHeight=20 and maxHeight=200
```

## Contract: SendButton → Parent

```
Input:
  onClick: () => void
  disabled?: boolean
  label?: string
```

## Contract: ComposerAddOn → ComposerShell

Each add-on receives `AddOnProps` containing the full `ComposerShellContext`:

```
Input:
  context: ComposerShellContext  — all shared state (scope, models, caps, streaming...)

Output:
  Renders in its assigned position slot (top/bottom/inline)
  Can read/write context state via context methods (setModel, toggleCapability, etc.)
```

## Contract: ComposerShell → localStorage

```
Read key:  "vivim:composer-addons:{instanceId}"
  Parse:   JSON → ComposerUserConfig
  Default: { enabledAddOns: [], showToggleMenu: false }
  On error: silently fall back to default

Write key: "vivim:composer-addons:{instanceId}"
  Format:  JSON.stringify(ComposerUserConfig)
  Trigger: on every toggleAddOn() call
```

## Contract: ComposerShell → Backend API

```
GET /api/providers/${providerId}
  → returns ProviderDefinition (may contain modelsJson)

GET /api/providers/${providerId}/capabilities?planTier=free
  → returns { capabilities: ResolvedCapability[], ... }
```

## Contract: Behavior Dispatch

```
behavior='chat'    → sendMessage(conversationId, text) via backend-client.ts
behavior='search'  → console.log('[search]', text)  // STUB
behavior='execute' → console.log('[execute]', text)  // STUB
behavior='prompt'  → console.log('[prompt]', text)   // STUB
behavior='command' → console.log('[command]', text)  // STUB
behavior='comment' → console.log('[comment]', text)  // STUB
```
