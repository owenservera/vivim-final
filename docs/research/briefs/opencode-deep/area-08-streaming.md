# Area 8 — Streaming & NDJSON / SSE Transport

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/08-streaming.transcript.txt`, `evidence/opencode-deep/08-streaming-variant.txt`, `evidence/opencode-deep/04-serve-probe*.log`

## CLI `--format json` = NDJSON (newline-delimited JSON)
- Each event is a **single-line JSON object**. No array wrapper, no JSONL envelope. Verified: 4 lines, all `ConvertFrom-Json`-valid, 0 invalid.
- Parse by splitting stdout on `\n`, `JSON.parse` each non-empty line.
- Event `type` is the dispatcher field (Area 1 table).

## SSE (serve) = `data: <json>\n\n`
- `GET /api/event` and `GET /api/session/:id/event` return `content-type: text/event-stream`.
- Each event frame: `data: <json-payload>\n\n` where `<json-payload>` is the **same event object shape** as CLI `--format json` (same `type` grammar).
- Confirmed live: `data: {"type":"server.connected",...}`.

## Event object identity (CLI == SSE)
- Both transports emit the SAME event vocabulary: `step_start`, `text`, `step_finish`, `tool_use`, `reasoning`, `error`, `server.connected`.
- The v2 parser can share one `ContentBlock`/event mapper across both transports.

## `--thinking` / `--variant` effect on stream
- `--thinking` adds `reasoning` events (Area 1). Verified present.
- `--variant <high|max|minimal>` accepted; passes through to provider; **no change to event grammar** (verified: same 3 event types, exit 0).

## SSE capture caveat (Area 4)
- Live SSE probes delivered 0 events for a completed `prompt_async` run (timing race). For reliable result capture, poll `GET /api/session/:id` after `prompt_async` returns 204. The stream shape is confirmed via `server.connected`; full run-event capture over SSE is unverified but shape-identical to CLI by design.

## Impl-doc correction
- If the impl-doc assumes CLI output is a JSON array or wrapped envelope, that is **WRONG** — it is bare NDJSON.
