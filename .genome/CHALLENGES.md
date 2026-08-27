# SOTA CHALLENGES — mandatory question sheet (gate G3)

> Generated 2026-08-27T03:51:42.203Z. The system forces these questions; **Pro answers every one**
> with: KEEP (user value) | REPLACE (cost/benefit + when) | RESEARCH (defer) | DROP — plus evidence.

## Part 1 — dependency currency (machine evidence)

- 4 packages behind latest major
- 0 deprecated packages
- 5 packages with no publish in 365+ days

- `alasql`: ^4.17.3 → latest 4.19.0
- `libp2p`: ^3.3.8 → latest 3.3.9
- `prisma`: ^6.19.3 → latest 8.0.0-rc.12
- `typescript-language-server`: ^5.3.0 → latest 6.0.0

### ABANDONWARE-RISK (>1y quiet)
- `cozo-node` last published 2023-12-11T09:18:09.575Z
- `mdast-util-gfm` last published 2025-02-10T12:33:52.269Z
- `micromark` last published 2025-02-27T14:04:03.516Z
- `micromark-extension-gfm` last published 2023-06-26T17:08:15.954Z
- `ulidx` last published 2024-08-25T18:44:04.012Z

## Part 2 — forced framework questions

### Q1
**Question:** Runtime: Bun 1.3.x vs Node 24 — for a Windows desktop sidecar in 2026, is Bun still the best user-value choice? Evidence: startup, compile, native API surface, packaging.

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q2
**Question:** ORMs: Prisma (+ 70 hand-written store impls) — is the dual layer (Prisma + manual stores) earning its complexity, or should one layer own persistence?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q3
**Question:** Provider access: CDP browser automation vs official/unofficial APIs — which maximizes user value for a local-first chat app (reliability, login friction, ToS risk)?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q4
**Question:** Frontend: Next.js static export — correct for Tauri v2, or is a lighter renderer better for install size and startup?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q5
**Question:** Search/embeddings: lexical catalog vs local embeddings — right trade for a single-user local app?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q6
**Question:** Desktop: Tauri v2 + sidecar — verified best, or does Electron edge matter? (user value: binary size, memory, maintenance)

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q7
**Question:** Testing: bun:test + biome — sufficient, or do we need vitest/jest/prettier parity?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q8
**Question:** Seeds-as-truth + DB-parser-logic + generated protocol — does this pattern still beat code-as-truth for user value (updatability, auditability)?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q9
**Question:** SQLite (2-DB split, WAL) vs alternatives — right for single-machine local-first?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___

### Q10
**Question:** TypeScript 7.0 adoption — when, and what breaks?

**Verdict:** ___ (KEEP / REPLACE / RESEARCH / DROP)
**Evidence:** ___
**User-value impact:** ___
