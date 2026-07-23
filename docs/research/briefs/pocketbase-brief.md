# PocketBase — Brief

**Source:** [full report](../reports/pocketbase-sota-2026.md)
**Confidence:** High | **Sources:** 8 | **Date:** 2026-07-23

## TL;DR

PocketBase is a single-binary Go backend with embedded SQLite, built-in auth (password/OAuth2/OTP/MFA), SSE realtime subscriptions, admin dashboard, and REST API. Latest v0.39.9 (July 2026), 60.2k GitHub stars. Pre-v1.0 — no backward compatibility guarantee. Excellent for simple backends; not suitable for vivim-final's complex 13-engine architecture.

## Key Decisions

1. **Not a fit for vivim-final** — 54 Prisma models, 13 engines, deep TypeScript logic exceed PocketBase's hook-based extension model (ES5 JS or Go only)
2. **Worth studying** — SSE subscription pattern, filter syntax, batch operations, and auth flows are good API design references
3. **Good for new simple projects** — if starting fresh with auth + CRUD + realtime + admin, PocketBase eliminates significant boilerplate

## Evidence Summary

- **Architecture**: Single ~12MB binary, embedded SQLite (modernc.org/sqlite, pure Go, no CGO) ([pocketbase.io/docs](https://pocketbase.io/docs/))
- **JS Extension**: ES5-only via goja engine, isolated handler contexts, no modern JS/TS ([pocketbase.io/docs/js-overview](https://pocketbase.io/docs/js-overview/))
- **Realtime**: SSE-based, subscribe to collection or record, custom messages via broker ([pocketbase.io/docs/api-realtime](https://pocketbase.io/docs/api-realtime/))
- **Auth**: Password, OAuth2, OTP, MFA, JWT, IP whitelist, impersonation ([pocketbase.io/docs/going-to-production](https://pocketbase.io/docs/going-to-production/))
- **API**: REST with filter syntax, batch operations, field selection, 6-level relation expansion ([pocketbase.io/docs/api-records](https://pocketbase.io/docs/api-records/))
- **SDKs**: JS (2.9k stars, TypeScript) + Dart official SDKs ([github.com/pocketbase/js-sdk](https://github.com/pocketbase/js-sdk))

## Open Questions

- When will PocketBase reach v1.0? (Active development, 280 releases as of July 2026)
- How does SQLite write concurrency perform under high load? (Single-writer limitation)
- Could PocketBase serve as a lightweight sidecar for auth-only in a microservice architecture?

## Used In
- General research (not linked to specific unit or ADR)
