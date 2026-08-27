# 00 — ORCHESTRATOR
### Master execution prompt for the documentation-generation agent

You are being handed **full read access to a repository** (stack: TypeScript, Next.js, Tauri, SQLite) and **this pack of 9 files**. Your job is to read the entire repo, understand it exhaustively, and produce two things, not one:

1. A **complete, multi-audience documentation suite** as Markdown source files with embedded Mermaid diagrams (Phases A–F, unchanged in spirit from v1).
2. A **shippable in-app wiki**: the same content published with stable IDs and a JSON manifest, plus an actual Next.js route/component inside this app that renders it — offline, deep-linkable, searchable — and a guided-tour layer on top of it (Phases G–H, new in v2).

The docs are not a side artifact anymore. They are a **product surface** end users click through inside the running app. Treat "will this link still work after the next regeneration" and "will this render inside the Tauri webview with no network" as first-class acceptance criteria, equal in weight to factual accuracy.

You have a large context window and no meaningful token ceiling. **Use that budget.** Do not summarize away detail to save space. Err toward completeness over brevity everywhere in this pack.

---

## 0. Operating principles

1. **Ground everything in the repo.** Never invent a feature, endpoint, table, or command. If something is ambiguous or you cannot confirm it from code/config, mark it `⚠️ UNCONFIRMED — verify` inline rather than guessing silently.
2. **Assume all audiences at once.** A single reader will not consume everything — but every doc must be sliceable: a PM reads the feature list and product description; an SRE reads architecture + I/O; a new engineer reads architecture + API + data model; an exec reads the product description and conceptual design copy; a security reviewer reads I/O + API + data flow; an integrator reads API + CLI + extensibility. Write so each file stands alone.
3. **Diagrams are not decoration.** Every architecture, data-flow, and data-model claim that can be drawn must be drawn in Mermaid, in addition to being described in prose. Prose and diagram should agree exactly.
4. **No stub sections.** If a template section doesn't apply, write "Not applicable: <reason>" rather than deleting it — this proves you considered it.
5. **Version everything.** Every generated file starts with a metadata header (see §4) so future runs are diffable.
6. **Links are a contract, not a convenience.** Every doc and every section that could plausibly be deep-linked from inside the app (a tooltip, a "learn more," a tour step) must carry a **stable ID that survives regeneration** even if its heading text changes later. Never invent a fresh ID for content that already exists — see `06-IN-APP-PUBLISHING-SPEC.md` §1 before writing your first heading.
7. **Two audiences for the same fact, two surfaces.** The Markdown source may contain internal detail (raw file paths, security notes) that a repo-reading engineer should see but an end user browsing the in-app wiki should not. Tag visibility explicitly per file/section rather than deciding by omission — see `06-IN-APP-PUBLISHING-SPEC.md` §3.

---

## 1. Execution phases (run in order, do not skip)

### Phase A — Discovery (read-only, no output yet)
Follow **`01-DISCOVERY-PROTOCOL.md`** exactly. Build an internal inventory before writing a single doc. Do not begin Phase B until discovery is complete. If the repo is large, it is acceptable to make multiple passes, but do not start drafting docs on partial understanding.

### Phase B — Product & narrative docs
Using **`01-PRODUCT-DOCS-TEMPLATES.md`**, generate:
- `docs/product/FEATURE-LIST.md`
- `docs/product/PRODUCT-DESCRIPTION.md`
- `docs/product/CONCEPTUAL-DESIGN.md`

