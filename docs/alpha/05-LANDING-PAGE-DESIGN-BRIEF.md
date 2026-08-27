# Landing Page Design Brief — SOTA Stealth Alpha

> This is the concrete design spec for Vivim's landing page. It replaces the
> current GuidedLanding as the first-run experience and doubles as the public
> face for close-friends alpha distribution. Research base: 04-SOTA-RESEARCH-SYNTHESIS.md.

---

## 1. What This Page Is

**A product page, not a marketing page.** Vivim is a desktop app that runs
locally. The landing page is the first screen after install. It must:

1. Show the product working (not describe it)
2. Get the user to their first AI message in <15 minutes
3. Progressive-disclose the three surfaces (chat → build → admin)
4. Double as the Codex wiki entry point
5. Collect structured feedback (via existing `feedback_*` capabilities)

**Audience:** 5–15 technical friends who have agreed to test. They already
know what Vivim is (you told them). No need to explain the category.

## 2. Page Architecture

```
┌─────────────────────────────────────────────────────┐
│  NAV BAR (minimal)                                   │
│  [logo] [Wiki] [Download] [Feedback]                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  SECTION 1 — HERO                                    │
│  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │ Animated product     │  │ Headline: "Your AI,    │  │
│  │ demo (looping GIF/   │  │  locally."             │  │
│  │ video showing a      │  │ Subline: "X providers.  │  │
│  │ real conversation)   │  │  Y capabilities.       │  │
│  │                      │  │  Zero cloud required." │  │
│  │                      │  │                        │  │
│  │                      │  │ [Install for Windows]  │  │
│  │                      │  │ v1.0 · 46 MB           │  │
│  └─────────────────────┘  └───────────────────────┘  │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SECTION 2 — STATUS BAR (live metrics)               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │  39  │ │  16  │ │  13  │ │   6  │ │ 100% │      │
│  │ real │ │ prov │ │ eng  │ │ chat │ │ local│      │
│  │ caps │ │ iders│ │ ines │ │ caps │ │      │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
├─────────────────────────────────────────────────────┤
│  SECTION 3 — THE THREE SURFACES                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ CHAT        │ │ BUILD       │ │ ADMIN       │   │
│  │ [screenshot] │ │ [screenshot]│ │ [screenshot]│   │
│  │ Send msgs   │ │ Capabilities│ │ Providers   │   │
│  │ Stream reps  │ │ Register   │ │ Fleet mgmt  │   │
│  │ Multi-prov  │ │ Extend     │ │ Debug       │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SECTION 4 — PERSONAS (tracks)                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ "I'm an Explorer" / "I'm a Builder" / ...    │   │
│  │ → redirects to S1 with track-specific tour    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SECTION 5 — THE CODEX (wiki preview)                │
│  "The Codex is your reference for everything."       │
│  [Top 5 articles] [Browse all →]                     │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SECTION 6 — FEEDBACK                               │
│  "Something broken? Something great?"                │
│  [Feedback form] [Quick emoji] [Discord/WhatsApp]   │
│                                                      │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
│  Status · Source · Roadmap · "Built for friends"     │
└─────────────────────────────────────────────────────┘
```

## 3. Section Details

### Section 1 — Hero

**Left half:** Animated product demo. Not a GIF — a live capture from a real
Claude/Gemini conversation. Use the existing screenshot capture infrastructure
(`devops/desktop/verify.ts` → `captureScreenshot`). Record a 10-second loop:
1. Composer focused
2. Message sent
3. Streaming response appearing
4. Provider badge visible

**Right half:**
- **Headline:** "Your AI, locally." (6 words. No jargon. Honest.)
- **Subline:** "X providers · Y capabilities · Zero cloud" (pull numbers from
  `default-caps.ts` count and provider manifest count)
- **CTA:** "Download Alpha" → triggers existing `launch-visible` setup flow
  (GuidedLanding → setup-wizard → first conversation)
- **Meta:** "v1.0 · 46 MB · Windows only · No signup required"

