# PocketBase: Research Report
*Generated: 2026-07-23 | Sources: 8 | Confidence: High*

## Executive Summary

PocketBase is an open-source, single-file backend built in Go with an embedded SQLite database, realtime SSE subscriptions, built-in auth, admin dashboard, and REST-ish API. Latest release is v0.39.9 (July 22, 2026). It has 60.2k GitHub stars and is actively maintained. It supports both standalone usage (download binary, run) and Go framework usage. JavaScript extension via embedded ES5 engine (goja) is available. Official JS and Dart SDKs exist. Not yet v1.0 — backward compatibility not guaranteed.

## 1. Architecture & Core Features

### Single-Binary Architecture
- Entire backend compiles to one ~12MB executable ([Source](https://github.com/pocketbase/pocketbase))
- Embedded SQLite via pure-Go driver (modernc.org/sqlite) — no CGO required ([Source](https://pocketbase.io/docs/))
- Self-contained: DB, API server, admin UI, auth system all in one binary
- Portable: upload binary + `pb_data/` directory = complete backend

### Database
- SQLite embedded directly — no separate DB process
- Collections = tables with schema definitions managed through dashboard or API
- Supports relations (expand up to 6 levels deep), filters, sorting
- Batch operations (create/update/upsert/delete) in single transaction
- Raw SQL API available for superusers ([Source](https://pocketbase.io/docs/api-records/))

### REST-ish API
- Full CRUD for all collections: `GET/POST/PATCH/DELETE /api/collections/{name}/records`
- Pagination, filtering, field selection, relation expansion
- Filter syntax: ` OPERAND OPERATOR OPERAND` with `=`, `!=`, `>`, `>=`, `<`, `<=`, `~` (like), `!~`, plus `?` prefix for any-of matching ([Source](https://pocketbase.io/docs/api-records/))
- Batch API: `POST /api/batch` for transactional multi-record operations

### Auth System
- Built-in auth collections with password, OAuth2 (Google, GitHub, etc.), OTP, MFA
- JWT-based tokens with configurable duration
- Password reset, email verification, email change flows
- Superuser impersonation for admin use
- IP whitelist for superuser accounts ([Source](https://pocketbase.io/docs/going-to-production/))

### Realtime (SSE)
- Server-Sent Events for realtime subscriptions
- Subscribe to entire collection or individual record
- Events for create, update, delete operations
- Custom realtime messages via `$app.subscriptionsBroker()` ([Source](https://pocketbase.io/docs/api-realtime/))
- Auto-reconnect, 5-minute idle disconnect, client-side SDK handling

### Admin Dashboard
- Built-in web UI at `/_/` for managing collections, records, settings, logs, backups
- Collection schema editor, API preview, record management
- Log viewer, backup/restore, OAuth2 provider configuration

## 2. Extension Model

### Go Framework
- Import as Go library, build custom app with business logic
- Event hooks (before/after create, update, delete, auth, etc.)
- Custom routing, middleware, console commands
- Go migrations for schema changes
- Job scheduling, email sending, template rendering ([Source](https://pocketbase.io/docs/go-overview/))

### JavaScript (ES5 via goja)
- Embedded JS engine in prebuilt executable
- `pb_hooks/*.pb.js` files for custom server-side code
- Global objects: `$app`, `$apis`, `$os`, `$security`
- Event hooks, custom routes, middleware — same as Go but in JS
- 15-runtime prewarmed pool for performance ([Source](https://pocketbase.io/docs/js-overview/))
- **Limitations**: ES5 only (no ES6 modules natively), no `window`/`fs`/`fetch`/`buffer`, isolated handler contexts, CommonJS `require()` only

### Official SDKs
- **JavaScript** (Browser, Node.js, React Native): `pocketbase` npm package, 2.9k stars ([Source](https://github.com/pocketbase/js-sdk))
- **Dart** (Web, Mobile, Desktop, CLI): `pocketbase` Dart package
- TypeScript definitions included, typed generics for record models
- Auth store with LocalStorage, AsyncStorage, or custom implementation
- Auto-cancellation of duplicate requests, send hooks, SSR integration patterns

## 3. Production Readiness

### Deployment Options
- **Minimal**: Upload binary, run `./pocketbase serve domain.com` (auto Let's Encrypt)
- **Reverse proxy**: Behind NGINX/Caddy/Apache
- **Docker**: Community Dockerfiles, mount `pb_data` volume for persistence
- **Systemd**: Service file for auto-restart ([Source](https://pocketbase.io/docs/going-to-production/))

### Security Features
- Rate limiting (built-in, configurable from dashboard)
- Superuser IP whitelist (v0.38.0+)
- MFA/OTP for superusers
- Settings encryption via env var (`PB_ENCRYPTION_KEY`)
- CSP recommendations for frontend XSS prevention

### Backup
- Built-in backup API (dashboard or programmatically)
- Full ZIP snapshot of `pb_data/` directory
- S3-compatible backup storage
- For large datasets: `sqlite3 .backup` + rsync recommended

### Caveats (Pre-v1.0)
- **No backward compatibility guarantee** before v1.0.0 ([Source](https://pocketbase.io/docs/))
- Not recommended for production-critical applications unless willing to handle manual migrations
- Single-server architecture — no built-in clustering or replication
- SQLite write concurrency limits (single writer)

## 4. Comparison: PocketBase vs Current Stack (Prisma + SQLite)

| Aspect | PocketBase | Prisma + SQLite (current) |
|--------|-----------|--------------------------|
| **DB Engine** | SQLite (embedded) | SQLite (via Prisma) |
| **Schema Mgmt** | Dashboard UI + JS migrations | Prisma schema + migrate |
| **API Layer** | Built-in REST | Custom HTTP server (Bun) |
| **Auth** | Built-in (password, OAuth2, OTP, MFA) | Custom implementation |
| **Realtime** | Built-in SSE | Custom WebSocket |
| **Admin UI** | Built-in dashboard | None (would need custom) |
| **Extension** | Go or JS hooks | Full TypeScript/Bun |
| **Type Safety** | Dart/JS SDK with generics | Full TypeScript via Prisma client |
| **Single Binary** | Yes (~12MB) | No (Bun + deps) |
| **Pre-v1.0 Risk** | Yes | N/A (mature tools) |
| **Custom Logic** | Limited to Go/JS hooks | Unlimited (full TS runtime) |

## 5. Relevance to vivim-final

### Potential Use Cases
1. **Standalone backend replacement**: Replace Prisma + custom HTTP with PocketBase for quick prototyping
2. **Auth subsystem**: Use PocketBase for auth only, keep custom engines
3. **Realtime layer**: Leverage SSE subscriptions for conversation streaming
4. **Admin dashboard**: Quick collection/record management without building custom admin UI
5. **Data portability**: Single-file backup/restore for development environments

### Limitations for This Project
- **54 Prisma models** with complex relations — PocketBase collections are simpler
- **13 engines** with deep business logic — PocketBase hooks are limited (ES5 JS or Go)
- **Stream parsing**, **Chrome CDP integration**, **capability resolution** — too complex for PocketBase hooks
- **Pre-v1.0** — not suitable for a project already in production-like state
- **Single-server** — no clustering for the Chrome fleet management

### Verdict
PocketBase is excellent for **new, simpler projects** needing a quick backend with auth, realtime, and admin UI. For vivim-final's complex multi-engine architecture with 54 models and deep TypeScript business logic, it would be a **regression** — replacing a flexible full-stack setup with a constrained hook-based system. The Prisma + Bun + custom HTTP stack is the right choice for this project's complexity level.

However, PocketBase patterns (SSE subscriptions, filter syntax, batch operations, auth flows) are **worth studying** for improving vivim-final's own API design.

## Key Takeaways
- PocketBase is production-grade for simple backends (auth + CRUD + realtime + admin)
- 60.2k stars, active development, v0.39.9 as of July 2026
- JS extension is ES5-only (goja engine) — no modern JS/TS in hooks
- Pre-v1.0: backward compatibility not guaranteed
- Not a fit for vivim-final's complex architecture, but patterns are instructive

## Sources
1. [PocketBase GitHub](https://github.com/pocketbase/pocketbase) — 60.2k stars, Go backend, MIT license
2. [PocketBase Docs - Introduction](https://pocketbase.io/docs/) — Core features, single-binary architecture
3. [PocketBase Docs - JS Overview](https://pocketbase.io/docs/js-overview/) — ES5 engine, hooks, limitations
4. [PocketBase Docs - API Records](https://pocketbase.io/docs/api-records/) — CRUD, filtering, batch, auth
5. [PocketBase Docs - API Realtime](https://pocketbase.io/docs/api-realtime/) — SSE subscriptions
6. [PocketBase Docs - Going to Production](https://pocketbase.io/docs/going-to-production/) — Deployment, security, backup
7. [PocketBase JS SDK](https://github.com/pocketbase/js-sdk) — 2.9k stars, TypeScript, SSR patterns
8. [PocketBase Docs - JS Realtime](https://pocketbase.io/docs/js-realtime/) — Custom realtime messaging

## Methodology
Searched 4 queries across official docs and GitHub. Analyzed 8 sources. Deep-read full docs for architecture, JS extension, API reference, production guide, and JS SDK.
