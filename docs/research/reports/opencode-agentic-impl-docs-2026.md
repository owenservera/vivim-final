# OpenCode Agentic Dev Loops & Subagent Orchestration — Full Implementation Docs (vivim-final)

*Generated: 2026-07-19 | Companion to `opencode-agentic-capabilities-sota-2026.md` | Confidence: High*

This document is the **implementation manual** for wiring OpenCode (and Kilocode, which shares the
same architecture) into vivim-final as a `local-agent` provider type (Shape B). It is built entirely
from official OpenCode documentation plus vivim-final's engine contracts. All commands are
PowerShell-compatible (per AGENTS.md). No CDP, ChromeGovernor untouched.

---

## PART 0 — Architecture decision (recap)

```
POST /api/interpret
   └─> UnifiedCapabilityRegistry
         ├─ provider_type == 'llm'      -> ChromeGovernor (CDP)        [unchanged]
         └─ provider_type == 'local-agent' -> LocalAgentProviderExecutor
                  ├─ spawn: kilo/opencode run --auto  (one-shot)
                  └─ http : POST serve /session/:id/message (persistent)
                         └─> StreamParserEngine -> ContentBlock[]
```

New surfaces: `src/engines/local-agent/*` (executor + agent store contract), a seed manifest, and
`UnifiedCapability` registrations. Everything else (registry, composer, event bus, conversation
manager) is reused.

---

## PART 0.5 — TESTED ON THIS HOST (2026-07-19, overrides assumptions)

These were executed, not inferred. `opencode` is installed via bun on Windows; `kilo` present.
**Zen free models need no API key and cost 0.**

```powershell
# Verified: these four Zen free models RUN non-interactively with zero key
opencode run --auto --model opencode/deepseek-v4-flash-free --format json "PONG"   # exit 0, cost 0
opencode run --auto --model opencode/hy3-free            --format json "OK"        # exit 0
opencode run --auto --model opencode/mimo-v2.5-free       --format json "OK"        # exit 0
opencode run --auto --model opencode/north-mini-code-free --format json "OK"        # exit 0

# Verified BROKEN (do NOT use):
opencode run --auto --model opencode/nemotron-3-ultra-free --format json "OK"       # no output in 5 min
```

| Model (USE THESE) | Latency (cold) | Notes |
|---|---|---|
| `opencode/deepseek-v4-flash-free` | ~43s | general coding, reliable |
| `opencode/hy3-free` (Tencent) | ~54s | your named model, works |
| `opencode/mimo-v2.5-free` | ~41s | fastest of the set |
| `opencode/north-mini-code-free` | ~37s | code-specialized mini |

`nemotron-3-ultra-free` is **excluded** — timed out even at 5 min.

`serve` starts unsecured unless `OPENCODE_SERVER_PASSWORD` is set (observed log line). Always set it.

## PART 1 — Install & trust (official)

```powershell
# OpenCode
npm install -g opencode        # or: scoop install opencode / brew install opencode

# Kilocode (CLI 1.0, OpenCode fork)
npm install -g @kilocode/cli

# Verify
opencode --version
kilo --version
```

Auth (trusted config only — never commit project config with secrets):
```powershell
opencode auth login --provider anthropic     # writes ~/.local/share/opencode/auth.json
# or set in trusted global config:
#   provider.anthropic.options.apiKey = "{env:ANTHROPIC_API_KEY}"
$env:ANTHROPIC_API_KEY = "sk-..."            # trusted env
```
Kilo equivalent: `kilo auth` or `~/.config/kilo/kilo.json[c]` with `{env:VAR}` (trusted only).

> **Security rule (official):** `{env:VAR}` resolves ONLY in global config, `OPENCODE_CONFIG_CONTENT`,
> or MDM-managed config. A project-committed `kilo.json`/`opencode.json` cannot read secrets.

---

## PART 2 — Agent definitions (official config)

### 2.1 JSON config (`opencode.json` / `kilo.json`)
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "build":   { "mode": "primary", "model": "anthropic/claude-sonnet-4-20250514",
                 "prompt": "{file:./prompts/build.txt}", "permission": { "edit":"allow","bash":"allow" } },
    "plan":    { "mode": "primary", "model": "anthropic/claude-haiku-4-20250514",
                 "permission": { "edit":"deny","bash":"deny" } },
    "code-reviewer": { "description":"Reviews code for best practices and potential issues",
                 "mode":"subagent", "model":"anthropic/claude-sonnet-4-20250514",
                 "prompt":"You are a code reviewer. Focus on security, performance, maintainability.",
                 "permission": { "edit":"deny" } }
  }
}
```

### 2.2 Markdown agents (`.opencode/agents/review.md` → agent `review`)
```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
  webfetch: deny
