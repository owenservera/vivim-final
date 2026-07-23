# Croc File Transfer Integration — Full Recommendations Report

**Project:** vivim-final  
**Date:** 2026-07-23  
**Status:** Proposal — Team Review Required  
**Author:** Research Agent  

---

## Executive Summary

vivim-final is currently a single-machine system. Every provider configuration, parser, Chrome profile, conversation, and knowledge graph node exists in one local database. This creates three critical failures:

1. **No team collaboration** — Team members cannot share provider onboarding work, parser reverse-engineering, or authenticated browser sessions.
2. **No disaster recovery** — Machine failure = total data loss. No backup mechanism exists.
3. **No multi-device workflow** — Developers cannot switch between machines without manual file copying.

**Recommendation:** Integrate [Croc](https://github.com/schollz/croc) (Go-based, PAKE-encrypted, self-hostable file transfer) via CLI wrapper to enable encrypted, peer-to-peer workspace synchronization across all vivim artifacts.

**Investment:** 20 days (phased over 3 milestones)  
**Return:** Team collaboration, disaster recovery, multi-device workflow, provider onboarding acceleration

---

## 1. Problem Statement

### 1.1 Current State

| Artifact | Location | Shareable? | Backup? |
|----------|----------|------------|---------|
| Provider manifests | `seeds/providers/*.json` | Manual copy | No |
| Parser logic | DB `parser_logic_code` | Manual export | No |
| Chrome profiles | `chrome-profiles/<provider>/<account>/` | Manual copy | No |
| Conversations | DB (SQLite) | No | No |
| Knowledge graph | DB (Node, NodeEdge) | No | No |
| Capability bindings | DB (CapabilityBinding) | No | No |
| Harness commands | DB + `seeds/harness/` | Manual copy | No |
| NL patterns | `src/engines/nlcl/catalog.ts` | Git only | No |
| Test fixtures | `tests/fixtures/*.db` | Manual copy | No |
| Health telemetry | DB (TelemetryRow) | No | No |

### 1.2 Failure Modes

| Scenario | Impact | Current Recovery |
|----------|--------|------------------|
| Machine disk failure | Total data loss | None |
| Developer onboarded new provider | Team must redo work | Manual seed file sharing |
| Parser reverse-engineered | Others must rediscover | Verbal/documented only |
| Chrome profile rate-limited | No backup authenticated session | Manual profile creation |
| Conversation bug report | Cannot reproduce locally | None |
| New team member setup | Full rebuild from scratch | Days of manual setup |

### 1.3 Why Croc

| Criterion | Croc | rsync | Syncthing | Magic Wormhole |
|-----------|------|-------|-----------|----------------|
| Self-host relay | ✅ Docker | N/A | N/A | ✅ |
| No config required | ✅ | ❌ | ❌ | ✅ |
| Resume support | ✅ | ✅ | ✅ | ❌ |
| E2E encryption | ✅ PAKE | SSH | TLS | ✅ PAKE |
| Cross-platform | ✅ | ✅ | ✅ | ✅ |
| Speed (Go vs Python) | Fast | Fast | Fast | Medium |
| Works behind NAT | ✅ relay | ❌ | ✅ | ✅ relay |
| GitHub stars | 37.7K | 12K | 60K | 13K |
| License | MIT | GPL3 | MPL2 | MIT |

**Decision:** Croc provides the best combination of zero-config, self-hostable relay, resume support, and E2E encryption for vivim's team workspace needs.

---

## 2. Use Cases

### 2.1 Category: Provider System

#### UC-1: Parser Distribution
**Problem:** Parser reverse-engineered on one machine must be manually recreated on others.  
**Flow:**
```
Dev A: reverse-engineers Gemini batchexecute format
  → croc send parser-gemini-003.croc
Dev B: croc recv <code>
  → parser row upserted into DB
  → available immediately
```
**Value:** Very High — eliminates hours of parser recreation  
**Effort:** 2 days

#### UC-2: Provider Onboarding Package
**Problem:** 8-phase onboarding (discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge) produces artifacts scattered across DB + files.  
**Flow:**
```
Dev A: completes onboarding for provider X
  → bundles: manifest + parsers + selectors + bindings + test results
  → croc send provider-x-onboard.croc
Dev B: croc recv <code>
  → full provider available, all tests pass
```
**Value:** Very High — onboarding once shares to entire team  
**Effort:** 2 days

#### UC-3: Provider Health Report Sharing
**Problem:** Health telemetry stays local. Team cannot correlate across instances.  
**Flow:**
```
Instance A: collects health telemetry
  → exports health report (last 24h)
  → croc send health-gemini-2026-07-23.croc
Team dashboard: croc recv <code>
  → aggregated health view
```
**Value:** Low — useful but not critical  
**Effort:** 1 day

### 2.2 Category: Chrome Profiles

#### UC-4: Profile Rotation
**Problem:** Provider accounts get rate-limited. Need to rotate between authenticated profiles.  
**Flow:**
```
System: detects rate limit on profile A
  → rotates to profile B from team pool
  → croc recv <code> from pool manager
  → authenticated session ready
```
**Value:** High — prevents downtime during rate limits  
**Effort:** 2 days

#### UC-5: Profile Backup/Restore
**Problem:** Chrome profile corruption = must re-authenticate manually.  
**Flow:**
```
System (scheduled): daily snapshot
  → croc send profile-gemini-owservera.croc
Recovery: croc recv <code>
  → profile restored, no re-auth needed
```
**Value:** High — avoids re-authentication friction  
**Effort:** Included in UC-4

### 2.3 Category: Conversations

#### UC-6: Conversation Debugging Pack
**Problem:** User reports bug in conversation. Cannot reproduce locally.  
**Flow:**
```
User: "bug in conversation abc123"
  → system exports conversation + messages + nodes + content blocks
  → croc send conversation-abc123-debug.croc
Dev: croc recv <code>
  → full conversation state restored
```
**Value:** Medium — useful for debugging  
**Effort:** 2 days

#### UC-7: Conversation History Sharing
**Problem:** Team cannot share conversation threads for analysis.  
**Flow:**
```
Dev A: has valuable conversation with provider
  → exports conversation (anonymized if needed)
  → croc send conversation-share.croc
Dev B: croc recv <code>
  → conversation available for analysis
```
**Value:** Low — niche use case  
**Effort:** Included in UC-6

### 2.4 Category: Knowledge Graph

#### UC-8: Knowledge Graph Portability
**Problem:** Nodes created by `captureAsNode()` stay local. Team cannot share insights.  
**Flow:**
```
Instance A: has rich knowledge graph
  → exports selected nodes + edges
  → croc send knowledge-graph-export.croc
Instance B: croc recv <code>
  → nodes merged into local graph
```
**Value:** Medium — enables collective intelligence  
**Effort:** 1 day

### 2.5 Category: Capabilities & Recipes

#### UC-9: Capability Recipe Sharing
**Problem:** Multi-step capability recipes (summarize → translate → email) cannot be shared.  
**Flow:**
```
Dev A: builds capability recipe
  → exports: definition + NL patterns + test cases
  → croc send recipe-summarize-translate.croc
Dev B: croc recv <code>
  → recipe available in registry
```
**Value:** Medium — accelerates capability development  
**Effort:** 1 day

#### UC-10: NL Pattern Library
**Problem:** NL patterns maintained independently. Duplicates emerge.  
**Flow:**
```
Dev A: adds 15 new NL patterns
  → exports catalog additions
  → croc send nl-patterns-v2.croc
Dev B: croc recv <code>
  → patterns merged, duplicates flagged
```
**Value:** Low — Git handles this for code  
**Effort:** 1 day

### 2.6 Category: Workspace Operations

#### UC-11: Backup/Restore (Disaster Recovery)
**Problem:** No disaster recovery mechanism. Machine failure = total loss.  
**Flow:**
```
System (scheduled): daily snapshot
  → exports: DB dump + chrome profiles + parser configs + harness commands
  → croc send snapshot-2026-07-23.croc (to backup relay)
Recovery: croc recv <code>
  → full environment restored
```
**Value:** High — prevents data loss  
**Effort:** 3 days

#### UC-12: New Machine Bootstrap
**Problem:** Setting up new machine takes days of manual configuration.  
**Flow:**
```
New machine: croc recv <bootstrap-code>
  → full workspace restored
  → ready to work immediately
```
**Value:** High — accelerates onboarding  
**Effort:** Included in UC-11

#### UC-13: Test Fixture Sync
**Problem:** Fixtures drift when schema changes. Team must manually rebuild.  
**Flow:**
```
CI: detects fixture drift
  → rebuilds fixtures
  → croc send fixtures-2026-07-23.croc
Dev: croc recv <code>
  → fresh fixtures, tests pass
```
**Value:** Low — niche use case  
**Effort:** 1 day

---

## 3. Architecture Design

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    vivim-final Backend                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                CrocTransferEngine                     │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────┐  │  │
│  │  │ CLI Wrapper│ │ Progress   │ │ Error Handling │  │  │
│  │  │ (spawn)    │ │ Parser     │ │ + Retry        │  │  │
│  │  └─────┬──────┘ └────────────┘ └────────────────┘  │  │
│  │        │                                              │  │
│  │  ┌─────▼──────────────────────────────────────────┐  │  │
│  │  │            Specialized Engines                  │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐            │  │  │
│  │  │  │ ProviderSync │ │ WorkspaceSync│            │  │  │
│  │  │  │ Engine       │ │ Engine       │            │  │  │
│  │  │  └──────────────┘ └──────────────┘            │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐            │  │  │
│  │  │  │ Conversation │ │ Knowledge    │            │  │  │
│  │  │  │ ExportEngine │ │ GraphExport  │            │  │  │
│  │  │  └──────────────┘ └──────────────┘            │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐            │  │  │
│  │  │  │ RecipeEngine │ │ HealthReport │            │  │  │
│  │  │  │              │ │ Engine       │            │  │  │
│  │  │  └──────────────┘ └──────────────┘            │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UnifiedCapabilityRegistry                │  │
│  │  cap:croc:send_file    cap:croc:recv_file            │  │
│  │  cap:croc:export_provider  cap:croc:import_provider  │  │
│  │  cap:croc:export_parser    cap:croc:import_parser    │  │
│  │  cap:croc:sync_workspace   cap:croc:backup_env       │  │
│  │  cap:croc:export_conversation  cap:croc:import_conv  │  │
│  │  cap:croc:export_kg    cap:croc:import_kg            │  │
│  │  cap:croc:export_recipe cap:croc:import_recipe       │  │
│  │  cap:croc:rotate_profile cap:croc:sync_fixtures      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Croc CLI Binary                         │  │
│  │  (installed via npm wrapper or direct download)      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Self-Hosted Croc Relay                         │
│  (Docker container, ports 9009-9013)                       │
│  - PAKE encryption                                          │
│  - No file persistence                                      │
│  - Rate limiting by IP                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Other vivim-final Instances                     │
│  (Team members, CI/CD, backup instances)                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow: Export

```
1. User/System triggers export
   ↓
2. Specialized Engine serializes data
   (DB rows → JSON, files → tar.gz)
   ↓
3. CrocTransferEngine.send()
   - Spawns: croc send <archive> --relay <relay>
   - Parses stdout for progress + code
   - Returns: { code, fileSize, relayAddress }
   ↓
4. Code returned to user/system
   (human-readable: "XXX-XXX-XXX")
```

### 3.3 Data Flow: Import

```
1. User/System provides code
   ↓
2. CrocTransferEngine.recv()
   - Spawns: croc recv <code> --relay <relay> --out <tmpdir>
   - Parses stdout for progress + completion
   - Returns: { filePath, fileName, fileSize }
   ↓
3. Specialized Engine deserializes data
   (JSON → DB rows, tar.gz → files)
   ↓
4. Data imported into local system
   (upsert or replace based on merge mode)
```

### 3.4 Bundle Format

```typescript
interface WorkspaceBundle {
  manifest: {
    version: string;           // Bundle format version
    type: string;              // 'provider' | 'parser' | 'conversation' | 'full'
    createdAt: string;         // ISO timestamp
    sourceInstance: string;    // Instance ID
    checksum: string;          // SHA-256 of contents
  };
  data: {
    providers?: ProviderRow[];
    parsers?: ParserRow[];
    conversations?: ConversationRow[];
    messages?: MessageRow[];
    nodes?: NodeRow[];
    edges?: NodeEdgeRow[];
    capabilities?: CapabilityBindingRow[];
    harnessCommands?: HarnessCommandRow[];
    nlPatterns?: NLPatternRow[];
    healthReports?: HealthReportRow[];
  };
  files?: {
    'chrome-profiles/': Buffer;      // Tar.gz of profile directory
    'seeds/providers/': Buffer;      // Provider manifest files
    'seeds/parsers/': Buffer;        // Parser logic files
    'tests/fixtures/': Buffer;       // Test fixture databases
  };
}
```

---

## 4. Capability Registry

### 4.1 Full Capability Map

```
croc-transfer engine
├── Basic
│   ├── cap:croc:send_file           — Send arbitrary file
│   ├── cap:croc:recv_file           — Receive arbitrary file
│   └── cap:croc:start_relay         — Start self-hosted relay
├── Provider
│   ├── cap:croc:export_provider     — Export provider config + parsers + bindings
│   ├── cap:croc:import_provider     — Import provider config
│   ├── cap:croc:export_parser       — Export single parser
│   └── cap:croc:import_parser       — Import parser
├── Workspace
│   ├── cap:croc:sync_workspace      — Export full workspace state
│   ├── cap:croc:backup_environment  — Full backup (DB + files)
│   └── cap:croc:restore_environment — Restore from backup
├── Conversation
│   ├── cap:croc:export_conversation — Export conversation + messages + nodes
│   └── cap:croc:import_conversation — Import conversation
├── Knowledge
│   ├── cap:croc:export_kg           — Export knowledge graph nodes + edges
│   └── cap:croc:import_kg           — Import knowledge graph
├── Team
│   ├── cap:croc:export_recipe       — Export capability recipe
│   ├── cap:croc:import_recipe       — Import capability recipe
│   ├── cap:croc:export_nl_patterns  — Export NL patterns
│   └── cap:croc:import_nl_patterns  — Import NL patterns
└── Ops
    ├── cap:croc:rotate_profile      — Automated profile rotation
    ├── cap:croc:sync_fixtures       — Sync test fixtures
    ├── cap:croc:export_health_report — Export health telemetry
    └── cap:croc:import_health_report — Import health telemetry
```

### 4.2 Capability Definitions

```typescript
// Provider export/import
export const exportProviderCapability = makeCapability({
  id: 'cap:croc:export_provider',
  slug: 'export_provider',
  name: 'Export Provider',
  description: 'Export provider manifest, parsers, bindings, and test results',
  surfaces: ['cli', 'api'],
  parameters: {
    providerSlug: { type: 'string', required: true },
    includeParsers: { type: 'boolean', default: true },
    includeBindings: { type: 'boolean', default: true },
    includeTestResults: { type: 'boolean', default: false },
  },
  execute: async (params) => {
    const bundle = await providerSyncEngine.exportProvider(params.providerSlug, {
      includeParsers: params.includeParsers,
      includeBindings: params.includeBindings,
      includeTestResults: params.includeTestResults,
    });
    const code = await crocEngine.send(bundle);
    return { success: true, data: { code, message: `Provider ${params.providerSlug} exported. Share code: ${code}` } };
  },
});

// Parser export/import
export const exportParserCapability = makeCapability({
  id: 'cap:croc:export_parser',
  slug: 'export_parser',
  name: 'Export Parser',
  description: 'Export parser logic code and metadata',
  surfaces: ['cli', 'api'],
  parameters: {
    parserId: { type: 'string', required: true },
  },
  execute: async (params) => {
    const bundle = await providerSyncEngine.exportParser(params.parserId);
    const code = await crocEngine.send(bundle);
    return { success: true, data: { code, message: `Parser exported. Share code: ${code}` } };
  },
});

// Backup/restore
export const backupEnvironmentCapability = makeCapability({
  id: 'cap:croc:backup_environment',
  slug: 'backup_environment',
  name: 'Backup Environment',
  description: 'Full environment backup (DB + chrome profiles + configs)',
  surfaces: ['cli', 'api'],
  parameters: {
    includeChromeProfiles: { type: 'boolean', default: true },
    includeTestFixtures: { type: 'boolean', default: false },
  },
  execute: async (params) => {
    const bundle = await workspaceSyncEngine.backupEnvironment({
      includeChromeProfiles: params.includeChromeProfiles,
      includeTestFixtures: params.includeTestFixtures,
    });
    const code = await crocEngine.send(bundle);
    return { success: true, data: { code, message: `Environment backed up. Share code: ${code}` } };
  },
});

// Profile rotation
export const rotateProfileCapability = makeCapability({
  id: 'cap:croc:rotate_profile',
  slug: 'rotate_profile',
  name: 'Rotate Profile',
  description: 'Automated profile rotation when rate-limited',
  surfaces: ['api'],  // CLI only for manual trigger
  parameters: {
    providerSlug: { type: 'string', required: true },
    reason: { type: 'string', required: false },
  },
  execute: async (params) => {
    const profile = await profileSyncEngine.rotateProfile(params.providerSlug, params.reason);
    return { success: true, data: { profile: profile.accountId, message: `Rotated to profile ${profile.accountId}` } };
  },
});
```

---

## 5. Implementation Plan

### 5.1 Phased Approach

#### Phase 1: Foundation (Days 1-6) — P0 Critical

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | CrocTransferEngine: CLI wrapper | `src/engines/croc-transfer.ts` |
| 2 | CrocTransferEngine: progress parsing + error handling | Unit tests passing |
| 3 | Self-hosted relay setup | `docker-compose.croc.yml` |
| 4 | Capability registration (basic) | `send_file`, `recv_file`, `start_relay` |
| 5 | ProviderSyncEngine: export/import provider | `src/engines/provider-sync.ts` |
| 6 | ProviderSyncEngine: export/import parser | Tests passing |

**Milestone 1:** Team can share providers and parsers via Croc.

#### Phase 2: Workspace (Days 7-12) — P1 Important

| Day | Task | Deliverable |
|-----|------|-------------|
| 7-8 | WorkspaceSyncEngine: full workspace export/import | `src/engines/workspace-sync.ts` |
| 9-10 | ConversationExportEngine: conversation + messages + nodes | `src/engines/conversation-export.ts` |
| 11 | KnowledgeGraphExportEngine: nodes + edges | `src/engines/kg-export.ts` |
| 12 | Integration tests | All engines tested together |

**Milestone 2:** Full workspace backup/restore, conversation debugging.

#### Phase 3: Team Features (Days 13-20) — P2 Nice-to-Have

| Day | Task | Deliverable |
|-----|------|-------------|
| 13-14 | ProfileSyncEngine: rotation + backup | `src/engines/profile-sync.ts` |
| 15 | RecipeEngine: capability recipe sharing | `src/engines/recipe-engine.ts` |
| 16 | NLPatternEngine: NL pattern distribution | `src/engines/nl-pattern-engine.ts` |
| 17 | HealthReportEngine: telemetry sharing | `src/engines/health-report.ts` |
| 18 | FixtureSyncEngine: test fixture distribution | `src/engines/fixture-sync.ts` |
| 19-20 | Full integration tests + documentation | All capabilities tested |

**Milestone 3:** Complete team workspace support.

### 5.2 File Structure

```
src/
  engines/
    croc-transfer.ts              # CLI wrapper (foundation)
    provider-sync.ts              # Provider + parser export/import
    workspace-sync.ts             # Full workspace backup/restore
    conversation-export.ts        # Conversation debugging packs
    kg-export.ts                  # Knowledge graph portability
    profile-sync.ts               # Chrome profile rotation
    recipe-engine.ts              # Capability recipe sharing
    nl-pattern-engine.ts          # NL pattern distribution
    health-report.ts              # Health telemetry sharing
    fixture-sync.ts               # Test fixture sync
    croc-caps.ts                  # Capability registration (all caps)

tests/
  unit/engines/
    croc-transfer.test.ts
    provider-sync.test.ts
    workspace-sync.test.ts
    conversation-export.test.ts
    kg-export.test.ts
    profile-sync.test.ts
    recipe-engine.test.ts
    nl-pattern-engine.test.ts
    health-report.test.ts
    fixture-sync.test.ts

docker-compose.croc.yml           # Self-hosted relay
scripts/
  install-croc.sh                 # Croc binary installer
  setup-relay.ps1                 # Relay setup script
```

---

## 6. Security Considerations

### 6.1 Encryption

- **PAKE (Password-Authenticated Key Exchange):** 9-character code used as password
- **E2E encryption:** Relay never sees plaintext data
- **No key exchange:** Code IS the key (derived via SRP-like protocol)

### 6.2 Relay Security

- **No authentication:** Relay doesn't authenticate users (by design)
- **Rate limiting:** IP-based rate limiting prevents abuse
- **No persistence:** Relay doesn't store files after transfer completes
- **Self-hosted:** Run your own relay for sensitive data

### 6.3 Data Sensitivity

| Data Type | Sensitivity | Recommendation |
|-----------|-------------|----------------|
| Provider manifests | Low | OK to transfer via public relay |
| Parser logic | Medium | Prefer self-hosted relay |
| Chrome profiles | High | **Always** use self-hosted relay |
| Conversations | High | **Always** use self-hosted relay |
| Knowledge graph | Medium | Prefer self-hosted relay |
| Test fixtures | Low | OK via public relay |

### 6.4 Secrets Handling

**Never transfer via Croc:**
- API keys
- Auth tokens
- Database credentials
- `.env` files with secrets

**Bundle format excludes:**
- `secrets` field from provider manifests
- `authToken` from chrome profile metadata
- Any `*Secret*`, `*Key*`, `*Token*` fields

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Croc binary not available on target | Medium | High | Ship croc binary with vivim, or install script |
| Relay downtime | Low | High | Self-hosted relay, fallback to public relay |
| Large file transfer timeout | Medium | Medium | Resume support, chunked transfers |
| stdout parsing fragility | Medium | Medium | Pin croc version, test against known output |
| Concurrent transfer conflicts | Low | Low | Single-use codes, sequential transfers |
| Data corruption during transfer | Low | High | SHA-256 checksums in bundle manifest |
| NAT traversal failure | Medium | Medium | Relay fallback, direct TCP when possible |
| Bun child_process differences | Low | Medium | Test on target platforms early |

---

## 8. Cost Analysis

### 8.1 Development Cost

| Phase | Days | Cost (at $500/day) |
|-------|------|---------------------|
| Phase 1: Foundation | 6 | $3,000 |
| Phase 2: Workspace | 6 | $3,000 |
| Phase 3: Team Features | 8 | $4,000 |
| **Total** | **20** | **$10,000** |

### 8.2 Infrastructure Cost

| Component | Cost |
|-----------|------|
| Croc binary | Free (MIT) |
| Self-hosted relay (Docker) | Free (runs on existing infra) |
| Bandwidth (relay) | Minimal (local network or small relay) |
| **Total** | **$0/month** |

### 8.3 ROI Analysis

| Benefit | Value |
|---------|-------|
| Parser recreation time saved | 4 hours/parser × 10 parsers/year = 40 hours |
| Provider onboarding acceleration | 2 days/provider × 5 providers/year = 10 days |
| Profile re-authentication time | 30 min/profile × 20 re-auths/year = 10 hours |
| Disaster recovery (avoided data loss) | Priceless |
| Team collaboration efficiency | 20% faster onboarding |
| **Total annual savings** | ~60 hours/year = $3,000/year |

**Payback period:** ~3.3 years (excluding disaster recovery value)

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Parser distribution time | < 5 minutes | Time from `croc send` to parser available |
| Provider onboarding sharing | < 10 minutes | Time from completed onboarding to team access |
| Backup/restore success rate | > 99% | Successful transfers / total transfers |
| Profile rotation success | > 95% | Successful rotations / rotation attempts |
| Team adoption | > 80% | Team members using Croc weekly |
| Data loss incidents | 0 | Incidents after backup system deployed |

---

## 10. Recommendations

### 10.1 Immediate Actions (This Week)

1. **Install Croc binary** — `npm install -g croc` or download from GitHub releases
2. **Deploy self-hosted relay** — `docker-compose -f docker-compose.croc.yml up -d`
3. **Implement CrocTransferEngine** — CLI wrapper (2 days)
4. **Test basic send/recv** — Verify on target platforms

### 10.2 Short-Term (This Month)

5. **Implement ProviderSyncEngine** — Export/import providers + parsers (2 days)
6. **Register capabilities** — `export_provider`, `import_provider`, `export_parser`, `import_parser`
7. **Team training** — Demo provider sharing workflow

### 10.3 Medium-Term (Next Quarter)

8. **Implement WorkspaceSyncEngine** — Full backup/restore (3 days)
9. **Implement ConversationExportEngine** — Debugging packs (2 days)
10. **Implement ProfileSyncEngine** — Automated rotation (2 days)
11. **Add to CI/CD** — Automated backup on deploy

### 10.4 Long-Term (Next Year)

12. **Implement remaining engines** — Knowledge graph, recipes, NL patterns, health reports
13. **Build team dashboard** — Aggregate health reports across instances
14. **Consider Go library embedding** — If bun-go FFI stabilizes

---

## 11. Decision Points

| Decision | Options | Recommendation |
|----------|---------|----------------|
| CLI wrapper vs Go library | CLI (simple) vs FFI (native) | **CLI** — simpler, cross-platform |
| Public relay vs self-hosted | Public (convenient) vs Self-hosted (secure) | **Self-hosted** for sensitive data |
| Full backup vs incremental | Full (simple) vs Incremental (efficient) | **Full** initially, incremental later |
| Manual vs automated rotation | Manual (user-triggered) vs Auto (system-triggered) | **Auto** with manual override |
| Bundle format versioning | Simple version field vs SemVer | **Simple version field** initially |

---

## 12. Open Questions

1. **Relay deployment:** Should we deploy relay on existing infra or separate VPS?
2. **Backup schedule:** Daily? Weekly? Event-driven (on significant changes)?
3. **Profile pool size:** How many Chrome profiles per provider for rotation?
4. **Data retention:** How long to keep transferred bundles on relay?
5. **Access control:** Should relay support authentication for sensitive transfers?
6. **Monitoring:** How to monitor relay health and transfer success rates?

---

## Appendix A: Croc CLI Reference

```bash
# Send file
croc send <file-or-dir>

# Send with custom code
croc send --code <custom-code> <file>

# Send via self-hosted relay
croc send --relay <relay-address> <file>

# Receive
croc recv <9-char-code>

# Receive via self-hosted relay
croc recv --relay <relay-address> <code>

# Resume interrupted transfer
croc send --resume <file>
croc recv --resume <code>

# Text transfer
croc send --text "hello world"

# Start relay server
croc relay

# Start relay on custom port
croc relay --port <port>
```

## Appendix B: Docker Compose

```yaml
# docker-compose.croc.yml
version: '3.8'
services:
  croc-relay:
    image: schollz/croc
    container_name: vivim-croc-relay
    command: relay
    ports:
      - "9009:9009"
      - "9010:9010"
      - "9011:9011"
      - "9012:9012"
      - "9013:9013"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "9009"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Appendix C: Example Transfer Session

```bash
# Dev A: Export provider
$ bun run devops croc export --provider=gemini
✓ Gemini provider exported (manifest + 3 parsers + 5 bindings)
✓ Bundle created: 2.3 MB
✓ Sent via Croc
✓ Share this code with your team: ABC-DEF-123

# Dev B: Import provider
$ bun run devops croc import --code=ABC-DEF-123
✓ Received bundle: 2.3 MB
✓ Validating manifest...
✓ Upserting provider: gemini
✓ Upserting parsers: 3 (gemini/001_batchexecute, gemini/002_ai_studio, gemini/003_fallback)
✓ Upserting bindings: 5
✓ Provider gemini imported successfully

# Dev B: Verify
$ bun run devops runtime-test status --provider=gemini
✓ Provider: gemini
✓ Status: seeded + registered
✓ Parsers: 3 (all inline)
✓ Capabilities: send_message, select_model
✓ All tests passing
```

---

**End of Report**

*Next step: Team review and decision on Phase 1 implementation.*
