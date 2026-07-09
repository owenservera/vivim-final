# SOTA-05 — Semantic Browser Automation Layer

**Status:** DRAFT
**Priority:** P3
**Extends:** `04-merged-engines.md` (ChromeGovernor, HarnessRuntime)

---

## Purpose

Raw CSS selectors are brittle. When a provider updates their DOM, selectors break. The v1 system handles this with `recovery_strategies` and `selector_strategy` with fallbacks, but the fundamental approach — matching strings against DOM structure — is fragile.

The SOTA approach grounds actions **semantically**:

1. **Accessibility tree grounding** — identify elements by their semantic role, name, and description (not CSS path)
2. **Visual grounding** — identify elements by their visual appearance on a screenshot (coordinate-based)
3. **Shadow DOM penetration** — access elements inside shadow roots
4. **Cross-origin frame handling** — interact with elements in cross-origin iframes
5. **Selector self-healing** — when a selector misses, an LLM proposes alternatives
6. **Anti-detection** — stealth techniques to avoid bot detection

---

## SemanticGroundingEngine

### Purpose

Replace raw CSS selectors with semantic references that are resilient to DOM changes.

### Grounding Types

```typescript
type SemanticSelector =
  | { type: 'aria'; role: string; name?: string; description?: string }
  | { type: 'text'; text: string; elementRole?: string }
  | { type: 'visual'; screenshotRegion: { x: number; y: number; w: number; h: number }; description: string }
  | { type: 'css'; selector: string }  // fallback — still supported
  | { type: 'xpath'; expression: string }  // fallback — still supported
  | { type: 'composite'; primary: SemanticSelector; fallbacks: SemanticSelector[] }
```

### Resolution Flow

```
Given: SemanticSelector { type: 'aria', role: 'textbox', name: 'Message Claude' }
  │
  ├─ [1] Query accessibility tree via CDP Accessibility.getFullAXTree
  │     └─ Find node where role='textbox' and name contains 'Message Claude'
  │
  ├─ [2] Get the backendDOMNodeId from the AX node
  │
  ├─ [3] Resolve to actual DOM element via DOM.resolveNode
  │
  ├─ [4] If not found → try fallback selectors
  │
  ├─ [5] If all fail → invoke SelectorHealer
  │
  └─ [6] Return resolved element (or null)
```

### Accessibility Tree Query

```typescript
class SemanticGroundingEngine {
  constructor(
    private governor: ChromeGovernor,
    private healer: SelectorHealer,
  ) {}

  async resolve(slaveId: string, selector: SemanticSelector): Promise<ResolvedElement | null>;
  async resolveAll(slaveId: string, selector: SemanticSelector): Promise<ResolvedElement[]>;
  async exists(slaveId: string, selector: SemanticSelector): Promise<boolean>;
  async waitFor(slaveId: string, selector: SemanticSelector, timeoutMs?: number): Promise<ResolvedElement | null>;

  // Snapshot the full accessibility tree (for SenseLayer in agentic loop)
  async getAccessibilityTree(slaveId: string): Promise<AccessibilityNode[]>;

  // Visual grounding — find element by screenshot region
  async resolveByVisual(slaveId: string, region: ScreenshotRegion, description: string): Promise<ResolvedElement | null>;
}

interface AccessibilityNode {
  nodeId: string;
  role: string;                      // 'textbox', 'button', 'combobox', 'link', etc.
  name: string;                      // accessible name
  description?: string;
  value?: string | number;
  checked?: 'mixed' | 'true' | 'false';
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  visible: boolean;
  // DOM coordinates (for visual grounding)
  boundingBox?: { x: number; y: number; width: number; height: number };
  // Children
  childIds: string[];
  // Actions available on this node
  actions: string[];                 // ['click', 'focus', 'setValue', etc.]
}

interface ResolvedElement {
  backendDOMNodeId: number;
  // The actual SemanticSelector that resolved this (may differ from input if healer was used)
  resolvedBy: SemanticSelector;
  boundingBox: { x: number; y: number; width: number; height: number };
  // Is the element visible and interactable?
  isVisible: boolean;
  isInteractable: boolean;
  // Confidence in this resolution (0.0-1.0)
  confidence: number;
}
```

---

## SelectorHealer

### Purpose

When a selector misses, the SelectorHealer uses LLM + DOM analysis to propose alternative selectors, validates them, and persists the working one.

```typescript
class SelectorHealer {
  constructor(
    private governor: ChromeGovernor,
    private store: SelectorHealStore,
    private eventBus: CapabilityEventBus,
  ) {}

  async heal(params: {
    slaveId: string;
    failedSelector: SemanticSelector;
    capabilityId: string;
    providerId: string;
    context?: string;                // what were we trying to do?
  }): Promise<HealResult | null>;
}

interface HealResult {
  // New selector that works
  newSelector: SemanticSelector;
  // How confident are we in this heal?
  confidence: number;
  // What approach was used?
  method: 'aria_match' | 'text_match' | 'visual_match' | 'llm_proposal' | 'dom_analysis';
  // Should this be persisted as the new primary selector?
  shouldPersist: boolean;
  // Evidence
  evidence: string;
}
```

