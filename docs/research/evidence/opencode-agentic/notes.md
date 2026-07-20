# OpenCode Agentic — Test Notes (raw, 2026-07-19)

Host: Windows, `opencode` via bun (C:\Users\VIVIM.inc\.bun\bin\opencode.cmd), kilo present, Node v24.11.1.

## Provider/model discovery
`opencode models` returns a `opencode/` provider group with `-free` Zen models:
- opencode/big-pickle
- opencode/deepseek-v4-flash-free   ✅
- opencode/hy3-free                  ✅ (Tencent)
- opencode/mimo-v2.5-free            ✅
- opencode/nemotron-3-ultra-free     ❌ (timeout)
- opencode/north-mini-code-free      ✅
Plus opencode-go/* (keyed) and named providers (anthropic, deepseek, google, openai).

## Live run tests (no API key set)
deepseek-v4-flash-free: exit 0, ~43s, returned "PONG", tokens.cost:0.
  JSON tail: {"type":"text","part":{"type":"text","text":"PONG",...},"tokens":{"total":68608,"input":68591,"output":3,"reasoning":14,"cost":0}}
hy3-free:            exit 0, ~54s, returned "OK".
mimo-v2.5-free:      exit 0, ~41s, returned "OK".
north-mini-code-free:exit 0, ~37s, returned "OK".
nemotron-3-ultra-free: NO text output in 5 min (terminated). EXCLUDED.

## serve test
`opencode serve --port 4097 --hostname 127.0.0.1` -> log:
  "Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured."
  "opencode server listening on http://127.0.0.1:4097"
Confirmed: serve starts; unsecured by default. Always set OPENCODE_SERVER_PASSWORD.

## Conclusion
Use ONLY these 4 Zen free models for now (per user directive): deepseek-v4-flash-free,
hy3-free, mimo-v2.5-free, north-mini-code-free. All cost 0, no key, valid --format json.
