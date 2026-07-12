> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-07: Reliability & Persistence

**Phase:** 7 | **Units:** 7 | **Goal:** System survives restarts, handles concurrent access, and retries intelligently

## Design Principle: Policy-Driven, Not Hardcoded

Every reliability mechanism is a **configurable policy object** loaded from DB. Policies can be updated at runtime without code changes or restarts.

```typescript
// Every policy follows this pattern:
interface Policy {
  id: string
  version: number
  config: Record<string, unknown>  // Zod-validated
  active: boolean
}
```

## Problem

7 reliability gaps that cause data loss, race conditions, or silent failures:

| # | Gap | Impact |
|---|---|---|
| 14 | Fleet state in-memory only | Server restart kills all tracked Chrome instances |
| 15 | PortReaper kills instead of adopts | Valid Chrome sessions destroyed on restart |
| 16 | No conversation locking | Concurrent sends to same conversation corrupt state |
| 17 | No double-send protection | Network retry causes duplicate messages |
| 18 | No graceful Chrome shutdown | SIGTERM leaves zombie Chrome processes |
| 19 | No SQLite WAL mode | Write lock contention under load |
| 20 | No retry with backoff | Transient failures cause permanent errors |

## Units

| Unit | Title | Policy Object |
|------|-------|---------------|
| 7.1 | Fleet state persistence | `FleetPersistencePolicy` |
| 7.2 | PortReaper adopt-on-restart | `AdoptionPolicy` |
| 7.3 | Conversation locking | `LockPolicy` |
| 7.4 | Double-send protection | `IdempotencyPolicy` |
| 7.5 | Graceful Chrome shutdown | `ShutdownPolicy` |
| 7.6 | SQLite WAL mode | `DbPragmaPolicy` |
| 7.7 | Retry policy engine | `RetryPolicy` |

