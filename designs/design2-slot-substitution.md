# DESIGN 2: Slot-Based Substitution with Zone Layout
"Radix / shadcn style" — pre-built accessible components, user swaps individual pieces

## Interface

```tsx
// ── Primitive Components (each independently swappable) ────────────────────

// Root form — handles submission, focus, streaming state
interface ComposerRootProps {
  children: React.ReactNode;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onStop?: () => void;
  isStreaming?: boolean;
  submitMode?: 'enter' | 'ctrlEnter' | 'none';
  className?: string;  // Tailwind classes
}

// Text input — auto-resize, keyboard shortcuts, paste handling
interface ComposerInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxRows?: number;
  autoFocus?: boolean;
  className?: string;
  // Render prop for full control
  children?: (props: { 
    value: string; 
    onChange: (v: string) => void; 
    ref: React.Ref<HTMLTextAreaElement>;
    id: string;
  }) => React.ReactNode;
}

// Attachments list — preview chips, drag-drop, remove
interface ComposerAttachmentsProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  onAdd?: (files: File[]) => void;
  dropzone?: boolean;
  className?: string;
  // Render prop per attachment
  children?: (attachment: Attachment, index: number) => React.ReactNode;
}

// Single attachment chip
interface ComposerAttachmentProps {
  attachment: Attachment;
  onRemove: () => void;
  className?: string;
  children?: (attachment: Attachment) => React.ReactNode;
}

// Add attachment button
interface ComposerAddAttachmentProps {
  onClick: () => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  children?: React.ReactNode; // default: <PlusIcon />
}

// Trigger popover root — manages @ / / # triggers
interface ComposerTriggerPopoverRootProps {
  children: React.ReactNode;
  className?: string;
}

// Individual trigger (@mentions, /commands, #issues)
interface ComposerTriggerProps {
  char: '@' | '/' | '#' | string;
  adapter: TriggerAdapter;
  children: React.ReactNode; // Directive or Action
  className?: string;
}

// Directive — inserts text on select (mentions)
interface ComposerTriggerDirectiveProps {
  formatter: (item: TriggerItem) => string;
  onInserted?: (item: TriggerItem) => void;
  children?: (item: TriggerItem, selected: boolean) => React.ReactNode;
}

// Action — executes callback on select (slash commands)
interface ComposerTriggerActionProps {
  onExecute: (item: TriggerItem, ctx: TriggerContext) => void;
  removeOnExecute?: boolean;
  children?: (item: TriggerItem, selected: boolean) => React.ReactNode;
}

// Toolbar zones
interface ComposerToolbarProps {
  zone: 'left' | 'right' | 'center' | 'bottom';
  children: React.ReactNode;
  className?: string;
}

// Model selector
interface ComposerModelSelectorProps {
  models: Model[];
  selected: string;
  onChange: (id: string) => void;
  className?: string;
  renderItem?: (model: Model, selected: boolean) => React.ReactNode;
}

// Web search toggle
interface ComposerWebSearchToggleProps {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
  children?: (enabled: boolean) => React.ReactNode;
}

// View mode toggle
interface ComposerViewModeToggleProps {
  mode: 'simple' | 'advanced';
  onChange: (m: 'simple' | 'advanced') => void;
  className?: string;
}

// Send/Stop button — auto-swaps based on streaming
interface ComposerSendButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  className?: string;
  children?: (isStreaming: boolean) => React.ReactNode;
}

// Quote bar
interface ComposerQuoteProps {
  message: Message;
  onDismiss: () => void;
  className?: string;
  children?: (message: Message) => React.ReactNode;
}

// Quick prompts
interface ComposerQuickPromptsProps {
  prompts: QuickPrompt[];
  onSelect: (prompt: string) => void;
  className?: string;
  renderPrompt?: (prompt: QuickPrompt) => React.ReactNode;
}

// ── Main Composer (composes all primitives with sensible defaults) ────────

interface ComposerProps extends Omit<ComposerRootProps, 'children'> {
  // All primitives have defaults; override any via props
  Input?: React.ComponentType<ComposerInputProps>;
  Attachments?: React.ComponentType<ComposerAttachmentsProps>;
  Attachment?: React.ComponentType<ComposerAttachmentProps>;
  AddAttachment?: React.ComponentType<ComposerAddAttachmentProps>;
  TriggerPopoverRoot?: React.ComponentType<ComposerTriggerPopoverRootProps>;
  Trigger?: React.ComponentType<ComposerTriggerProps>;
  TriggerDirective?: React.ComponentType<ComposerTriggerDirectiveProps>;
  TriggerAction?: React.ComponentType<ComposerTriggerActionProps>;
  Toolbar?: React.ComponentType<ComposerToolbarProps>;
  ModelSelector?: React.ComponentType<ComposerModelSelectorProps>;
  WebSearchToggle?: React.ComponentType<ComposerWebSearchToggleProps>;
  ViewModeToggle?: React.ComponentType<ComposerViewModeToggleProps>;
  SendButton?: React.ComponentType<ComposerSendButtonProps>;
  Quote?: React.ComponentType<ComposerQuoteProps>;
  QuickPrompts?: React.ComponentType<ComposerQuickPromptsProps>;
  
  // Layout zones — user controls what goes where
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  toolbarCenter?: React.ReactNode;
  toolbarBottom?: React.ReactNode;
  
  // Capabilities & context (auto-wires triggers)
  capabilities?: CapabilityRegistry;
  context?: ExecutionContext;
}
```

