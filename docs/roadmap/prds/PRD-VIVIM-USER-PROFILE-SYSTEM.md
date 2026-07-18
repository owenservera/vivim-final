# PRD: VIVIM User Profile System (+ Admin/Dev Roles)

**Status:** DESIGN v3 (three-pass codebase audit)  
**Date:** 2026-07-17  
**Epic:** CAP-003 — User Profile, Identity & Role System  
**Author:** Agent (deep codebase audit)

---

## 1. Problem Statement

VIVIM ships as a local-first installed application with **zero user concept**. Every user-facing
table hardcodes `userId = 'default'`. Sessions are anonymous. Chrome slaves are orphaned from
any owner. Debug logs are global soup. The codebase already has 18+ `admin_*` capabilities in
`capability-bootstrap.ts` (seed, config get/set, audit, drift, health, version, etc.) but **zero
role-based access control** — any caller can invoke admin operations.

This PRD covers two intertwined concerns:
1. **User Profile System** — identity, settings, fleet ownership, debug logs, telemetry, data export
2. **Admin/Dev Roles** — role-based capability gating, system-wide visibility, developer tools

### 1.1 Audit Evidence

| Location | Issue |
|----------|-------|
| `prisma/schema.prisma:1-2752` | No `model User` exists anywhere. `userId = 'default'` on 4 tables. |
| `ProviderAccount` (L:374) | `chromeSlaveId`, `debugPort`, `profileDir` — no `userId` FK. |
| `VivimSession` (L:670) | No `userId`. Can't answer "what was my last session?" |
| `TraceEntry` (L:417) | No `userId`. |
| `KernelSpan` / `KernelProvenance` | No `userId`. |
| `BackupEntry` (L:2582), `SyncLog` (L:2373) | No `userId`. |
| `ConfigEntry` (L:1152) | `scopeType` enum lacks `'user'`. |
| `UserPreference` (L:2235) | `userId` = `@default("default")`. Bare key-value. |
| `capability-bootstrap.ts:328-1129` | 18 `admin_*` capabilities registered with `category: 'admin'`, `ui.position: 'admin'` — **no role gate on any of them**. |

### 1.2 What We Build

| Layer | What | Key Tables |
|-------|------|-----------|
| **L0** | User Identity + Roles | `User` (new, with `role` field) |
| **L1** | Fleet Ownership | `ChromeSlave` (new), FKs on `ProviderAccount`, `ProfileSession` |
| **L2** | Session State | FKs on `VivimSession`, `Conversation` |
| **L3** | Settings & Config | `UserConfigOverride`, `UserNotificationPref` (new); `ConfigScope` extended |
| **L4** | Debug Logs | `UserEvent`, `DebugSession`, `DebugCapturedTrace` (new); `TraceEntry` +FK |
| **L5** | User Telemetry | `UserTelemetryDaily` (new) |
| **L6** | Data Sovereignty | `UserDataExport`, `UserBackupConfig` (new) |
| **A1** | Admin Dashboards | Cross-user views, system-wide fleet, all events, all telemetry |
| **D1** | Developer Tools | Kernel introspection, raw query, config hot-reload, debug toggles |

---

## 2. Role System

### 2.1 Role Hierarchy

```
developer  (dev)   — kernel access, raw SQL, debug toggles, config hot-reload, all admin privs
  ↓
admin      (admin) — system-wide data visibility, user management, fleet oversight, audit logs
  ↓
member     (member) — own data only, personal fleet, personal settings, personal debug
```

A `member` sees only their own conversations, fleet, events, and telemetry. An `admin` sees
everything across all users. A `developer` additionally gets kernel introspection, raw DB query,
engine status, and debug-mode toggles.

### 2.2 Role-Based Capability Gating

Existing `admin_*` capabilities in `capability-bootstrap.ts` are already registered but un-gated.
We add a **minimum role requirement** to `UnifiedCapability`:

```typescript
// Add to UnifiedCapability interface:
export interface UnifiedCapability {
  // ... existing fields ...
  minRole?: UserRole  // 'member' | 'admin' | 'developer' — undefined = member (everyone)
}
```

The `UnifiedCapabilityRegistry.execute()` method checks: if `cap.minRole` is set and the caller's
role is below it, the execution is rejected with `EngineError('Insufficient role')`.

The existing `admin_*` capabilities get `minRole: 'admin'` or `minRole: 'developer'`.

### 2.3 Role Resolution

Roles come from `User.role` column. The active session carries the user's role.
`UserIdentityEngine.getActiveUserId()` → `getCurrentUser()` → `user.role`.

Capability handlers receive `ctx.userId` and can check:
```typescript
const user = await services.userIdentity.getCurrentUser()
if (user.role !== 'admin' && user.role !== 'developer') throw new Error('Forbidden')
```

But the primary enforcement is at the registry level (fail-fast before handler invocation).

---

## 3. Data Model (Complete)

### 3.1 User Table

```prisma
model User {
  id              String   @id
  displayName     String   @map("display_name")
  role            String   @default("member")               // member | admin | developer
  avatarColor     String   @default("#6C5CE7") @map("avatar_color")
  avatarUrl       String?  @map("avatar_url")
  status          String   @default("active")                // active | inactive | deleted
  isDefault       Int      @default(0) @map("is_default")

  createdAt       BigInt   @map("created_at")
  updatedAt       BigInt   @map("updated_at")
  lastActiveAt    BigInt?  @map("last_active_at")
  lastSessionId   String?  @map("last_session_id")

  preferences       UserPreference[]
  componentLayouts  UserComponentLayout[]
  workspaceModes    WorkspaceMode[]
  contextBudgets    ContextBudgetConfig[]
  providerAccounts  ProviderAccount[]
  slaves            ChromeSlave[]
  vivimSessions     VivimSession[]
  configOverrides   UserConfigOverride[]
  notificationPref  UserNotificationPref?
  userEvents        UserEvent[]
  debugSessions     DebugSession[]
  telemetryDaily    UserTelemetryDaily[]
  dataExports       UserDataExport[]
  backupConfig      UserBackupConfig?

  @@index([role])
  @@map("user")
}
```

### 3.2 ChromeSlave Table

```prisma
model ChromeSlave {
  id              String   @id
  userId          String   @map("user_id")
  providerId      String   @map("provider_id")
  accountId       String   @map("account_id")
  debugPort       Int      @map("debug_port")
  profileDir      String?  @map("profile_dir")
  state           String   @default("stopped")     // running | stopped | error | zombie
  healthStatus    String   @default("unknown") @map("health_status")
  pid             Int?
  launchMode      String   @default("spawn") @map("launch_mode")
  launchArgsJson  String   @default("[]") @map("launch_args_json")
  createdAt       BigInt   @map("created_at")
  updatedAt       BigInt   @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([providerId])
  @@index([state])
  @@map("chrome_slave")
}
```

### 3.3 UserConfigOverride

```prisma
model UserConfigOverride {
  id           String @id
  userId       String @map("user_id")
  engineId     String @map("engine_id")
  configJson   String @map("config_json")
  updatedAt    BigInt @map("updated_at")

  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, engineId])
  @@map("user_config_override")
}
```

### 3.4 UserNotificationPref