---
You are in code review mode. Focus on code quality, bugs, performance, security.
```

### 2.3 Every agent axis (official keys)
| Key | Values | Notes |
|---|---|---|
| `description` | string | **required**; drives Task-tool selection |
| `mode` | `primary`\|`subagent`\|`all` | default `all` |
| `model` | `provider/model` | per-agent override |
| `prompt` | string / `{file:...}` | system prompt |
| `temperature` | 0.0–1.0 | 0–0.2 focused, 0.6–1.0 creative |
| `top_p` | 0.0–1.0 | diversity |
| `steps` | integer | max agentic iterations (cost cap) |
| `permission` | allow/ask/deny + glob | gates tools |
| `hidden` | true | programmatic-only subagent |
| `color` | hex/theme | UI only |
| `disable` | true | turn off |
| `permission.task` | glob allow/deny | which subagents this agent may invoke |
| *(pass-through)* | any | forwarded to provider as model options (`reasoningEffort`, `textVerbosity`, …) |

### 2.4 Subagent orchestration (the loop primitive)
- Primary agents invoke subagents via the **Task tool**; restrictions via `permission.task`:
  ```jsonc
  "orchestrator": { "mode":"primary", "permission": { "task": { "*":"deny", "orchestrator-*":"allow", "code-reviewer":"ask" } } }
  ```
  `deny` removes the subagent from the Task description entirely (model won't try it).
- Manual invoke: `@general help me search for this function` (message `@`-mention).
- Child sessions: `session_child_first` (Leader+Down), `session_child_cycle` (Right),
  `session_child_cycle_reverse` (Left), `session_parent` (Up).
- Built-ins: **General** (full tools, multi-step), **Explore** (read-only, fast), **Scout**
  (read-only external/docs), **Build**/**Plan** (primary), plus hidden Compaction/Title/Summary.

---

## PART 3 — Headless dev loop (official CLI)

### 3.1 One-shot (preferred for unattended devops)
```powershell
# TESTED — Zen free, no key. Use one of the four verified models (see PART 0.5).
opencode run "Implement feature X and open a PR" --auto --model opencode/deepseek-v4-flash-free
kilo     run --auto "Implement feature X and open a PR"
```
Flags: `--auto` (auto-approve non-denied), `--model provider/model`, `--agent <id>`,
`--format json` (OpenCode raw JSON events), `--continue`/`--session`, `--attach <url>`,
`--dir <path>`, `--title`, `--variant` (reasoning effort).
**Exit codes:** `0` success · `124` timeout · `1` error. Kilo: same set.

### 3.2 Warm server (skip MCP cold boot)
```powershell
# Terminal 1 — headless server
opencode serve --port 4096 --hostname 127.0.0.1
# Terminal 2 — attach (reuses MCP servers)
opencode run --attach http://localhost:4096 "Explain async/await in JavaScript"
```
For networked `serve`, set `OPENCODE_SERVER_PASSWORD` (username defaults `opencode`).

### 3.3 ACP (stdin/stdout nd-JSON — best embed contract)
```powershell
opencode acp --cwd C:\path\to\repo      # or kilo acp
```
Use ACP when embedding OpenCode as a managed subagent inside another runtime (e.g., vivim's
`CapabilityComposer`).

---

## PART 4 — Headless HTTP API (official server surface)

`opencode serve` publishes OpenAPI 3.1 at `http://localhost:4096/doc`. Key endpoints:

| Method | Path | Use in vivim |
|---|---|---|
| `GET` | `/global/health` | liveness probe |
| `POST` | `/session` | create conversation |
| `GET` | `/session` | list |
| `DELETE` | `/session/:id` | cleanup |
| `POST` | `/session/:id/message` | blocking send → `ContentBlock[]` |
| `POST` | `/session/:id/prompt_async` | fire-and-forget (204) |
| `POST` | `/session/:id/command` | slash command |
| `POST` | `/session/:id/shell` | shell exec |
| `GET` | `/session/:id/message` | history |
| `GET` | `/file/content?path=` | read file |
| `GET` | `/find?pattern=` `/find/file` `/find/symbol` | grep/glob/symbol |
| `GET` | `/event` | SSE stream → event bus |
| `POST` | `/mcp` | add MCP server |
| `PUT` | `/auth/:id` | set credentials |
| `GET` | `/experimental/tool/ids` `/experimental/tool` | tool schemas |

Example (blocking send):
```powershell
$body = '{"parts":[{"type":"text","text":"Refactor stream-parser fallback chain"}]}'
Invoke-RestMethod -Uri "http://localhost:4096/session/$sid/message" -Method Post `
  -ContentType 'application/json' -Body $body
