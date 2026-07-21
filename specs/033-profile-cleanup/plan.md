# Implementation Plan: One Logged-In Profile Per Provider + Account

**Branch**: `033-profile-cleanup` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/033-profile-cleanup/spec.md`

## Summary

Enforce the invariant: for every (providerSlug, accountId) exactly one profile directory
exists under `chrome-profiles/<provider>/<account>/`, and it is the authenticated one.
Delivered as a `devops profiles cleanup` command backed by extensions to the existing
`ProfileAllocator`, plus a sync layer with `ChromeSetupWizard` so new-account setup and
cleanup never create duplicates or disagree on "logged in". Design-only deliverables in
this plan phase are `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: existing `ProfileAllocator` (`src/executor/profile-allocator.ts`), `CapStoreDb` (`src/storage/db.ts`), `ChromeSetupWizard` (`src/engines/chrome-setup-wizard.ts`), Prisma v6.5
**Storage**: SQLite via Prisma (`provider_account` table, `prisma/schema.prisma:232`)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Backend/devops tooling (no new engine surface, no frontend)
**Linter/Formatter**: Biome

**Constraints**:
- Governor Canon: cleanup touches no CDP; it only inspects `Cookies` files + `ProviderAccount` rows.
- One Entry Point: delivered as a `devops` CLI command (operator maintenance), consistent with existing `devops agentic adopt`/`setup` — NOT a `UnifiedCapability`.
- Profile dir (cookies), not DB row, is source of truth for "logged in" (AGENTS.md:131).

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: cleanup reads filesystem + DB only; never imports `BunCdpClient`.
- [x] Store Contracts: DB writes go through `CapStoreDb.prisma` (existing impl), not raw SQL.
- [x] One Entry Point: operator command, not a capability — matches `devops agentic adopt`.
- [x] Custom errors: reuse `EngineError` from `src/errors.ts`.
- [x] TypeScript strict: no `any`; `type` imports; `.js` extensions in imports.
- [x] Tests: unit (grouping/dedupe logic) + integration (with mock live slave + DB).

## Project Structure (design artifacts)

```text
specs/033-profile-cleanup/
├── plan.md              # This file
├── spec.md              # Feature spec (filled)
├── research.md          # Phase 0 — code-grounded decisions (incl. wizard sync)
├── data-model.md        # Phase 1 — ProfileRecord/Group/Plan/Result + wizard integration
├── quickstart.md        # Phase 1 — runnable validation scenarios
└── contracts/
    ├── cleanup-cli.md    # devops profiles cleanup CLI + allocator + DB reconcile
    └── wizard-sync.md    # ChromeSetupWizard ↔ cleanup cooperation contract
```

### Source changes (implementation phase, out of scope for design)

```text
src/executor/profile-allocator.ts      # + canonicalPath, groupByProviderAccount, findStrayRoots,
                                        #   isLiveSlave, plan(), enforce()
devops/index.ts                        # + `profiles cleanup` subcommand (alongside setup/adopt)
src/engines/chrome-setup-wizard.ts     # + findExisting (adopt), isAuthenticated in needsSetup,
                                        #   single-isDefault on save
```

## Complexity Tracking

> No constitution violations. Design is additive (extensions to `ProfileAllocator` + one devops subcommand + wizard tweaks). No new engine surface, no schema migration required (`provider_account` already has `profileDir`/`loginState`/`isDefault`/`debugPort`).