### Phase C — Architecture & data flow
Using **`02-ARCHITECTURE-DIAGRAMS.md`**, generate:
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/DATA-FLOW.md`
- `docs/architecture/DATA-MODEL.md`

### Phase D — Interfaces
Using **`03-API-CLI-IO-REFERENCE.md`**, generate:
- `docs/interfaces/API-REFERENCE.md`
- `docs/interfaces/CLI-REFERENCE.md`
- `docs/interfaces/IO-REFERENCE.md`

### Phase E — Extensibility
Using **`04-EXTENSIBILITY-AND-CAPABILITIES.md`**, generate:
- `docs/extensibility/CAPABILITIES-AND-ROADMAP.md`

### Phase F — Cross-linking, audience map, and self-audit
Using **`05-QUALITY-GATE-AND-AUDIENCE-MAP.md`**:
- Generate `docs/AUDIENCE-MAP.md` and `docs/README.md` (index/table of contents).
- Run the full quality checklist against every file produced.
- Fix every failing item before declaring done. Do not report completion with known gaps — either close them or explicitly flag them in a `docs/OPEN-QUESTIONS.md` file with owner-actionable next steps.

### Phase G — In-app publishing
Using **`06-IN-APP-PUBLISHING-SPEC.md`**:
- Retrofit every file from Phases B–E with the extended frontmatter (stable `id`, `slug`, `nav_order`, `audience_visibility`) and explicit heading anchors.
- Generate `docs/docs-manifest.json` and `docs/search-index.json`.
- Rewrite every cross-link produced in Phases B–F from relative `.md` paths to manifest-slug routes (`/docs/<slug>`).

### Phase H — In-app viewer and guided tour
Using **`07-DOCS-VIEWER-APP-INTEGRATION.md`** and **`08-GUIDED-TOUR-SPEC.md`**:
- Scaffold the actual in-app docs route/component inside this repo's Next.js app, wired to `docs-manifest.json` and `search-index.json`, statically bundled (no network dependency).
- Generate `docs/tour-manifest.json` and the minimal tour engine that walks it.
- Add an entry point for at least one tour (e.g. a "Take the tour" affordance on first run or in a help menu).

---

## 2. Output directory contract

Write everything under a top-level `docs/` folder in the repo root, using exactly this tree (create subfolders as needed):

```
docs/
├── README.md                          # index, how to navigate, audience map link
├── AUDIENCE-MAP.md
├── OPEN-QUESTIONS.md                  # only if unresolved items exist
├── docs-manifest.json                 # NEW — machine-readable doc/section/diagram tree
├── search-index.json                  # NEW — flat searchable index for the in-app wiki
├── tour-manifest.json                 # NEW — ordered tour steps, doc + live-UI refs
├── .ids-registry.json                 # NEW — append-only stable-ID ledger, never hand-edited after creation
├── product/
│   ├── FEATURE-LIST.md
│   ├── PRODUCT-DESCRIPTION.md
│   └── CONCEPTUAL-DESIGN.md
├── architecture/
│   ├── ARCHITECTURE.md
│   ├── DATA-FLOW.md
│   └── DATA-MODEL.md
├── interfaces/
│   ├── API-REFERENCE.md
│   ├── CLI-REFERENCE.md
│   └── IO-REFERENCE.md
└── extensibility/
    └── CAPABILITIES-AND-ROADMAP.md
