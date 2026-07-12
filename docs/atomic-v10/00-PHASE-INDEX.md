# Atomic v10 — Phase Index

**Version:** v10 | **Parent:** atomic-v9 (unified command + config + oracle surface)
**Theme:** **CLI = FRONTEND — one single entry point via natural language**
**Total units:** 45 | **Built on:** docs/atomic-v3-fork-canon (phases 1-22) + atomic-v9 (phase 23)

> v10 is the SOA unification: the CLI and the frontend chat box become
> interchangeable natural-language entry points that talk to one system.
> The user types plain English in either place; the NLCL formats it to a
> system-level capability invocation. Whatever the CLI can do, the frontend
> can do, and vice versa — literally the same capability id, same handler,
> same transport.

---

## The Two Success Criteria v10 Natively Empowers

### Scenario 1 — Frontend (user logged into an AI provider)
The user types in their chat composer:
- *"change my canvas background to an image of the moon made out of cheese"*
- *"add new streaming channels like my facebook messaging feed, my whatsapp"*
- *"create an automated weekly newsletter that distills the week's work and sends to the team"*

Each sentence is parsed by NLCL → resolves to a capability id (or composite
DAG) → executes server-side → result streams back into the chat/canvas.

### Scenario 2 — CLI (interactive REPL)
```
$ vivim
> load my chatgpt.com and start an interactive session
[spawning chrome slave for chatgpt... session active]
> ask it what is quantum computing
[streaming response...]
> switch to claude
...
```

The CLI REPL and the frontend chat box issue **identical** `/api/interpret`
requests. The NL is the universal front door; capabilities are the universal
back end.

---

## Phases in v10

| Phase | Name | Units | Spec | Scenario |
|-------|------|-------|--------|----------|
| 24 | SOA Spine — Universal Capability Execution | 10 | ✓ written | foundation for both |
| 25 | NLCL Universal Resolver — NL → Capability | 9 | ✓ written | the NLP formatting layer |
| 26 | Canvas Natural-Language Mutation | 5 | ✓ written | Scenario 1a (moon/cheese) |
| 27 | Streaming Channel Registration | 6 | ✓ written | Scenario 1b (whatsapp/fb) |
| 28 | Workflow Automation | 6 | ✓ written | Scenario 1c (newsletter) |
| 29 | Interactive Sessions | 5 | ✓ written | Scenario 2 (load chatgpt) |
| 30 | Parity Lock + Release | 4 | ✓ written | invariant enforcement |

---

## Design lineage (what already exists and is extended)

- `src/engines/unified-registry.ts` — `UnifiedCapabilityRegistry` with `surfaces[]`, `exportForCli()`, `exportForMcp()` — **lacks `exportForUi()` and a universal execute route**
- `src/engines/capability-bootstrap.ts` — 24 default capabilities already multi-surface — **frontend ignores them**
- `src/engines/nlcl/nlcl-engine.ts` — NL → intent → route → execute; composite detection; AI fallback — **CommandResult lacks `capabilityId`; resolver not bound to conversation context**
- `src/cli/` — argv parser + `syncCliFromUnified()` bridge — **standalone CLI never calls it; 5 command modules orphaned; HTTP paths broken**
- `src/server/conversation-router.ts` — has `/api/conversations/:id/capabilities/:slug/execute` — **no universal `/api/capabilities/:id/execute`; no `/api/interpret`**
- `web/ui/src/actions/` — hand-written `ActionRegistry` + `catalog.ts` — **divergent from unified registry; not auto-generated**
- `src/canvas/` — CanvasEngine + SandboxBridge + capability bridge — **no NL mutation caps, no image-gen bridge**
- `src/engines/workflow-engine.ts` + `src/automation/scheduler.ts` — workflow + cron exist — **not exposed as capabilities; no NL patterns**
- `src/executor/fleet-supervisor.ts` — Chrome lifecycle — **no `load_provider`/`start_session` capabilities; no CLI REPL**
- `seeds/providers/*.json` + `ProviderRegistrar` — AI providers seeded — **no messaging providers (whatsapp/fb/slack)**

## Classification summary (devops-roadmap)

| Class | Count | Meaning |
|-------|-------|---------|
| CREATE | 22 | New code (universal route, exportForUi, LLM resolver, channel caps, newsletter, REPL) |
| PORT | 16 | Logic exists elsewhere (CLI command files → capabilities; workflow engine → cap) |
| EXTEND | 5 | Existing engine gains a method/field (NLCL capabilityId; canvas mutation caps) |
| FIX | 2 | Broken wiring repaired (CLI path prefixes; orphan command registration) |
