# SSE Official Taxonomy + Synonym Map (controlled vocabulary for harvest)

Server-Sent Events (SSE) — W3C/WHATWG event-stream format.

## Core terms
- event-stream          : the text/event-stream transport (Content-Type: text/event-stream)
- data field            : `data:` line carrying the payload
- event field           : `event:` line naming the event type
- id field              : `id:` line for last-event-id resume
- retry field           : `retry:` line for reconnect interval
- comment/keepalive     : `:` prefixed comment line used as heartbeat (e.g. `: ping`)
- named event           : an event with a non-default event name
- default event (message): event with no `event:` field
- multiline data        : multiple `data:` lines concatenated with `\n`
- [DONE] sentinel       : non-spec sentinel some LLM streams use to mark completion

## Synonyms
- SSE        → event-stream
- server push → event-stream
- streaming  → event-stream
- delta      → data field
- chunk      → data field
- heartbeat  → comment/keepalive
- ping       → comment/keepalive
- last-id    → id field
- reconnect  → retry field

## Related protocols / capabilities it implies
- text/event-stream implies protocol `sse`
- `data:` payloads imply a streaming parser (`sse` parser type)
- OpenAI-compatible `choices[].delta` implies `sse` + capability `send_message`/streaming
- Gemini `batchexecute` is NOT SSE (different transport) — do not map to sse


