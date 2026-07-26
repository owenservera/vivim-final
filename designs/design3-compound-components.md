# DESIGN 3: Compound Components with Context
"React Compound Components" — implicit state sharing, declarative composition

## Interface

```tsx
// ── Context (internal, not exposed directly) ──────────────────────────────

interface ComposerContextValue {
  // State
  value: string;
  setValue: (v: string) => void;
  attachments: Attachment[];
  addAttachments: (files: File[]) => void;
  removeAttachment: (id: string) => void;
  isStreaming: boolean;
  setStreaming: (v: boolean) => void;
  quotedMessage: Message | null;
  setQuotedMessage: (m: Message | null) => void;
  availableModels: Model[];
  selectedModel: string;
  setModel: (id: string) => void;
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  viewMode: 'simple' | 'advanced';
  setViewMode: (m: 'simple' | 'advanced') => void;
  
  // Triggers
  activeTrigger: TriggerType | null;
  triggerQuery: string;
  setTriggerQuery: (q: string) => void;
  triggerItems: TriggerItem[];
  selectTriggerItem: (item: TriggerItem) => void;
  closeTrigger: () => void;
  
  // Capabilities
  capabilities: CapabilityRegistry;
  context: ExecutionContext;
  
  // Callbacks
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onStop: () => void;
  submitMode: 'enter' | 'ctrlEnter' | 'none';
  
  // Imperative
  focus: () => void;
  clear: () => void;
  submit: () => Promise<void>;
  stop: () => void;
}

// Provider — sets up all state, keyboards, triggers, capabilities
interface ComposerProviderProps {
  children: React.ReactNode;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onStop?: () => void;
  isStreaming?: boolean;
  submitMode?: 'enter' | 'ctrlEnter' | 'none';
  capabilities?: CapabilityRegistry;
  context?: ExecutionContext;
  defaultValue?: string;
  defaultAttachments?: Attachment[];
  defaultModel?: string;
  defaultWebSearch?: boolean;
  defaultViewMode?: 'simple' | 'advanced';
  className?: string; // on root wrapper
}

// ── Compound Components (consume context automatically) ────────────────────

// Root — renders form wrapper, handles submit
function Composer.Root({ children, className }: { children: React.ReactNode; className?: string });

// Quote bar — shows if quotedMessage in context
function Composer.Quote({ children, className }: { 
  children?: (msg: Message) => React.ReactNode; 
  className?: string; 
});

// Attachments list
function Composer.Attachments({ children, className }: { 
  children?: (att: Attachment, idx: number) => React.ReactNode;
  className?: string;
});

// Single attachment
function Composer.Attachment({ children, className }: { 
  children?: (att: Attachment) => React.ReactNode;
  className?: string;
});

// Add attachment button
function Composer.AddAttachment({ children, className }: { 
  children?: React.ReactNode; 
  className?: string;
});

// Trigger popover root
function Composer.TriggerPopoverRoot({ children, className }: { children: React.ReactNode; className?: string });

// Individual trigger (@, /, #)
function Composer.Trigger({ char, adapter, children, className }: { 
  char: TriggerType; 
  adapter: TriggerAdapter; 
  children: React.ReactNode;
  className?: string;
});

// Trigger directive (mentions)
function Composer.TriggerDirective({ formatter, onInserted, children }: { 
  formatter: (item: TriggerItem) => string;
  onInserted?: (item: TriggerItem) => void;
  children?: (item: TriggerItem, selected: boolean) => React.ReactNode;
});

// Trigger action (slash commands)
function Composer.TriggerAction({ onExecute, removeOnExecute, children }: { 
  onExecute: (item: TriggerItem, ctx: TriggerContext) => void;
  removeOnExecute?: boolean;
  children?: (item: TriggerItem, selected: boolean) => React.ReactNode;
});

// Input — auto-wires triggers, keyboard, paste
function Composer.Input({ 
  placeholder, 
  maxRows, 
  autoFocus, 
  className, 
  children 
}: { 
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
    triggerProps: TriggerInputProps; // for combobox ARIA
  }) => React.ReactNode;
});

// Send/Stop button — auto-swaps based on isStreaming
function Composer.SendButton({ 
  className, 
  children 
}: { 
  className?: string; 
  children?: (isStreaming: boolean) => React.ReactNode;
});

// Model selector
function Composer.ModelSelector({ 
  className, 
  renderItem 
}: { 
  className?: string;
  renderItem?: (model: Model, selected: boolean) => React.ReactNode;
});

// Web search toggle
function Composer.WebSearchToggle({ 
  className, 
  children 
}: { 
  className?: string; 
  children?: (enabled: boolean) => React.ReactNode;
});

// View mode toggle
function Composer.ViewModeToggle({ 
  className, 
  children 
}: { 
  className?: string; 
  children?: (mode: 'simple' | 'advanced') => React.ReactNode;
});

// Quick prompts
function Composer.QuickPrompts({ 
  prompts, 
  onSelect, 
  className, 
  renderPrompt 
}: { 
  prompts: QuickPrompt[];
  onSelect: (prompt: string) => void;
  className?: string;
  renderPrompt?: (prompt: QuickPrompt) => React.ReactNode;
});

// Toolbar zones — semantic areas
function Composer.Toolbar({ 
  zone, 
  children, 
  className 
}: { 
  zone: 'left' | 'right' | 'center' | 'bottom' | 'top';
  children: React.ReactNode;
  className?: string;
});

// Imperative handle access
function Composer.useComposer(): ComposerContextValue;
```