```prisma
model UserNotificationPref {
  id               String @id
  userId           String @map("user_id")
  desktopAlerts    Int    @default(1) @map("desktop_alerts")
  soundAlerts      Int    @default(0) @map("sound_alerts")
  conversationComplete Int @default(1) @map("conversation_complete")
  errors           Int    @default(1)
  healthAlerts     Int    @default(1) @map("health_alerts")
  dailyDigest      Int    @default(0) @map("daily_digest")
  updatedAt        BigInt @map("updated_at")

  user             User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("user_notification_pref")
}
```

### 3.5 UserEvent (Debug Logs)

```prisma
model UserEvent {
  id              String @id
  userId          String @map("user_id")
  eventType       String @map("event_type")
  severity        String @default("info")         // debug | info | warn | error | fatal
  source          String                          // engineId
  message         String
  dataJson        String @default("{}") @map("data_json")
  conversationId  String? @map("conversation_id")
  providerId      String? @map("provider_id")
  slaveId         String? @map("slave_id")
  ts              BigInt

  user            User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, ts])
  @@index([userId, severity, ts])
  @@index([eventType])
  @@map("user_event")
}
```

### 3.6 DebugSession + DebugCapturedTrace

```prisma
model DebugSession {
  id              String @id
  userId          String @map("user_id")
  label           String
  status          String @default("recording")    // recording | stopped | archived
  filterJson      String @default("{}") @map("filter_json")
  startedAt       BigInt @map("started_at")
  stoppedAt       BigInt? @map("stopped_at")
  totalEvents     Int    @default(0) @map("total_events")
  exportPath      String? @map("export_path")

  user            User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  capturedTraces  DebugCapturedTrace[]

  @@index([userId, startedAt])
  @@map("debug_session")
}

model DebugCapturedTrace {
  id              String @id
  debugSessionId  String @map("debug_session_id")
  sourceEntryId   String @map("source_entry_id")
  sourceTable     String @map("source_table")     // trace_entry | kernel_spans | outcome | user_event
  capturedAt      BigInt @map("captured_at")

  session         DebugSession @relation(fields: [debugSessionId], references: [id], onDelete: Cascade)

  @@index([debugSessionId])
  @@map("debug_captured_trace")
}
```

### 3.7 UserTelemetryDaily

```prisma
model UserTelemetryDaily {
  id                          String @id
  userId                      String @map("user_id")
  dayTs                       String @map("day_ts")

  totalConversations          Int    @default(0) @map("total_conversations")
  totalConversationsCreated   Int    @default(0) @map("total_conversations_created")
  totalMessagesSent           Int    @default(0) @map("total_messages_sent")
  totalMessagesReceived       Int    @default(0) @map("total_messages_received")
  totalCapabilityExecutions   Int    @default(0) @map("total_capability_executions")
  totalCapabilitySuccesses    Int    @default(0) @map("total_capability_successes")
  totalCapabilityFailures     Int    @default(0) @map("total_capability_failures")
  totalSessions               Int    @default(0) @map("total_sessions")
  totalSessionTimeMs          Int    @default(0) @map("total_session_time_ms")
  peakConcurrentSlaves        Int    @default(0) @map("peak_concurrent_slaves")
  avgResponseLatencyMs        Float  @default(0) @map("avg_response_latency_ms")
  p95ResponseLatencyMs        Float  @default(0) @map("p95_response_latency_ms")
  byProviderJson              String @default("{}") @map("by_provider_json")
  totalErrors                 Int    @default(0) @map("total_errors")
  bySeverityJson              String @default("{}") @map("by_severity_json")
  schemaVersion               Int    @default(1) @map("schema_version")

  user                        User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, dayTs])
  @@index([userId, dayTs])
  @@index([dayTs])
  @@map("user_telemetry_daily")
}
```

### 3.8 UserDataExport + UserBackupConfig

```prisma
model UserDataExport {
  id            String @id
  userId        String @map("user_id")
  exportType    String @map("export_type")        // conversations | settings | debug_logs | full
  status        String @default("pending")
  format        String @default("json")           // json | zip
  filePath      String? @map("file_path")
  sizeBytes     Int    @default(0) @map("size_bytes")
  startedAt     BigInt @map("started_at")
  completedAt   BigInt? @map("completed_at")
  error         String?

  user          User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startedAt])
  @@map("user_data_export")
}

model UserBackupConfig {
  id            String @id
  userId        String @map("user_id")
  enabled       Int    @default(1)
  interval      String @default("daily")          // hourly | daily | weekly | manual
  maxBackups    Int    @default(30) @map("max_backups")
  includeDebug  Int    @default(0) @map("include_debug")
  encryptOutput Int    @default(1) @map("encrypt_output")
  updatedAt     BigInt @map("updated_at")

  user          User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("user_backup_config")
}
```

### 3.9 Modified Existing Tables

| Table | Change |
|-------|--------|
| `VivimSession` | Add `userId String` FK → User (NOT NULL after migration). |
| `ProviderAccount` | Add `userId String` FK → User (NOT NULL). |
| `ProfileSession` | Add `userId String` FK → User (NOT NULL). |
| `Conversation` | Add `userId String` FK → User (NOT NULL). |
| `TraceEntry` | Add `userId String?` FK → User (nullable — system-level traces have null). |
| `KernelSpan` | Add `userId String?` FK → User (nullable). |
| `ProviderHealthHistory` | Add `userId String?` FK → User (nullable). |
| `BackupEntry` | Add `userId String?` FK → User (nullable). |
| `SyncLog` | Add `userId String?` FK → User (nullable). |
| `UserPreference` | Remove `@default("default")`. `userId` → FK to User. |
| `UserComponentLayout` | Remove `@default("default")`. `userId` → FK to User. |
| `WorkspaceMode` | Remove `@default("default")`. `userId` → FK to User. |
| `ContextBudgetConfig` | Remove `@default("default")`. `userId` → FK to User. |

### 3.10 ConfigScope Extension

```typescript
// BEFORE (config-store.ts:10):
scopeType: z.enum(['global', 'provider', 'account', 'engine']),

// AFTER:
scopeType: z.enum(['global', 'provider', 'account', 'engine', 'user']),
```

No ConfigManager code changes needed — `getConfig`/`updateConfig` already handle arbitrary
`scopeType` values via the `resolveScope` helper.

### 3.11 Views

```sql
CREATE VIEW v_user_activity AS
SELECT
  u.id, u.display_name, u.role, u.last_active_at,
  COUNT(DISTINCT vs.id) FILTER (WHERE vs.state = 'active') AS active_sessions,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.state = 'running') AS running_slaves,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.state = 'error') AS error_slaves,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT ue.id) FILTER (WHERE ue.ts > (unixepoch() * 1000) - 86400000 AND ue.severity = 'error') AS errors_24h
FROM user u
LEFT JOIN vivim_session vs ON vs.user_id = u.id
LEFT JOIN chrome_slave cs ON cs.user_id = u.id
LEFT JOIN conversation c ON c.user_id = u.id
LEFT JOIN user_event ue ON ue.user_id = u.id
WHERE u.status = 'active'
GROUP BY u.id;

CREATE VIEW v_admin_fleet AS
SELECT
  u.display_name AS user_name, u.role,
  cs.provider_id, cs.state, cs.health_status, cs.debug_port, cs.pid,
  cs.created_at, cs.updated_at
FROM chrome_slave cs
JOIN user u ON u.id = cs.user_id
WHERE u.status = 'active';

CREATE VIEW v_admin_errors AS
SELECT
  u.display_name AS user_name, ue.severity, ue.source, ue.message, ue.ts,
  ue.event_type, ue.conversation_id, ue.provider_id
FROM user_event ue
JOIN user u ON u.id = ue.user_id
WHERE ue.severity IN ('error', 'fatal');
```

