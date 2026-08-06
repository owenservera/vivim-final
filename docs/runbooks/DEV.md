# Runbook — Local Dev Loop

## One-command start / stop

```bash
bun run dev            # backend (9420) + frontend (3000) in one foreground process
bun run stop           # kill orphaned processes on 9420/3000 + clean .runtime/
bun run dev:backend    # backend only
bun run dev:frontend   # frontend only (port 3000)
```

`bun run dev` kills stale processes on the known ports first. Output is
prefixed `[backend]` / `[frontend]`. Ctrl+C shuts both down.

## Ports (Windows gotcha)

Backend defaults to **9420**, frontend **3000**. If 9420 is held by a Windows
zombie socket (dead PID still LISTENING), the launcher falls back to the next
free port and writes it to `.runtime/backend.port`. Clients resolve the port the
same way — never hard-bind 9420 in tooling. Precedence: `CAP_STORE_PORT` →
`.runtime/backend.port` → 9420.

## Useful commands

```bash
bun run typecheck          # TS strict check (bunx tsc --noEmit)
bun run lint               # biome check src/ tests/ seeds/
bun run test               # bun test (excludes docs/**)
bun run test:fast          # unit + arch only
bun run seed               # seed DB (all)
bun run migrate            # run migrations (source all)
bun run db:backup          # backup SQLite
bun run db:restore         # restore
```

## Dev server gotchas

- **PowerShell pipeline drops JSON** — ALWAYS read API/JSON through a bun
  script in `.runtime/`, never `Invoke-RestMethod | Select-Object |
  Out-File` (silently empty).
- **Smoke tests need client-side timeouts** — endpoints like
  `/api/conversations/:id/send` block forever waiting for an unattached CDP
  browser. Wrap `fetch` with `AbortController` + timeout.
- **`Bun.spawn` exitCode is null** until `await proc.exited` — await before
  reading.
- **Typecheck guardrail**: don't run `tsc`/`typecheck` mid-task — the repo has
  pre-existing errors in `tests/` owned by other agents. Build first; verify at
  the human's request.

## Agent devops loop (vivim-runtime)

```bash
bun run devops runtime-test             # full autonomous loop
bun run devops runtime-test preflight   # DB + server health
bun run devops runtime-test status --provider=gemini
bun run devops runtime-test test --nl="send message to gemini"
```

## Docs

Fresh doc set lives in `docs/` (`docs/README.md` for the map). Code review
system: `docs/review-system/` (run via `bun docs/review-system/scripts/run.ts`).