## Usage — Declarative Composition

```tsx
// 1. SIMPLEST — just wrap everything in Provider
<Composer.Provider
  onSubmit={handleSubmit}
  onStop={handleStop}
  isStreaming={isRunning}
  capabilities={registry}
  context={ctx}
>
  <Composer.Root className="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border">
    
    {/* Quote auto-shows if present */}
    <Composer.Quote />
    
    {/* Attachments auto-render */}
    <Composer.Attachments />
    
    {/* Triggers auto-wire from capabilities */}
    <Composer.TriggerPopoverRoot>
      <Composer.Trigger char="@" adapter={mentionAdapter}>
        <Composer.TriggerDirective formatter={formatMention} />
      </Composer.Trigger>
      <Composer.Trigger char="/" adapter={slashAdapter}>
        <Composer.TriggerAction onExecute={executeSlash} />
      </Composer.Trigger>
    </Composer.TriggerPopoverRoot>
    
    {/* Input + Send auto-wired */}
    <div className="flex items-end gap-2">
      <Composer.AddAttachment />
      <Composer.Input placeholder="Message..." maxRows={8} />
      <Composer.SendButton />
    </div>
    
    {/* Toolbar zones — semantic, reorderable */}
    <Composer.Toolbar zone="left">
      <Composer.ModelSelector />
      <Composer.WebSearchToggle />
      <Composer.QuickPrompts prompts={starters} onSelect={insertPrompt} />
    </Composer.Toolbar>
    
    <Composer.Toolbar zone="right">
      <Composer.ViewModeToggle />
    </Composer.Toolbar>
    
    <Composer.Toolbar zone="bottom" className="pt-2 border-t">
      <CustomBrowserProfilePicker />
      <CustomAgentDelegationMenu />
    </Composer.Toolbar>
    
  </Composer.Root>
</Composer.Provider>

// 2. CUSTOMIZE INDIVIDUAL PIECES — override render via children
<Composer.Provider ...>
  <Composer.Root>
    <Composer.Attachments>
      {({ attachment, index }) => (  // render prop per attachment
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
          <FileIcon className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate max-w-[150px]">{attachment.name}</span>
          <span className="text-xs text-blue-500">({formatBytes(attachment.size)})</span>
          <button onClick={() => removeAttachment(attachment.id)} className="text-blue-500 hover:text-blue-700 p-0.5">
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </Composer.Attachments>
    
    <Composer.Input>
      {({ value, onChange, ref, id, triggerProps }) => (
        <div className="relative">
          <textarea
            ref={ref}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...triggerProps}  // spreads ARIA combobox props when trigger active
            className="w-full min-h-[44px] max-h-[300px] px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            placeholder="Ask anything..."
            rows={1}
          />
          {/* Custom floating label */}
          {value && <label className="absolute -top-2 left-3 text-xs text-primary font-medium bg-white dark:bg-gray-900 px-1">Composing</label>}
          {/* Custom character counter with color coding */}
          <div className="absolute bottom-1 right-2 text-xs" style={{ color: value.length > 3500 ? 'red' : value.length > 2500 ? 'orange' : 'gray' }}>
            {value.length}/4000
          </div>
        </div>
      )}
    </Composer.Input>
    
    <Composer.SendButton>
      {(isStreaming) => isStreaming ? (
        <button className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
          <SquareIcon className="w-5 h-5" />
        </button>
      ) : (
        <button className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors group">
          <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </Composer.SendButton>
    
    <Composer.ModelSelector>
      {(model, selected) => (
        <button className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selected 
          ? 'bg-primary text-primary-foreground shadow-lg' 
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
        {model.icon && <model.icon className="w-4 h-4 mr-1.5" />}
        {model.name}
        {selected && <CheckIcon className="w-4 h-4 ml-1.5" />}
      </button>
      )}
    </Composer.ModelSelector>
    
    <Composer.WebSearchToggle>
      {(enabled) => (
        <button className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${enabled
          ? 'bg-blue-500 text-white shadow-lg'
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
          <GlobeIcon className="w-4 h-4" />
          <span>Web</span>
        </button>
      )}
    </Composer.WebSearchToggle>
    
  </Composer.Root>
</Composer.Provider>

// 3. USE IMPERATIVE HANDLE — external control
function ChatHeader() {
  const composer = Composer.useComposer();
  
  return (
    <button onClick={() => { composer.clear(); composer.focus(); }} className="p-2 hover:bg-gray-100 rounded-lg">
      <RotateCcwIcon className="w-5 h-5" />
    </button>
  );
}

// 4. EXTRACT SUB-TREE — use Provider in different component
function ComposerFooter() {
  return (
    <Composer.Provider ...>  // reuses same context if nested
      <Composer.Toolbar zone="bottom">
        <Composer.QuickPrompts prompts={starters} onSelect={insertPrompt} />
      </Composer.Toolbar>
    </Composer.Provider>
  );
}
```