---

## 4. Store Contracts

### 4.1 UserIdentityStore

```typescript
export interface UserRow {
  id: string
  displayName: string
  role: UserRole
  avatarColor: string
  avatarUrl: string | null
  status: string
  isDefault: number
  createdAt: number
  updatedAt: number
  lastActiveAt: number | null
  lastSessionId: string | null
}

export type UserRole = 'member' | 'admin' | 'developer'

export interface UserIdentityStore {
  create(input: { displayName: string; role?: UserRole; avatarColor?: string; isDefault?: boolean }): Promise<UserRow>
  getById(id: string): Promise<UserRow | null>
  list(opts?: { status?: string; role?: UserRole }): Promise<UserRow[]>
  getDefault(): Promise<UserRow | null>
  update(id: string, patch: Partial<Pick<UserRow, 'displayName' | 'role' | 'avatarColor' | 'avatarUrl' | 'status' | 'isDefault' | 'lastActiveAt' | 'lastSessionId'>>): Promise<void>
  softDelete(id: string): Promise<void>
  countByRole(role: UserRole): Promise<number>
}
```

### 4.2 UserFleetStore

```typescript
export interface ChromeSlaveRow {
  id: string; userId: string; providerId: string; accountId: string
  debugPort: number; profileDir: string | null
  state: string; healthStatus: string; pid: number | null
  launchMode: string; launchArgsJson: string
  createdAt: number; updatedAt: number
}

export interface UserFleetStore {
  getByUser(userId: string): Promise<ChromeSlaveRow[]>
  getAll(opts?: { state?: string }): Promise<ChromeSlaveRow[]> // admin: cross-user
  getById(slaveId: string): Promise<ChromeSlaveRow | null>
  upsert(input: Omit<ChromeSlaveRow, 'createdAt' | 'updatedAt'>): Promise<ChromeSlaveRow>
  updateState(slaveId: string, state: string, healthStatus?: string, pid?: number | null): Promise<void>
  remove(slaveId: string): Promise<void>
}
```

### 4.3 UserSettingsStore

```typescript
export interface UserSettingsStore {
  getPreferences(userId: string): Promise<Array<{ key: string; value: string; confidence: number }>>
  setPreference(userId: string, key: string, value: string, confidence?: number): Promise<void>
  deletePreference(userId: string, key: string): Promise<void>
  getNotificationPrefs(userId: string): Promise<UserNotificationPrefRow | null>
  upsertNotificationPrefs(userId: string, prefs: Omit<UserNotificationPrefRow, 'id' | 'updatedAt'>): Promise<void>
  getConfigOverride(userId: string, engineId: string): Promise<Record<string, unknown> | null>
  setConfigOverride(userId: string, engineId: string, config: Record<string, unknown>): Promise<void>
  deleteConfigOverride(userId: string, engineId: string): Promise<void>
}
```

### 4.4 UserDebugStore

```typescript
export interface UserDebugStore {
  logEvent(input: Omit<UserEventRow, 'id'>): Promise<UserEventRow>
  queryEvents(userId: string | null, opts: EventQueryOpts): Promise<UserEventRow[]> // null userId = all users (admin)
  countEvents(userId: string | null, opts: EventQueryOpts): Promise<number>
  createDebugSession(userId: string, label: string, filterJson: string): Promise<DebugSessionRow>
  stopDebugSession(sessionId: string, totalEvents: number): Promise<void>
  getDebugSessions(userId: string): Promise<DebugSessionRow[]>
  captureTrace(sessionId: string, sourceEntryId: string, sourceTable: string): Promise<void>
  getCapturedTraces(sessionId: string): Promise<Array<{ sourceEntryId: string; sourceTable: string }>>
  purgeEvents(userId: string | null, olderThanDays: number): Promise<number>
}
```

### 4.5 UserTelemetryStore

```typescript
export interface UserTelemetryStore {
  upsertDaily(row: Omit<UserTelemetryDailyRow, 'id'>): Promise<UserTelemetryDailyRow>
  getDaily(userId: string, dayTs: string): Promise<UserTelemetryDailyRow | null>
  getRange(userId: string | null, from: string, to: string): Promise<UserTelemetryDailyRow[]> // null = all
  getAllSummary(): Promise<Array<{ userId: string; displayName: string; role: string; totalConversations: number; totalMessagesSent: number; totalErrors: number }>>
}
```

### 4.6 UserDataExportStore

```typescript
export interface UserDataExportStore {
  create(userId: string, exportType: string, format: string): Promise<UserDataExportRow>
  update(id: string, patch: Partial<Pick<UserDataExportRow, 'status' | 'filePath' | 'sizeBytes' | 'completedAt' | 'error'>>): Promise<void>
  list(userId: string): Promise<UserDataExportRow[]>
}
```

---

## 5. Engine Architecture

### 5.1 UserIdentityEngine

```typescript
export class UserIdentityEngine {
  private activeUserId: string | null = null

  constructor(
    private store: UserIdentityStore,
    private eventBus: CapabilityEventBus,
  ) {}

  async ensureDefaultUser(): Promise<void>
  async createProfile(name: string, opts?: { role?: UserRole; avatarColor?: string; setActive?: boolean }): Promise<UserRow>
  async switchProfile(userId: string): Promise<{ user: UserRow; previousUserId: string | null }>
  async deleteProfile(userId: string): Promise<void>
  async setRole(userId: string, role: UserRole): Promise<void>  // admin/dev only
  getActiveUserId(): string | null
  getActiveUserRole(): UserRole | null
  async getCurrentUser(): Promise<UserRow | null>
  async listProfiles(): Promise<UserRow[]>
  async listByRole(role: UserRole): Promise<UserRow[]>  // admin only
}
```

### 5.2 UserFleetManager

```typescript
export class UserFleetManager {
  constructor(
    private store: UserFleetStore,
    private governor: ChromeGovernor,
    private userIdentity: UserIdentityEngine,
    private eventBus: CapabilityEventBus,
  ) {}

  async getUserFleet(userId: string): Promise<ChromeSlaveRow[]>
  async getAllFleet(): Promise<ChromeSlaveRow[]>               // admin: cross-user
  async startSlave(userId: string, providerId: string, accountId: string): Promise<ChromeSlaveRow>
  async stopSlave(slaveId: string): Promise<void>
  async restartSlave(slaveId: string): Promise<ChromeSlaveRow>
  async getSlaveHealth(slaveId: string): Promise<SlaveHealth>
}
```

### 5.3 UserSettingsEngine

```typescript
export class UserSettingsEngine {
  constructor(
    private store: UserSettingsStore,
    private configManager: ConfigManager,
    private eventBus: CapabilityEventBus,
  ) {}

  async getSettings(userId: string): Promise<UserSettings>
  async updateSetting(userId: string, key: string, value: unknown): Promise<void>
  async exportSettings(userId: string): Promise<UserSettings>
  async importSettings(userId: string, settings: UserSettings): Promise<void>
  async resetSettings(userId: string, scope?: string): Promise<void>
  async learnPreference(userId: string, key: string, value: string, confidence: number): Promise<void>
}
```