**Why this hero works:** It shows the thing working, states the value
proposition in 6 words, and the CTA is the first step of the actual journey.

### Section 2 — Status Bar

Pull live numbers from the system. These should be **real**, not hardcoded.

| Metric | Source |
|---|---|
| `real caps` | `Object.keys(defaultCapabilities).length` (currently 39) |
| `providers` | Provider manifest count from `seeds/providers/manifests.ts` (16) |
| `engines` | 13 (static, from architecture spec) |
| `chat providers` | Filter providers where `parser` exists in DB |
| `local` | "100%" — always true |

This bar is the alpha equivalent of social proof. "Here's what's real."

### Section 3 — Three Surfaces

Three columns with **live screenshots** (not mockups). Each column:

**CHAT**
- Screenshot: Real conversation in the chat surface
- Headline: "Talk to your AI"
- Bullets: Multi-provider streaming · Conversation memory · Provider switching
- Link: "Try it →" (navigates to chat surface)

**BUILD**
- Screenshot: Capability catalog or palette
- Headline: "Extend it"
- Bullets: 39+ capabilities · Registry pattern · NL commands
- Link: "Explore →" (opens Command Palette)

**ADMIN**
- Screenshot: Health dashboard or fleet config
- Headline: "Manage it"
- Bullets: Provider health · Chrome fleet · Debug console
- Link: "Configure →" (opens admin layer)

### Section 4 — Personas

One-line persona selector. Not a form — three/two buttons.

```
What kind of tester are you?

[Explorer]  [Builder]  [Observer]  [Breaker]
```

Each button:
1. Sets a track cookie/localStorage flag
2. Navigates to S1 with the track pre-selected
3. The OnboardingTour (Tour Kit) uses the track to show different first steps

- **Explorer:** "Show me what this thing does" → first tour is a live demo
- **Builder:** "I want to build on this" → first tour is capability registry
- **Observer:** "I want to watch and report" → first tour is feedback flow
- **Breaker:** "I'm going to try to break it" → first tour is debug console

### Section 5 — Codex Wiki Preview

"**The Codex** — your reference for everything."

Show the top 5 most-recently-updated wiki articles as cards. Each card:
- Article title
- One-line summary
- Status chip (Alpha/Partial/Draft)
- "Read →" link to `/wiki/[slug]`

"Browse all articles →" links to `/wiki` index.

### Section 6 — Feedback

Three feedback channels, ranked by effort:

1. **Quick emoji** — `👍` / `🤷` / `👎` — sends to `feedback_quick` capability
2. **One-liner** — text input → `feedback_report` capability
3. **Full form** — structured bug report → `feedback_report` with type=bug

## 4. Technical Implementation

### Route

```
frontend/src/app/alpha/page.tsx        ← NEW: Alpha landing page
frontend/src/components/alpha/         ← NEW: Hero, StatusBar, Surfaces, Personas, CodexPreview, Feedback
frontend/src/features/guided-landing.tsx ← MODIFIED: Redirect to /alpha on first run
```

### Tool Stack

| Component | Tool | Why |
|---|---|---|
| Tour steps | `@tourkit/core` + `@tourkit/react` | React 19, headless, accessible |
| Wizard flow | OnboardJS | Setup wizard orchestration |
| Wiki content | `@next/mdx` + `gray-matter` | Native, minimal, no framework conflict |
| Wiki search | Flexsearch (client-side) | Lightweight for 16–50 articles |
| Animation | Framer Motion | Page transitions, hero reveal |
| Icons | Lucide React | Verify already in deps |
| Syntax highlight | Shiki (rehype plugin) | Codex code blocks |
| Components | shadcn/ui (Radix + Tailwind) | Consistent with existing UI |

### Data Flow