```

---

## PART 5 — vivim-final implementation (new code)

### 5.1 Provider manifest (seed) — `seeds/providers/local-agent.ts`
Add to `PROVIDER_MANIFESTS` a `provider_type: 'local-agent'` entry (new enum value):
```typescript
{
  provider: {
    slug: 'opencode',
    display_name: 'OpenCode Agent',
    description: 'Headless OpenCode agentic backend (LLM API caller, not a web UI)',
    category: 'agent',
    provider_type: 'local-agent',          // NEW — distinct from 'llm' (CDP)
    website_url: 'https://opencode.ai',
    auth_type: 'apikey',                    // vs 'browser' for CDP providers
    has_multi_account: false,
    profile_strategy: 'none',
    capabilities: ['send_message','select_model','run_subagent','fork_session','get_stream_blocks'],
  },
  endpoints: [],                             // no CDP endpoints
  models: [
    { slug:'opencode/deepseek-v4-flash-free', display_name:'DeepSeek V4 Flash (Zen free)', is_default:true },
    { slug:'opencode/hy3-free', display_name:'Tencent Hy3 (Zen free)' },
    { slug:'opencode/mimo-v2.5-free', display_name:'Mimo 2.5 (Zen free)' },
    { slug:'opencode/north-mini-code-free', display_name:'North Mini Code (Zen free)' },
  ],
}
// VERIFIED 2026-07-19: the four Zen free models above all run with no API key, cost 0.
// `nemotron-3-ultra-free` EXCLUDED — timed out (>5 min) in test.
```
> Update `ProviderManifestSchema` (Zod) to accept `'local-agent'` in `provider_type`.

### 5.2 Store contract — `src/storage/contracts/local-agent-store.ts`
```typescript
export interface LocalAgentStore {
  getAgentConfig(slug: string): Promise<LocalAgentConfig | null>
  upsertAgentConfig(cfg: LocalAgentConfig): Promise<void>
  listAgentConfigs(): Promise<LocalAgentConfig[]>
}
export interface LocalAgentConfig {
  slug: string
  bin: 'opencode' | 'kilo'
  defaultModel?: string
  permission: Record<string, 'allow' | 'ask' | 'deny'>
  hidden?: boolean
}
```

### 5.3 Executor — `src/engines/local-agent/local-agent-executor.ts`
```typescript
import { spawn } from 'node:child_process'
import type { ContentBlock } from '@/engines/stream-parser.js'
import type { LocalAgentStore } from '@/storage/contracts/local-agent-store.js'

export interface LocalAgentRequest {
  slug: 'opencode' | 'kilo'
  message: string
  model?: string
  cwd?: string
  agent?: string
  timeoutMs?: number
  attachUrl?: string          // warm serve
}

export class LocalAgentProviderExecutor {
  constructor(private store: LocalAgentStore) {}

  async run(req: LocalAgentRequest): Promise<ContentBlock[]> {
    const bin = req.slug
    const args = req.attachUrl
      ? ['run', '--attach', req.attachUrl, req.message]
      : ['run', '--auto', req.message,
         ...(req.model ? ['--model', req.model] : []),
         ...(req.agent ? ['--agent', req.agent] : []),
         ...(req.cwd ? ['--dir', req.cwd] : [])]
    if (req.slug === 'opencode' && !req.attachUrl) args.push('--format', 'json')

    const proc = spawn(bin, args, { cwd: req.cwd, env: { ...process.env } })
    const chunks: Buffer[] = []
    proc.stdout.on('data', (d: Buffer) => chunks.push(d))

    const code = await new Promise<number>((res) => {
      proc.on('close', (c) => res(c ?? 1))
      setTimeout(() => proc.kill('SIGTERM'), req.timeoutMs ?? 120_000).unref()
    })
    if (code === 124) throw new Error('local-agent: timeout')
    if (code !== 0) throw new Error(`local-agent: exit ${code}`)
    return this.parse(Buffer.concat(chunks).toString('utf8'))
  }

  private parse(raw: string): ContentBlock[] {
    // Reuse StreamParserEngine (DB-only parser logic) — never inline parse rules.
    return streamParserEngine.parse('local-agent', raw) as ContentBlock[]
  }
}
```

### 5.4 Capability registration — `src/engines/local-agent/caps.ts`
```typescript
import { UnifiedCapability } from '@/engines/unified-registry.js'
import { LocalAgentProviderExecutor } from './local-agent-executor.js'

