# DevOps Module

**Purpose:** Development operations, build automation, and testing infrastructure.

## Description
Contains scripts and tooling for:
- Tauri desktop builds (`scripts/tauri/`)
- Desktop testing and validation (`devops/desktop/`)
- Provider onboarding (`devops/onboard-controller.ts`)
- General dev operations scripts

## Public Interface
- Desktop loop: `bun run devops desktop-loop <action>` (15 actions)
- Provider onboarding: 8-phase pipeline (discover → converge)
- Build scripts: `build.ps1`, `build-sidecar.ps1`, `prepare-frontend.ts`

## Internal Gotchas
- Desktop loop uses hash-gated rebuilds (fingerprint: `dist/build-hashes.json`)
- PowerShell object pipeline bug: always use Bun scripts for JSON API data
- Provider tests require Playwright and CDP browser attachment
- Version management via `scripts/tauri/version.ts` (single source of truth)

## Owner: VIVIM.inc
## Last Reviewed: 2026-08-15