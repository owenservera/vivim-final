# 01 — PRODUCT DOCS TEMPLATES
### Generates: FEATURE-LIST.md, PRODUCT-DESCRIPTION.md, CONCEPTUAL-DESIGN.md

Ground every claim in the Phase A inventory. Nothing here is allowed to be aspirational unless explicitly placed in a "Planned / Not Yet Built" section.

---

## 1. `docs/product/FEATURE-LIST.md`

### Structure

```markdown
# Feature List

## How to read this document
Status legend: ✅ Shipped · 🚧 In Progress · 🧪 Experimental/flagged · 📋 Planned (see roadmap) · 🗑️ Deprecated

## <Feature Category 1, e.g. "Data Management">
### <Feature name>
- **Status:** ✅
- **What it does:** <1-3 sentences, user-facing behavior, not implementation>
- **Where it lives:** <route/component/command references, e.g. `app/dashboard/page.tsx`, IPC command `save_project`>
- **Depends on:** <other features, tables, plugins>
- **Notable constraints:** <platform limits, size limits, offline-only, etc.>
```

### Rules
- Derive categories from the actual product surface (pages/views), not generic SaaS categories — do not force-fit categories that don't exist in this app.
- Include **every** route/screen, every distinct IPC command that produces user-visible effect, every settings toggle, every export/import capability, every keyboard shortcut or power-user feature you found in discovery.
- Include infrastructure-adjacent but user-visible features: auto-update, offline mode, local-first storage, multi-window, tray behavior — these are still "features" to a product audience.
- For anything gated behind a feature flag or `#[cfg]`/env check found in discovery, mark 🧪 and note the flag name and default state.
- End with a **Feature Inventory Table** — one row per feature, sortable mentally by status — so a PM can scan the whole surface in one table.

---

## 2. `docs/product/PRODUCT-DESCRIPTION.md`

Audience: prospective users, new team members, stakeholders who need "what is this, in plain terms" before touching code.

### Structure

```markdown
# Product Description

## What this is
<2-4 sentences. Plain language. No jargon. State the problem it solves and for whom, inferred from actual features — do not invent a market you have no evidence for. If the target user isn't obvious from the repo, say so and describe the product functionally instead of by persona.>

## Core value proposition
<3-5 bullets. Each tied to a real, shipped feature. No bullet may reference a 📋 planned feature.>

## Who uses it and how
<Describe primary usage flow end-to-end in narrative form: what a user opens, what they do first, what they do repeatedly, what they get out at the end. Base this on the actual page/route flow discovered, not a generic onboarding story.>

## Why this architecture (Tauri + Next + SQLite)
<Explain, for a non-engineer, what this combination buys the product: e.g. native desktop packaging with web tooling, local-first data ownership, offline capability, small binary size vs. Electron — but only claim what's actually true of THIS repo's config (check tauri.conf.json bundle settings, whether it's truly offline-capable, etc.). Do not recite generic Tauri marketing copy as if it were this product's property.>

## Platform support
<Derive strictly from tauri.conf.json bundle targets and any platform-conditional code found in discovery.>

## Current maturity
<Be honest: alpha/beta/production, based on test coverage, CI presence, versioning in package.json, changelog if present.>
```

---

## 3. `docs/product/CONCEPTUAL-DESIGN.md`

Audience: design/brand stakeholders, execs skimming for narrative, and future contributors who want the "why" before the "how." This is the one file allowed genuine narrative/vision voice — but it must still be traceable to the real product, not generic startup prose.

### Structure

```markdown
# Conceptual Design

## The idea in one paragraph
<Vision-voice, but concrete. What is this trying to become? Ground it in the trajectory visible from the feature list — shipped + in-progress + planned — not pure invention.>

## Design principles observed in the codebase
<Reverse-engineer the principles the actual code implies. E.g.: "local-first: no feature requires network access" (only claim this if discovery confirmed it) — "single source of truth: all state flows through SQLite, not duplicated in frontend state" (only if true). Each principle must cite the evidence that led you to infer it.>

## Interaction philosophy
<How does the app want the user to feel/behave — inferred from UI structure, keyboard-first vs. mouse-first affordances, information density, native-feeling chrome (tray, native menus) vs. web-feeling chrome.>

## Where the conceptual model and the implementation diverge
<Important, often-skipped section: call out anywhere the code suggests an intended design that isn't fully realized yet — half-built features, TODOs, inconsistent patterns between modules. This is valuable signal, not criticism.>

## Naming and metaphor audit
<List the domain vocabulary used in the code (table names, route names, component names) and note whether it's used consistently across the Rust/TS boundary — inconsistency here is a real finding worth surfacing.>
```

### Rules for this whole file
- No corporate-marketing filler ("revolutionary," "seamless," "best-in-class") unless quoting something already present in the repo (e.g. an existing README/marketing copy) — and if quoting, cite it as existing copy, don't originate it fresh.
- Every principle claimed must have a one-line "evidence" pointer back to a real file/pattern.
