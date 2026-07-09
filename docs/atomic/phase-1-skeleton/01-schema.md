# Unit 1.1: Prisma Schema

**Phase:** 1 | **File:** `prisma/schema.prisma`
**Depends:** — | **Produces:** `prisma/dev.db`, Prisma client types

## Summary
Define all 54 tables, relations, indexes, and defaults in Prisma schema format.
SQLite datasource. Foreign keys with cascading deletes. All IDs are TEXT (ULID).
Timestamps are INTEGER (epoch ms). Booleans are Int (0/1).

## Prisma Datasource
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

## Layer Breakdown
- **L0:** SchemaMeta, MigrationLog
- **L1:** ProviderDefinition, ProviderEndpoint, ProviderParser, ProviderCapability, ProviderConfig, ProviderModel, ProviderAccount
- **L2:** TraceEntry
- **L3:** CapabilityTaxonomy, CapabilityTier, CapabilityBinding, CapabilityProgram, SelectorStrategy, Outcome
- **L4:** VivimSession, ProviderSession, ProfileSession, Conversation, ConversationMessage, StateTransition, SessionCheckpoint, StreamBlock
- **L5:** ProviderManifestVersion, RegistrationEvent, ManifestDrift
- **L6:** CapabilityTaxonomyVersion, BindingStatusLog, ProgramVersionMetric
- **L7:** ProviderHealthHistory, CapabilityTelemetry, SelectorHealthHistory, TelemetrySummaryDaily, ManifestChangeLog, TelemetryCycleLog
- **L8:** ConfigEntry, ConfigAudit
- **L9:** HarnessCheckpoint, CapabilityMacro
- **L10:** McpServerConfig
- **L11:** HealthTick, CircuitBreakerState, DriftEvent, FleetEvent, ProviderHealth, AutomationSchedule, AutomationRun, AlertCondition, AlertEvent, RouteSpec, RouteRequest, RouteTarget, RouteEvent
- **L12:** TransferPattern, TransferCandidate, TransferAttempt, LearningEvent, Rule, BindingEvent, FailureClassification
- **L13:** TestRun

## Key Rules
- Use `@map()` to map camelCase Prisma fields to snake_case DB columns
- Use `@@map()` for table name mapping
- Self-referential relations need explicit relation names (e.g., ProviderParser fallback)
- All nullable fields should use `?`
- Indexes via `@@index()`, unique constraints via `@unique` or `@@unique`

## Gate
- `bunx prisma generate` succeeds
- `bunx prisma db push` creates dev.db with all 54 tables
- No validation errors

## Reference
Full table definitions in `docs/merged-design-v2/03-merged-schema.md`.
