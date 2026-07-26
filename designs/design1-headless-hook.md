# DESIGN 1: Headless Hook + Render Props
"React Aria / TanStack style" — consumer owns 100% of markup

## Interface

```tsx
// State returned by hook
interface InputCardState {
  // Text input
  value: string;
  setValue: (v: string) => void;
  cursorPosition: number;
  
  // Attachments
  attachments: Attachment[];
  addAttachments: (files: FileList | File[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  
  // Triggers (@mentions, /commands, #issues)
  activeTrigger: TriggerType | null;
  triggerQuery: string;
  setTriggerQuery: (q: string) => void;
  triggerItems: TriggerItem[];
  selectTriggerItem: (item: TriggerItem) => void;
  closeTrigger: () => void;
  
  // Streaming
  isStreaming: boolean;
  setStreaming: (v: boolean) => void;
  
  // Model selection
  availableModels: Model[];
  selectedModel: string;
  setModel: (id: string) => void;
  
  // Web search toggle
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  
  // View mode (simple/advanced)
  viewMode: 'simple' | 'advanced';
  setViewMode: (m: 'simple' | 'advanced') => void;
  
  // Quoted/referenced message
  quotedMessage: Message | null;
  setQuotedMessage: (m: Message | null) => void;
  
  // Imperative
  submit: () => Promise<void>;
  stop: () => void;
  focus: () => void;
  clear: () => void;
  insertText: (text: string) => void;
  replaceTrigger: (directive: string) => void;
}

// Hook options
interface UseInputCardOptions {
  capabilities: CapabilityRegistry;
  context: ExecutionContext;
  submitMode?: 'enter' | 'ctrlEnter' | 'none';
  smartNewline?: boolean;
  maxRows?: number;
  onSubmit?: (payload: SubmitPayload) => Promise<void>;
  onStop?: () => void;
  onCapabilityExecute?: (capabilityId: string, args: unknown) => Promise<void>;
}

function useInputCard(options: UseInputCardOptions): InputCardState;
```

## Usage — Consumer Owns ALL Markup

```tsx
function MyComposer() {
  const {
    value, setValue,
    attachments, addAttachments, removeAttachment,
    activeTrigger, triggerQuery, setTriggerQuery, triggerItems, selectTriggerItem, closeTrigger,
    isStreaming,
    availableModels, selectedModel, setModel,
    webSearchEnabled, toggleWebSearch,
    viewMode, setViewMode,
    quotedMessage, setQuotedMessage,
    submit, stop, focus, clear, insertText,
  } = useInputCard({
    capabilities: myCapabilities,
    context: myContext,
    onSubmit: handleSubmit,
    onStop: handleStop,
  });

  return (
    // USER CONTROLS 100% OF MARKUP & TAILWIND STYLING
    <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
      
      {/* Quote bar - user decides position, style, everything */}
      {quotedMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <QuoteIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="flex-1 text-sm text-blue-800 dark:text-blue-200 truncate">
            {quotedMessage.content.slice(0, 100)}
          </span>
          <button onClick={() => setQuotedMessage(null)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Attachments - user controls layout completely */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
              <FileIcon className="w-4 h-4" />
              <span className="text-sm truncate max-w-[150px]">{att.name}</span>
              <button onClick={() => removeAttachment(att.id)} className="text-gray-500 hover:text-red-500">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Main input area */}
      <div className="relative flex items-end gap-2">
        <div className="flex-1 relative">
          {/* Trigger popovers - user positions them */}
          <TriggerPopoverRoot>
            <Trigger
              char="@"
              items={triggerItems}
              query={triggerQuery}
              onQueryChange={setTriggerQuery}
              onSelect={selectTriggerItem}
              active={activeTrigger === '@'}
              renderItem={(item) => (
                <div className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                  <Avatar src={item.avatar} className="w-6 h-6" />
                  <span className="font-medium">@{item.label}</span>
                  <span className="text-xs text-gray-500">{item.description}</span>
                </div>
              )}
            />
            <Trigger char="/" ... />
          </TriggerPopoverRoot>
          
          {/* Textarea - user controls every aspect */}
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`
              w-full min-h-[44px] max-h-[200px] resize-none
              bg-transparent border-none outline-none
              text-base leading-relaxed
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              ${isStreaming ? 'opacity-60' : ''}
            `}
            placeholder={isStreaming ? "Streaming..." : "Message..."}
            rows={1}
          />
        </div>
        
        {/* Toolbar - user controls layout completely */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ModelSelector
            models={availableModels}
            selected={selectedModel}
            onChange={setModel}
            renderItem={(model) => (
              <div className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                <ModelIcon provider={model.provider} className="w-4 h-4" />
                <span>{model.name}</span>
                {model.contextWindow && <span className="text-xs text-gray-500">{model.contextWindow}k ctx</span>}
              </div>
            )}
          />
          
          <button
            onClick={toggleWebSearch}
            className={`
              p-2 rounded-lg transition-colors
              ${webSearchEnabled 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }
            `}
          >
            <GlobeIcon className="w-5 h-5" />
          </button>
          
          {isStreaming ? (
            <button onClick={stop} className="p-2 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={submit} disabled={!value.trim() && attachments.length === 0} className="...">
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

## What It Hides
- All state machines (trigger open/close, attachment upload, streaming toggle, model selection, quote management)
- Keyboard navigation & ARIA combobox wiring
- Focus management, paste/drag handling, auto-resize
- Capability execution routing (`/command` → find capability → validate params → execute)

## Trade-offs
| ✅ Pros | ❌ Cons |
|---------|---------|
| Complete UI freedom — any Tailwind design | Higher implementation burden on consumer |
| Logic reusable across React/Solid/Vue/Svelte | Easy to create inaccessible UI if not careful |
| Testable — test logic without rendering | More boilerplate for standard cases |
| Small bundle if consumer only uses needed parts | Must re-implement common patterns (quote bar, attachment chips) |
| Zero design system coupling | No shared visual consistency across surfaces |