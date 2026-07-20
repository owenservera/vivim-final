# Area 5 — ACP (Agent Client Protocol) stdio Contract

**Verified against:** opencode v1.17.15 (ACP handshake reports `agentInfo.version: 1.18.2`).
**Evidence:** `evidence/opencode-deep/05-acp-help.txt`, `evidence/opencode-deep/05-acp-stdio.transcript.txt`, `evidence/opencode-deep/05-acp-stdio2.transcript.txt`

## Transport
- `opencode acp` is a **JSON-RPC 2.0 server over newline-delimited stdio** (`--port` defaults to 0 = stdio).
- Flags: `--print-logs`, `--log-level`, `--pure`, `--port` (0=stdio), `--hostname`, `--mdns`, `--mdns-domain`, `--cors`, `--cwd`.

## Handshake
```
--> {"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":1}}
<-- {"jsonrpc":"2.0","id":"1","result":{
       "protocolVersion":1,
       "agentCapabilities":{
         "loadSession":true,
         "mcpCapabilities":{"http":true,"sse":true},
         "promptCapabilities":{"embeddedContext":true,"image":true},
         "sessionCapabilities":{"close":{},"fork":{},"list":{},"resume":{}}
       },
       "authMethods":[{"id":"opencode-login","name":"Login with opencode",
                       "description":"Run `opencode auth login` in the terminal"}],
       "agentInfo":{"name":"OpenCode","version":"1.18.2"}
     }}
```
- `initialize` **requires** `params.protocolVersion` (number). `{}` → `-32602 Invalid params` (`expected number, received undefined`). Any number is accepted (lenient echo).
- The `agentCapabilities` block is the protocol surface contract: fork/resume/list/close are **ACP-native session ops**; embeddedContext + image prompts supported; MCP http/sse supported.

## Method dispatch
- `prompt` → `-32601 Method not found` (probe 1, before init completed).
- `chat` → `-32601 Method not found` (probe 2).
- `message` → `-32601 Method not found` (probe 2).
- The actual prompt-sending method requires a **session to be created first** (per `sessionCapabilities`, likely `session/new` then a session-scoped prompt method). Exact method name not enumerated in this probe; the HTTP API (`/prompt_async`, `/message`) is the documented path (Area 4).

## Config loading
- ACP **loads the repo `opencode.json`** (confirmed in logs: `loading path=...\vivim-final\opencode.json`). Config precedence identical to CLI (Area 10).

## Version discrepancy (flag in brief)
- CLI `--version` reports **1.17.15**; ACP `initialize` result reports **1.18.2**. Two possibilities: (a) the binary's ACP server advertises a different version string, or (b) a second opencode build is on PATH. The v2 executor should not hard-depend on a single version string; pin the binary path and re-verify version at deploy.

## Implication for v2 backend
- ACP is viable as an alternative transport but its prompt method requires session bootstrap. The CLI (`run --format json`) is simpler and fully verified for one-shot + multi-turn (Area 7). **Recommendation: use CLI transport for v2; keep ACP as a future option.**