```

Additionally, inside the app's own source tree (exact location depends on the repo's router — typically `app/(docs)/docs/` or `app/help/`), scaffold the viewer per `07-DOCS-VIEWER-APP-INTEGRATION.md`. This is app source code, not `docs/` output — do not put it inside the `docs/` folder above.

Do not flatten the `docs/` structure. Do not rename files. If a repo already has a `docs/` folder, merge non-destructively — never delete existing human-authored content; append a `-generated` suffix to any file you'd otherwise overwrite and note the collision in `docs/OPEN-QUESTIONS.md`.

---

## 3. Non-negotiable completeness bar

Before you consider this task done, every one of the following must be independently true. This list is your acceptance test — re-read it after Phase F.

- [ ] Every Tauri IPC command (`#[tauri::command]` / registered in `invoke_handler`) is documented in `API-REFERENCE.md`.
- [ ] Every Next.js route handler (`app/**/route.ts`, `pages/api/**`) is documented in `API-REFERENCE.md`.
- [ ] Every SQLite table, column, type, constraint, index, and foreign key is in `DATA-MODEL.md`, with an ER diagram that matches the live schema (migrations or schema files are the source of truth, not assumptions).
- [ ] Every CLI entry point (package.json scripts, bin files, Tauri CLI plugins, custom argument parsers) is in `CLI-REFERENCE.md`.
- [ ] Every environment variable, config file, and file-system read/write path the app touches is in `IO-REFERENCE.md`.
- [ ] Every user-facing feature (including partially-built ones behind flags) is in `FEATURE-LIST.md`, tagged with status (see §5 of `01-PRODUCT-DOCS-TEMPLATES.md`).
- [ ] `ARCHITECTURE.md` contains, at minimum, a system-context diagram, a container diagram, and a component diagram for each major subsystem (frontend, Tauri/Rust shell, data layer).
- [ ] `DATA-FLOW.md` contains a sequence diagram for every major user journey and every cross-process boundary (webview ↔ Rust ↔ SQLite ↔ any external network calls).
- [ ] Every diagram renders as valid Mermaid (mentally trace the syntax — no dangling nodes, no unescaped special characters).
- [ ] Every doc has the metadata header from §4.
- [ ] `AUDIENCE-MAP.md` maps every one of the 6+ audiences in `05-QUALITY-GATE-AND-AUDIENCE-MAP.md` to specific files and sections.
- [ ] Every H2/H3 heading across every generated doc carries an explicit, stable anchor ID recorded in `.ids-registry.json` — none rely on default text-derived anchors.
- [ ] `docs-manifest.json` enumerates every doc, every section, and every diagram with a matching `id`/`anchor`, and validates as well-formed JSON.
- [ ] `search-index.json` contains at least one entry per section across every doc.
- [ ] Zero relative `.md` cross-links remain anywhere in `docs/` — every internal link is a manifest-slug route.
- [ ] The in-app docs route renders, offline, from bundled content only (no `fetch` to an external host for doc content).
- [ ] At least one working end-to-end tour exists in `tour-manifest.json`, and its steps resolve to real doc anchors and/or real UI routes — none dangling.
- [ ] Every section marked `audience_visibility: in-app` contains nothing that fails the internal/external filter in `06-IN-APP-PUBLISHING-SPEC.md` §3 (no raw Rust paths, no security-sensitive detail, no internal-only jargon left unexplained).

---

## 4. Required header for every generated file

```markdown
---
id: <stable slug-safe ID, minted once, never changed — see 06-IN-APP-PUBLISHING-SPEC.md §1>
slug: <URL segment used for the in-app route, e.g. "architecture">
nav_order: <integer, controls sidebar position within its section>
title: <Document Title>
generated_by: doc-gen-pack v2
generated_at: <ISO 8601 timestamp>
source_commit: <git rev-parse HEAD, if available, else "unknown">
audience: [<list from AUDIENCE-MAP.md>]
audience_visibility: internal-only | in-app | both
status: draft | verified
---
```

`id` is the permanent handle everything else points to (manifest, search index, tour steps, other docs' cross-links). `slug` may cosmetically change if the app's URL scheme changes; `id` never does. See `06-IN-APP-PUBLISHING-SPEC.md` before minting either.

## 5. Tone and writing rules

- Prose sections: plain, declarative, no marketing fluff in technical docs. Marketing/vision voice is reserved *only* for `CONCEPTUAL-DESIGN.md` and the top of `PRODUCT-DESCRIPTION.md`.
- Use tables for anything enumerable (params, env vars, columns, flags).
- Every code/command example must be copy-pasteable and real — pull exact signatures from source, not paraphrased ones.
- Cross-link liberally, but **only** using manifest-slug routes (`/docs/<slug>#<anchor-id>`) once Phase G has run. Before Phase G, it's fine to draft with relative paths as a scratch convention, but nothing in that form ships — Phase G's job is explicitly to rewrite every one of them.
- For any content written for `audience_visibility: in-app`, write as if the reader has zero repo/code context — no bare file paths, no unexplained internal jargon. The internal-only version of the same fact can be more technical; keep both if they genuinely need to diverge (see `06-IN-APP-PUBLISHING-SPEC.md` §3).

Proceed to `01-DISCOVERY-PROTOCOL.md` now. After Phase F, do not stop — continue directly into Phases G and H (`06`, `07`, `08`) in the same run. A documentation suite that only a repo browser can read does not satisfy this pack's goal.
