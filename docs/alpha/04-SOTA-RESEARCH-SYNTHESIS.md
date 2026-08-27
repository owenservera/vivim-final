# SOTA Research Synthesis — Tools, Patterns & Recommendations

> Research conducted 2026-08-26. All claims cite sources. This is the evidence
> base for the landing page design brief (05-LANDING-PAGE-DESIGN-BRIEF.md).

---

## 1. Landing Page Design Patterns (2026 evidence)

Source: designrevision.com B2B SaaS patterns (Feb 2026), abmatic.ai PLG guide (May 2026),
Arcade product-led onboarding benchmarks (May 2026), SaasUI gallery analysis.

**Structural patterns that convert:**
- **5–8 section layout** converts 2–3× higher than unstructured pages
- **Outcome-specific headlines** ("Send your first AI message in 60 seconds") drive 20–30% higher engagement than generic
- **Show product working, not described** — Linear's animated demo hero outperforms text-heavy alternatives. Confidence in design signals confidence in product.
- **Above-fold social proof** lifts conversions 15–25%. For alpha with no customer logos: use metrics (N capabilities, download count) and "built by a friend" transparency.
- **Use-case framing > feature listing** — Notion targets personas via use-case sections. For Vivim: Explorer/Builder/Observer/Breaker tracks.
- **Dual CTA** — Stripe serves self-serve + enterprise simultaneously. For Vivim: "Download Alpha" + "Read the Codex".
- **Page speed is a conversion factor** — every second drops 7%. Target LCP < 2.5s, INP < 200ms, CLS < 0.1.

**Alpha-specific insight:**
The "stealth test for close friends" context means: skip generic trust signals (no enterprise logos needed). Lead with transparency and honesty. "Here's exactly what works, what's partial, and what's not ready" builds MORE trust with technical friends than polish.

## 2. Documentation Frameworks (Next.js 16)

Source: pkgpulse.com comparison (Mar 2026), Next.js 16 MDX docs (Aug 2026),
MiniWiki template (Mar 2026), Fumadocs docs.

**Recommended: native MDX via `@next/mdx`**

| Option | Verdict for Vivim |
|---|---|
| **Nextra** (~800K downloads) | Heavy — adds its own routing/theme layer that conflicts with Vivim's existing App Router. Overkill. |
| **Fumadocs** | Better DX than Nextra but still a framework-on-framework. |
| **Contentlayer** | Abandoned maintainer. Risk. |
| **Velite** | Typed MDX collections for App Router. Good but adds dependency. |
| **`@next/mdx` + `gray-matter` + `next-mdx-remote`** (recommended) | Minimal. File-system routing. No framework conflict. `docs/wiki/**/*.mdx` → `app/wiki/[slug]/page.tsx`. Exactly what the Codex spec calls for. |

**Why this wins:** Vivim already has 100+ App Router API routes. Adding Nextra's routing layer would create conflicts. Native MDX with `gray-matter` for frontmatter is 4 dependencies, not a framework.

## 3. Interactive Tour Libraries (React 19)

Source: usertourkit.com expert roundup (Apr 2026), onboardjs.com comparison (Jan 2026),
userpilot PLG guide (Aug 2026).

**The React 19 compatibility crisis:** React Joyride (400K downloads, 7.6K stars) and Shepherd.js React wrapper are both broken on React 19 as of April 2026. Joyride v3 exists but most installs are still on broken v2.

**Recommended for Vivim:**

| Library | Bundle | React 19 | Headless | Verdict |
|---|---|---|---|---|
| **Tour Kit** (`@tourkit/core` + `@tourkit/react`) | ~12KB gz | ✅ native | ✅ | **Primary choice.** Headless = styles via Tailwind. WCAG 2.1 AA. MIT + $99 Pro for analytics. |
| **OnboardJS** | ~8KB gz | ✅ | ✅ | **For wizard flows** (setup wizard, discovery session). No DOM targeting — complementary to Tour Kit. |
| **Driver.js** | ~5KB gz | ⚠️ vanilla | ❌ | Lightweight fallback. No React wrapper, manage refs manually. |

**Key insight:** Tour Kit is headless — you bring the Tailwind classes, the shadcn/ui primitives, the design tokens. No fighting the library's opinions. This matches Vivim's CSS-variable design system exactly.

**Existing Vivim component:** `OnboardingTour` already exists in `frontend/src/components/canvas`. It should be replaced/extended with Tour Kit for production quality, not rebuilt from scratch.

