# VIVIM Documentation

**Local-first AI conversation platform** — cap-store v1 Knowledge Graph Rebuild.
Bun + TypeScript (ESM) + Prisma + Next.js. Tauri desktop.

This `docs/` tree is the **single live documentation set** for the repo. It is
deliberately small and high-signal. Anything stale lives in `.archive/`, not here.

## Doc map

| Doc | Read it when | Who maintains |
|-----|--------------|---------------|
| [`ALPHA.md`](ALPHA.md) | Deciding **what ships in alpha** vs future; the atomic feature breakdown | PM (head) |
| [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) | You want the **30-second mental model** of the system | Agent + PM |
| [`architecture/ENGINES.md`](architecture/ENGINES.md) | You want to know **what each engine does** and where its code lives | Agent (on engine change) |
| [`architecture/DATA.md`](architecture/DATA.md) | You touch **schema, migrations, stores** | Agent (on schema change) |
| [`architecture/API.md`](architecture/API.md) | You add/change a **route or entry point** | Agent (on API change) |
| [`architecture/FRONTEND.md`](architecture/FRONTEND.md) | You work in **`frontend/`** | Agent (on frontend change) |
| [`runbooks/DEV.md`](runbooks/DEV.md) | You **run the dev loop** or hit port issues | Agent + human |
| [`runbooks/DESKTOP.md`](runbooks/DESKTOP.md) | You **build/install/test the desktop app** | Agent + human |
| [`runbooks/PROVIDERS.md`](runbooks/PROVIDERS.md) | You **set up or test a provider** (chatgpt/claude/gemini/…) | Agent + human |
| [`decisions/README.md`](decisions/README.md) | You need to **record or find a decision** | PM + agent |
| [`review-system/`](review-system/README.md) | You run the **code review system** | Agent |

## The `docs/` contract (how this stays fresh)

1. **Every code change that touches an architecture surface updates the matching
   doc in the same change.** No doc update = the change is not done.
2. **Docs are short.** A doc that grows past ~200 lines should split into a page
   per subsystem. Long docs rot; short docs survive.
3. **Anything stale is archived, never deleted.** Move it to `.archive/` with a
   dated folder. If you are tempted to delete, archive instead.
4. **The review system (`review-system/`) is sacred** — it is fresh and we build
   on it. Do not archive, rewrite, or delete it.
5. **Diagrams are Mermaid** (`.mmd` blocks in markdown) — text-diffable, no tool
   dependency. ASCII where a diagram is overkill.
6. **Facts, not prose.** Evidence = code ref (`path:line`) or measured number.
   Opinion lives in decisions/, not in architecture docs.
7. **No duplication.** If a fact already lives in `AGENTS.md`, link it, don't
   copy it. `AGENTS.md` is the agent-operational source; `docs/` is the human
   architecture source.

## What is deliberately NOT here

- PRDs, roadmaps, workstream plans, taxonomies, upgrade logs, session notes —
  **all archived** in `.archive/`.
- Run artifacts, review outputs, generated snapshots — in the review system's
  `runs/` (gitignored).
- API reference generated from code — generated live, not stored.

## Repository layout at a glance

```
docs/          ← this documentation set
review-system  ← code review system (kept, fresh)
src/           ← backend engines + server + storage
frontend/      ← Next.js UI (consumes src via /api + /ws)
src-tauri/     ← desktop shell
prisma/        ← schema + migrations + seeds
scripts/       ← dev/build automation
devops/        ← agent-driven devops CLI
seeds/         ← provider manifests, parsers, harness commands
shared/        ← cross-cutting TS types (api, slots, stream blocks)
```
