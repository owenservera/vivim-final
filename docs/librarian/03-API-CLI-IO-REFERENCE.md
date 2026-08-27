# 03 — API / CLI / I·O REFERENCE
### Generates: API-REFERENCE.md, CLI-REFERENCE.md, IO-REFERENCE.md

These are the "ground truth interface contracts." Every entry must be copy-verified against source — no paraphrased signatures.

---

## 1. `docs/interfaces/API-REFERENCE.md`

Split into two parts even if one is empty (state "None found" rather than omitting the heading).

### Part A — Tauri IPC Commands

One entry per command, in this exact shape:

```markdown
### `command_name`
- **File:** `src-tauri/src/<path>.rs`
- **Signature:** `fn command_name(arg1: Type1, arg2: Type2) -> Result<ReturnType, ErrorType>`
- **Async:** yes/no
- **Registered in invoke_handler:** yes/no — ⚠️ if no, flag as dead/unreachable code
- **Called from (frontend):** every `invoke('command_name', ...)` call site, file + line context
- **Purpose:** plain-language description
- **Parameters:**
  | Name | Type | Required | Description |
  |---|---|---|---|
- **Returns:** shape of success value
- **Errors:** every distinct error variant/condition and when it fires
- **Side effects:** DB writes, filesystem writes, events emitted
- **Example call (TypeScript):**
  ```ts
  const result = await invoke<ReturnType>('command_name', { arg1, arg2 });
  ```
```

Also include a **command inventory table** at the top: Command | Async | Side Effects | Called From — for quick scanning.

### Part B — Next.js HTTP Routes (if any)

One entry per route file:

```markdown
### `METHOD /path`
- **File:** `app/api/<path>/route.ts`
- **Auth required:** yes/no + mechanism
- **Request:** headers/query/body shape (from types/schema)
- **Response:** shape + status codes, including error responses
- **Calls into:** DB tables touched, other services called
- **Example:**
  ```bash
  curl -X METHOD https://.../path -d '{...}'
  ```
```

### Part C — IPC Events (pub/sub, not request/response)
Table: Event name | Emitted from (file) | Payload shape | Listened to by (file) | Purpose.

---

## 2. `docs/interfaces/CLI-REFERENCE.md`

For each CLI surface found (npm scripts meant to be run directly, custom bin, Tauri CLI wrappers):

```markdown
### `<command>`
- **Invocation:** `npm run <script>` / `./bin/<tool> <subcommand>`
- **Source:** `<file>`
- **Purpose:** ...
- **Flags/Arguments:**
  | Flag | Type | Default | Description |
  |---|---|---|---|
- **Environment dependencies:** any env vars it reads
- **Exit codes:** what each exit code means, if the tool sets them explicitly
- **Example:**
  ```bash
  npm run seed -- --fresh
  ```
```

Include a top-level **"Common workflows"** section stringing multiple CLI commands together for real tasks: first-time setup, running dev, running tests, producing a release build, resetting the local DB.

---

## 3. `docs/interfaces/IO-REFERENCE.md`

This is the definitive "what does this app touch on the machine it runs on" document — critical for security review and support/debugging.

### 3.1 Environment variables
Table: Name | Required/Optional | Default | Read by (file) | Purpose | Sensitive? (yes/no)

### 3.2 Configuration files
For each config file (`.env`, `tauri.conf.json`, any app-specific config JSON/TOML the app itself reads at runtime): location, format, who reads it (Rust/Node), what happens if missing/malformed.

### 3.3 Filesystem access map
Table: Path (or path pattern, e.g. `$APPDATA/app/db.sqlite`) | Read/Write/Both | Purpose | Governed by which Tauri capability/permission | User-visible or internal-only.

Explicitly resolve Tauri path variables (`$APPDATA`, `$APPCONFIG`, `$RESOURCE`, etc.) to what they mean per-OS if the app targets multiple platforms.

### 3.4 Network access map
Table: Destination/host | Direction (outbound only unless a local server is run) | Protocol | Auth | Triggered by which feature | Data sent | Data received.
If genuinely zero network calls exist, state that plainly as a notable property (relevant to product description too).

### 3.5 OS integration surface
List: system tray, native notifications, global shortcuts, deep link handling, clipboard access, drag-and-drop, auto-updater — for each, whether present, how it's implemented, and what permission it requires.

### 3.6 Tauri capability/permission manifest (v2) or allowlist (v1)
Reproduce the actual capabilities/allowlist configuration as a table: Capability | Scope | Why the app needs it (map to the feature that uses it). This table should let a security reviewer approve/deny each capability independently.