## 4. Progressive Disclosure Patterns

Source: UI-Patterns.com, Userpilot examples (Aug 2026), UXPin guide (May 2026),
GitLab Pajamas design system, Lightflows (Jan 2026).

**Three categories (Lightflows taxonomy):**

| Category | Vivim analog | Implementation |
|---|---|---|
| **Step-by-step (sequential)** | GuidedLanding → S0→S1→S2→S3 journey | Tour Kit step sequencing + OnboardJS wizard for setup |
| **Conditional** | Layer switching (chat→build→admin reveals different capabilities) | Existing layer system (`page.tsx:138-145`) |
| **Contextual** | Help widget, DevConsole, palette search | Existing HelpPanel + UnifiedEntry |

**Progressive disclosure anti-patterns to avoid:**
- **Excessive modal dialogs** — users dismiss modals after seeing 2. Use spotlight tooltips instead (Tour Kit's strength).
- **Front-loading feature education** — don't explain features before users need them. Show the thing, let them click it, THEN explain.
- **Hard gates** — never block "the next thing" because they haven't done "the previous thing." Nudge, don't block.

**Empty states as onboarding moments (Userpilot research):**
Every empty state is a first-run opportunity. Vivim already has empty-state handling in components. Design each empty state as a mini-tutorial: "No conversations yet — send your first message below."

## 5. Product-Led Onboarding Benchmarks (2026)

Source: Arcade benchmarks (14M demo sessions, May 2026), Amplitude retention data.

| Metric | Benchmark | Vivim target |
|---|---|---|
| Activation rate | 40–60% | ≥80% (friends, hand-held) |
| Onboarding completion | 60–85% | ≥90% (3-screen wizard) |
| 30-day feature adoption | 50%+ | ≥50% |
| Time to value | <5 min | <15 min (install+first message) |

**Key insight from Arcade:** "Users who reach step 7 of a demo are 2.3× more likely to finish." — Tour steps need to be short, frequent, and rewarding. Don't make step 3 of 10 a wall of text.

**Key insight from Amplitude:** "98% churn without value within two weeks." — The Day 1–7 window is everything. Mission cards + check-ins are not optional.

## 6. Inspiration Sources for Vivim's Page

Based on research, the closest analogs for Vivim's landing page are:

| Product | Why it fits | What to steal |
|---|---|---|
| **Linear** | Minimal chrome, product-first, confident design | Animated product demo in hero. "Get started" single CTA. Sparse, earns every pixel. |
| **Vercel** | Technical audience, speed-first messaging | "Deploy instantly" → "Install instantly." Transparent status. Live metrics. |
| **Raycast** | Desktop app, power-user, keyboard-first | Keyboard shortcuts prominently featured. Community/extensions angle. |
| **Figma** | Canvas-first, collaborative, local+cloud | The canvas IS the product. Don't explain it — show it. |
| **Arc Browser** | New take on a known category, progressive features | "Browse differently" → "Chat differently." New paradigm messaging. |
| **Notion** | Multiple personas, use-case sections | Explorer/Builder/Observer/Breaker as persona sections. |

## 7. Tailwind + Design System Compatibility

Vivim uses CSS variables (`var(--bg)`, `var(--text)`, `var(--border)`, `var(--accent)`) with inline styles — NOT Tailwind utility classes in most components.

**Implication for landing page:**
- Can use Tailwind for the NEW landing page components (clean break)
- Must honor CSS variables for theme consistency with existing app
- shadcn/ui components (if used) compose well with Radix + Tailwind
- Tour Kit is headless — Tailwind styling works natively

## 8. Key Tools Summary

| Category | Tool | Why |
|---|---|---|
| **Tour framework** | Tour Kit (`@tourkit/core` + `@tourkit/react`) | React 19 native, headless, MIT, accessible |
| **Wizard framework** | OnboardJS | Headless flow orchestration for setup wizard |
| **MDX content** | `@next/mdx` + `gray-matter` + `next-mdx-remote` | Minimal, no framework conflict |
| **Component library** | shadcn/ui (already available) | Radix-based, Tailwind, composable |
| **Animation** | Framer Motion | React 19 compatible, the standard |
| **Icons** | Lucide React | Already in project deps? Verify. Lightweight, tree-shakeable |
| **Syntax highlighting** | Shiki (via rehype) | For code blocks in Codex articles |
| **Search** | Flexsearch (client-side) | Already used by Nextra; lightweight for 16–50 articles |
