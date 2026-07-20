# Contracts: OpenCode `serve` Client API

**Feature**: `027-opencode-serve` | **Date**: 2026-07-19

> The authoritative contract is the live OpenAPI at `GET /doc` of a running `opencode serve`.
> This document pins the subset the vivim client depends on (verified against opencode v1.17.15).

## Base URL & Auth

- Base: `http://127.0.0.1:<port>` (loopback only).
- Auth: HTTP Basic. User `OPENCODE_SERVER_USERNAME` (default `opencode`), password `OPENCODE_SERVER_PASSWORD`.
- All requests include `Authorization: Basic base64(user:password)`.

## Endpoints

### `GET /doc`
- Returns OpenAPI 3.1 JSON. Used as the **readiness probe** (200 = server up) and schema source.
- Client: `await fetch(base + '/doc', {headers: auth})`.

### `GET /global/health`
- Liveness. Supervisor polls this (or `/doc`) until 200 before declaring ready.

### `POST /session`
- Body: `{ message?: string, cwd?: string, agent?: string, model?: string }`.
- Response: `{ id: string, ... }` — the `sessionId` (→ `AgentSession.providerSessionId`).

### `POST /session/:id/message`
- Body: `{ message: string }`.
- Sends a turn synchronously. Response 200 = accepted.

### `POST /session/:id/prompt_async`
- Body: `{ prompt: string }`.
- Async dispatch; streamed via `GET /event`. Response 202 = queued.

### `GET /event` (SSE)
- `Accept: text/event-stream`. Streams session events.
- Each frame is a JSON object with top-level `type` and `part` (same grammar as `--format json`).
- Client parses each frame via `parseOpencodeJson`.

### `GET /session/:id/diff`
- Returns file diffs for the session. Source of `AgentFileEdit.patchJson` (RFC-6902).

### `POST /session/:id/permissions/:permissionID`
- Body: `{ decision: 'allow' | 'deny' | 'allow_always' }`.
- Governor replies here for each `/event` permission request.

## SSE Frame → ContentBlock Mapping (reuse `parseOpencodeJson`)

| frame `type` / `part.type` | ContentBlock |
|----------------------------|--------------|
| `text` / `part.type:'text'` | `{type:'text',text}` |
| `reasoning` | `{type:'reasoning',text}` |
| `step-start` | `{type:'step-start'}` |
| `tool` (valid) | `{type:'tool-call',...}` + `{type:'tool-result',...}` |
| `tool` (`part.tool==='invalid'`) | `{type:'error',code:'PERMISSION_DENIED',message}` |
| `error` | `{type:'error',code:'AGENT_FAILED',message}` |

## Client Interface (TypeScript)

```ts
export interface OpenCodeClient {
  ready(): Promise<void>                                  // poll /doc until 200
  createSession(opts: { cwd?: string; model?: string; message?: string }): Promise<{ sessionId: string }>
  sendPrompt(sessionId: string, prompt: string): Promise<void>
  subscribe(sessionId: string, onEvent: (ev: OpencodeEvent) => void): Promise<() => void>
  respondPermission(sessionId: string, permissionId: string, decision: 'allow' | 'deny' | 'allow_always'): Promise<void>
  getDiff(sessionId: string): Promise<unknown>
}
```

## Supervisor Interface (TypeScript)

```ts
export interface OpenCodeSupervisor {
  start(): Promise<{ port: number }>
  stop(): Promise<void>
  isRunning(): boolean
  on(event: 'ready' | 'exit' | 'error', cb: (info: unknown) => void): void
}
```
