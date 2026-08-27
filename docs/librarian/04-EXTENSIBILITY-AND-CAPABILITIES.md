# 04 — EXTENSIBILITY & CAPABILITIES
### Generates: CAPABILITIES-AND-ROADMAP.md

Audience: future contributors, integrators, and anyone deciding "can this app do X, or be made to."

## Structure

```markdown
# Capabilities & Extensibility Roadmap

## 1. Extension points that exist today
For each real seam found in discovery where new behavior could be added with minimal core changes:
- **Seam name** (e.g. "New Tauri command," "New SQLite table + migration," "New Next.js route," "New tray menu item")
- **How to add one:** concrete step-by-step using the actual patterns already in the codebase (reference a real existing example to copy from)
- **Constraints:** anything that limits this (e.g. all commands must be manually registered in `invoke_handler`; no dynamic plugin loading exists)

## 2. Plugin/module architecture assessment
- Does the app use Tauri's plugin system for its own code, or only for third-party plugins? State which plugins are third-party vs. custom.
- Is there any dynamic-loading, config-driven, or feature-flag-driven extensibility, or is everything compiled-in? Be honest — most desktop apps at this stage are compiled-in only.

## 3. Scaling considerations
- **Data layer:** SQLite's real limits relevant to this app (concurrent writers, file size practicalities, no built-in multi-device sync unless the app has built one) — tie to what's actually implemented.
- **Frontend:** how the component/state architecture would need to change for the next order of magnitude of features (e.g. router structure, state management growing pains visible in the code today).
- **Cross-platform:** any platform-specific code paths that would need duplicating for a new target platform.

## 4. Known technical debt relevant to future extension
Pull directly from: TODO/FIXME comments, inconsistent patterns between similar modules, any dead code found in discovery (unregistered commands, unused exports), outdated dependencies flagged by version skew.

## 5. Candidate next capabilities (clearly labeled speculative)
This is the only section allowed to propose things not in the code. Each proposal must:
- Be explicitly tagged `📋 SPECULATIVE — not planned, not started`
- State which existing extension point (from §1) it would use
- State the smallest viable version of the idea
Do not let this section bleed into FEATURE-LIST.md — planned/speculative items belong only here until actually started.

## 6. Integration surface for external developers
If someone outside the core team wanted to integrate with this app (script against its DB, call its API, wrap its CLI), summarize the safest points of integration and the ones to avoid (e.g. "don't write to the SQLite file directly while the app is running — no locking guarantee observed"), cross-linking to IO-REFERENCE.md and API-REFERENCE.md.
```

## Rules
- Every claim in §1–§4 must trace to something concretely observed in discovery.
- §5 is bounded and clearly fenced off from the rest of the pack's fact-only discipline — reviewers must never mistake a speculative idea here for a documented feature.