```
User installs desktop app
  → vivim-server.exe boots on :9421
  → Frontend loads (Next.js)
  → checkNeedsSetup() returns true (first run)
  → Redirect to /alpha (NOT GuidedLanding)
  → /alpha page loads:
    1. Status bar fetches /api/capabilities → real counts
    2. Hero loads pre-recorded demo (static asset)
    3. Surfaces section loads screenshots (static assets)
    4. Persona buttons set localStorage track
  → User picks persona → Tour Kit starts S1 tour
  → Tour guides through first conversation
  → On completion → set has_completed_onboarding = true
  → Future loads: show /alpha as hub (not redirect to it)
```

### Responsive Layout

| Breakpoint | Layout |
|---|---|
| Desktop (>1024px) | Full 6-section layout, side-by-side hero |
| Tablet (768–1024px) | Stacked hero, 2-column surfaces |
| Mobile (<768px) | Single column, hero text only (no demo loop) |

**Note:** Desktop is primary (Tauri is Windows-only). Mobile is for the
`/wiki` and `/alpha` pages that might be viewed in a browser.

## 5. Integration with Existing Code

### What Changes

| File | Change |
|---|---|
| `frontend/src/features/guided-landing.tsx` | Redirect logic: `if (needsSetup) redirect('/alpha')` |
| `frontend/src/app/page.tsx` | After onboarding, `/alpha` becomes the hub (add link in UnifiedEntry) |
| `frontend/src/features/help-system/HelpPanel.tsx` | Add "Codex" tab → `/wiki` |
| `src/server/index.ts` | No changes — existing APIs serve the data |
| `seeds/wiki/` | NEW — MDX articles for the Codex |
| `frontend/src/app/wiki/` | NEW — Wiki routes |
| `frontend/src/app/wiki/[slug]/page.tsx` | NEW — Article renderer |

### What Doesn't Change

- All existing routes (30+) — untouched
- All existing capabilities (39 real + generated) — untouched
- Canvas V10 architecture — the landing page is a NEW route, not a replacement
- Tauri build pipeline — same `vivim-server.exe` sidecar
- Desktop boot flow — same `/readyz` → window show sequence

## 6. First-Boot Sequence (revised)

```
1. Desktop app installed (NSIS)
2. User double-clicks vivim-desktop.exe
3. Supervisor spawns vivim-server.exe
4. Server boots: snapshot bootstrap → DB ready → /readyz returns 200
5. Window shows, loads http://localhost:9420
6. Frontend checks: needsSetup = true (no workspace configured)
7. Redirect to /alpha
8. /alpha page renders (hero + status + surfaces + personas)
9. User clicks "Download Alpha" or picks a persona
10. Tour Kit starts: Setup Wizard (workspace config → provider selection → first message)
11. On first message sent: Set needsSetup = false
12. Future boots: Show /alpha as hub (not redirect)
```

## 7. Metrics to Track

| Metric | How | Target |
|---|---|---|
| Time from install to first message | `launch_visible` timestamp → first `send_message` cap | <15 min |
| Persona selection rate | /alpha → persona click | >80% |
| Tour completion rate | Tour Kit `onComplete` callback | >90% |
| Feedback submission rate | 7 days post-install | ≥1 per user |
| Wiki article views | `/wiki/[slug]` page views | ≥3 per user |
| Features tried (unique caps) | Capability execution log | ≥5 in first week |

## 8. Content Requirements

### To Build Now (pre-alpha)

- [ ] Record 10-second product demo (Claude conversation)
- [ ] Take 3 surface screenshots (chat, build, admin)
- [ ] Write 5 starter wiki articles (see 01-WIKI-SPEC.md §6)
- [ ] Verify Lucide React is in frontend deps
- [ ] Install `@tourkit/core` + `@tourkit/react`
- [ ] Install `@next/mdx` + `gray-matter`
- [ ] Create `frontend/src/components/alpha/` directory
- [ ] Create `frontend/src/app/alpha/page.tsx`
- [ ] Create `frontend/src/app/wiki/` directory

### To Build During Alpha

- [ ] Full 16-article Codex (see 01-WIKI-SPEC.md)
- [ ] OnboardJS setup wizard integration
- [ ] Search across wiki articles
- [ ] "What's new" changelog section
- [ ] Feedback dashboard in admin layer
