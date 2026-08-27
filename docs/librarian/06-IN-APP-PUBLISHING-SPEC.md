# 06 — IN-APP PUBLISHING SPEC
### Generates: docs-manifest.json, search-index.json, .ids-registry.json, and retrofits every Phase B–F file

This is the file that turns "a folder of Markdown" into "a wiki the app can serve." Read this before writing your first heading in Phase B, not just when you arrive at Phase G — the ID discipline has to be applied from the start or you'll be retrofitting hundreds of anchors later.

---

## 1. Stable ID scheme

### 1.1 Why this exists
An in-app tooltip, a "Learn more" link, or a tour step will hard-code a reference like `docId: "architecture", anchor: "trust-boundaries"`. If a later regeneration reworks that heading's wording and the anchor is derived from text, the link silently 404s inside the running app — with no build error to catch it. That failure mode is unacceptable for a shipped product surface. IDs solve this by being **assigned once and never regenerated from text**.

### 1.2 The registry
`docs/.ids-registry.json` is the single source of truth for every ID ever minted:

```json
{
  "docs": {
    "architecture": { "id": "architecture", "first_seen": "2026-08-26T00:00:00Z", "title_history": ["Architecture"] }
  },
  "sections": {
    "architecture:trust-boundaries": { "id": "trust-boundaries", "doc": "architecture", "first_seen": "...", "title_history": ["Trust Boundaries"] }
  }
}
```

### 1.3 Rules for every run (including the very first)
- Before minting a new ID for a doc or section, check the registry for an existing entry whose **content**, not heading text, matches (same subsystem, same table, same command). If the underlying thing already has an ID, reuse it even if you're rewording the heading.
- If you rename a heading, append the old title to `title_history` and keep the `id` unchanged.
- Never delete a registry entry, even if the underlying doc/section is removed — mark it `"status": "removed"` so old links can render a graceful "this moved/was removed" page instead of a raw 404.
- New content gets a new kebab-case ID scoped to its doc (`doc-id:section-id`), generated from the *first* wording, and locked forever after.
- Every H2 and H3 heading in every generated Markdown file must render its anchor explicitly, not rely on the renderer's auto-slug:
  ```markdown
  ## Trust Boundaries {#trust-boundaries}
  ```

## 2. `docs/docs-manifest.json` schema

```json
{
  "generated_at": "ISO 8601",
  "source_commit": "abc1234",
  "docs": [
    {
      "id": "architecture",
      "slug": "architecture",
      "title": "Architecture",
      "category": "architecture",
      "file": "architecture/ARCHITECTURE.md",
      "audience": ["engineer", "devops"],
      "audience_visibility": "both",
      "nav_order": 10,
      "sections": [
        { "id": "trust-boundaries", "title": "Trust Boundaries", "anchor": "trust-boundaries", "audience_visibility": "internal-only" }
      ],
      "diagrams": [
        { "id": "container-diagram", "type": "mermaid", "anchor": "container-diagram", "title": "Container Diagram" }
      ]
    }
  ]
}
```

Rules:
- One entry per file in the `docs/` tree from Phases B–E, plus the index/audience files from Phase F.
- `sections[]` must include every H2/H3 in the file, in document order.
- `diagrams[]` must include every Mermaid block, with its own ID distinct from its parent section's ID (a section can contain more than one diagram).
- This file must be valid, parseable JSON — verify by mentally tracing every bracket/comma before finalizing. A broken manifest breaks the entire in-app wiki, not just one page.

## 3. Visibility filtering (internal vs. in-app)

Every doc, and optionally individual sections within it, carries `audience_visibility`:
- `internal-only` — repo/dev-facing detail (raw file paths, Rust module names, security implementation notes, TODOs). Never surfaced in the in-app viewer.
- `in-app` — written for the end user browsing the wiki inside the running app. No bare paths, no unexplained jargon, no internal architecture detail that doesn't help someone use the product.
- `both` — safe and useful for either audience as-is.

Concretely:
- `FEATURE-LIST.md`, `PRODUCT-DESCRIPTION.md`, `CONCEPTUAL-DESIGN.md`: default `both`, written for `in-app` from the start (this matches what v1 already did — no change needed here).
- `ARCHITECTURE.md`, `DATA-FLOW.md`, `DATA-MODEL.md`, `API-REFERENCE.md`, `CLI-REFERENCE.md`, `IO-REFERENCE.md`: default `internal-only` **unless** a specific section is genuinely useful to an end user (e.g. "what data does this app store locally" is legitimate end-user content even though it lives in `DATA-MODEL.md`). Mark those specific sections `in-app` explicitly rather than flipping the whole file.
- When a section is `in-app` but its natural phrasing in the technical doc is too code-heavy, do not force one paragraph to serve both audiences. Write a short `in-app`-tagged subsection in plain language and let the detailed version stay `internal-only` directly below it. Cross-reference them to each other.
- The manifest and search index must both respect this flag: the in-app viewer (`07`) only ever queries entries where `audience_visibility` is `in-app` or `both`. The full manifest still exists for repo-side tooling/CI that wants everything.

## 4. `docs/search-index.json` schema

Flat array, one entry per section (not per doc), filtered to `in-app`/`both` visibility only — this is what ships to the client:

```json
[
  {
    "docId": "feature-list",
    "sectionId": "data-management",
    "title": "Data Management",
    "route": "/docs/feature-list#data-management",
    "snippet": "First ~200 chars of plain-text content, stripped of Markdown syntax",
    "keywords": ["projects", "save", "export"]
  }
]
```
`keywords` are a handful of terms a real user might type that aren't literally in the title (synonyms, feature names, UI labels) — pull these from the actual UI copy found in discovery so search matches what users see on screen, not just internal terminology.

## 5. Link rewriting pass (end of Phase G)

Scan every generated Markdown file for any remaining relative-path link (`](../architecture/ARCHITECTURE.md)`, `](./DATA-MODEL.md#tables)`, etc.) and rewrite to `](/docs/<slug>#<anchor-id>)` using the manifest as the lookup table. Zero relative `.md` links may remain — this is checked explicitly in the Phase F/quality-gate audit (see `00-ORCHESTRATOR.md` §3).