## What It Hides
- **All state management** — value, attachments, triggers, streaming, model, web search, view mode, quote
- **Keyboard handling** — Enter/Shift+Enter, Cmd+Enter, Escape, Tab navigation in triggers, arrow keys
- **Trigger orchestration** — multiple simultaneous triggers (@, /, #), combobox ARIA, positioning, item selection
- **Capability wiring** — slash commands auto-populated from `capabilities.slashCommands`, mentions from `mentionProviders`
- **Attachment pipeline** — drag-drop, paste, file input, preview generation, upload state
- **Focus management** — auto-focus on mount, restore focus after trigger, focus input on quote dismiss
- **Form submission** — prevents default, builds payload (text, markdown, attachments, mentions), clears on success

## Trade-offs
| ✅ Pros | ❌ Cons |
|---------|---------|
| Zero props drilling — context shares everything | Magic context can be confusing for debugging |
| Declarative — "what" not "how" | Harder to test individual pieces in isolation |
| Swappable at ANY level (provider, root, or primitive) | Context coupling — all pieces must be in Provider tree |
| Sensible defaults, override only what you need | Can't easily use pieces outside Provider |
| Natural React patterns — matches Radix, Reach UI | Slightly larger bundle (context + all primitives) |
| Imperative escape hatch (`useComposer`) | |
| Semantic zones (`zone="left|right|bottom"`) for layout | |