### 5.4 UserDebugEngine

```typescript
export class UserDebugEngine {
  constructor(private store: UserDebugStore, private eventBus: CapabilityEventBus) {}

  // Event logging (used by ConversationManager, ChromeGovernor, etc.)
  async log(userId: string, params: LogEventParams): Promise<void>
  debug(userId: string, msg: string, source: string, data?: Record<string, unknown>): Promise<void>
  info(userId: string, msg: string, source: string, data?: Record<string, unknown>): Promise<void>
  warn(userId: string, msg: string, source: string, data?: Record<string, unknown>): Promise<void>
  error(userId: string, msg: string, source: string, data?: Record<string, unknown>): Promise<void>

  // Queries
  async queryEvents(userId: string, opts: EventQueryOpts): Promise<{ events: UserEventRow[]; total: number }>
  async getAllEvents(opts: EventQueryOpts): Promise<{ events: UserEventRow[]; total: number }>  // admin
  async getRecentErrors(userId: string | null, hours?: number): Promise<UserEventRow[]>

  // Debug capture sessions
  async startCapture(userId: string, label: string, filter?: Record<string, unknown>): Promise<DebugSessionRow>
  async stopCapture(sessionId: string): Promise<DebugSessionRow>
  async getCaptureLog(sessionId: string): Promise<Array<{ sourceEntryId: string; sourceTable: string }>>

  // Export & maintenance
  async exportLogs(userId: string, format: 'json' | 'csv', opts?: EventQueryOpts): Promise<string>
  async purgeOldEvents(userId: string | null, days: number): Promise<number>
}
```

### 5.5 UserTelemetryEngine

```typescript
export class UserTelemetryEngine {
  constructor(private store: UserTelemetryStore, private eventBus: CapabilityEventBus) {}

  async aggregateDaily(userId: string): Promise<UserTelemetryDailyRow>  // called by TelemetryAggregator
  async getDashboard(userId: string): Promise<UserDashboard>
  async getAdminDashboard(): Promise<AdminDashboard>                     // admin: all users
  async getActivityChart(userId: string, days: number): Promise<ActivityPoint[]>
  async getProviderBreakdown(userId: string): Promise<ProviderBreakdown[]>
  async getErrorSummary(userId: string | null): Promise<ErrorSummary>
  async runDailyAggregation(): Promise<void>  // iterates all active users
}
```

### 5.6 UserDataExportEngine

```typescript
export class UserDataExportEngine {
  constructor(
    private store: UserDataExportStore,
    private userIdentity: UserIdentityEngine,
    private userDebug: UserDebugEngine,
    private conversationStore: ConversationStore,
    private encryption: EncryptionEngine,
  ) {}

  async exportConversations(userId: string): Promise<string>
  async exportSettings(userId: string): Promise<string>
  async exportDebugLogs(userId: string, opts?: EventQueryOpts): Promise<string>
  async exportFull(userId: string): Promise<string>   // zip with everything
  async importData(userId: string, filePath: string): Promise<ImportResult>
  // Admin: export any user's data
  async exportUserData(adminUserId: string, targetUserId: string, exportType: string): Promise<string>
}
```

### 5.7 DeveloperToolsEngine (NEW — D1)

```typescript
export interface EngineStatus {
  engineId: string
  status: 'ready' | 'starting' | 'error' | 'not_requested'
  uptime?: number
  error?: string
}

export interface KernelIntrospection {
  engines: EngineStatus[]
  stores: string[]
  capabilities: number
  routes: string[]
  topology: unknown
}

export class DeveloperToolsEngine {
  constructor(
    private kernel: Kernel,
    private registry: UnifiedCapabilityRegistry,
    private db: CapStoreDb,
    private eventBus: CapabilityEventBus,
  ) {}

  // Kernel introspection
  async getEngineStatus(): Promise<EngineStatus[]>
  async getTopology(): Promise<unknown>
  async getKernelDiagnostics(): Promise<KernelIntrospection>

  // Raw query (read-only, sandboxed, developer only)
  async rawQuery(sql: string): Promise<unknown[]>

  // Debug toggles (developer only)
  async enableVerboseLogging(): Promise<void>
  async disableVerboseLogging(): Promise<void>
  async enableCdpTraceCapture(): Promise<void>
  async disableCdpTraceCapture(): Promise<void>
  async getDebugToggles(): Promise<DebugToggles>

  // Config hot-reload (developer only)
  async hotReloadConfig(engineId: string): Promise<void>

  // Version
  async getVersionInfo(): Promise<{ version: string; migrations: number; engines: number }>
}
```

---

## 6. Engine Boot Integration

All new engines are wired in `createServerWithEngines()` after provider seeding but BEFORE
capability registration. They use the existing lazy-import + try/catch pattern.

```typescript
// ── L0: User Identity (ALWAYS available — foundation for everything) ──
let userIdentity: UserIdentityEngine | undefined
try {
  const { UserIdentityEngine } = await import('../engines/user-identity.js')
  const { UserIdentityStoreImpl } = await import('../storage/impl/user-identity-store-impl.js')
  userIdentity = new UserIdentityEngine(new UserIdentityStoreImpl(db), eventBus)
  await userIdentity.ensureDefaultUser()
  log.info('user engine ready', { users: (await userIdentity.listProfiles()).length })
} catch (err) { log.error('user engine failed', { error: String(err) }) }

// ── L1: User Fleet Manager ──
let userFleet: UserFleetManager | undefined
if (userIdentity && governor) {
  try {
    const { UserFleetManager } = await import('../engines/user-fleet.js')
    const { UserFleetStoreImpl } = await import('../storage/impl/user-fleet-store-impl.js')
    userFleet = new UserFleetManager(new UserFleetStoreImpl(db), governor, userIdentity, eventBus)
  } catch {}
}

// ── L3: User Settings ──
let userSettings: UserSettingsEngine | undefined
if (userIdentity) {
  try {
    const { UserSettingsEngine } = await import('../engines/user-settings.js')
    const { UserSettingsStoreImpl } = await import('../storage/impl/user-settings-store-impl.js')
    userSettings = new UserSettingsEngine(new UserSettingsStoreImpl(db), configManager, eventBus)
  } catch {}
}

// ── L4: User Debug ──
let userDebug: UserDebugEngine | undefined
if (userIdentity) {
  try {
    const { UserDebugEngine } = await import('../engines/user-debug.js')
    const { UserDebugStoreImpl } = await import('../storage/impl/user-debug-store-impl.js')
    userDebug = new UserDebugEngine(new UserDebugStoreImpl(db), eventBus)
  } catch {}
}

// ── L5: User Telemetry ──
let userTelemetry: UserTelemetryEngine | undefined
if (userIdentity) {
  try {
    const { UserTelemetryEngine } = await import('../engines/user-telemetry.js')
    const { UserTelemetryStoreImpl } = await import('../storage/impl/user-telemetry-store-impl.js')
    userTelemetry = new UserTelemetryEngine(new UserTelemetryStoreImpl(db), eventBus)
  } catch {}
}

// ── D1: Developer Tools (only if kernel + registry + db are available) ──
let devTools: DeveloperToolsEngine | undefined
if (kernel && registry) {
  try {
    const { DeveloperToolsEngine } = await import('../engines/developer-tools.js')
    devTools = new DeveloperToolsEngine(kernel, registry, db, eventBus)
  } catch {}
}
```

