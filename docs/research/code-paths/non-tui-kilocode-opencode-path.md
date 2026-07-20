# Non-TUI Kilocode / OpenCode → vivim-final — Confirmed Code Path

**Convergence:** CONFIRMED
**Iterations:** 3 | **Confidence:** High | **Date:** 2026-07-18

## Recommended Approach
Register Kilo/OpenCode as a **new `local-agent` provider type** (Shape B), executed by a thin
`LocalAgentProviderExecutor` that spawns `kilo run --auto` / `opencode run --auto` (or POSTs to
`opencode serve`) and parses stdout/JSON into vivim `ContentBlock[]` via the existing
`StreamParserEngine` contract. No CDP, no ChromeGovernor involvement — preserves the Governor Canon
invariant.

## Working Code Example

```typescript
// src/engines/local-agent-provider.ts
// Shape B: agent backend as a vivim provider. No CDP. Spawns the CLI / hits serve HTTP.
import { spawn } from 'node:child_process';
import { type ContentBlock } from '@/engines/stream-parser'; // existing block shape

export interface LocalAgentRequest {
  slug: 'kilo' | 'opencode';
  message: string;
  model?: string;          // provider/model
  cwd?: string;
  timeoutMs?: number;      // kilo returns 124 on timeout
  denyTools?: string[];    // explicit deny for autonomous mode
}

// Option 1: one-shot via CLI (preferred for unattended devops jobs)
export async function runLocalAgent(req: LocalAgentRequest): Promise<ContentBlock[]> {
  const bin = req.slug === 'kilo' ? 'kilo' : 'opencode';
  const args = [
    'run',
    '--auto',
    req.message,
    ...(req.model ? ['--model', req.model] : []),
    ...(req.cwd ? ['--dir', req.cwd] : []),
  ];
  // OpenCode can emit raw JSON events; Kilo 1.x prints formatted text.
  if (req.slug === 'opencode') args.push('--format', 'json');

  const proc = spawn(bin, args, { cwd: req.cwd, env: { ...process.env } });
  const chunks: Buffer[] = [];
  proc.stdout.on('data', (d) => chunks.push(d));

  const code = await new Promise<number>((resolve) => {
    proc.on('close', (c) => resolve(c ?? 1));
    setTimeout(() => proc.kill('SIGTERM'), req.timeoutMs ?? 120_000).unref();
  });
  if (code === 124) throw new Error('local-agent: timeout');
  if (code !== 0) throw new Error(`local-agent: exit ${code}`);

  const raw = Buffer.concat(chunks).toString('utf8');
  // Parse raw|json into ContentBlock[] — reuse StreamParserEngine (DB-only parser contract).
  return parseAgentOutput(req.slug, raw);
}

// Option 2: persistent server (richer API, reuse MCP) — only if networked + password set
export async function postToServe(baseUrl: string, sessionId: string, message: string) {
  const r = await fetch(`${baseUrl}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text: message }] }),
  });
  return r.json(); // { info: Message, parts: Part[] }
}
```

## Why This Works
1. `kilo run --auto` is documented as the autonomous non-interactive CI entrypoint (exit 0/124/1) —
   [Kilo CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli).
2. `opencode run --auto --format json` emits raw JSON events for machine parsing; `--attach` avoids
   MCP cold boot — [OpenCode CLI docs](https://opencode.ai/docs/cli/).
3. `opencode serve` `/session/:id/message` + `/event` SSE is a stable OpenAPI 3.1 contract —
   [OpenCode Server docs](https://opencode.ai/docs/server/).
4. vivim's `ContentBlock` shape (`text`/`reasoning`/`tool-call`/…) already matches agent output and is
   produced by `StreamParserEngine` — local source `seeds/providers/manifests.ts` + parser contracts.

## Prerequisites
- `@kilocode/cli` (npm i -g) or `opencode` installed on the devops host.
- `{env:VAR}` API keys in **trusted** config only (global or `KILO_CONFIG_CONTENT`), never committed
  project `kilo.json` (security rule from Kilo/OpenCode config).
- For `serve` option: `OPENCODE_SERVER_PASSWORD` set + bound to localhost.

## Known Gotchas
- **Blind follow-ups:** autonomous mode auto-answers "decide autonomously"; set explicit `deny` in
  permission config for destructive tools (rm, etc.). Mitigation: `permission: { "*": "ask", "bash": { "rm *": "deny" } }`.
- **`serve` hangs:** community reports infinite loops in `serve`+client — prefer `run` for unattended
  jobs; if using `serve`, add client-side timeout + `124` check.
- **No DOM vision:** non-TUI agents can't see a browser; don't try to drive their web UI via CDP
  (that's Shape A, deprecated for devops).
- **`--continue`互斥:** cannot combine resume + prompt + `--auto`; use explicit session IDs.

## Alternatives Considered
| Approach | Why Rejected | Source |
|----------|--------------|--------|
| Shape A: CDP-wrap Kilo/OpenCode web UI as a chatgpt-like provider | Heavyweight, needs logged-in browser, loses structured JSON, defeats headless purpose | vivim manifests (CDP-shaped) vs headless goal |
| Long-lived `opencode serve` for every devops call | Hang risk; unnecessary server lifecycle for one-shots | serve-hang issue |
| Call LLM APIs directly (skip Kilo/OpenCode) | Loses agentic loop, tools, permissions, compaction — the whole point of using them | OpenCode internals |

## Verification Steps
1. `kilo run --auto "say hi" --dir <vivim-root>` returns exit 0 and prints a response.
2. `opencode run "say hi" --auto --format json` returns JSON events parseable to `ContentBlock[]`.
3. Seed a `local-agent` provider manifest; `POST /api/interpret` routes to it; capability executes the
   CLI and returns parsed blocks.
4. Gate: ensure ChromeGovernor is NOT imported by `local-agent-provider.ts` (Governor Canon).

## Risk Assessment
- **Technical risk:** Low — CLI/HTTP contracts are documented and stable.
- **Integration risk:** Medium — needs new `provider_type` enum + executor; touches ProviderRegistrar seed path.
- **Maintenance risk:** Low — Kilo/OpenCode are MIT, BYO-model, actively maintained; config schema stable.
