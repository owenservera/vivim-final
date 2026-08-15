<![CDATA[<div align="center">

# Contributing to Vivim

**Thank you for your interest in contributing to Vivim!**

</div>

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Getting Started

### Prerequisites

- **Bun** 1.3.14+ ([Install](https://bun.sh))
- **Node.js** 20+ ([Install](https://nodejs.org))
- **Git** ([Install](https://git-scm.com))
- **VS Code** (recommended) with extensions:
  - Bun
  - TypeScript

### Fork and Clone

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/vivim-final.git
   cd vivim-final
   ```
3. **Add** upstream remote:
   ```bash
   git remote add upstream https://github.com/owenservera/vivim-final.git
   ```

### Setup Development Environment

```bash
# Install dependencies
bun install

# Set up database
bun run prisma:generate
bun run seed

# Start development server
bun run dev
```

This starts:
- **Backend** at `http://localhost:9420`
- **Frontend** at `http://localhost:3000`

See [Dev Runbook](docs/runbooks/dev.md) for detailed setup and gotchas.

---

## Development Workflow

### Branch Naming

Use descriptive branch names:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/add-grok-provider` |
| `fix/` | Bug fix | `fix/streaming-memory-leak` |
| `docs/` | Documentation | `docs/update-api-reference` |
| `refactor/` | Code refactoring | `refactor/capability-engine` |
| `test/` | Tests | `test/add-unit-tests` |
| `chore/` | Maintenance | `chore/update-dependencies` |

### Development Steps

1. **Create** a branch from `master`:
   ```bash
   git checkout -b feat/my-feature master
   ```

2. **Make** your changes

3. **Write** tests for new functionality

4. **Run** tests:
   ```bash
   bun test
   bun run typecheck
   bun run lint
   ```

5. **Commit** your changes (see [Commit Messages](#commit-messages))

6. **Push** to your fork:
   ```bash
   git push origin feat/my-feature
   ```

7. **Create** a Pull Request

---

## Coding Standards

### TypeScript

- **Strict Mode** — All TypeScript in strict mode
- **No `any`** — Use `unknown` and type narrowing
- **Type Imports** — Use `import type` for type-only imports
- **File Extensions** — Use `.js` extension in imports (Bun ESM requirement)

```typescript
// Good
import type { Conversation } from './types.js'
import { createConversation } from './conversation.js'

// Bad
import { Conversation } from './types'
```

### Error Handling

- **Custom Errors** — Use custom error classes from `src/errors.ts`
- **No Swallowing** — Never swallow errors silently
- **Result Pattern** — Use `Result<T, E>` where appropriate

```typescript
// Good
try {
  const result = await riskyOperation()
  return Result.ok(result)
} catch (error) {
  if (error instanceof ValidationError) {
    return Result.err(error)
  }
  throw error // Re-throw unexpected errors
}

// Bad
try {
  return await riskyOperation()
} catch {
  return null // Swallowing errors
}
```

### Formatting

- **Biome** — Use Biome for formatting and linting
- **Line Length** — 100 characters max
- **Indentation** — 2 spaces
- **Quotes** — Double quotes for strings

```bash
# Format code
bun run format

# Check formatting
bun run lint
```

### File Organization

```
src/
├── engines/           # Core engines (455+ files)
├── storage/           # Database access layer
│   ├── contracts/     # Storage interfaces (use these)
│   └── impl/         # Storage implementations (never import from engines)
├── server/            # HTTP server and API routes
├── cli/               # CLI entry points
└── errors.ts          # Custom error classes
```

**Critical rule:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.

---

## Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(CapabilityEngine): add NL interpretation` |
| `fix` | Bug fix | `fix(StreamParser): handle empty chunks` |
| `docs` | Documentation | `docs(API): add WebSocket examples` |
| `style` | Formatting | `style: fix indentation` |
| `refactor` | Refactoring | `refactor(ProviderEngine): extract health check` |
| `test` | Tests | `test(CapabilityEngine): add unit tests` |
| `chore` | Maintenance | `chore: update dependencies` |

### Examples

```
feat(CapabilityEngine): add natural language interpretation

- Add `/api/interpret` endpoint
- Implement NL resolution with confidence scoring
- Add support for complex multi-step instructions

Closes #123
```

```
fix(StreamParser): handle empty chunks from provider

Previously, empty chunks from providers would cause a parsing error.
Now, empty chunks are skipped and logged for debugging.

Fixes #456
```

---

## Pull Requests

### PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows coding standards
- [ ] Tests pass (`bun test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Documentation is updated **in the same PR as the code**
- [ ] If making a non-obvious decision, new ADR written using TEMPLATE.md
- [ ] Commit messages follow format
- [ ] PR description explains changes

### PR Description

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

Describe tests added/updated

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks** — CI must pass
2. **Code Review** — At least one approval required
3. **Testing** — Reviewer tests locally if needed
4. **Merge** — Squash and merge to `master`

---

## Testing

### Test Types

| Type | Location | Purpose |
|------|----------|---------|
| Unit | `tests/unit/` | Test individual functions |
| Integration | `tests/integration/` | Test engine interactions |
| E2E | `tests/e2e/` | Test full stack |
| Architecture | `tests/arch/` | Test boundary invariants |

### Writing Tests

```typescript
// tests/unit/engines/capability-engine.test.ts
import { describe, it, expect } from 'bun:test'
import { CapabilityEngine } from '../../../src/engines/capability-engine.js'

describe('CapabilityEngine', () => {
  it('should resolve capability from natural language', async () => {
    const engine = new CapabilityEngine()
    const result = await engine.resolve('send message to claude')
    
    expect(result.capabilityId).toBe('cap:chat:send_message')
    expect(result.confidence).toBeGreaterThan(0.8)
  })
})
```

### Running Tests

```bash
# All tests
bun test

# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# E2E tests only
bun run test:e2e

# Architecture boundary tests
bun run test:arch

# Fast (unit + arch)
bun run test:fast

# Specific test file
bun test tests/unit/engines/capability-engine.test.ts
```

### Test Coverage

Aim for:

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: User journeys covered

---

## Documentation

### Documentation Protocol (CRITICAL)

**Docs-as-a-byproduct-of-work:** Every time code changes in a way that affects how the system works, the relevant doc gets touched in the *same commit/PR*. Not later. Not "I'll circle back."

**Rule:** If you touch code that changes behavior, architecture, an API contract, or a decision — you touch the matching doc in the same change. No exceptions, no "TODO: update docs."

### Types of Documentation

| Type | Location | Purpose | Update Trigger |
|------|----------|---------|----------------|
| Architecture | [docs/architecture/](docs/architecture/) | System design and engine catalog | New service/module added or component responsibility changes |
| Modules | [docs/modules/](docs/modules/) | Per-component documentation | Module's public interface changes or new module created |
| Runbooks | [docs/runbooks/](docs/runbooks/) | Operational guides | Deploy process changes or new failure mode discovered |
| Decisions | [docs/decisions/](docs/decisions/) | Architecture Decision Records (ADRs) | Any non-trivial decision between alternatives |
| API Docs | [docs/api/](docs/api/) | Auto-generated API reference | API changes (regenerated automatically) |
| Glossary | [docs/GLOSSARY.md](docs/GLOSSARY.md) | Domain terms and shorthand | New domain terminology introduced |
| Code Comments | Source code | Inline documentation | Complex logic implementation |

### Writing Documentation

- **Clear and Concise** — Write for your audience
- **Examples** — Include code examples
- **Up-to-Date** — Keep documentation current (update in same PR as code)
- **Accessible** — Use plain language
- **Keep it short** — Each doc file under ~300 lines. Split if growing past that.

### ADR Guidelines

- **Never edit old ADRs** — If a decision is reversed, write a new ADR that supersedes it and link both ways
- **Write at the moment of decision** — The "why" cannot be reconstructed later
- **Use the TEMPLATE** — Copy `docs/decisions/TEMPLATE.md` for new ADRs

### Documentation Checklist

When adding features:

- [ ] Update relevant docs in `docs/` **in the same PR as the code**
- [ ] If making a non-obvious decision, write a new ADR using TEMPLATE.md
- [ ] Add code comments for complex logic
- [ ] Update CHANGELOG for user/API-visible changes
- [ ] Add new domain terms to GLOSSARY.md
- [ ] Keep module docs under 300 lines; split if needed

---

## Architecture Overview

New to the codebase? Start with these docs:

1. **[Architecture Overview](docs/architecture/overview.md)** — The 30-second mental model
2. **[Engine Catalog](docs/architecture/backend.md)** — What each engine does
3. **[Data Layer](docs/architecture/data-model.md)** — Schema and Node model
4. **[API Reference](docs/architecture/api-philosophy.md)** — Routes and surfaces
5. **[Dev Runbook](docs/runbooks/dev.md)** — Local development setup

---

## Community

### Getting Help

- **[GitHub Discussions](https://github.com/owenservera/vivim-final/discussions)** — Ask questions, share ideas
- **[Issue Tracker](https://github.com/owenservera/vivim-final/issues)** — Report bugs, request features

### Contributing Areas

We welcome contributions in:

- **Bug Fixes** — Always appreciated!
- **New Features** — Check issues for ideas
- **Documentation** — Help improve docs
- **Tests** — Increase coverage
- **Performance** — Optimize code
- **Accessibility** — Make Vivim usable by everyone

### First-Time Contributors

Look for issues labeled:

- `good first issue` — Beginner-friendly
- `help wanted` — Community contributions welcome
- `documentation` — Documentation improvements

---

## Recognition

Contributors will be recognized in:

- **README** — Contributors section
- **CHANGELOG** — Release notes
- **GitHub** — Contributor badge

---

## Questions?

If you have questions about contributing:

1. **Check** this guide and [documentation](docs/)
2. **Search** existing issues and discussions
3. **Ask** in [GitHub Discussions](https://github.com/owenservera/vivim-final/discussions)

---

<div align="center">

**[Back to README](README.md)** • **[Code of Conduct](CODE_OF_CONDUCT.md)** • **[License](LICENSE)**

</div>
]]>
