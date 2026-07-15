# VIVIM Skills Index

Skill routing table — maps user intents to the correct skill.

## Active Skills

| User Intent | Skill | Trigger Phrases |
|-------------|-------|-----------------|
| "implement the next unit" / "continue" / "keep going" / "devops" | `devops` | `bun run devops run`, autonomous loop |
| "build X" / "add capability Y" / "full stack" | `devops` (Goal Mode) | `bun run devops runtime-test loop --goal="..."` |
| "build an engine" / "implement engine" | `devops` (Backend Build) | Engine implementation patterns |
| "automate the browser" / "type in the UI" / "click" | `devops` (automate) | `bun run devops automate <action>` |
| "research X" / "deep dive on Y" / "web search" | `devops-research` | Research-first intelligence layer |
| "plan the roadmap" / "what should we build?" | `devops-roadmap` | Truth scanning, gap discovery |
| "generate taxonomy for X" / "build provider library" | `devops-generators` | PlatformCatalog + ProviderCapabilityTaxonomy |
| "audit the codebase" / "find bugs" / "code quality" | `source-audit` | `bun run devops audit-code <scope>` |
| "audit the architecture" / "find cycles" / "module graph" | `arch-audit` | `bun run devops audit-arch <scope>` |
| "write tests" / "fix flaky tests" / "test coverage" | `vivim-testing` | Testing patterns and workflows |
| "build frontend UI" / "add a button" / "hot-swap" | `vivi-frontend` | Component-driven, contract-first |
| "set up Prisma" / "create a migration" / "schema" | `prisma-workflow` | Prisma patterns and workflows |

## Deprecated Skills (Do Not Load)

| Skill | Replacement |
|-------|-------------|
| `vivim-runtime` | `devops` (Goal Mode) |
| `vivim-build` | `devops` (Backend Build) |

## Skill Loading

Skills are loaded via the `skill` tool. The agent should:
1. Match user intent to the appropriate skill from the table above
2. Load the skill using the `skill` tool with the skill name
3. Follow the skill's instructions for the task

## Notes

- `devops` is the primary orchestrator — it covers tracker mode, goal mode, engine building, and browser automation
- `devops-research`, `devops-roadmap`, `devops-generators` are complementary research/planning skills
- `source-audit` and `arch-audit` drive deterministic mechanics in `devops/audit-code/` and `devops/audit-arch/`
- `vivim-testing` and `prisma-workflow` are infrastructure skills for testing and database workflows
- `vivi-frontend` is the frontend development skill — component-driven, contract-first
