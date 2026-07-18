# Triage Labels — vivim-final

## Canonical Roles

| Role | Label | Description |
|------|-------|-------------|
| Needs evaluation | `needs-triage` | Maintainer needs to evaluate |
| Waiting on reporter | `needs-info` | Waiting on reporter for more info |
| Agent-ready | `ready-for-agent` | Fully specified, AFK-ready (agent can pick up with no human context) |
| Human-ready | `ready-for-human` | Needs human implementation |
| Won't fix | `wontfix` | Will not be actioned |

## Additional Labels

| Label | Description |
|-------|-------------|
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |
| `documentation` | Docs only |
| `testing` | Test coverage |
| `infrastructure` | CI/CD, build, tooling |
| `priority:high` | Must fix before next release |
| `priority:low` | Nice to have |

## State Machine

```
[new issue] → needs-triage
  ├── needs-info (waiting on reporter)
  │     └── needs-triage (reporter responded)
  ├── ready-for-agent (fully specified)
  │     └── wontfix (decided not to action)
  └── ready-for-human (needs human)
```