### Healing Flow

```
heal({ failedSelector, capabilityId, providerId, context })
  │
  ├─ [1] Capture current DOM + accessibility tree + screenshot
  │
  ├─ [2] Strategy: ARIA match
  │     └─ Was the selector aria-based? Try relaxing the name match
  │     └─ e.g., role='textbox' name='Message Claude' → role='textbox' (any name)
  │     └─ If found → return with confidence 0.8
  │
  ├─ [3] Strategy: Text match
  │     └─ Search for elements with similar text content
  │     └─ e.g., find any element containing "Message" or "Claude"
  │     └─ If found → return with confidence 0.6
  │
  ├─ [4] Strategy: DOM structure analysis
  │     └─ Find elements in similar DOM position to where the old selector was
  │     └─ e.g., "was in a div[data-role='composer'] → find similar structure"
  │     └─ If found → return with confidence 0.5
  │
  ├─ [5] Strategy: LLM proposal
  │     └─ Send screenshot + accessibility tree + context to LLM
  │     └─ "The element for [capability] was not found. Here's the current page.
  │         Which element should I use instead?"
  │     └─ LLM returns proposed selector
  │     └─ Validate by checking if selector resolves
  │     └─ If valid → return with confidence 0.7
  │
  ├─ [6] Strategy: Visual match
  │     └─ If we have a screenshot of where the element used to be
  │     └─ Find element at similar coordinates
  │     └─ If found → return with confidence 0.4
  │
  ├─ [7] If any strategy succeeded:
  │     ├─ Persist new selector to selector_strategy table
  │     ├─ Record heal event
  │     ├─ Emit capability:selector_healed event
  │     └─ Return HealResult
  │
  └─ [8] If all strategies failed:
       ├─ Emit capability:selector_broken event
       └─ Return null (capability marked as broken)
```

---

## Shadow DOM Penetration

Many modern web apps use Shadow DOM (Web Components). Standard CSS selectors cannot penetrate shadow boundaries. The SemanticGroundingEngine handles this:

```typescript
// The accessibility tree naturally includes shadow DOM elements.
// When we query Accessibility.getFullAXTree, shadow DOM elements appear
// with their roles and names — no special handling needed.
//
// For CSS selector fallbacks, we use a shadow-piercing query:
//   >>> is replaced by shadow root boundary traversal
//   e.g., "my-app >>> div >>> button.send"
```

The CDPProxy gains a new method:

```typescript
interface CDPProxy {
  // ... v1 methods ...

  // NEW: Shadow-piercing query
  queryShadowPiercing(slaveId: string, selector: string): Promise<ResolvedElement[]>;
}
```

---

## Cross-Origin Frame Handling

For providers that embed cross-origin iframes (e.g., login forms hosted on a different domain), the GroundingEngine can target specific frames:

```typescript
interface FrameAwareSelector extends SemanticSelector {
  frameChain?: string[];  // URLs of frames to traverse (outer → inner)
}

// Resolution:
// 1. Get all frames via Page.getFrameTree
// 2. Navigate to the target frame by matching frameChain URLs
// 3. Execute selector within that frame's context
```

---

## Anti-Detection (Stealth)

To avoid bot detection on providers that use Cloudflare, reCAPTCHA, or custom bot detection:

```typescript
interface StealthConfig {
  // Mask WebDriver flag
  maskWebDriver: boolean;            // default: true
  // Spoof navigator properties
  spoofNavigator: {
    platform: string;
    languages: string[];
    hardwareConcurrency: number;
    deviceMemory: number;
  };
  // Spoof screen properties
  spoofScreen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  // Human-like interaction patterns
  humanLikeInteraction: {
    typeDelayMs: [number, number];   // [min, max] per character
    clickOffsetJitter: number;       // pixels of random offset
    mouseMovementCurves: boolean;    // bezier curve mouse movement
    randomScrollPauses: boolean;     // pause scrolling randomly
  };
  // Canvas fingerprint randomization
  randomizeCanvasFingerprint: boolean;
  // WebRTC IP leak prevention
  preventWebrtcLeak: boolean;
}
```

Stealth is applied by the Governor.LifecycleManager when spawning Chrome — injected via `Page.addScriptToEvaluateOnNewDocument` before any page loads.

---

## Integration with selector_strategy Table

The `selector_strategy` table from v1 is extended:

| New Column | Type | Purpose |
|-----------|------|---------|
| `selector_format` | TEXT | 'css' \| 'xpath' \| 'aria' \| 'text' \| 'visual' \| 'composite' |
| `semantic_data` | TEXT | JSON-encoded SemanticSelector data |
| `heal_count` | INTEGER | Number of times this selector has been healed |
| `last_healed_at` | INTEGER | Timestamp of last heal |
| `original_selector` | TEXT | The original selector before healing |

---

## See also

- `SOTA-03` — Agentic loop (SenseLayer uses accessibility tree)
- `SOTA-01` — MirrorEngine (ObservationTap uses semantic grounding for state projection)
- `SOTA-07` — Schema delta (selector_strategy extensions, selector_heal_event table)