export function registerLocalAgentCaps(exec: LocalAgentProviderExecutor): UnifiedCapability[] {
  return [
    {
      id: 'cap:agent:run', slug: 'agent_run', name: 'Run OpenCode/Kilo agent',
      description: 'Execute a one-shot headless agent task',
      category: 'agent', surfaces: ['cli','ui','api','mcp','workflow'],
      inputSchema: { message: 'string', model: 'string?', agent: 'string?' },
      outputSchema: { blocks: 'ContentBlock[]' },
      handler: (i) => exec.run({ slug:'opencode', message: String(i.message),
        model: i.model as string|undefined, agent: i.agent as string|undefined }),
      cliCommand: { name:'agent run', aliases:['ar'], examples:['agent run "fix lint"]' },
      mcpToolName: 'agent_run', apiEndpoint: { method:'POST', path:'/api/agent/run' },
      isAsync: false, requiresConfirmation: false, tags: ['agent','local-agent'],
    },
    // ... agent.subagent.invoke, agent.session.fork, tool.* , server.* per capability list
  ]
}
```

### 5.5 Wiring (boot)
In `capability-bootstrap.ts` (or `src/engines/capability-bootstrap.ts`), after seeding harness
commands, register local-agent caps:
```typescript
const executor = new LocalAgentProviderExecutor(localAgentStore)
for (const cap of registerLocalAgentCaps(executor)) registry.register(cap)
```

### 5.6 Event bridge (SSE → CapabilityEventBus)
```typescript
// src/engines/local-agent/event-bridge.ts
const es = await fetch(`http://localhost:4096/event`, { headers: { accept:'text/event-stream' } })
// pipe server bus events into CapabilityEventBus.emit(...)
```

---

## PART 6 — Subagent orchestration in vivim

Compose a multi-agent DAG with `CapabilityComposer` (existing):
```typescript
const dag = compileRecipe({
  steps: [
    { id:'plan',   capabilityId:'cap:agent:run', input:{ agent:'plan',    message:'Plan unit 2.1' } },
    { id:'build',  capabilityId:'cap:agent:run', input:{ agent:'build',   message:'Implement per plan', dependsOn:['plan'] } },
    { id:'review', capabilityId:'cap:agent:run', input:{ agent:'code-reviewer', message:'Review diff', dependsOn:['build'] } },
  ],
})
```
Each step shells `opencode run --auto --agent <id>`. `permission.task` on the orchestrator agent
limits which subagents may be spawned. Background subagents via
`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=1` map to `isAsync:true` capabilities.

---

## PART 7 — Operational guardrails (official + vivim invariants)

1. **Permission deny-by-default for risky tools.** In `local-agent` config:
   ```jsonc
   "permission": { "*":"ask", "bash": { "*":"ask", "rm *":"deny", "git push":"ask" } }
   ```
2. **serve auth**: always set `OPENCODE_SERVER_PASSWORD` if `serve` is reachable beyond localhost.
3. **Timeout**: client-side `120s` + `124` check; never rely on agent self-termination.
4. **No DOM**: local-agent capabilities must NOT import `ChromeGovernor` (Governor Canon).
5. **Secrets**: only global/`OPENCODE_CONFIG_CONTENT` config may carry `{env:VAR}`.
6. **Resume**: use explicit `--session <id>`; never combine `--continue` + prompt + `--auto`.
7. **Observability**: set `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces; surface `agent.stats`.

---

## PART 8 — Verification

```powershell
# 1. Headless one-shot works
opencode run "say hi" --auto --format json

# 2. vivim capability resolves + executes
bun run devops runtime-test test --nl "run opencode agent: fix the lint error in stream-parser.ts"

# 3. Subagent DAG runs
bun run devops runtime-test test --nl "orchestrate: plan then build then review unit X"

# 4. Governor Canon intact (no CDP import in local-agent)
Get-Content src/engines/local-agent/*.ts | Select-String "chrome-governor"   # expect: none

# 5. Cross-surface parity
bun run devops verify-cross-surface
```

---

## PART 9 — Sources (official, fetched 2026-07-19)
1. OpenCode Agents — https://opencode.ai/docs/agents/
2. OpenCode Tools — https://opencode.ai/docs/tools/
3. OpenCode CLI — https://opencode.ai/docs/cli/
4. OpenCode Server — https://opencode.ai/docs/server/
5. OpenCode Config — https://opencode.ai/docs/config/
6. OpenCode Providers — https://opencode.ai/docs/providers/
7. Kilo Code CLI — https://kilo.ai/docs/code-with-ai/platforms/cli
8. vivim-final source — `src/engines/{unified-registry,capability-composer,conversation-manager,provider-registrar,stream-parser,capability-event-bus,chrome-governor}.ts`, `seeds/providers/manifests.ts`
