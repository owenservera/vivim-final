> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-13: Human Simulation Engines

**Phase:** 13 | **Units:** 3 | **Goal:** Mouse, keyboard, and scroll input indistinguishable from human

## Architecture

Each human simulation engine wraps the corresponding CDP input domain:

```
Current: CDP Input.dispatchMouseEvent({ x, y, type: 'mousePressed' })
  → Bot: clicks exact center of element, zero acceleration

HumanMouseEngine: 
  → Generates bezier curve path from current position to target
  → Dispatches mouseMoved events along the curve (20-40 points)
  → Click offset is Gaussian-distributed around center (not exact center)
  → Velocity follows bell curve (slow→fast→slow)

Current: Runtime.evaluate({ expression: "el.value = 'text'" })
  → Bot: entire text appears in one frame, zero keystrokes

HumanKeyboardEngine:
  → Types character by character with variable delay
  → Delay follows log-normal distribution (human typing pattern)
  → Occasional burst typing (fast sequences)
  → Occasional typo + correction (very low probability)

Current: Runtime.evaluate({ expression: "window.scrollBy(0, 300)" })
  → Bot: instant jump, no acceleration

HumanScrollEngine:
  → Generates scroll velocity curve (acceleration → constant → deceleration)
  → Dispatches multiple small scroll events over 300-800ms
  → Occasionally overshoots and corrects
```

## Units

| Unit | Title | Engine |
|------|-------|--------|
| 13.1 | HumanMouseEngine | `src/engines/stealth/human-mouse-engine.ts` |
| 13.2 | HumanKeyboardEngine | `src/engines/stealth/human-keyboard-engine.ts` |
| 13.3 | HumanScrollEngine | `src/engines/stealth/human-scroll-engine.ts` |

