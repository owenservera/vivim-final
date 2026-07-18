# Database Schema

## Schema Location
`prisma/schema.prisma`

## Provider Tables (Phase 2)
- `Provider` — Base provider record
- `ProviderEndpoint` — API endpoints with `selectorsJson`
- `ProviderCapability` — Capability definitions
- `SelectorStrategy` — Selector resolution strategies

## Governor Tables (Phase 3)
- `Slave` — Chrome slave instances
- `SlaveState` — State transitions
- `HealthHistory` — Health check records
- `Conversation` — Chat sessions
- `Message` — Individual messages
- `StreamBlock` — Content blocks

## Engine Tables (Phase 4+)
- `HarnessCheckpoint` — Automation checkpoints
- `CapabilityMacro` — Reusable macro definitions
- `StateTransition` — System state log

## SOTA Tables (Phases 7-10)
- `MirrorState` — UI sync state
- `Workflow` — DAG workflows
- `MemoryEpisode` — Episodic memories
- `MemorySemantic` — Semantic memories
- `Synthesis` — Cross-conversation results

## Scripts
- Dev DB: `.env` → `DATABASE_URL="file:./dev.db"`
- Seed: `bunx prisma db seed`
- Migrate: `bunx prisma migrate dev`