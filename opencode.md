# New session - 2026-07-18T23:22:25.191Z

**Session ID:** ses_088763bd8ffexdTkJLyIKnuuax
**Created:** 7/19/2026, 1:22:25 AM
**Updated:** 7/19/2026, 1:22:26 AM

---

## User

we did research on enabling opencode as a local provider . we need to run more research to get a more complete understanding - 1. you were running some opencode tests with the providers we have identifiesd the free ones,we need a fully documented real understanding of 1. full comms protocol 2. tooluse 3. context 4. etc -- so you should get up to speed on our baseline - idenify 10 research areas we should search online for proper implementation and examples and document

---

## Assistant (Plan · Tencent: Hy3 (free) · 38.0s)

I'll get up to speed on the baseline first, then identify the research areas. Let me explore the existing opencode provider work.

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"C:\\0-BlackBoxProject-0\\vivim-final\" -Recurse -Filter \"*.md\" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match \"opencode|provider|research\" } | Select-Object -First 40 FullName",
  "description": "Find opencode/provider/research related markdown files"
}
```

**Output:**
```

[32;1mFullName[0m
[32;1m--------[0m
C:\0-BlackBoxProject-0\vivim-final\GAP-ANALYSIS-CDP-PROVIDER-SLAVE.md
C:\0-BlackBoxProject-0\vivim-final\RESEARCH-BRIEF-DEVOPS.md
C:\0-BlackBoxProject-0\vivim-final\RESEARCH-BRIEF-LIBRARIES.md
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v11\phase-32-provider-harness\00-PHASE-INDEX.md
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v11\phase-32-provider-harness\provider-harness…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v11\phase-34-autonomous-completion\provider-fa…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v12\phase-01-baseline-hardening\1.3-provider-t…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-01-stabilization\1.…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-04-workspace-ui\4.8…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-05-provider-expansi…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-06-memory-knowledge…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-ARCHIVED-20260712\phase-07-autonomous-orche…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-01-stabilization\1.1-remov…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-05-workspace-ui\4.8-provid…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\00-P…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.1-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.10…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.2-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.3-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.4-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.5-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.6-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.7-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.8-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-06-provider-expansion\5.9-…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-07-memory-knowledge\6.1-em…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v3-fork-canon\phase-08-autonomous-orch\7.8-pro…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v4-ARCHIVED-20260712\mdprds\MDPRD-04-three-pro…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v4-ARCHIVED-20260712\phase-04-three-provider\4…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v4-ARCHIVED-20260712\phase-04-three-provider\4…
C:\0-BlackBoxProject-0\vivim-final\.archive\atomic-v4-ARCHIVED-20260712\phase-04-three-provider\4…


```

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"C:\\0-BlackBoxProject-0\\vivim-final\" -Directory | Select-Object Name",
  "description": "List top-level directories"
}
```

**Output:**
```

[32;1mName[0m
[32;1m----[0m
--help
--url
.archive
.kilo
.opencode
.playwright-mcp
.runtime
.skills
.specify
.test-tmp
agent-brief
bench
C0-BlackBoxProject-0
chrome-profiles
context-handoff
data
dev-poc
devops
dist
docs
harvest-targets
migrations
node_modules
prisma
prov_claude
scripts
sdk
seeds
shared
specs
src
tests
uploads
web


```

---

## Assistant (Plan · Tencent: Hy3 (free) · 31.3s)

There's existing research and opencode work. Let me dig into the opencode-specific files and the existing tests/research.

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"C:\\0-BlackBoxProject-0\\vivim-final\" -Recurse -Filter \"*.md\" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match \"opencode\" } | Select-Object FullName",
  "description": "Find all opencode related markdown"
}
```

**Output:**
```

[32;1mFullName[0m
[32;1m--------[0m
C:\0-BlackBoxProject-0\vivim-final\.kilo\plans\1783827600085-opencode-pre-compaction-hook.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\agent\db.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\agent\debug.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\agent\review.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\agent\test.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\check.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\migrate.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\new-engine.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\research.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\seed.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\ship.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\taxonomy.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\command\test.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.analyze.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.checklist.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.clarify.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.constitution.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.converge.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.implement.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.plan.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.specify.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.tasks.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\commands\speckit.taskstoissues.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\memory\project.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\@ai-sdk\provider\CHANGELOG.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\@ai-sdk\provider\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\@msgpackr-extract\msgpackr-extract-win32-x64\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\@standard-schema\spec\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\cross-spawn\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\detect-libc\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\effect\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\fast-check\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\find-my-way-ts\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\ini\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\isexe\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\json-schema\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\kubernetes-types\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\msgpackr\benchmark.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\msgpackr\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\msgpackr\SECURITY.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\msgpackr-extract\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\multipasta\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\node-gyp-build-optional-packages\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\path-key\readme.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\pure-rand\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\shebang-command\readme.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\shebang-regex\readme.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\toml\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\uuid\LICENSE.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\uuid\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\which\CHANGELOG.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\which\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\yaml\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\node_modules\zod\README.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\agentic\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\arch-audit\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops-fullstack\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops-generators\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops-research\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops-roadmap\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\prisma-workflow\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\provider-testing\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\source-audit\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\vivi-frontend\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\vivi-frontend\references\surface-slots.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\vivi-frontend\references\ui-contract.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\vivim-build\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\vivim-runtime\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\vivim-testing\SKILL.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\briefs\non-tui-kilocode-opencode-brief.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\briefs\opencode-agentic-brief.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\briefs\opencode-compaction-brief.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\code-paths\non-tui-kilocode-opencode-path.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\code-paths\non-tui-kilocode-opencode-trace.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\code-paths\opencode-compaction-path.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\evidence\opencode-agentic\notes.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\evidence\opencode-agentic\value-add-assessment.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\reports\non-tui-kilocode-opencode-sota-2026.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\reports\opencode-agentic-capabilities-sota-2026.md
C:\0-BlackBoxProject-0\vivim-final\docs\research\reports\opencode-agentic-impl-docs-2026.md
C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\data-model.md
C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\plan.md
C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\quickstart.md
C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\research.md
C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\spec.md
C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\contracts\local-agent-store.md


```

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"C:\\0-BlackBoxProject-0\\vivim-final\\dev-poc\" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName | Select-Object -First 60",
  "description": "List dev-poc directory contents"
}
```

**Output:**
```

[32;1mFullName[0m
[32;1m--------[0m
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\agent-brief
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\v2
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\V4
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\V5
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\V6
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\v7
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\v8
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\nexus-3.0.html
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\v2.tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\v3.tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\V4.tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\V5.tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\v7.tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\workspace-15d42749-4df9-4c7e-a6fd-85ce217d8a10.tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\workspace-3d365658-b9d1-44b2-9549-5b05d69c6705 (1).tar
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\agent-brief\00-MASTER-INDEX.md
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\agent-brief\01-system-overview.md
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\agent-brief\02-current-canvas-state.md
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.zscripts
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\db
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\download
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\examples
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\mini-services
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\prisma
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\public
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\scripts
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\src
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\tool-results
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\upload
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.env
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.gitignore
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\bun.lock
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\Caddyfile
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\components.json
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\eslint.config.mjs
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\next.config.ts
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\package.json
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\postcss.config.mjs
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\tailwind.config.ts
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\tsconfig.json
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\worklog.md
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\branches
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\hooks
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\info
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\logs
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\objects
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\refs
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\COMMIT_EDITMSG
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\config
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\description
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\HEAD
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\index
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\hooks\applypatch-msg.sample
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\hooks\commit-msg.sample
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\hooks\fsmonitor-watchman.sample
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\hooks\post-update.sample
C:\0-BlackBoxProject-0\vivim-final\dev-poc\canvas\html-shell-sdk-1\.git\hooks\pre-applypatch.sample


```

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"C:\\0-BlackBoxProject-0\\vivim-final\" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -match \"opencode\" -and $_.Name -match \"\\.(ts|js|json)$\" } | Select-Object FullName | Select-Object -First 40",
  "description": "Find opencode code files"
}
```

**Output:**
```

[32;1mFullName[0m
[32;1m--------[0m
C:\0-BlackBoxProject-0\vivim-final\opencode.json
C:\0-BlackBoxProject-0\vivim-final\.specify\integrations\opencode.manifest.json


```

---

## Assistant (Plan · Tencent: Hy3 (free) · 9.2s)

There's a spec at `specs/022-local-agent-opencode`. Let me read that spec and the existing research reports to understand the baseline.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\specs\\022-local-agent-opencode\\spec.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\spec.md</path>
<type>file</type>
<content>
1: # Feature Specification: Local-Agent OpenCode Provider (Zen free models)
2: 
3: **Feature Branch**: `022-local-agent-opencode`
4: 
5: **Created**: 2026-07-19
6: 
7: **Status**: Draft
8: 
9: **Input**: User description: "Wire the 4 verified Zen free OpenCode models (deepseek-v4-flash-free, hy3-free, mimo-v2.5-free, north-mini-code-free) into vivim as a `local-agent` provider so the UnifiedCapabilityRegistry can dispatch them without CDP/Chrome."
10: 
11: ## User Scenarios & Testing *(mandatory)*
12: 
13: ### User Story 1 - Register local-agent provider + capabilities (Priority: P1)
14: 
15: vivim boots, seeds a `local-agent` provider manifest (`slug: opencode`) with 4 Zen free
16: models, and registers a `cap:agent:run` UnifiedCapability so any surface (CLI/UI/API/MCP)
17: can dispatch an OpenCode agent task. No browser, no CDP, no ChromeGovernor.
18: 
19: **Why this priority**: This is the minimal shippable integration — it makes the 4 verified
20: free models first-class vivim capabilities without touching the Governor Canon.
21: 
22: **Independent Test**: `bun run devops runtime-test status --provider=opencode` shows the
23: provider seeded with 4 models; `bun run devops runtime-test test --nl "run deepseek agent: say hello"`
24: returns a parsed `ContentBlock[]` text.
25: 
26: **Acceptance Scenarios**:
27: 
28: 1. **Given** a fresh boot, **When** `registerDefaultCapabilities` + local-agent seed runs, **Then** a provider row `opencode` with `provider_type='local-agent'` and 4 model rows exists.
29: 2. **Given** the registry, **When** `cap:agent:run` is executed with `model: 'opencode/deepseek-v4-flash-free'`, **Then** an `opencode run --auto --format json` subprocess is spawned and its stdout parsed to `ContentBlock[]`.
30: 3. **Given** `nemotron-3-ultra-free` is requested, **When** dispatched, **Then** it is rejected with `EngineError` (model not in allowed list).
31: 
32: ---
33: 
34: ### User Story 2 - LocalAgentProviderExecutor parses `--format json` (Priority: P2)
35: 
36: The executor wraps `opencode run` and converts the JSON event stream
37: (`step_start`/`text`/`step_finish`, `tokens.cost`) into the canonical `ContentBlock[]`
38: consumed by `StreamParserEngine` / `ConversationManager.captureAsNode()`.
39: 
40: **Why this priority**: The parse contract is what lets downstream engines treat agent
41: output identically to provider output — no special-casing elsewhere.
42: 
43: **Independent Test**: A unit test feeding a recorded `--format json` payload (from
44: `evidence/opencode-agentic/notes.md`) through `LocalAgentProviderExecutor.parse()` yields
45: `[{type:'text',text:'PONG'}]` and `cost:0`.
46: 
47: **Acceptance Scenarios**:
48: 
49: 1. **Given** a `--format json` stdout with a `text` event, **When** parsed, **Then** a `ContentBlock` of type `text` is produced.
50: 2. **Given** an agent error/timeout, **When** exit code != 0, **Then** an `error` ContentBlock is produced and a `capability:failed` event emitted.
51: 
52: ---
53: 
54: ### User Story 3 - Surface parity + event bus bridge (Priority: P3)
55: 
56: `cap:agent:run` is exported to CLI (`cliCommand`), UI (`ui`), API (`apiEndpoint`), and MCP
57: (`mcpToolName`) via the registry's `exportFor*` methods, and emits `capability:executed`
58: / `capability:failed` on `CapabilityEventBus`.
59: 
60: **Why this priority**: Confirms the One-Entry-Point invariant — one capability, all surfaces.
61: 
62: **Independent Test**: `registry.exportForCli()` / `exportForApi()` / `exportForMcp()` include
63: `agent_run`; `CapabilityEventBus.snapshot()` shows a `capability:executed` entry after a run.
64: 
65: ---
66: 
67: ### Edge Cases
68: 
69: - What happens when `opencode` binary is not on PATH? → Executor throws `EngineError` (not a silent hang); capability returns an `error` block.
70: - What happens when the model slug is not one of the 4 verified free models? → Rejected before spawn (allow-list).
71: - How does system handle a hung agent (no output)? → `timeoutMs` kill + `capability:failed`.
72: - `serve` mode unsecured? → Only `run` (one-shot) is wired in v1; `serve` is out of scope (see research).
73: 
74: ## Requirements *(mandatory)*
75: 
76: ### Functional Requirements
77: 
78: - **FR-001**: System MUST seed a `local-agent` provider manifest `opencode` with the 4 verified Zen free models (`deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`).
79: - **FR-002**: System MUST register a `cap:agent:run` UnifiedCapability exposed on `cli`, `ui`, `workflow`, `mcp`, `api` surfaces.
80: - **FR-003**: `LocalAgentProviderExecutor` MUST spawn `opencode run --auto --model <allowed> --format json "<prompt>"` and parse stdout to `ContentBlock[]`.
81: - **FR-004**: System MUST reject any model not in the verified allow-list via `EngineError` before spawning a process.
82: - **FR-005**: System MUST emit `capability:executed` / `capability:failed` events on `CapabilityEventBus`.
83: - **FR-006**: System MUST NOT import `BunCdpClient` or use `ChromeGovernor` for `local-agent` (Governor Canon).
84: - **FR-007**: `LocalAgentProviderExecutor` MUST enforce a `timeoutMs` cap and surface a failure on timeout.
85: 
86: ### Key Entities
87: 
88: - **LocalAgentProvider**: a `provider_type: 'local-agent'` manifest row (distinct from `llm`/CDP). `slug`, `models[]`, `auth_type: 'none'` (Zen free).
89: - **LocalAgentConfig**: runtime config — `binary: 'opencode'`, `defaultModel`, `timeoutMs`, `allowedModels[]`.
90: - **ContentBlock**: canonical output (`src/schema/streaming.ts` `ContentPart`) — the parse target.
91: 
92: ## Success Criteria *(mandatory)*
93: 
94: ### Measurable Outcomes
95: 
96: - **SC-001**: `cap:agent:run` with `opencode/deepseek-v4-flash-free` returns a non-empty `ContentBlock[]` text within 120s on this host.
97: - **SC-002**: Requests for `opencode/nemotron-3-ultra-free` are rejected with zero subprocess spawns.
98: - **SC-003**: All 4 free models pass the same dispatch path (one capability, 4 models).
99: - **SC-004**: `exportForCli/exportForApi/exportForMcp` each list `agent_run` (surface parity verified).
100: 
101: ## Assumptions
102: 
103: - `opencode` CLI is installed and on PATH (verified 2026-07-19 via bun).
104: - Zen free models need no API key and cost 0 (verified).
105: - `nemotron-3-ultra-free` is excluded (timed out >5 min in test).
106: - Only one-shot `run` is wired in v1; `serve`/ACP are future scope.
107: - LocalAgentProviderExecutor does NOT extend the existing CDP `ProviderRegistrar` path — it uses a dedicated `LocalAgentStore` contract (per impl docs).

(End of file - total 107 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\specs\\022-local-agent-opencode\\research.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\specs\022-local-agent-opencode\research.md</path>
<type>file</type>
<content>
1: # Research: Local-Agent OpenCode Provider (Phase 0)
2: 
3: **Feature**: `022-local-agent-opencode` | **Date**: 2026-07-19
4: 
5: All NEEDS CLARIFICATION from the spec are resolved below. The single source of truth is the
6: empirical test performed on this host (see `docs/research/evidence/opencode-agentic/notes.md`).
7: 
8: ## R-1: Which models are usable? (was NEEDS CLARIFICATION)
9: 
10: **Decision**: Exactly 4 Zen free models, verified by live execution:
11: `opencode/deepseek-v4-flash-free`, `opencode/hy3-free`, `opencode/mimo-v2.5-free`,
12: `opencode/north-mini-code-free`.
13: 
14: **Rationale**: These returned text with exit code 0 and `tokens.cost:0` in real runs.
15: `opencode/nemotron-3-ultra-free` produced no output in 5 minutes → excluded.
16: 
17: **Alternatives considered**: Paid models (`anthropic/claude-sonnet-4`, `deepseek/deepseek-v4-flash`)
18: require API keys — out of scope per user directive (Zen free only).
19: 
20: ## R-2: How to invoke OpenCode headlessly? (was NEEDS CLARIFICATION)
21: 
22: **Decision**: `opencode run --auto --model <id> --format json "<prompt>"`.
23: 
24: **Rationale**: Verified non-interactive, zero-key, parseable JSON stream. `--auto` auto-approves
25: non-denied tool calls; `--format json` emits `step_start`/`text`/`step_finish` events.
26: 
27: **Alternatives considered**: `serve` + HTTP (`POST /session/:id/message`) — starts unsecured by
28: default and adds a server lifecycle; deferred to a later phase. `acp` (stdio nd-JSON) — good
29: embed contract but heavier to manage from a spawned process in v1.
30: 
31: ## R-3: What is the parse contract? (was NEEDS CLARIFICATION)
32: 
33: **Decision**: Map OpenCode `--format json` events to `ContentBlock` (`src/schema/streaming.ts` `ContentPart`):
34: - `type:'text'` → `{type:'text', text: part.text}`
35: - `type:'step_start'` → `{type:'step-start'}`
36: - `type:'step_finish'` → terminal; read `tokens.cost` for the `meta`/cost record.
37: - agent error (exit != 0) → `{type:'error', message, code:'AGENT_FAILED'}`.
38: 
39: **Rationale**: `ContentBlock = ContentPart` is the canonical layer-1 part and the parse target of
40: `StreamParserEngine` + `ConversationManager.captureAsNode()`. No special type needed.
41: 
42: ## R-4: Where does the capability live? (was NEEDS CLARIFICATION / governed by invariants)
43: 
44: **Decision**: One `cap:agent:run` UnifiedCapability registered in `capability-bootstrap.ts`
45: `registerDefaultCapabilities` (or a sibling `registerLocalAgentCapabilities`). Exposed on all 5
46: surfaces via `makeCapability`.
47: 
48: **Rationale**: Satisfies One Entry Point invariant — every operation is a UnifiedCapability.
49: 
50: ## R-5: Does this touch the Governor Canon?
51: 
52: **Decision**: No. `LocalAgentProviderExecutor` shells `opencode` via `Bun.spawn`. It imports no
53: `BunCdpClient` and never calls `ChromeGovernor`. The `provider_type: 'local-agent'` is a distinct
54: enum value from `'llm'` (CDP).
55: 
56: **Rationale**: Preserves the architectural boundary; local-agent is an LLM-API caller, not a web UI.
57: 
58: ## R-6: Storage shape?
59: 
60: **Decision**: Dedicated `LocalAgentStore` contract (not the CDP `ProviderStore`). Provider + model
61: rows seeded from `seeds/providers/local-agent.ts` into the existing `Provider`/`Model` Prisma
62: models with `provider_type='local-agent'`. Config (`timeoutMs`, `allowedModels`, `binary`) held in
63: `LocalAgentConfig`.
64: 
65: **Rationale**: Per impl docs (PART 5.2) — local-agent reuses the DB but owns a store contract so
66: the CDP seed path stays untouched.
67: 
68: ## Consolidated decisions
69: 
70: | # | Decision | Key |
71: |---|----------|-----|
72: | R-1 | 4 verified free models; nemotron excluded | allow-list |
73: | R-2 | `opencode run --auto --model <id> --format json` | spawn |
74: | R-3 | JSON events → `ContentBlock[]` (`ContentPart`) | parse |
75: | R-4 | one `cap:agent:run` capability, all surfaces | registry |
76: | R-5 | no CDP/ChromeGovernor; `Bun.spawn` only | canon |
77: | R-6 | dedicated `LocalAgentStore` contract | storage |

(End of file - total 77 lines)
</content>
```

---

## Assistant (Plan · Tencent: Hy3 (free) · 8.9s)

Now let me read the empirical evidence notes and the existing test/impl docs to understand what's been verified so far.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\research\\evidence\\opencode-agentic\\notes.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\research\evidence\opencode-agentic\notes.md</path>
<type>file</type>
<content>
1: # OpenCode Agentic — Test Notes (raw, 2026-07-19)
2: 
3: Host: Windows, `opencode` via bun (C:\Users\VIVIM.inc\.bun\bin\opencode.cmd), kilo present, Node v24.11.1.
4: 
5: ## Provider/model discovery
6: `opencode models` returns a `opencode/` provider group with `-free` Zen models:
7: - opencode/big-pickle
8: - opencode/deepseek-v4-flash-free   ✅
9: - opencode/hy3-free                  ✅ (Tencent)
10: - opencode/mimo-v2.5-free            ✅
11: - opencode/nemotron-3-ultra-free     ❌ (timeout)
12: - opencode/north-mini-code-free      ✅
13: Plus opencode-go/* (keyed) and named providers (anthropic, deepseek, google, openai).
14: 
15: ## Live run tests (no API key set)
16: deepseek-v4-flash-free: exit 0, ~43s, returned "PONG", tokens.cost:0.
17:   JSON tail: {"type":"text","part":{"type":"text","text":"PONG",...},"tokens":{"total":68608,"input":68591,"output":3,"reasoning":14,"cost":0}}
18: hy3-free:            exit 0, ~54s, returned "OK".
19: mimo-v2.5-free:      exit 0, ~41s, returned "OK".
20: north-mini-code-free:exit 0, ~37s, returned "OK".
21: nemotron-3-ultra-free: NO text output in 5 min (terminated). EXCLUDED.
22: 
23: ## serve test
24: `opencode serve --port 4097 --hostname 127.0.0.1` -> log:
25:   "Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured."
26:   "opencode server listening on http://127.0.0.1:4097"
27: Confirmed: serve starts; unsecured by default. Always set OPENCODE_SERVER_PASSWORD.
28: 
29: ## Conclusion
30: Use ONLY these 4 Zen free models for now (per user directive): deepseek-v4-flash-free,
31: hy3-free, mimo-v2.5-free, north-mini-code-free. All cost 0, no key, valid --format json.

(End of file - total 31 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\research\\reports\\opencode-agentic-impl-docs-2026.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\research\reports\opencode-agentic-impl-docs-2026.md</path>
<type>file</type>
<content>
1: # OpenCode Agentic Dev Loops & Subagent Orchestration — Full Implementation Docs (vivim-final)
2: 
3: *Generated: 2026-07-19 | Companion to `opencode-agentic-capabilities-sota-2026.md` | Confidence: High*
4: 
5: This document is the **implementation manual** for wiring OpenCode (and Kilocode, which shares the
6: same architecture) into vivim-final as a `local-agent` provider type (Shape B). It is built entirely
7: from official OpenCode documentation plus vivim-final's engine contracts. All commands are
8: PowerShell-compatible (per AGENTS.md). No CDP, ChromeGovernor untouched.
9: 
10: ---
11: 
12: ## PART 0 — Architecture decision (recap)
13: 
14: ```
15: POST /api/interpret
16:    └─> UnifiedCapabilityRegistry
17:          ├─ provider_type == 'llm'      -> ChromeGovernor (CDP)        [unchanged]
18:          └─ provider_type == 'local-agent' -> LocalAgentProviderExecutor
19:                   ├─ spawn: kilo/opencode run --auto  (one-shot)
20:                   └─ http : POST serve /session/:id/message (persistent)
21:                          └─> StreamParserEngine -> ContentBlock[]
22: ```
23: 
24: New surfaces: `src/engines/local-agent/*` (executor + agent store contract), a seed manifest, and
25: `UnifiedCapability` registrations. Everything else (registry, composer, event bus, conversation
26: manager) is reused.
27: 
28: ---
29: 
30: ## PART 0.5 — TESTED ON THIS HOST (2026-07-19, overrides assumptions)
31: 
32: These were executed, not inferred. `opencode` is installed via bun on Windows; `kilo` present.
33: **Zen free models need no API key and cost 0.**
34: 
35: ```powershell
36: # Verified: these four Zen free models RUN non-interactively with zero key
37: opencode run --auto --model opencode/deepseek-v4-flash-free --format json "PONG"   # exit 0, cost 0
38: opencode run --auto --model opencode/hy3-free            --format json "OK"        # exit 0
39: opencode run --auto --model opencode/mimo-v2.5-free       --format json "OK"        # exit 0
40: opencode run --auto --model opencode/north-mini-code-free --format json "OK"        # exit 0
41: 
42: # Verified BROKEN (do NOT use):
43: opencode run --auto --model opencode/nemotron-3-ultra-free --format json "OK"       # no output in 5 min
44: ```
45: 
46: | Model (USE THESE) | Latency (cold) | Notes |
47: |---|---|---|
48: | `opencode/deepseek-v4-flash-free` | ~43s | general coding, reliable |
49: | `opencode/hy3-free` (Tencent) | ~54s | your named model, works |
50: | `opencode/mimo-v2.5-free` | ~41s | fastest of the set |
51: | `opencode/north-mini-code-free` | ~37s | code-specialized mini |
52: 
53: `nemotron-3-ultra-free` is **excluded** — timed out even at 5 min.
54: 
55: `serve` starts unsecured unless `OPENCODE_SERVER_PASSWORD` is set (observed log line). Always set it.
56: 
57: ## PART 1 — Install & trust (official)
58: 
59: ```powershell
60: # OpenCode
61: npm install -g opencode        # or: scoop install opencode / brew install opencode
62: 
63: # Kilocode (CLI 1.0, OpenCode fork)
64: npm install -g @kilocode/cli
65: 
66: # Verify
67: opencode --version
68: kilo --version
69: ```
70: 
71: Auth (trusted config only — never commit project config with secrets):
72: ```powershell
73: opencode auth login --provider anthropic     # writes ~/.local/share/opencode/auth.json
74: # or set in trusted global config:
75: #   provider.anthropic.options.apiKey = "{env:ANTHROPIC_API_KEY}"
76: $env:ANTHROPIC_API_KEY = "sk-..."            # trusted env
77: ```
78: Kilo equivalent: `kilo auth` or `~/.config/kilo/kilo.json[c]` with `{env:VAR}` (trusted only).
79: 
80: > **Security rule (official):** `{env:VAR}` resolves ONLY in global config, `OPENCODE_CONFIG_CONTENT`,
81: > or MDM-managed config. A project-committed `kilo.json`/`opencode.json` cannot read secrets.
82: 
83: ---
84: 
85: ## PART 2 — Agent definitions (official config)
86: 
87: ### 2.1 JSON config (`opencode.json` / `kilo.json`)
88: ```jsonc
89: {
90:   "$schema": "https://opencode.ai/config.json",
91:   "agent": {
92:     "build":   { "mode": "primary", "model": "anthropic/claude-sonnet-4-20250514",
93:                  "prompt": "{file:./prompts/build.txt}", "permission": { "edit":"allow","bash":"allow" } },
94:     "plan":    { "mode": "primary", "model": "anthropic/claude-haiku-4-20250514",
95:                  "permission": { "edit":"deny","bash":"deny" } },
96:     "code-reviewer": { "description":"Reviews code for best practices and potential issues",
97:                  "mode":"subagent", "model":"anthropic/claude-sonnet-4-20250514",
98:                  "prompt":"You are a code reviewer. Focus on security, performance, maintainability.",
99:                  "permission": { "edit":"deny" } }
100:   }
101: }
102: ```
103: 
104: ### 2.2 Markdown agents (`.opencode/agents/review.md` → agent `review`)
105: ```markdown
106: ---
107: description: Reviews code for quality and best practices
108: mode: subagent
109: model: anthropic/claude-sonnet-4-20250514
110: temperature: 0.1
111: permission:
112:   edit: deny
113:   bash:
114:     "*": ask
115:     "git diff": allow
116:     "git log*": allow
117:   webfetch: deny
118: ---
119: You are in code review mode. Focus on code quality, bugs, performance, security.
120: ```
121: 
122: ### 2.3 Every agent axis (official keys)
123: | Key | Values | Notes |
124: |---|---|---|
125: | `description` | string | **required**; drives Task-tool selection |
126: | `mode` | `primary`\|`subagent`\|`all` | default `all` |
127: | `model` | `provider/model` | per-agent override |
128: | `prompt` | string / `{file:...}` | system prompt |
129: | `temperature` | 0.0–1.0 | 0–0.2 focused, 0.6–1.0 creative |
130: | `top_p` | 0.0–1.0 | diversity |
131: | `steps` | integer | max agentic iterations (cost cap) |
132: | `permission` | allow/ask/deny + glob | gates tools |
133: | `hidden` | true | programmatic-only subagent |
134: | `color` | hex/theme | UI only |
135: | `disable` | true | turn off |
136: | `permission.task` | glob allow/deny | which subagents this agent may invoke |
137: | *(pass-through)* | any | forwarded to provider as model options (`reasoningEffort`, `textVerbosity`, …) |
138: 
139: ### 2.4 Subagent orchestration (the loop primitive)
140: - Primary agents invoke subagents via the **Task tool**; restrictions via `permission.task`:
141:   ```jsonc
142:   "orchestrator": { "mode":"primary", "permission": { "task": { "*":"deny", "orchestrator-*":"allow", "code-reviewer":"ask" } } }
143:   ```
144:   `deny` removes the subagent from the Task description entirely (model won't try it).
145: - Manual invoke: `@general help me search for this function` (message `@`-mention).
146: - Child sessions: `session_child_first` (Leader+Down), `session_child_cycle` (Right),
147:   `session_child_cycle_reverse` (Left), `session_parent` (Up).
148: - Built-ins: **General** (full tools, multi-step), **Explore** (read-only, fast), **Scout**
149:   (read-only external/docs), **Build**/**Plan** (primary), plus hidden Compaction/Title/Summary.
150: 
151: ---
152: 
153: ## PART 3 — Headless dev loop (official CLI)
154: 
155: ### 3.1 One-shot (preferred for unattended devops)
156: ```powershell
157: # TESTED — Zen free, no key. Use one of the four verified models (see PART 0.5).
158: opencode run "Implement feature X and open a PR" --auto --model opencode/deepseek-v4-flash-free
159: kilo     run --auto "Implement feature X and open a PR"
160: ```
161: Flags: `--auto` (auto-approve non-denied), `--model provider/model`, `--agent <id>`,
162: `--format json` (OpenCode raw JSON events), `--continue`/`--session`, `--attach <url>`,
163: `--dir <path>`, `--title`, `--variant` (reasoning effort).
164: **Exit codes:** `0` success · `124` timeout · `1` error. Kilo: same set.
165: 
166: ### 3.2 Warm server (skip MCP cold boot)
167: ```powershell
168: # Terminal 1 — headless server
169: opencode serve --port 4096 --hostname 127.0.0.1
170: # Terminal 2 — attach (reuses MCP servers)
171: opencode run --attach http://localhost:4096 "Explain async/await in JavaScript"
172: ```
173: For networked `serve`, set `OPENCODE_SERVER_PASSWORD` (username defaults `opencode`).
174: 
175: ### 3.3 ACP (stdin/stdout nd-JSON — best embed contract)
176: ```powershell
177: opencode acp --cwd C:\path\to\repo      # or kilo acp
178: ```
179: Use ACP when embedding OpenCode as a managed subagent inside another runtime (e.g., vivim's
180: `CapabilityComposer`).
181: 
182: ---
183: 
184: ## PART 4 — Headless HTTP API (official server surface)
185: 
186: `opencode serve` publishes OpenAPI 3.1 at `http://localhost:4096/doc`. Key endpoints:
187: 
188: | Method | Path | Use in vivim |
189: |---|---|---|
190: | `GET` | `/global/health` | liveness probe |
191: | `POST` | `/session` | create conversation |
192: | `GET` | `/session` | list |
193: | `DELETE` | `/session/:id` | cleanup |
194: | `POST` | `/session/:id/message` | blocking send → `ContentBlock[]` |
195: | `POST` | `/session/:id/prompt_async` | fire-and-forget (204) |
196: | `POST` | `/session/:id/command` | slash command |
197: | `POST` | `/session/:id/shell` | shell exec |
198: | `GET` | `/session/:id/message` | history |
199: | `GET` | `/file/content?path=` | read file |
200: | `GET` | `/find?pattern=` `/find/file` `/find/symbol` | grep/glob/symbol |
201: | `GET` | `/event` | SSE stream → event bus |
202: | `POST` | `/mcp` | add MCP server |
203: | `PUT` | `/auth/:id` | set credentials |
204: | `GET` | `/experimental/tool/ids` `/experimental/tool` | tool schemas |
205: 
206: Example (blocking send):
207: ```powershell
208: $body = '{"parts":[{"type":"text","text":"Refactor stream-parser fallback chain"}]}'
209: Invoke-RestMethod -Uri "http://localhost:4096/session/$sid/message" -Method Post `
210:   -ContentType 'application/json' -Body $body
211: ```
212: 
213: ---
214: 
215: ## PART 5 — vivim-final implementation (new code)
216: 
217: ### 5.1 Provider manifest (seed) — `seeds/providers/local-agent.ts`
218: Add to `PROVIDER_MANIFESTS` a `provider_type: 'local-agent'` entry (new enum value):
219: ```typescript
220: {
221:   provider: {
222:     slug: 'opencode',
223:     display_name: 'OpenCode Agent',
224:     description: 'Headless OpenCode agentic backend (LLM API caller, not a web UI)',
225:     category: 'agent',
226:     provider_type: 'local-agent',          // NEW — distinct from 'llm' (CDP)
227:     website_url: 'https://opencode.ai',
228:     auth_type: 'apikey',                    // vs 'browser' for CDP providers
229:     has_multi_account: false,
230:     profile_strategy: 'none',
231:     capabilities: ['send_message','select_model','run_subagent','fork_session','get_stream_blocks'],
232:   },
233:   endpoints: [],                             // no CDP endpoints
234:   models: [
235:     { slug:'opencode/deepseek-v4-flash-free', display_name:'DeepSeek V4 Flash (Zen free)', is_default:true },
236:     { slug:'opencode/hy3-free', display_name:'Tencent Hy3 (Zen free)' },
237:     { slug:'opencode/mimo-v2.5-free', display_name:'Mimo 2.5 (Zen free)' },
238:     { slug:'opencode/north-mini-code-free', display_name:'North Mini Code (Zen free)' },
239:   ],
240: }
241: // VERIFIED 2026-07-19: the four Zen free models above all run with no API key, cost 0.
242: // `nemotron-3-ultra-free` EXCLUDED — timed out (>5 min) in test.
243: ```
244: > Update `ProviderManifestSchema` (Zod) to accept `'local-agent'` in `provider_type`.
245: 
246: ### 5.2 Store contract — `src/storage/contracts/local-agent-store.ts`
247: ```typescript
248: export interface LocalAgentStore {
249:   getAgentConfig(slug: string): Promise<LocalAgentConfig | null>
250:   upsertAgentConfig(cfg: LocalAgentConfig): Promise<void>
251:   listAgentConfigs(): Promise<LocalAgentConfig[]>
252: }
253: export interface LocalAgentConfig {
254:   slug: string
255:   bin: 'opencode' | 'kilo'
256:   defaultModel?: string
257:   permission: Record<string, 'allow' | 'ask' | 'deny'>
258:   hidden?: boolean
259: }
260: ```
261: 
262: ### 5.3 Executor — `src/engines/local-agent/local-agent-executor.ts`
263: ```typescript
264: import { spawn } from 'node:child_process'
265: import type { ContentBlock } from '@/engines/stream-parser.js'
266: import type { LocalAgentStore } from '@/storage/contracts/local-agent-store.js'
267: 
268: export interface LocalAgentRequest {
269:   slug: 'opencode' | 'kilo'
270:   message: string
271:   model?: string
272:   cwd?: string
273:   agent?: string
274:   timeoutMs?: number
275:   attachUrl?: string          // warm serve
276: }
277: 
278: export class LocalAgentProviderExecutor {
279:   constructor(private store: LocalAgentStore) {}
280: 
281:   async run(req: LocalAgentRequest): Promise<ContentBlock[]> {
282:     const bin = req.slug
283:     const args = req.attachUrl
284:       ? ['run', '--attach', req.attachUrl, req.message]
285:       : ['run', '--auto', req.message,
286:          ...(req.model ? ['--model', req.model] : []),
287:          ...(req.agent ? ['--agent', req.agent] : []),
288:          ...(req.cwd ? ['--dir', req.cwd] : [])]
289:     if (req.slug === 'opencode' && !req.attachUrl) args.push('--format', 'json')
290: 
291:     const proc = spawn(bin, args, { cwd: req.cwd, env: { ...process.env } })
292:     const chunks: Buffer[] = []
293:     proc.stdout.on('data', (d: Buffer) => chunks.push(d))
294: 
295:     const code = await new Promise<number>((res) => {
296:       proc.on('close', (c) => res(c ?? 1))
297:       setTimeout(() => proc.kill('SIGTERM'), req.timeoutMs ?? 120_000).unref()
298:     })
299:     if (code === 124) throw new Error('local-agent: timeout')
300:     if (code !== 0) throw new Error(`local-agent: exit ${code}`)
301:     return this.parse(Buffer.concat(chunks).toString('utf8'))
302:   }
303: 
304:   private parse(raw: string): ContentBlock[] {
305:     // Reuse StreamParserEngine (DB-only parser logic) — never inline parse rules.
306:     return streamParserEngine.parse('local-agent', raw) as ContentBlock[]
307:   }
308: }
309: ```
310: 
311: ### 5.4 Capability registration — `src/engines/local-agent/caps.ts`
312: ```typescript
313: import { UnifiedCapability } from '@/engines/unified-registry.js'
314: import { LocalAgentProviderExecutor } from './local-agent-executor.js'
315: 
316: export function registerLocalAgentCaps(exec: LocalAgentProviderExecutor): UnifiedCapability[] {
317:   return [
318:     {
319:       id: 'cap:agent:run', slug: 'agent_run', name: 'Run OpenCode/Kilo agent',
320:       description: 'Execute a one-shot headless agent task',
321:       category: 'agent', surfaces: ['cli','ui','api','mcp','workflow'],
322:       inputSchema: { message: 'string', model: 'string?', agent: 'string?' },
323:       outputSchema: { blocks: 'ContentBlock[]' },
324:       handler: (i) => exec.run({ slug:'opencode', message: String(i.message),
325:         model: i.model as string|undefined, agent: i.agent as string|undefined }),
326:       cliCommand: { name:'agent run', aliases:['ar'], examples:['agent run "fix lint"]' },
327:       mcpToolName: 'agent_run', apiEndpoint: { method:'POST', path:'/api/agent/run' },
328:       isAsync: false, requiresConfirmation: false, tags: ['agent','local-agent'],
329:     },
330:     // ... agent.subagent.invoke, agent.session.fork, tool.* , server.* per capability list
331:   ]
332: }
333: ```
334: 
335: ### 5.5 Wiring (boot)
336: In `capability-bootstrap.ts` (or `src/engines/capability-bootstrap.ts`), after seeding harness
337: commands, register local-agent caps:
338: ```typescript
339: const executor = new LocalAgentProviderExecutor(localAgentStore)
340: for (const cap of registerLocalAgentCaps(executor)) registry.register(cap)
341: ```
342: 
343: ### 5.6 Event bridge (SSE → CapabilityEventBus)
344: ```typescript
345: // src/engines/local-agent/event-bridge.ts
346: const es = await fetch(`http://localhost:4096/event`, { headers: { accept:'text/event-stream' } })
347: // pipe server bus events into CapabilityEventBus.emit(...)
348: ```
349: 
350: ---
351: 
352: ## PART 6 — Subagent orchestration in vivim
353: 
354: Compose a multi-agent DAG with `CapabilityComposer` (existing):
355: ```typescript
356: const dag = compileRecipe({
357:   steps: [
358:     { id:'plan',   capabilityId:'cap:agent:run', input:{ agent:'plan',    message:'Plan unit 2.1' } },
359:     { id:'build',  capabilityId:'cap:agent:run', input:{ agent:'build',   message:'Implement per plan', dependsOn:['plan'] } },
360:     { id:'review', capabilityId:'cap:agent:run', input:{ agent:'code-reviewer', message:'Review diff', dependsOn:['build'] } },
361:   ],
362: })
363: ```
364: Each step shells `opencode run --auto --agent <id>`. `permission.task` on the orchestrator agent
365: limits which subagents may be spawned. Background subagents via
366: `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=1` map to `isAsync:true` capabilities.
367: 
368: ---
369: 
370: ## PART 7 — Operational guardrails (official + vivim invariants)
371: 
372: 1. **Permission deny-by-default for risky tools.** In `local-agent` config:
373:    ```jsonc
374:    "permission": { "*":"ask", "bash": { "*":"ask", "rm *":"deny", "git push":"ask" } }
375:    ```
376: 2. **serve auth**: always set `OPENCODE_SERVER_PASSWORD` if `serve` is reachable beyond localhost.
377: 3. **Timeout**: client-side `120s` + `124` check; never rely on agent self-termination.
378: 4. **No DOM**: local-agent capabilities must NOT import `ChromeGovernor` (Governor Canon).
379: 5. **Secrets**: only global/`OPENCODE_CONFIG_CONTENT` config may carry `{env:VAR}`.
380: 6. **Resume**: use explicit `--session <id>`; never combine `--continue` + prompt + `--auto`.
381: 7. **Observability**: set `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces; surface `agent.stats`.
382: 
383: ---
384: 
385: ## PART 8 — Verification
386: 
387: ```powershell
388: # 1. Headless one-shot works
389: opencode run "say hi" --auto --format json
390: 
391: # 2. vivim capability resolves + executes
392: bun run devops runtime-test test --nl "run opencode agent: fix the lint error in stream-parser.ts"
393: 
394: # 3. Subagent DAG runs
395: bun run devops runtime-test test --nl "orchestrate: plan then build then review unit X"
396: 
397: # 4. Governor Canon intact (no CDP import in local-agent)
398: Get-Content src/engines/local-agent/*.ts | Select-String "chrome-governor"   # expect: none
399: 
400: # 5. Cross-surface parity
401: bun run devops verify-cross-surface
402: ```
403: 
404: ---
405: 
406: ## PART 9 — Sources (official, fetched 2026-07-19)
407: 1. OpenCode Agents — https://opencode.ai/docs/agents/
408: 2. OpenCode Tools — https://opencode.ai/docs/tools/
409: 3. OpenCode CLI — https://opencode.ai/docs/cli/
410: 4. OpenCode Server — https://opencode.ai/docs/server/
411: 5. OpenCode Config — https://opencode.ai/docs/config/
412: 6. OpenCode Providers — https://opencode.ai/docs/providers/
413: 7. Kilo Code CLI — https://kilo.ai/docs/code-with-ai/platforms/cli
414: 8. vivim-final source — `src/engines/{unified-registry,capability-composer,conversation-manager,provider-registrar,stream-parser,capability-event-bus,chrome-governor}.ts`, `seeds/providers/manifests.ts`

(End of file - total 414 lines)
</content>
```

---

## Assistant (Plan · Tencent: Hy3 (free) · 10.9s)

I have a strong understanding of the baseline now. The team has verified the 4 free models, the one-shot `run --auto --format json` path, and discovered `serve` is unsecured. The spec is v1 (one-shot only). Let me check what other relevant research exists and the existing `opencode.json` config.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\opencode.json"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\opencode.json</path>
<type>file</type>
<content>
1: {
2:   "$schema": "https://opencode.ai/config.json",
3:   "model": "anthropic/claude-sonnet-4-20250514",
4:   "small_model": "anthropic/claude-haiku-3-20250307",
5:   "default_agent": "build",
6:   "logLevel": "INFO",
7:   "share": "manual",
8:   "autoupdate": true,
9:   "snapshot": false,
10:   "compaction": {
11:     "auto": true,
12:     "prune": true,
13:     "reserved": 10000
14:   },
15:   "instructions": [
16:     "AGENTS.md"
17:   ],
18:   "skills": {
19:     "paths": [
20:       ".opencode/skill"
21:     ]
22:   },
23:   "references": {
24:     "docs": {
25:       "path": "./docs/merged-design-v2",
26:       "description": "Complete design docs: epic, architecture, schema (54 tables), engines (13), seeds, API, implementation plan. Read in doc order 00-08, then SOTA-00 through SOTA-09."
27:     }
28:   },
29:   "agent": {
30:     "build": {
31:       "description": "Primary development agent. Full tool access for implementing features, writing code, running tests, and shipping.",
32:       "mode": "primary"
33:     },
34:     "plan": {
35:       "description": "Planning and analysis agent. Read-only — cannot edit files or run commands. Use for architecture review, design decisions, and implementation planning.",
36:       "mode": "primary"
37:     },
38:     "test": {
39:       "description": "Testing specialist. Writes unit, integration, and E2E tests. Runs test suites, analyzes coverage, fixes flaky tests. Use for all testing tasks.",
40:       "mode": "subagent"
41:     },
42:     "review": {
43:       "description": "Code review agent. Analyzes code for quality, bugs, security, and performance. Read-only — reports findings without making changes.",
44:       "mode": "subagent"
45:     },
46:     "db": {
47:       "description": "Database and Prisma specialist. Handles schema changes, migrations, seed files, query optimization, and database debugging.",
48:       "mode": "subagent"
49:     },
50:     "debug": {
51:       "description": "Debugging specialist. Investigates bugs using logs, traces, grep, and read tools. Reports root cause and fix recommendations.",
52:       "mode": "subagent"
53:     }
54:   },
55:   "command": {
56:     "migrate": {
57:       "description": "Run Prisma migration",
58:       "agent": "build",
59:       "template": "Run the Prisma migration: bunx prisma migrate dev --name $ARGUMENTS"
60:     },
61:     "seed": {
62:       "description": "Seed the database",
63:       "agent": "build",
64:       "template": "Run database seeding: bun run seed"
65:     },
66:     "check": {
67:       "description": "Run typecheck + lint + tests",
68:       "agent": "build",
69:       "template": "Run the full quality check pipeline: bun run typecheck && bun run lint && bun test"
70:     },
71:     "coverage": {
72:       "description": "Run tests with coverage report",
73:       "agent": "test",
74:       "template": "Run tests with coverage: bun test --coverage"
75:     },
76:     "review": {
77:       "description": "Review recent changes",
78:       "agent": "review",
79:       "template": "Review the current git diff for code quality, bugs, and security issues. Focus on: type safety, error handling, and edge cases."
80:     },
81:     "ship": {
82:       "description": "Final quality gate before merge",
83:       "agent": "build",
84:       "template": "Run the full ship pipeline: bun run typecheck && bun run lint && bun test && echo 'All checks passed - ready to ship.'"
85:     },
86:     "devops": {
87:       "description": "Run the agentic DevOps orchestrator loop to autonomously implement atomic units",
88:       "agent": "build",
89:       "template": "Load the devops skill and run the agentic DevOps orchestrator loop: read docs/atomic/01-tracker.md, then repeatedly `bun run devops select` to get the next unit, implement it per its atomic file, run `bun run devops gate`, and on pass run `bun run devops mark <id> done` + commit. Continue until all units are done or only blocked units remain. Never pause to ask."
90:     },
91:     "research": {
92:       "description": "Run deep research on a topic and wire findings into devops",
93:       "agent": "build",
94:       "template": "Load the devops-research skill and research the following topic: $ARGUMENTS. Steps: 1. Classify (unit/ADR/general). 2. Execute multi-source research (firecrawl + exa or web-search-prime fallback). 3. Produce full report, brief, and evidence. 4. Wire into devops (INDEX, FRESHNESS, CROSS-REF). 5. If unit-linked: update tracker. If ADR-linked: attach brief. 6. Report: paths + confidence + source count."
95:     }
96:   },
97:   "plugin": ["opencode-agent-memory"],
98:   "mcp": {
99:     "playwright": {
100:       "type": "local",
101:       "command": [
102:         "npx",
103:         "-y",
104:         "@playwright/mcp"
105:       ],
106:       "enabled": true,
107:       "env": {
108:         "BROWSER": "chromium"
109:       }
110:     }
111:   },
112:   "lsp": {
113:     "typescript": {
114:       "disabled": false,
115:       "command": ["bun", "run", "--bun", "typescript-language-server", "--stdio"],
116:       "initialization": {
117:         "preferences": {
118:           "importModuleSpecifierPreference": "relative"
119:         }
120:       }
121:     }
122:   },
123:   "permission": "allow"
124: }

(End of file - total 124 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\research\\reports\\opencode-agentic-capabilities-sota-2026.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\research\reports\opencode-agentic-capabilities-sota-2026.md</path>
<type>file</type>
<content>
1: # OpenCode Agentic Dev Loops & Subagent Orchestration — Capability Inventory for vivim-final
2: 
3: *Generated: 2026-07-19 | Sources: OpenCode official docs (agents, tools, cli, server, config) + vivim-final source | Confidence: High*
4: 
5: This artifact extracts the **full official OpenCode capability surface** for agentic dev loops and
6: subagent orchestration, then maps each capability to a concrete home in vivim-final's existing
7: engine/contract layout (sourced from `src/engines/*`). The integration shape is **Shape B
8: (`local-agent` provider type)** from `non-tui-kilocode-opencode-brief.md` — no CDP, ChromeGovernor
9: untouched.
10: 
11: ## 0. Source map (vivim engines referenced below)
12: 
13: | vivim engine / contract | File | Role |
14: |---|---|---|
15: | `UnifiedCapabilityRegistry` | `src/engines/unified-registry.ts` | Single registry; every cap defined once, exported to cli/ui/workflow/mcp/api |
16: | `CapabilityResolutionEngine` | `src/engines/capability-resolution.ts` | Resolves which capability runs for a request |
17: | `CapabilityComposer` | `src/engines/capability-composer.ts` | Composite (multi-step) capabilities |
18: | `ConversationManager` | `src/engines/conversation-manager.ts` | Per-conversation send/capture; `captureAsNode()` |
19: | `ProviderRegistrar` | `src/engines/provider-registrar.ts` | Seeds providers into DB |
20: | `StreamParserEngine` | `src/engines/stream-parser.ts` | Parses agent output → `ContentBlock[]` (DB-only parser logic) |
21: | `CapabilityEventBus` | `src/engines/capability-event-bus.ts` | Pub/sub for capability lifecycle events |
22: | `CommandPatternRegistry` (NLCL) | `src/engines/nlcl/command-registry.ts` | NL phrase → capability binding |
23: | `ChromeGovernor` | `src/engines/chrome-governor.ts` | CDP-only (NOT used by local-agent) |
24: 
25: ## 0.1 TESTED TRUTH — verified on this host (2026-07-19)
26: 
27: Commands were actually executed on the dev machine (Windows, `opencode` installed via bun,
28: Node v24). Results override any assumption in the official docs.
29: 
30: **Install confirmed:** `opencode` resolves on PATH (`C:\Users\VIVIM.inc\.bun\bin\opencode.cmd`);
31: `kilo` also present. No API key required for Zen free models.
32: 
33: **Zen free models actually run (zero key, cost: 0, `--format json` valid):**
34: 
35: | Model ID | Test | Result |
36: |---|---|---|
37: | `opencode/deepseek-v4-flash-free` | `run --auto --model … "PONG"` | ✅ exit 0, ~43s, returned `PONG`, `cost:0` |
38: | `opencode/hy3-free` (Tencent) | `run --auto --model … "OK"` | ✅ exit 0, ~54s, returned `OK` |
39: | `opencode/mimo-v2.5-free` | `run --auto --model … "OK"` | ✅ exit 0, ~41s, returned `OK` |
40: | `opencode/north-mini-code-free` | `run --auto --model … "OK"` | ✅ exit 0, ~37s, returned `OK` |
41: | `opencode/nemotron-3-ultra-free` | `run --auto … "OK"` | ❌ no text in 5 min — **unusable (too slow/queued)** |
42: 
43: **Decision:** For now use **only these four Zen free models** —
44: `deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`.
45: 
46: **Verified JSON shape** (`--format json`), directly parseable to `ContentBlock[]`:
47: ```json
48: {"type":"text","part":{"type":"text","text":"PONG",
49:  "time":{"start":1784413182629,"end":1784413182639}},
50:  "tokens":{"total":68608,"input":68591,"output":3,"reasoning":14,"cost":0}}
51: ```
52: `step_start` / `text` / `step_finish` event stream — same contract the impl doc's
53: `LocalAgentProviderExecutor.parse()` consumes via `StreamParserEngine`.
54: 
55: **`serve` verified to start** (`opencode server listening on http://127.0.0.1:4097`) but logs
56: `OPENCODE_SERVER_PASSWORD is not set; server is unsecured.` → the auth guardrail in the impl doc is
57: real; always set `OPENCODE_SERVER_PASSWORD` for any networked serve. (Health probe raced startup in
58: test; use `--attach` or a longer readiness wait, not a bare 5s GET.)
59: 
60: ## 1. OpenCode capability inventory (official)
61: 
62: ### 1.1 Agent topology
63: | Capability | OpenCode mechanism | vivim home |
64: |---|---|---|
65: | Primary agents (Build/Plan) | `mode: primary`, Tab to cycle | `LocalAgentProviderExecutor` agent variants seeded as `UnifiedCapability` |
66: | Subagents (General/Explore/Scout) | `mode: subagent`, `@`-mention, Task tool | Subagent fan-out capability → `CapabilityComposer` DAG |
67: | Hidden internal subagents | `hidden: true` (programmatic only) | `tags:['internal']` on the capability |
68: | `mode: all` | usable as both primary + subagent | single capability, `surfaces` includes all |
69: 
70: ### 1.2 Subagent orchestration (the loop primitive)
71: | Capability | OpenCode mechanism | vivim home |
72: |---|---|---|
73: | Invoke subagent via Task tool | `permission.task` glob allow/deny; Task tool spawns child session | `capability-composer` node that shells `opencode run --agent <sub>` |
74: | `@`-mention dispatch | manual invoke in message | NLCL `command-registry` pattern `@<agent>` |
75: | Child sessions + navigation | `session_child_first/cycle/parent` keys | `ConversationManager` fork-linking (`responds_to` edge) |
76: | Task permissions scoping | `permission.task: { "*": "deny", "code-reviewer": "ask" }` | per-capability `requiresConfirmation` + `permission` map |
77: | Background subagents (experimental) | `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` | async `UnifiedCapability.isAsync` + `CapabilityEventBus` |
78: 
79: ### 1.3 Non-interactive / headless execution (dev loops)
80: | Capability | OpenCode mechanism | vivim home |
81: |---|---|---|
82: | One-shot prompt | `opencode run "<msg>"` | `local-agent` capability handler |
83: | Auto-approve | `--auto` | `permission` config passed to executor |
84: | JSON events | `--format json` | parse to `ContentBlock[]` via `StreamParserEngine` |
85: | Attach to warm server | `run --attach http://localhost:4096` | reuse a `serve` instance per devops loop |
86: | Async message | `POST /session/:id/prompt_async` (204) | fire-and-forget capability |
87: | Session fork/resume | `--fork`, `/session/:id/fork` | `ConversationManager` fork |
88: | Exit codes | `0`/`124`(timeout)/`1` | executor maps to vivim `Result` |
89: 
90: ### 1.4 Headless HTTP server (programmatic control)
91: | Capability | OpenCode HTTP API | vivim home |
92: |---|---|---|
93: | Create session | `POST /session` | `conversation-manager` create |
94: | Send (blocking) | `POST /session/:id/message` | capability handler |
95: | Send (async) | `POST /session/:id/prompt_async` | async capability |
96: | Slash command | `POST /session/:id/command` | capability → `command-registry` |
97: | Shell exec | `POST /session/:id/shell` | `bash` tool capability |
98: | Read file | `GET /file/content?path=` | `read` tool capability |
99: | Grep/Find | `GET /find`, `GET /find/file`, `GET /find/symbol` | `grep`/`glob` tool capability |
100: | SSE events | `GET /event` | `CapabilityEventBus` bridge |
101: | Tool schemas | `GET /experimental/tool/ids`, `/experimental/tool` | capability introspection |
102: | MCP add | `POST /mcp` | MCP bridge capability |
103: | Auth set | `PUT /auth/:id` | credential capability |
104: | Health | `GET /global/health` | liveness probe |
105: 
106: ### 1.5 Agent configuration axes (per-agent)
107: | Axis | OpenCode key | vivim mapping |
108: |---|---|---|
109: | System prompt | `prompt: "{file:...}"` | `UnifiedCapability.description` + seeded prompt |
110: | Model | `model: "provider/model"` | `provider` field on capability ctx |
111: | Temperature | `temperature` | passed to executor env/flag |
112: | Top-p | `top_p` | passed through |
113: | Max steps | `steps` | `CapabilityContext.metadata.maxSteps` → executor `--max-steps` |
114: | Permission | `permission` (allow/ask/deny + glob) | `requiresConfirmation` + permission map |
115: | Mode | `mode: primary|subagent|all` | `surfaces` |
116: | Hidden | `hidden: true` | `tags:['internal']` |
117: | Task scope | `permission.task` | capability allow-list |
118: | Color | `color` | UI slot styling |
119: | Pass-through model opts | arbitrary keys | executor extra flags |
120: 
121: ### 1.6 Tool surface (what agents can do)
122: `bash`, `edit`, `write`, `read`, `grep`, `glob`, `lsp`, `patch`, `skill`, `todowrite`,
123: `todoread`, `webfetch`, `websearch`, `question`, `task`, `external_directory`, `doom_loop`.
124: Each maps to a `UnifiedCapability` with `tags:['agent-tool']`. Note `question` is auto-answered in
125: `--auto` mode ("make the decision autonomously") — see limitations.
126: 
127: ## 2. Full capability list we can bring into vivim-final
128: 
129: Grouped by integration class. Each is real, derivable from the official docs above.
130: 
131: **A. Local-agent execution (Shape B core)**
132: 1. `agent.run` — one-shot `kilo/opencode run --auto` → `ContentBlock[]`
133: 2. `agent.run.json` — OpenCode `--format json` structured parse
134: 3. `agent.run.attach` — attach to warm `serve` (skip MCP cold boot)
135: 4. `agent.run.async` — `prompt_async` fire-and-forget
136: 5. `agent.serve.start` — launch `opencode serve` as a managed dev-loop backend
137: 6. `agent.serve.health` — `GET /global/health` liveness
138: 7. `agent.session.create` — `POST /session`
139: 8. `agent.session.fork` — fork at message
140: 9. `agent.session.delete` — `DELETE /session/:id`
141: 
142: **B. Subagent orchestration**
143: 10. `agent.subagent.invoke` — Task-tool spawn (child session)
144: 11. `agent.subagent.mention` — `@<agent>` dispatch (NLCL pattern)
145: 12. `agent.subagent.background` — `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`
146: 13. `agent.orchestrate` — multi-subagent DAG via `CapabilityComposer`
147: 14. `agent.task.scope` — `permission.task` allow/deny lists
148: 
149: **C. Agent configuration as capabilities**
150: 15. `agent.define` — seed an OpenCode agent (markdown/JSON) as a vivim capability
151: 16. `agent.pick.model` — per-agent `model` override
152: 17. `agent.pick.temperature` / `top_p` — sampling control
153: 18. `agent.limit.steps` — `steps` cap → cost control
154: 19. `agent.restrict.permissions` — per-agent allow/ask/deny + glob
155: 20. `agent.hide` — `hidden:true` internal subagent
156: 
157: **D. Tool-surface bridge (agent tools → vivim capabilities)**
158: 21. `tool.bash`, `tool.edit`, `tool.write`, `tool.read`, `tool.grep`, `tool.glob`,
159:     `tool.lsp`, `tool.patch`, `tool.skill`, `tool.todowrite`, `tool.webfetch`,
160:     `tool.websearch`, `tool.question`, `tool.task`, `tool.external_directory`,
161:     `tool.doom_loop` — 17 tool capabilities, each gated by `permission`.
162: 
163: **E. HTTP/server bridge**
164: 22. `server.command` — `POST /session/:id/command`
165: 23. `server.shell` — `POST /session/:id/shell`
166: 24. `server.file.read` — `GET /file/content`
167: 25. `server.find` / `server.find.file` / `server.find.symbol` — search
168: 26. `server.event.stream` — `GET /event` → `CapabilityEventBus`
169: 27. `server.mcp.add` — `POST /mcp`
170: 28. `server.auth.set` — `PUT /auth/:id`
171: 
172: **F. Observability / handoff**
173: 29. `agent.session.export` / `import` — JSON handoff
174: 30. `agent.stats` — token/cost stats
175: 31. `agent.otlp` — OTEL export bridge
176: 
177: That is **31 distinct capabilities** across 6 classes, all backed by official OpenCode APIs.
178: 
179: ## 3. Limitations carried into vivim (must encode)
180: - `question` tool is auto-answered in `--auto` → never rely on it for input; pre-define permissions.
181: - `serve` can hang (community issue) → prefer `run` for unattended; client timeout + `124` check.
182: - `serve` unauthenticated unless `OPENCODE_SERVER_PASSWORD` set → bind localhost, require password.
183: - `--continue` mutually exclusive with prompt/`--auto` → use explicit session IDs.
184: - Non-TUI: no DOM vision → do NOT route browser-grounded work here; that stays ChromeGovernor.
185: - `{env:VAR}` only resolves in trusted config (global / env-passed), never committed project config.
186: 
187: ## 4. Confidence & sources
188: All capabilities above trace to: OpenCode `docs/agents/`, `docs/tools/`, `docs/cli/`, `docs/server/`,
189: `docs/config/` (official, fetched 2026-07-19) and vivim `src/engines/*` (local source). Convergence:
190: CONFIRMED (Shape B). No conflicting guidance on the integration seam.

(End of file - total 190 lines)
</content>
```

---

## Assistant (Plan · Tencent: Hy3 (free) · 17.4s)

I now have a thorough understanding of the baseline. The team has done empirical testing of the **v1 one-shot `run` path** and documented the full capability surface from official docs — but several areas lack real, verified understanding (tool-use mechanics, context/compaction, the unsecured `serve` risk, ACP, streaming schema, permission semantics). 

The user wants 10 research areas with a real, documented understanding (full comms protocol, tooluse, context, etc.). Since this is a planning task, I should produce a research plan. Let me quickly verify a couple of uncertainties before finalizing — particularly whether the `serve` auth and ACP details are truly open questions, and check the `provider-testing` skill that already exists.

I have enough to propose the 10 research areas. Let me write the plan file.

**Tool: bash**

**Input:**
```json
{
  "command": "Get-Content -Path \"C:\\0-BlackBoxProject-0\\vivim-final\\.opencode\\skill\\provider-testing\\SKILL.md\" -ErrorAction SilentlyContinue | Select-Object -First 50",
  "description": "Read provider-testing skill head"
}
```

**Output:**
```
---
name: provider-testing
description: Test providers in vivim-final. Covers the 8-phase onboarding pipeline (discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge), parser test workflow, CDP selector validation, and provider status checking. Use when testing a provider, onboarding a new provider, or diagnosing provider-specific failures.
---

# Provider Testing

## The 8-Phase Onboarding Pipeline

Every provider goes through this pipeline. Each phase is a bounded, repeatable mode:

```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

| Phase | Command | Gate |
|-------|---------|------|
| discover | `bun run devops discover-protocol <url> --hint=<name>` | Returns manifest with selectors + format |
| infer | `bun run devops runtime-test onboard infer --provider=<slug>` | Confidence >= 0.7 |
| test-selectors | `bun run devops runtime-test onboard test-selectors --provider=<slug>` | All selectors match live DOM |
| test-parse | `bun run devops runtime-test onboard test-parse --provider=<slug>` | All known formats parse |
| test-cap | `bun run devops runtime-test onboard test-cap --provider=<slug>` | Capability resolves via `/api/interpret` |
| test-frontend | `bun run devops runtime-test onboard test-frontend --provider=<slug>` | UI renders capability |
| verify | `bun run devops runtime-test onboard verify --provider=<slug>` | CLI + API + MCP + UI all resolve |
| converge | `bun run devops runtime-test onboard converge --provider=<slug>` | No drift from spec |

## Provider Status

Before starting, check what exists:

```bash
# All providers summary
bun run devops agentic preflight

# Single provider deep-dive (seed, profile, slave, caps, selectors, UI)
bun run devops runtime-test status --provider=gemini
```

The status command returns: `seeded?`, `profileOnDisk?`, `hasCookies?`, `liveSlave?`, `capabilityRegistered?`, `selectorConfidence?`, `uiTestStatus`. Verdict is `already-registered` / `partial` / `absent`.

## Parser Test Workflow

Each provider has harvested parsers in `seeds/parsers/harvested/<slug>-*.ts` as `LOGIC_CODE` strings. They are tested in two ways:

### 1. Unit: Format Correctness (`tests/unit/engines/harvested-parser.test.ts`)
Compiles each `LOGIC_CODE` via `new Function`, runs against representative payload samples.

```bash
bun test tests/unit/engines/harvested-parser.test.ts
```

```

---

## Assistant (Plan · Tencent: Hy3 (free) · 33.4s)

I have a complete picture of the baseline. The existing research covers the **v1 one-shot `run` path** empirically, plus a capability inventory from official docs — but it does **not** contain verified, documented understanding of the deeper protocol mechanics (full `--format json` event schema, real tool-call loop, context/compaction contract, the unsecured `serve`, ACP framing, permission enforcement, multi-turn state, error/failure semantics, kill/timeout signals, and config precedence). 

Let me write the research plan.

**Tool: write**

**Input:**
```json
{
  "content": "# Research Plan: OpenCode `local-agent` Provider — Deep Protocol Understanding\n\n**Feature**: `022-local-agent-opencode` | **Date**: 2026-07-19\n**Mode**: Research-only (no source changes). Output = 10 documented research briefs with verified facts + examples.\n\n## Baseline (what we already know — verified 2026-07-19 on this host)\n\n- `opencode` runs via bun (`C:\\Users\\VIVIM.inc\\.bun\\bin\\opencode.cmd`), kill present, Node v24, Windows.\n- 4 verified Zen free models run with **no key, cost 0**: `deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`. `nemotron-3-ultra-free` excluded (timed out >5 min).\n- One-shot path verified: `opencode run --auto --model <id> --format json \"<prompt>\"` → exit 0; JSON tail `{\"type\":\"text\",\"part\":{\"type\":\"text\",\"text\":\"PONG\"},\"tokens\":{\"total\":68608,\"input\":68591,\"output\":3,\"reasoning\":14,\"cost\":0}}`.\n- `serve` starts **unsecured** by default (observed log `OPENCODE_SERVER_PASSWORD is not set; server is unsecured`). Always set `OPENCODE_SERVER_PASSWORD`.\n- Spec `specs/022-local-agent-opencode/spec.md` is **v1 one-shot only** (`run`, no `serve`/ACP). Executor shells `opencode` via `Bun.spawn`; must NOT import `ChromeGovernor` (Governor Canon).\n- Existing docs: `docs/research/reports/opencode-agentic-{capabilities-sota,impl-docs}-2026.md` + `evidence/opencode-agentic/notes.md` are **doc-derived inventories**, not empirically verified for the deep protocol mechanics.\n\n## Critical gap\n\nWe have a capability *inventory* but **no verified, documented, example-backed understanding** of the actual wire protocol. The 10 areas below are the ones blocking a \"fully documented real understanding\" of full comms protocol, tooluse, context, etc. Each must be grounded in **live execution on this host + official docs**, not inference.\n\n## The 10 research areas (each → one brief in `docs/research/briefs/opencode-deep/`)\n\n1. **Full `--format json` event-stream contract (comms protocol)**\n   - Reconstruct the *complete* ordered event schema from `step_start` → `text`/`reasoning`/`tool_call` → `step_finish` → terminal, including every field (`part`, `tokens`, `session`, `permission`, `variant`).\n   - Capture a real multi-event transcript (long prompt) and document field-by-field. Verify vs `docs/research/reports/opencode-agentic-impl-docs-2026.md` PART 3/4.\n   - Deliverable: canonical event grammar + recorded sample → maps to `ContentBlock[]` (`src/schema/streaming.ts`).\n\n2. **Tool-use loop mechanics (TUI-internal tool calls)**\n   - What does the agent actually invoke when it needs to `edit`/`bash`/`read`/`grep`? Are tool calls surfaced in `--format json` as distinct event types, or only as final text?\n   - Run a task that *requires* a tool (e.g. \"read stream-parser.ts and summarize\") and capture the raw stream to see `tool_call`/`permission` events.\n   - Document: event shape, approval flow under `--auto`, how tool *results* return into the stream. Feeds `tool.*` capability class (cap list item D).\n\n3. **Context window, compaction & session state (context)**\n   - `opencode.json` has `compaction.auto/prune/reserved:10000`. What is the real context contract? When does compaction fire, what `reserved` means, and is there a `compaction` event in `--format json`?\n   - Test a long multi-turn session; capture compaction trigger + resulting event. Document token accounting (`tokens.input/reasoning/output`) semantics and cost:0 guarantee for free models.\n   - Feeds `ConversationManager.captureAsNode()` fork-linking + node-layer v2 versioning.\n\n4. **`serve` HTTP API — full surface & auth (security-critical)**\n   - The #1 open risk: unsecured `serve`. Document exact auth model: `OPENCODE_SERVER_PASSWORD` (username default `opencode`), token header name, how `/session/:id/message` is authed.\n   - Enumerate ALL endpoints from live `GET /doc` OpenAPI 3.1 on `127.0.0.1:<port>`; confirm request/response shapes for `POST /session`, `POST /session/:id/message`, `GET /event`, `POST /session/:id/prompt_async`.\n   - Document readiness race (health probe lost to startup) + safe boot/wait pattern. Determines whether `serve` is viable beyond v1.\n\n5. **ACP (Agent Client Protocol) stdio contract (embed path)**\n   - `opencode acp --cwd <repo>` emits nd-JSON on stdin/stdout. Document the ACP message framing (handshake, `initialize`, `prompt`, `notification` types), vs the `--format json` CLI events.\n   - Verify ACP is the better embed contract for `CapabilityComposer` DAG fan-out (per impl doc PART 3.3). Capture a real ACP session transcript.\n   - Decision input: `run` (one-shot) vs `acp` (managed subagent) vs `serve` (persistent) for v2.\n\n6. **Permission model & tool gating (safety)**\n   - `permission: allow|ask|deny` + glob; `permission.task` scoping subagents. How is `ask` resolved headlessly (implied: auto-answered / denied)? What is deny-by-default behavior?\n   - Verify: run with `permission:{\"*\":\"deny\"}` + a tool-needing prompt → does it error or skip? Document exit behavior.\n   - Maps to `requiresConfirmation` + `permission` map on `UnifiedCapability` (cap class C/E).\n\n7. **Multi-turn / session resume & forking (state)**\n   - `--session <id>`, `--continue`, `--fork`, `/session/:id/fork`. What is the session artifact on disk? Is `--continue` truly mutually exclusive with prompt+`--auto` (per impl doc limitation)?\n   - Test resume: run, capture session id, `--session <id>` second message → verify continuity + event diff. Feeds `agent.session.fork/create/delete` caps.\n\n8. **Streaming / SSE transport & partial-delivery semantics**\n   - `--format json` is it line-delimited? Does `serve`'s `GET /event` SSE carry the *same* events as CLI json? Document delimiters, flush cadence, partial-block reassembly for `StreamParserEngine`.\n   - Needed because `LocalAgentProviderExecutor.parse()` must handle partial/streamed chunks without a DB parser that assumes complete payloads.\n\n9. **Error, failure & signal semantics (robustness)**\n   - Exit codes `0`/`1`/`124`(timeout) confirmed in docs but not stress-tested. What events precede a non-zero exit (e.g. `error` event type)? How does SIGTERM kill behave mid-stream?\n   - Force failures: bad model, denied tool, hung prompt → capture exit + stdout/stderr. Define `EngineError` mapping for `capability:failed`.\n\n10. **Config precedence, providers & model routing (wiring)**\n    - `opencode.json` resolution order (global → project → `OPENCODE_CONFIG_CONTENT`), how `model`/`small_model`/per-agent `model` override, and how the `opencode/` Zen provider group is registered (local vs keyed).\n    - Verify: can we pin `default_agent`/per-capability model purely via committed config without secrets? Document the `{env:VAR}` trust boundary (global only).\n    - Feeds `LocalAgentStore` config shape + seed manifest (`seeds/providers/local-agent.ts`).\n\n## Method per area (recommended)\n\n1. Live capture on this host: `opencode run --auto --model opencode/<free> --format json \"<task>\" 2>&1 | Tee-Object -FilePath docs/research/evidence/opencode-deep/<area>.transcript.txt`\n2. For `serve`/ACP: start in background, hit with PowerShell `Invoke-RestMethod` / capture stdio; use `OPENCODE_SERVER_PASSWORD` + localhost bind.\n3. Cross-check every claim against official docs: `opencode.ai/docs/{agents,tools,cli,server,config,providers}` (already linked in impl doc PART 9).\n4. Write a brief per area: **Verified facts (with transcript excerpt) · Official doc confirmation · Gap/risk · Mapping to vivim engine/contract · Example snippet**.\n\n## Output location\n\n`docs/research/briefs/opencode-deep/<NN>-<area>.md` (10 files) + `docs/research/evidence/opencode-deep/*.transcript.txt` (raw captures). Append a consolidated index `docs/research/briefs/opencode-deep/INDEX.md`.\n\n## Open questions to resolve through research\n\n- Is `--format json` the *complete* comms contract, or does `serve`/ACP expose richer tool/permission events not visible in one-shot?\n- Can `serve` be made safe enough (password + localhost) to justify v2 persistent backend?\n- Does tool-use actually surface as parseable events, or only final synthesized text (affects `tool.*` capability feasibility)?\n\n## Validation\n\n- Each brief cites a real transcript excerpt from this host.\n- Cross-surface parity unaffected (local-agent stays out of `ChromeGovernor`).\n- Findings feed a v2 spec update (currently out of scope to implement).\n",
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\.kilo\\plans\\1784416945191-opencode-deep-research-plan.md"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Plan · Tencent: Hy3 (free) · 11.0s)

I've reviewed the full baseline and written the research plan.

**What I found (baseline):** You have solid empirical verification of the **v1 one-shot `run` path** (4 free Zen models, `--format json`, cost 0) plus a doc-derived capability inventory — but the deep protocol mechanics (full event schema, real tool-call loop, context/compaction contract, the unsecured `serve`, ACP, permissions, multi-turn state, streaming delimiters, error signals, config precedence) are **not yet verified or example-backed**.

**The 10 research areas I'm proposing** (each → a brief + a real transcript captured on this host):

1. Full `--format json` event-stream contract (comms protocol)
2. Tool-use loop mechanics (are tool calls surfaced as events?)
3. Context window, compaction & session state
4. `serve` HTTP API — full surface & auth (security-critical)
5. ACP stdio contract (embed path)
6. Permission model & tool gating (safety)
7. Multi-turn / session resume & forking
8. Streaming / SSE transport & partial-delivery semantics
9. Error, failure & signal semantics
10. Config precedence, providers & model routing

Each brief follows: **verified facts (transcript) · doc confirmation · gap/risk · vivim mapping · example**. Output to `docs/research/briefs/opencode-deep/` + raw transcripts in `evidence/opencode-deep/`.

Two notes worth flagging before I finalize: research areas **#2 (tool-use)** and **#4 (serve auth)** are the highest-value because they decide whether the `tool.*` capabilities and any v2 persistent backend are even feasible. The plan is research-only (no source changes); it feeds a future v2 spec update.

**Tool: plan_exit**

**Input:**
```json
{
  "path": "C:\\0-BlackBoxProject-0\\vivim-final\\.kilo\\plans\\1784416945191-opencode-deep-research-plan.md"
}
```

**Output:**
```
Plan is ready at .kilo\plans\1784416945191-opencode-deep-research-plan.md. Ending planning turn.
```

---

