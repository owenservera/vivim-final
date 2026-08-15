# vivim-final Documentation

Documentation for the vivim-final project, organized by concern.

## Quick Start

New to the codebase? Start here:

1. **[Architecture Overview](architecture/overview.md)** — System-wide map and component overview
2. **[Engine Catalog](architecture/backend.md)** — What each engine does
3. **[Data Model](architecture/data-model.md)** — Schema philosophy and structure
4. **[Module Documentation](modules/)** — Per-component documentation
5. **[Glossary](GLOSSARY.md)** — Domain terms and internal shorthand

## Documentation Structure

```
docs/
├── architecture/          # System design and layer overviews
│   ├── overview.md       # System-wide map (C4-style)
│   ├── frontend.md       # Frontend architecture
│   ├── backend.md        # Backend engines
│   ├── data-model.md     # Database schema philosophy
│   └── dual-db.md        # Dual-database strategy
├── decisions/            # Architecture Decision Records (ADRs)
│   ├── TEMPLATE.md       # ADR template
│   └── ADR-*.md          # Individual decisions
├── modules/              # Per-component documentation
│   ├── engines.md        # Core computation engines
│   ├── storage.md       # Data persistence layer
│   ├── api.md            # HTTP API layer
│   ├── desktop.md        # Tauri desktop application
│   ├── frontend.md       # Next.js frontend
│   └── devops.md         # DevOps and tooling
├── runbooks/             # Operational guides
│   ├── dev.md            # Local development setup
│   ├── desktop.md        # Desktop build and deploy
│   └── providers.md     # Provider onboarding
├── api/                  # Auto-generated API docs
│   └── README.md         # Setup instructions
├── GLOSSARY.md           # Domain terms and shorthand
└── README.md             # This file
```

## Documentation Protocol

**Docs-as-a-byproduct-of-work:** Every time code changes in a way that affects how the system works, the relevant doc gets touched in the *same commit/PR*. Not later. Not "I'll circle back."

**Rule:** If you touch code that changes behavior, architecture, an API contract, or a decision — you touch the matching doc in the same change. No exceptions, no "TODO: update docs."

See [CONTRIBUTING.md](../CONTRIBUTING.md#documentation) for detailed guidelines.

## Legacy Documentation

The previous documentation structure has been archived to `.archive/docs-legacy-2026-08-15/` for reference.