These are added to `BootstrapServices` and `ServerContext`:

```typescript
export interface BootstrapServices {
  // ... existing ...
  userIdentity?: UserIdentityEngine
  userFleet?: UserFleetManager
  userSettings?: UserSettingsEngine
  userDebug?: UserDebugEngine
  userTelemetry?: UserTelemetryEngine
  devTools?: DeveloperToolsEngine
}

export interface ServerContext {
  // ... existing ...
  userIdentity?: UserIdentityEngine
  userFleet?: UserFleetManager
  userSettings?: UserSettingsEngine
  userDebug?: UserDebugEngine
  userTelemetry?: UserTelemetryEngine
  devTools?: DeveloperToolsEngine
}
```

---

## 7. Capability Catalog

### 7.1 Registry Changes

`UnifiedCapability` gets a `minRole?` field:

```typescript
export interface UnifiedCapability {
  // ... existing ...
  minRole?: 'member' | 'admin' | 'developer'
}
```

`UnifiedCapabilityRegistry.execute()` checks:

```typescript
async execute(id: string, input: Record<string, unknown>, ctx: CapabilityContext): Promise<unknown> {
  const cap = this.capabilities.get(id)
  if (!cap) throw new EngineError(`Capability ${id} not found`)

  // Role gate
  if (cap.minRole && cap.minRole !== 'member') {
    const userRole = ctx.metadata.userRole as string | undefined ?? 'member'
    const ROLE_RANK: Record<string, number> = { member: 0, admin: 1, developer: 2 }
    if (ROLE_RANK[userRole] < ROLE_RANK[cap.minRole]) {
      throw new EngineError(`Capability ${id} requires role ${cap.minRole} (caller is ${userRole})`)
    }
  }

  return cap.handler(input, ctx)
}
```

### 7.2 User Capabilities (new)

| id | slug | minRole |
|----|------|---------|
| `cap:user:create_profile` | `user_create_profile` | member |
| `cap:user:list_profiles` | `user_list_profiles` | member |
| `cap:user:switch_profile` | `user_switch_profile` | member |
| `cap:user:update_profile` | `user_update_profile` | member |
| `cap:user:delete_profile` | `user_delete_profile` | admin |
| `cap:user:set_role` | `user_set_role` | developer |
| `cap:user:current` | `user_current` | member |
| `cap:user:get_settings` | `user_get_settings` | member |
| `cap:user:update_setting` | `user_update_setting` | member |
| `cap:user:reset_settings` | `user_reset_settings` | member |
| `cap:user:view_fleet` | `user_view_fleet` | member |
| `cap:user:view_all_fleet` | `user_view_all_fleet` | admin |
| `cap:user:start_slave` | `user_start_slave` | member |
| `cap:user:stop_slave` | `user_stop_slave` | member |
| `cap:user:slave_health` | `user_slave_health` | member |
| `cap:user:view_debug_logs` | `user_view_debug_logs` | member |
| `cap:user:view_all_debug_logs` | `user_view_all_debug_logs` | admin |
| `cap:user:start_debug_capture` | `user_start_debug_capture` | member |
| `cap:user:stop_debug_capture` | `user_stop_debug_capture` | member |
| `cap:user:export_debug_logs` | `user_export_debug_logs` | member |
| `cap:user:view_dashboard` | `user_view_dashboard` | member |
| `cap:user:view_admin_dashboard` | `user_view_admin_dashboard` | admin |
| `cap:user:get_telemetry` | `user_get_telemetry` | member |
| `cap:user:get_all_telemetry` | `user_get_all_telemetry` | admin |
| `cap:user:export_data` | `user_export_data` | member |
| `cap:user:export_any_data` | `user_export_any_data` | admin |
| `cap:user:import_data` | `user_import_data` | member |
| `cap:user:session_resume` | `user_session_resume` | member |

### 7.3 Admin Capabilities (existing, now role-gated)

| id | slug | minRole | Notes |
|----|------|---------|-------|
| `cap:admin:seed` | `admin_seed` | developer | Re-seed providers from manifest |
| `cap:admin:config_get` | `admin_config_get` | admin | Read any engine config |
| `cap:admin:config_set` | `admin_config_set` | developer | Write any engine config |
| `cap:admin:config_history` | `admin_config_history` | admin | Read config audit trail |
| `cap:admin:audit` | `admin_audit` | admin | Run RegistrationAuditor |
| `cap:admin:drift` | `admin_drift` | admin | List unresolved drift |
| `cap:admin:health` | `admin_health` | admin | System health summary |
| `cap:admin:version` | `admin_version` | member | Version info (everyone can see) |

### 7.4 Developer Capabilities (new)

| id | slug | minRole | Notes |
|----|------|---------|-------|
| `cap:dev:kernel_introspect` | `dev_kernel_introspect` | developer | Engine status, topology |
| `cap:dev:raw_query` | `dev_raw_query` | developer | Read-only SQL query |
| `cap:dev:set_debug_toggle` | `dev_set_debug_toggle` | developer | Enable/disable verbose logging, CDP trace |
| `cap:dev:get_debug_toggles` | `dev_get_debug_toggles` | developer | Current debug state |
| `cap:dev:hot_reload_config` | `dev_hot_reload_config` | developer | Reload engine config without restart |
| `cap:dev:list_engines` | `dev_list_engines` | developer | All registered engines + status |
| `cap:dev:purge_events` | `dev_purge_events` | developer | Purge old debug events system-wide |
| `cap:dev:ensure_views` | `dev_ensure_views` | developer | Re-create SQL views |

---

## 8. NLCL Catalog Additions

```typescript
// In src/engines/nlcl/catalog.ts:
// ── User ──
{ intent: 'user.create', patterns: ['create profile', 'add user', 'new profile'], capabilityId: 'cap:user:create_profile', confidence: 0.95 },
{ intent: 'user.switch', patterns: ['switch to', 'switch profile', 'change user'], capabilityId: 'cap:user:switch_profile', confidence: 0.9 },
{ intent: 'user.settings', patterns: ['settings', 'preferences', 'configure profile'], capabilityId: 'cap:user:get_settings', confidence: 0.85 },
{ intent: 'user.fleet', patterns: ['my fleet', 'show slaves', 'chrome instances', 'show fleet'], capabilityId: 'cap:user:view_fleet', confidence: 0.9 },
{ intent: 'user.debug', patterns: ['debug logs', 'show errors', 'event log', 'what went wrong'], capabilityId: 'cap:user:view_debug_logs', confidence: 0.85 },
{ intent: 'user.dashboard', patterns: ['dashboard', 'usage stats', 'my activity', 'telemetry'], capabilityId: 'cap:user:view_dashboard', confidence: 0.85 },
{ intent: 'user.export', patterns: ['export data', 'backup my data', 'download conversations'], capabilityId: 'cap:user:export_data', confidence: 0.9 },

// ── Admin ──
{ intent: 'admin.dashboard', patterns: ['admin dashboard', 'system overview', 'all users', 'admin view'], capabilityId: 'cap:user:view_admin_dashboard', confidence: 0.9 },
{ intent: 'admin.all_fleet', patterns: ['all fleet', 'show all slaves', 'system fleet'], capabilityId: 'cap:user:view_all_fleet', confidence: 0.9 },
{ intent: 'admin.all_events', patterns: ['all events', 'all debug logs', 'system errors'], capabilityId: 'cap:user:view_all_debug_logs', confidence: 0.85 },
{ intent: 'admin.all_telemetry', patterns: ['all telemetry', 'system stats', 'global usage'], capabilityId: 'cap:user:get_all_telemetry', confidence: 0.85 },

// ── Developer ──
{ intent: 'dev.kernel', patterns: ['kernel status', 'engine status', 'system topology'], capabilityId: 'cap:dev:kernel_introspect', confidence: 0.9 },
{ intent: 'dev.query', patterns: ['raw query', 'sql query', 'run sql'], capabilityId: 'cap:dev:raw_query', confidence: 0.85 },
{ intent: 'dev.debug_toggle', patterns: ['enable debug', 'debug mode', 'verbose logging', 'cdp trace'], capabilityId: 'cap:dev:set_debug_toggle', confidence: 0.85 },
{ intent: 'dev.reload_config', patterns: ['reload config', 'hot reload', 'refresh config'], capabilityId: 'cap:dev:hot_reload_config', confidence: 0.85 },
```

