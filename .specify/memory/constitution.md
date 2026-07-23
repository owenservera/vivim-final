# Constitution — vivim-final

**Purpose:** Non-negotiable architectural invariants that every feature plan must satisfy.

---

## A. Invariants (from `docs/roadmap/INVARIANTS.md`)

| ID | Category | Rule | Status |
|----|----------|------|--------|
| B1 | Boundary | **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`. | ACTIVE |
| B2 | Boundary | **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`. | ACTIVE |
| B5 | Boundary | **Config Authority:** `ConfigManager` is the single source of truth for runtime configuration. | ACTIVE |
| B6 | Boundary | **Server-Side Harness:** `HarnessRuntime` executes server-side only. No client-side harness execution. | ACTIVE |
| B8 | Boundary | **Agent-Addressable UI Actions:** Every capability exposed via CLI must also be addressable via UI. | ACTIVE |
| B10 | Boundary | **HITL Gate:** Human-in-the-loop confirmation required for destructive operations. | ACTIVE |
| P1 | Vision | **Data is the API:** All layers are data, not code. HTML/CSS/scriptUrl stored in DB. | ACTIVE |
| P2 | Vision | **Shell is Dumb:** The shell is pure HTML. No provider conditionals, no hardcoded tool registries. | ACTIVE |
| P3 | Vision | **On-Demand Layers:** Canvas spawns layers when needed, not all at once. | ACTIVE |
| P5 | Vision | **Single Capability Plane:** Every op is a UnifiedCapability (CLI + UI + MCP + API). | ACTIVE |
| P8 | Vision | **Sandboxed Layers:** Iframe sandbox with CSP, watchdog, capability allow-list. | ACTIVE |
| P9 | Vision | **Design from Within:** The canvas can modify itself via the designer layer. | ACTIVE |

## B. Code Conventions

- **Runtime:** Bun
- **Language:** TypeScript (strict mode, ESNext target)
- **ORM:** Prisma v6.5
- **Linter/Formatter:** Biome
- **ID format:** ULID (from `src/ids.ts`)
- **Path aliases:** `@/*` maps to `./src/*`
- **Imports:** Use `.js` extension in ESM imports
- **No `any`:** Use `unknown` + type narrowing
- **Zod** for runtime validation at boundaries

## C. Testing Requirements

- Unit tests: `tests/unit/` — test individual functions
- Integration tests: `tests/integration/` — test engine interactions
- E2E tests: `tests/e2e/` — full stack tests
- Mock store contracts for isolation tests
- Aim for 80%+ coverage on engines

## D. Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
- Reference engine names in commits

## E. Frontend Conventions

- **Design system:** CSS variables (`var(--bg)`, `var(--text)`, `var(--border)`, `var(--accent)`)
- **FRONTEND = BACKEND:** Capability `slug` is the single link
- **No provider conditionals** in UI code
- **Backend:** `http://localhost:9420`, WebSocket `ws://localhost:9420/ws`

## F. Canvas-Specific Invariants

- The shell is pure HTML (P2); layers are data, not code
- Every canvas op is a UnifiedCapability (P5)
- On-demand spawning (P3); no always-on requirement
- Sandboxed iframes with CSP + watchdog (P8)
- Oracle visibility (P4/P9) — the canvas can observe itself
- Designer layer (P9) — the canvas can modify itself
