# docs/audits/

Generated output directory for the **source-code audit** subsystem
(`bun run devops audit-code <scope>` → `devops/audit-code/`).

## What lands here

All outputs are written **repo-local** (under this directory) — nothing is ever
written to a system temp directory. Paths are resolved from the audit module's
location, so the reports are portable across machines and clones.

| File | Produced by | Committed? |
|---|---|---|
| `CODE-AUDIT-<scope>-<date>.md` | `audit-code <scope>` | No (regenerated) |
| `findings.json` | every run (consumed by `audit-code fix`) | No (regenerated) |
| `baseline-<date>.json` | `audit-code full --baseline` | No (regenerated) |
| `AUDIT-UNITS-<date>.md` | `audit-code --to-units` | No (regenerated) |

The pre-existing hand-written audit docs in this directory (e.g. `cap-store-audit.md`,
`extraction/`, `providers/`) are **tracked** and unrelated to the generator.

## Regenerate after a fresh clone

```powershell
bun install
bun run devops audit-code standard      # report + findings.json
bun run devops audit-code fix <id>      # print fix instructions
bun run devops audit-code fix <id> --apply   # apply auto-fixable fixes only
```

See `.opencode/skill/source-audit/SKILL.md` for the full command reference.