---

## 9. API Routes (`src/server/routes/users.ts`)

```typescript
export function createUserRouter(ctx: ServerContext) {
  return async function userRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    // POST /api/users — create profile
    if (req.method === 'POST' && path === '/api/users') { /* ... */ }

    // GET /api/users — list profiles
    if (req.method === 'GET' && path === '/api/users') { /* ... */ }

    // GET /api/users/current — get active user
    if (req.method === 'GET' && path === '/api/users/current') { /* ... */ }

    // POST /api/users/switch — switch active profile
    if (req.method === 'POST' && path === '/api/users/switch') { /* ... */ }

    // PATCH /api/users/:id — update profile (self or admin)
    // DELETE /api/users/:id — delete profile (admin only)
    // PATCH /api/users/:id/role — set role (developer only)

    // GET /api/users/:id/fleet — view fleet (self or admin:all)
    // POST /api/users/:id/fleet/:slaveId/start
    // POST /api/users/:id/fleet/:slaveId/stop

    // GET /api/users/:id/settings
    // PATCH /api/users/:id/settings
    // POST /api/users/:id/settings/reset

    // GET /api/users/:id/events?severity=error&limit=50
    // POST /api/users/:id/debug/capture
    // POST /api/users/:id/debug/capture/:sid/stop
    // GET /api/users/:id/debug/sessions
    // GET /api/users/:id/debug/export

    // GET /api/users/:id/telemetry/dashboard
    // GET /api/admin/dashboard — system-wide admin dashboard
    // GET /api/admin/fleet — all users' fleet

    // GET /api/dev/kernel — kernel introspection
    // POST /api/dev/raw-query — raw SQL
    // GET /api/dev/debug-toggles
    // POST /api/dev/debug-toggles
    // POST /api/dev/hot-reload

    // POST /api/users/:id/export
    // POST /api/users/:id/import

    return undefined
  }
}
```

Mount in `server/index.ts:fetch()`:

```typescript
// In fetch(), before conversationRouter fallback:
const userRouter = createUserRouter(ctx)
const devRouter = devTools ? createDevRouter(devTools, ctx) : null

if (url.pathname.startsWith('/api/users') || url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/dev')) {
  const res = await userRouter(req) ?? await devRouter?.(req)
  if (res) return res
}
```

---

## 10. Frontend (Canvas Layers)

### 10.1 Layer Catalog