## Usage — Swap Individual Pieces

```tsx
// 1. USE DEFAULTS — zero config
<Composer
  onSubmit={handleSubmit}
  onStop={handleStop}
  isStreaming={isRunning}
  capabilities={registry}
  context={ctx}
/>

// 2. OVERRIDE SPECIFIC PIECES — swap just the Attachment chip
<Composer
  onSubmit={handleSubmit}
  Attachment={({ attachment, onRemove }) => (
    <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
      <FileIcon className="w-4 h-4 text-amber-600" />
      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">{attachment.name}</span>
      <button onClick={onRemove} className="text-amber-600 hover:text-amber-800">
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  )}
  // ... other props
/>

// 3. CUSTOM TOOLBAR LAYOUT — full control over zones
<Composer
  onSubmit={handleSubmit}
  toolbarLeft={
    <>
      <ComposerModelSelector models={models} selected={model} onChange={setModel} />
      <ComposerWebSearchToggle enabled={webSearch} onToggle={toggleWebSearch} />
      <ComposerQuickPrompts prompts={starters} onSelect={insertPrompt} />
    </>
  }
  toolbarRight={
    <>
      <ComposerViewModeToggle mode={viewMode} onChange={setViewMode} />
      <ComposerSendButton isStreaming={isRunning} onClick={submit} onStop={stop} />
    </>
  }
  toolbarBottom={
    <div className="flex gap-2 p-2 border-t">
      <CustomBrowserProfilePicker />
      <CustomAgentDelegationMenu />
    </div>
  }
  // ... other props
/>

// 4. FULL REPLACEMENT OF INPUT — render prop for total control
<Composer
  onSubmit={handleSubmit}
  Input={({ value, onChange, ref, id }) => (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[44px] max-h-[200px] p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder="Type a message..."
        rows={1}
      />
      {/* Custom character counter */}
      <div className="absolute bottom-1 right-2 text-xs text-gray-400">
        {value.length}/4000
      </div>
    </div>
  )}
/>

// 5. COMPOSE FROM PRIMITIVES DIRECTLY — no Composer wrapper
<ComposerRoot onSubmit={handleSubmit} isStreaming={isRunning} className="flex flex-col gap-2 p-4">
  <ComposerQuote message={quoted} onDismiss={clearQuote} />
  
  <ComposerAttachments attachments={attachments} onRemove={removeAttachment} />
  
  <ComposerTriggerPopoverRoot>
    <ComposerTrigger char="@" adapter={mentionAdapter}>
      <ComposerTriggerDirective formatter={formatMention} />
    </ComposerTrigger>
    <ComposerTrigger char="/" adapter={slashAdapter}>
      <ComposerTriggerAction onExecute={executeSlash} />
    </ComposerTrigger>
  </ComposerTriggerPopoverRoot>
  
  <div className="flex items-end gap-2">
    <ComposerAddAttachment />
    <ComposerInput value={value} onChange={setValue} />
    <ComposerSendButton isStreaming={isRunning} onClick={submit} onStop={stop} />
  </div>
  
  <ComposerToolbar zone="bottom">
    <ComposerModelSelector models={models} selected={model} onChange={setModel} />
    <ComposerWebSearchToggle enabled={webSearch} onToggle={toggleWebSearch} />
  </ComposerToolbar>
</ComposerRoot>
```

## What It Hides
- Each primitive hides its internal complexity (Input: auto-resize, keyboard shortcuts, paste handling; Trigger: combobox ARIA, positioning, keyboard nav; Attachments: preview rendering, upload state machine)
- Default composition logic in `<Composer />` — wires capabilities to triggers automatically
- Streaming button swap (Send ↔ Stop)
- Focus management, form submission, Enter/Shift+Enter handling

## Trade-offs
| ✅ Pros | ❌ Cons |
|---------|---------|
| Swap ONE piece without rewriting everything | More components to learn (15+ primitives) |
| Accessible by default (Radix patterns) | Default composition may not match every layout |
| Type-safe — each primitive has focused props | Can't change layout structure without dropping to primitives |
| Tree-shakeable — unused primitives don't bundle | Slightly larger bundle than headless hook |
| Consistent visual language across surfaces | Zone-based layout still constrains some arrangements |
| Progressive disclosure — start simple, override as needed | |