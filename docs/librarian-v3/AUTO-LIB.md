# AUTO-LIB.md — LIVIN-LIB Operator Manual (One Page)

> Quick reference for running the new automated documentation-knowledge-graph system.

---

## Commands

```bash
# 1. Discover source truth (Phase A automation)
bun run docs:discover
# → writes .runtime/docs-inventory.json

# 2. Generate docs (Phase B-E automation)
bun run docs:generate
# → writes docs/product/, docs/architecture/, docs/interfaces/, docs/extensibility/

# 3. Verify everything (Phase F automation)
bun run docs:verify
# → exits 0 (clean) or 1 (errors in .runtime/docs-verify-report.json)

# 4. Publish manifests + viewer (Phase G-H automation)
bun run docs:publish
# → updates docs/docs-manifest.json, docs/search-index.json, docs/tour-manifest.json
# → rebuilds frontend/src/app/docs/ viewer components

# 5. Full one-shot pipeline
bun run docs:all
# → discover → generate → verify → publish (fails fast on any error)

# 6. Live dev mode (watch + hot rebuild docs viewer)
bun run docs:live
# → watches src/, prisma/, docs/; regenerates on change; reports verify errors in terminal
```

---

## Key Differences from v2 Librarian

| v2 Action | v3 Replacement | Why Better |
|---|---|---|
| Read `docs/librarian/` manually | Read `DESIGN.md` + `AUTO-LIB.md` | Design is machine-readable; automation is scripted |
| Manual Phase A (inventory checklist) | `docs:discover` (AST parsing) | <5s, reproducible, no agent required |
| Manual Phase B (product docs) | `docs:generate` (template engine + capability registry) | Auto-linked to `UnifiedCapability` definitions |
| Manual Phase G (`docs-manifest.json`) | `docs:publish` (manifest generator) | Manifest rebuilt from `.ids-registry.json`; links never break |
| Manual Phase H (`tour-manifest.json`) | `docs:publish` (tour generator) | Tour steps derived from capability execution paths |
| Manual quality audit (`05`) | `docs:verify` (`verify-docs.ts`) | Automated, exits non-zero on failure |
| No sync with code changes | `.lefthook` pre-commit hook (`docs:verify`) + CI gate (`docs:all`) | Docs never drift from source |

---

## File Reference

| File | Purpose |
|---|---|
| `docs/librarian-v3/DESIGN.md` | Full architecture, lifecycle, improvement metrics |
| `docs/librarian-v3/AUTO-LIB.md` | This file |
| `docs/librarian-v3/scripts/auto-discover.ts` | Discovery engine |
| `docs/librarian-v3/scripts/generate-docs.ts` | Template engine |
| `docs/librarian-v3/scripts/generate-manifest.ts` | Manifest builder |
| `docs/librarian-v3/scripts/generate-viewer.ts` | Next.js viewer scaffolder |
| `docs/librarian-v3/scripts/generate-tour.ts` | Tour builder |
| `docs/librarian-v3/scripts/verify-docs.ts` | Audit engine |

---

## Integration Points

- **`devops/` CLI**: `docs:discover`, `docs:generate`, `docs:verify`, `docs:publish`, `docs:live`, `docs:all` are available as `bun run devops docs:discover` if `devops/cli.ts` is updated.
- **`.lefthook`**: Add to `.lefthook/pre-commit`:
  ```
  docs-verify:
    files: git diff --cached --name-only | grep -E 'src/|prisma/|docs/'
    run: bun run docs:verify
  ```
- **CI (`.github/workflows/`)**: Add `bun run docs:all` as a required check.
- **Desktop build (`scripts/tauri/build.ps1`)**: `docs:publish` ensures the viewer is rebuilt into the Tauri bundle; no external network dependency.

---

## Status

- [x] Design complete (`DESIGN.md`)
- [x] Operator manual (this file)
- [ ] Starter script (`auto-discover.ts`)
- [ ] Template engine (`generate-docs.ts`)
- [ ] Manifest generator (`generate-manifest.ts`)
- [ ] Viewer scaffolder (`generate-viewer.ts`)
- [ ] Tour generator (`generate-tour.ts`)
- [ ] Verify engine (`verify-docs.ts`)
- [ ] `.ids-registry.json` seed
- [ ] `MANIFEST-SPEC.md`

---

## Open Design Questions (Need User Input)

1. **Scope of scripts**: Should I create all 6 scripts, or start with just `auto-discover.ts` + `verify-docs.ts`?
2. **Capability registry source**: Does `generate-docs.ts` read from `src/engines/*caps.ts`, a DB table (`CapabilityBinding`), or both?
3. **Viewer target**: `frontend/src/app/docs/` (Next.js App Router) or a separate `docs/` static export?
4. **Live server port**: Should `docs:live` reuse the existing dev server (`9420`) or run independently on `9401`?
5. **Hook placement**: Modify `.lefthook/pre-commit` directly, or add `docs:verify` as a separate CI-only step?
6. **Back-compat with v2**: Should `generate-docs.ts` overwrite existing `docs/librarian/` output files, or create a new `docs/generated-v3/` directory to preserve v2 work?
