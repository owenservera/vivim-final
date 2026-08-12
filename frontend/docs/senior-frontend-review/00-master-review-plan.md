# Senior Frontend Architecture Review & Multi-Stage Execution Framework

**Workspace:** `frontend` (`c:\0-BlackBoxProject-0\vivim-final\frontend`)  
**Target Audience:** Engineering Leads & Implementation Developers  
**Execution Constraint:** All reports contain **verbatim copy-pasteable implementation specifications** with zero pseudocode or missing lines.

---

## 1. Executive Summary

The `frontend` workspace is a canvas-first, hot-swappable UI framework built with Next.js 16 (App Router), React 19, Radix UI, Tailwind CSS, and Bun. It is designed to run in dual execution modes:
1. **Standalone Server Mode:** Next.js `output: "standalone"` serving dynamic API routes, proxying to backend services, and handling dynamic UI configurations.
2. **Static Export / Tauri Mode:** Next.js `output: "export"` compiled to static assets (`out/`) bundled into the Tauri V2 NSIS desktop shell (`vivim-desktop.exe`).

This review was commissioned to perform a rigorous, code-first audit across all dimensions of the frontend architecture. Due to the scope and depth required, the audit is structured into 5 distinct, sequential stages.

---

## 2. Multi-Stage Review Roadmap

| Stage | Report Document | Scope & Focus | Key Deliverables | Status |
|---|---|---|---|---|
| **Stage 1** | `stage-1-architecture-and-foundation.md` | Dual-mode Next.js config, TypeScript strictness, Prisma schema divergence, App Router entry point bugs. | Verbatim diffs for `next.config.mjs`, `app/page.tsx`, `tsconfig.json`, `prisma-onboarding-store.ts`. | **Completed** |
| **Stage 2** | `stage-2-engines-state-and-sdk.md` | Audit of 30 frontend engines, Zustand / SessionState hydration, API proxy routing vs local endpoints, SDK hooks error handling. | Engine lifecycle fixes, Zustand SSR hydration safeguards, SDK hook timeout/error wrappers. | **Completed** |
| **Stage 3** | `stage-3-ui-canvas-and-design-system.md` | LivingCanvas slot mounter, DrawerSystem, Radix UI primitive composition, CSS custom properties & dark mode FOUC, accessibility (a11y). | Slot bounds math fixes, theme script optimizations, keyboard navigation refactors. | **Completed** |
| **Stage 4** | **`stage-4-performance-bundle-and-tauri.md`** | Static export build efficiency, bundle splitting, lazy loading (`DevConsole`), image unoptimization, asset paths. | Tauri export patches, dynamic import barriers, asset path resolver. | **Completed** |
| **Stage 5** | **`stage-5-security-rbac-and-test-suite.md`** | RBAC permission evaluation, ErrorBoundary fallbacks, Bun test runner integration, route-sync suite, Playwright E2E. | RBAC guard hooks, error fallback UI components, test suite updates. | **Completed** |

---

## 3. Verbatim Implementation Protocol

Readers and implementers of these reports must adhere to the following execution rules:
1. **Zero Interpretation Needed:** Every recommendation is accompanied by exact target file paths, line numbers, and a complete code block or Git diff.
2. **Copy-Paste Verbatim:** Implementers must apply the specified changes directly without adding placeholder logic or modifying function signatures unless directed.
3. **Verification Step:** After applying changes for a stage, run the corresponding automated test or build verification command specified in that stage's report.
