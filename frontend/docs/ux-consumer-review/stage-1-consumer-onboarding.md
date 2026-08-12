# Consumer UX Review — Stage 1: Consumer Onboarding & First-Run Value

**Target Components:** `src/features/guided-landing/`, `src/components/canvas/OnboardingTour.tsx`, `src/app/page.tsx`

---

## 1. UX Audit & Consumer Friction Analysis

### Current UX Friction:
1. **Abstract Terminology on First Launch:**
   The onboarding screens reference technical abstractions like "SSOA Layers", "Canvas Slots", and "Provider Allocators". Non-technical consumers are left confused about how to perform basic tasks (e.g. asking a question, generating an outline, or creating a canvas note).
2. **Missing Actionable Starter Templates:**
   When a new user lands on the empty canvas, there are no immediate sample prompt cards or 1-click starter templates ("Draft an Email", "Analyze a Document", "Brainstorm Ideas").

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/features/guided-landing/GuidedLanding.tsx` — Consumer Starter Cards

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/features/guided-landing/GuidedLanding.tsx`  
**Target Action:** Add friendly consumer prompt templates ("Write an article outline", "Explain a complex topic", "Organize a project canvas").

```tsx
// Verbatim Starter Templates snippet for consumer onboarding:
export const CONSUMER_STARTER_PROMPTS = [
  {
    icon: 'sparkles',
    title: 'Brainstorm & Plan',
    description: 'Create an interactive project board or outline on your canvas.',
    prompt: 'Help me plan a new project with step-by-step goals on the canvas.',
  },
  {
    icon: 'message-square',
    title: 'Ask Anything',
    description: 'Start a natural conversation with your connected AI models.',
    prompt: 'Summarize the key ideas of high-efficiency productivity methods.',
  },
  {
    icon: 'layout',
    title: 'Explore Templates',
    description: 'Choose a pre-built visual layout for notes, data, or workflows.',
    prompt: 'Show me the available canvas layout templates.',
  },
];
```

---

## 3. Verification Protocol

```bash
# Verify component renders cleanly
bun test tests/unit/
```