| Layer | Primitive | Who Sees |
|-------|-----------|----------|
| `user.profile-bar` | `user-profile-bar` | All users (top bar with avatar, name, role badge) |
| `user.profile-settings` | `user-profile-settings` | All users (own settings) |
| `user.profile-switcher` | `user-profile-switcher` | All users |
| `user.fleet-panel` | `user-fleet-panel` | All users (own fleet) |
| `user.slave-card` | `user-slave-card` | All users |
| `user.debug-panel` | `user-debug-panel` | All users (own events) |
| `user.dashboard` | `user-dashboard` | All users (own telemetry) |
| `user.onboarding-wizard` | `user-onboarding-wizard` | First-run |
| `admin.dashboard` | `admin-dashboard` | Admin/Dev (all users' stats) |
| `admin.all-fleet` | `admin-all-fleet` | Admin/Dev |
| `admin.all-events` | `admin-all-events` | Admin/Dev |
| `dev.kernel-panel` | `dev-kernel-panel` | Developer only (engine status, topology) |
| `dev.raw-query` | `dev-raw-query` | Developer only (SQL console) |
| `dev.debug-toggles` | `dev-debug-toggles` | Developer only |

### 10.2 Conceptual Model Seed

```typescript
// seeds/conceptual-model/user-profile-seed.ts
export function seedUserProfilePrimitives() {
  return {
    family: {
      id: 'user-profile-family',
      slug: 'user-profile',
      displayName: 'User Profile',
      basePrimitive: 'user-profile',
      slotCatalogJson: JSON.stringify([
        'user.profile-bar', 'user.profile-settings', 'user.profile-switcher',
        'user.fleet-panel', 'user.slave-card', 'user.debug-panel',
        'user.dashboard', 'user.onboarding-wizard',
        'admin.dashboard', 'admin.all-fleet', 'admin.all-events',
        'dev.kernel-panel', 'dev.raw-query', 'dev.debug-toggles',
      ]),
    },
    primitives: [
      { id: 'prim-user-profile-bar', scope: 'cross-type', label: 'User Profile Bar',
        defaultRegionJson: JSON.stringify({ region: 'top-bar', w: 320, h: 48 }) },
      { id: 'prim-admin-dashboard', scope: 'cross-type', label: 'Admin Dashboard',
        defaultRegionJson: JSON.stringify({ region: 'main-center', w: 900, h: 600 }) },
      { id: 'prim-dev-kernel-panel', scope: 'cross-type', label: 'Kernel Panel',
        defaultRegionJson: JSON.stringify({ region: 'main-center', w: 800, h: 500 }) },
      // ... etc.
    ],
    components: [
      { primitiveId: 'prim-user-profile-bar', scope: 'cross-type', ownerId: 'global',
        componentKey: 'UserProfileBar', displayName: 'User Profile Bar',
        html: '<div id="user-profile-bar" class="flex items-center gap-2 p-2"></div>',
        archetype: 'display', status: 'published',
        defaultRegionJson: JSON.stringify({ x: 0, y: 0, w: 320, h: 48 }) },
      // ... etc.
    ],
  }
}
```

### 10.3 Role-Based Layer Visibility

The frontend `useConceptualModel` hook filters layers based on `user.role`:

```typescript
const ROLE_RANK: Record<string, number> = { member: 0, admin: 1, developer: 2 }
const userRole = user?.role ?? 'member'

const visibleLayers = allLayers.filter((layer) => {
  const requiredRole = layer.minRole ?? 'member'
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole]
})
```

---

## 11. Migration Strategy

### 11.1 Prisma Migration SQL

```sql
-- Create User table
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "display_name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "avatar_color" TEXT NOT NULL DEFAULT '#6C5CE7',
  "avatar_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "is_default" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "last_active_at" INTEGER,
  "last_session_id" TEXT
);

-- Create default admin/developer user
INSERT INTO "user" ("id", "display_name", "role", "is_default", "status", "created_at", "updated_at")
VALUES ('user-default-001', 'Default User', 'developer', 1, 'active',
        CAST(strftime('%s', 'now') AS INTEGER), CAST(strftime('%s', 'now') AS INTEGER));

-- Add userId columns (nullable initially)
ALTER TABLE "vivim_session" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "provider_account" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "profile_session" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "conversation" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "trace_entry" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "kernel_spans" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "provider_health_history" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "backup_entry" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");
ALTER TABLE "sync_log" ADD COLUMN "user_id" TEXT REFERENCES "user"("id");

-- Assign existing rows to default user
UPDATE "vivim_session" SET "user_id" = 'user-default-001' WHERE "user_id" IS NULL;
UPDATE "provider_account" SET "user_id" = 'user-default-001' WHERE "user_id" IS NULL;
UPDATE "profile_session" SET "user_id" = 'user-default-001' WHERE "user_id" IS NULL;
UPDATE "conversation" SET "user_id" = 'user-default-001' WHERE "user_id" IS NULL;

-- Migrate userId = 'default' tables
UPDATE "user_preference" SET "user_id" = 'user-default-001' WHERE "user_id" = 'default';
UPDATE "user_component_layout" SET "user_id" = 'user-default-001' WHERE "user_id" = 'default';
UPDATE "workspace_mode" SET "user_id" = 'user-default-001' WHERE "user_id" = 'default';
UPDATE "context_budget_config" SET "user_id" = 'user-default-001' WHERE "user_id" = 'default';

-- Create indexes
CREATE INDEX "idx_user_role" ON "user"("role");
```

### 11.2 Idempotent Boot Check

`UserIdentityEngine.ensureDefaultUser()` — runs on every boot:
1. `SELECT COUNT(*) FROM user WHERE status = 'active'`
2. If 0: create "Developer" user (first install, developer for full access)
3. If > 0: check if default user exists, use it as active
4. Never overwrites existing data

---

## 12. Integration Points

### 12.1 ConversationManager → UserDebugEngine

```typescript
// In conversation-manager.ts, send() pipeline:
if (userDebug) {
  await userDebug.debug(userId, 'RESOLVE: capabilities resolved', 'ConversationManager', { conversationId, providerId })
  // ... after each step ...
  await userDebug.info(userId, 'SEND: message sent', 'ConversationManager', { conversationId, durationMs })
  // On error:
  await userDebug.error(userId, `SEND failed: ${err.message}`, 'ConversationManager', { conversationId, providerId, error: String(err) })
}
```

### 12.2 ChromeGovernor → UserFleetManager

```typescript
// Governor lifecycle hooks:
governor.on('slave:started', async (slave) => {
  await userFleet?.recordSlaveStarted(slave.slaveId, slave.pid)
})
governor.on('slave:stopped', async (slave) => {
  await userFleet?.recordSlaveStopped(slave.slaveId)
})
governor.on('slave:error', async (slave, error) => {
  await userFleet?.recordSlaveError(slave.slaveId, String(error))
})
```

### 12.3 TelemetryAggregator → UserTelemetryEngine

```typescript
// New aggregation schedule in DEFAULT_TELEMETRY_PIPELINE:
{
  name: 'user_telemetry_daily',
  enabled: true,
  intervalMs: 86_400_000,
  sourceTable: 'user_event',
  windowMs: 86_400_000,
  groupBy: ['user_id', 'day_ts'],
  metrics: [
    { sourceField: 'id', aggregation: 'count', targetColumn: 'total_errors', alias: 'errors' },
    // grouped by user_id
  ],
  targetTable: 'user_telemetry_daily',
  upsertColumns: ['user_id', 'day_ts'],
}
```

### 12.4 CapabilityEventBus New Event Types

```typescript
| { type: 'user:profile:created'; userId: string; role: string }
| { type: 'user:profile:deleted'; userId: string }
| { type: 'user:profile:switched'; userId: string; previousUserId: string | null; role: string }
| { type: 'user:role:changed'; userId: string; fromRole: string; toRole: string; changedBy: string }
| { type: 'user:event:logged'; userId: string; eventId: string; severity: string }
| { type: 'user:slave:state_changed'; userId: string; slaveId: string; state: string }
| { type: 'user:debug:capture_started'; userId: string; sessionId: string }
| { type: 'user:debug:capture_stopped'; userId: string; sessionId: string }
| { type: 'user:export:completed'; userId: string; exportId: string; filePath: string }
| { type: 'user:telemetry:aggregated'; userId: string; dayTs: string }
| { type: 'dev:debug_toggle_changed'; toggle: string; enabled: boolean; changedBy: string }
| { type: 'dev:config_reloaded'; engineId: string; changedBy: string }
```

---

## 13. Implementation Phases

### Phase 1: User Identity + Roles
**Schema:** `User` table, 13 table FK mods. Migration script.  
**Store:** `UserIdentityStore`.  
**Engine:** `UserIdentityEngine` (CRUD + role management).  
**Registry:** Add `minRole` to `UnifiedCapability`, add role check in `execute()`.  
**Gating:** 18 existing `admin_*` caps get `minRole: 'admin'` or `minRole: 'developer'`.  
**API:** User routes.  
**Boot:** Wired in `createServerWithEngines()`.  

### Phase 2: Fleet Ownership
**Schema:** `ChromeSlave` table.  
**Store:** `UserFleetStore`.  
**Engine:** `UserFleetManager` (user + admin fleet views).  
**Integration:** Governor lifecycle hooks → ChromeSlave table.  

### Phase 3: Session State
**Schema:** (FKs added in Phase 1). Session resume in `UserIdentityEngine`.  

### Phase 4: Settings + Config
**Schema:** `UserConfigOverride`, `UserNotificationPref`.  
**Store:** `UserSettingsStore`.  
**Engine:** `UserSettingsEngine`.  
**Config:** `ConfigScopeSchema` extended with `'user'`.  

### Phase 5: Debug Logs
**Schema:** `UserEvent`, `DebugSession`, `DebugCapturedTrace`.  
**Store:** `UserDebugStore`.  
**Engine:** `UserDebugEngine` (log, query, capture, export, purge).  
**Integration:** ConversationManager, ChromeGovernor log events.  

### Phase 6: User Telemetry
**Schema:** `UserTelemetryDaily`.  
**Store:** `UserTelemetryStore`.  
**Engine:** `UserTelemetryEngine` (dashboard, admin dashboard, aggregation).  
**Integration:** TelemetryAggregator schedule.  

### Phase 7: Data Sovereignty
**Schema:** `UserDataExport`, `UserBackupConfig`.  
**Store:** `UserDataExportStore`.  
**Engine:** `UserDataExportEngine` + `EncryptionEngine`.  

### Phase 8: Developer Tools
**Engine:** `DeveloperToolsEngine` (kernel, raw query, debug toggles, hot reload).  
**API:** `/api/dev/*` routes (developer-role-gated).  
**Caps:** 8 developer capabilities with `minRole: 'developer'`.  

### Phase 9: Frontend + Onboarding
**Conceptual Model:** Seed user-profile, admin, and dev primitives/components.  
**Canvas:** 14 layers with role-based visibility.  
**NLCL:** User, admin, and dev intents.  
**E2E:** Full flow with role switching.  

---

## 14. Invariant Compliance

| Invariant | Detail |
|-----------|--------|
| B1 | `UserFleetManager` uses `governor.spawn()`/`kill()` — never `BunCdpClient` |
| B2 | All new engines import from `src/storage/contracts/` only |
| B3 | Provider configs in seeds; user-profile UI in conceptual-model seed |
| B4 | FK cascades on all new tables; JSON columns are metadata only |
| B5 | `UserSettingsEngine` passes through `ConfigManager` with `scopeType: 'user'` |
| B9 | `UserDataExportEngine` uses `EncryptionEngine` for encrypted exports |
| B15 | User layers via `CanvasLayerMounter` → `canvas:layer:spawned` events |
| B16 | UI components as `UiComponent` rows, 4-tier resolution |
| 25.7 | All operations are `UnifiedCapability` entries passing through registry |

---

## 15. File Manifest

```
# Phase 1
CREATE  prisma/migrations/20260717_user_profile/migration.sql
MODIFY  prisma/schema.prisma
CREATE  src/storage/contracts/user-identity-store.ts
CREATE  src/storage/impl/user-identity-store-impl.ts
CREATE  src/engines/user-identity.ts
CREATE  tests/unit/engines/user-identity.test.ts
CREATE  src/server/routes/users.ts
MODIFY  src/engines/unified-registry.ts        (+minRole, +role check in execute)
MODIFY  src/engines/capability-bootstrap.ts    (+minRole on existing admin caps, +new user caps)
MODIFY  src/server/index.ts                    (+engine wiring, +userRouter mount, +ServerContext)
MODIFY  src/index.ts

# Phase 2
CREATE  src/storage/contracts/user-fleet-store.ts
CREATE  src/storage/impl/user-fleet-store-impl.ts
CREATE  src/engines/user-fleet.ts
CREATE  tests/unit/engines/user-fleet.test.ts
MODIFY  src/engines/chrome-governor.ts         (+lifecycle hooks → ChromeSlave)
MODIFY  src/engines/capability-bootstrap.ts    (+fleet caps)

# Phase 3
MODIFY  src/engines/user-identity.ts           (+resumeSession)
MODIFY  src/engines/session-checkpoint.ts      (+userId param)
MODIFY  src/engines/capability-bootstrap.ts    (+session cap)

# Phase 4
CREATE  src/storage/contracts/user-settings-store.ts
CREATE  src/storage/impl/user-settings-store-impl.ts
CREATE  src/engines/user-settings.ts
CREATE  tests/unit/engines/user-settings.test.ts
MODIFY  src/storage/contracts/config-store.ts   (+'user' in ConfigScopeSchema)
MODIFY  src/engines/capability-bootstrap.ts     (+settings caps)

# Phase 5
CREATE  src/storage/contracts/user-debug-store.ts
CREATE  src/storage/impl/user-debug-store-impl.ts
CREATE  src/engines/user-debug.ts
CREATE  tests/unit/engines/user-debug.test.ts
MODIFY  src/engines/conversation-manager.ts     (+UserEvent logging)
MODIFY  src/engines/chrome-governor.ts          (+UserEvent logging)
MODIFY  src/engines/capability-bootstrap.ts     (+debug caps)

# Phase 6
CREATE  src/storage/contracts/user-telemetry-store.ts
CREATE  src/storage/impl/user-telemetry-store-impl.ts
CREATE  src/engines/user-telemetry.ts
CREATE  tests/unit/engines/user-telemetry.test.ts
MODIFY  src/engines/telemetry-aggregator.ts     (+user_telemetry_daily schedule)
MODIFY  src/engines/capability-bootstrap.ts     (+telemetry caps)

# Phase 7
CREATE  src/storage/contracts/user-data-export-store.ts
CREATE  src/storage/impl/user-data-export-store-impl.ts
CREATE  src/engines/user-data-export.ts
CREATE  tests/unit/engines/user-data-export.test.ts
MODIFY  src/engines/capability-bootstrap.ts     (+export caps)

# Phase 8
CREATE  src/engines/developer-tools.ts
CREATE  tests/unit/engines/developer-tools.test.ts
MODIFY  src/engines/capability-bootstrap.ts     (+8 dev caps with minRole: 'developer')
MODIFY  src/server/index.ts                     (+devRouter mount, +devTools wiring)

# Phase 9
CREATE  seeds/conceptual-model/user-profile-seed.ts
MODIFY  seeds/conceptual-model/seed.ts          (+call user-profile-seed)
CREATE  web/ui/src/features/canvas/layers/UserProfileBar.tsx
CREATE  web/ui/src/features/canvas/layers/UserProfileSettings.tsx
CREATE  web/ui/src/features/canvas/layers/UserProfileSwitcher.tsx
CREATE  web/ui/src/features/canvas/layers/UserFleetPanel.tsx
CREATE  web/ui/src/features/canvas/layers/UserDebugPanel.tsx
CREATE  web/ui/src/features/canvas/layers/UserDashboard.tsx
CREATE  web/ui/src/features/canvas/layers/AdminDashboard.tsx
CREATE  web/ui/src/features/canvas/layers/AdminAllFleet.tsx
CREATE  web/ui/src/features/canvas/layers/AdminAllEvents.tsx
CREATE  web/ui/src/features/canvas/layers/DevKernelPanel.tsx
CREATE  web/ui/src/features/canvas/layers/DevRawQuery.tsx
CREATE  web/ui/src/features/canvas/layers/DevDebugToggles.tsx
CREATE  web/ui/src/features/canvas/layers/UserOnboardingWizard.tsx
MODIFY  web/ui/src/features/canvas/useNodeTypes.tsx
CREATE  web/ui/src/features/canvas/hooks/useUserProfile.ts
MODIFY  src/engines/nlcl/catalog.ts             (+user/admin/dev intents)
CREATE  tests/e2e/user-profile-flow.e2e.ts

# Docs
PRD at docs/roadmap/prds/PRD-VIVIM-USER-PROFILE-SYSTEM.md (this file)
```

---

## 16. Exit Criteria

- [ ] `User` table with `role` column. Zero `userId = 'default'` values.
- [ ] `UserIdentityEngine` creates/switches/deletes/sets-role. Unit tests pass.
- [ ] Role gating: member cannot call `admin_*` or `dev_*` capabilities. Admin cannot call `dev_*`.
- [ ] Developer can call `dev_kernel_introspect`, `dev_raw_query`, `dev_set_debug_toggle`.
- [ ] `UserFleetManager` shows per-user fleet; admin sees all users' fleet.
- [ ] `UserDebugEngine` event pipeline: ConversationManager → UserEvent rows → queryable.
- [ ] Debug capture: start → reproduce → stop → export JSON.
- [ ] `UserTelemetryEngine.getDashboard()` / `getAdminDashboard()` return correct stats.
- [ ] `POST /api/users/:id/export` produces encrypted ZIP for self; admin can export any user.
- [ ] `DeveloperToolsEngine.rawQuery()` returns results (read-only, no INSERT/UPDATE/DELETE/DROP).
- [ ] Debug toggles (verbose logging, CDP trace) change engine behavior at runtime.
- [ ] All 14 canvas layers render with correct role-based visibility.
- [ ] `bun run typecheck` → 0 errors. `bun run lint` → 0 errors.
- [ ] `bun test` → ≥ 80% on all new engines.
- [ ] `bun run devops audit-code standard` → 0 P0/P1.
- [ ] `bun run devops verify-cross-surface` → all new caps resolve.
- [ ] `bun run devops invariants check --category B` → pass.
