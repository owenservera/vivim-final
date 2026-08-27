# Living Product Knowledge System — Research Archive

> Source: User-provided 2026-era architecture research (saved for value assessment against LIVIN-LIB v3).
> Status: ARCHIVED — assess value-add before implementing.

---

## 0. Concept: Living Product Subsystem (Not Conventional Docs)

> **Documentation is becoming a living product subsystem: generated from the system, continuously reconciled against reality, searchable by humans and agents, and capable of driving onboarding/contextual assistance inside the product.**

For Vivim: a **Living Product Knowledge System** embedded in the application, not a conventional `/docs` site.

---

## 1. Projects to Study

### OpenWiki (LangChain) — Self-Maintaining Wiki for Agents
- Source: Agent-written; agent-explored; self-maintaining; codebase + personal knowledge modes; visual knowledge graph; CI updates; explicit knowledge format.
- Key steal: **"Don't think documentation pages. Think knowledge graph with human-readable projections."**
- Vivim mapping: user asks "How does Vivim connect to Claude?" → gets path through manifest/profile/governor/capability/resolution/conversation/parser (not static article).

### Agent Wiki (Onyx) — Controlled Autonomous Updates
- Source: Markdown canonical; filesystem hierarchy; Git history; MCP agent updates; API ingestion; automatic reconciliation; page/folder-specific update policies; event triggers.
- Key steal: **Update policies** (e.g., `auto_update: allowed` + `update_instruction: "Keep conceptual. Never modify compatibility table automatically."`). Policies inherit down hierarchy.
- Vivim guardrail: prevents docs from becoming fiction.

### GitHub Agentic Workflows — Safe Maintenance Pattern
- Source: Code change → agent detects drift → proposes documentation PR → reviewable → merge. Not silent rewrite.
- Key principle: **"Automate detection and proposal aggressively; automate publication conservatively."**
- Vivim: distinguish machine-derived facts (`code_exists`, `ui_exists`) from human-authored guidance.

### Mintlify — Documentation UX + AI/MCP + Analytics
- Source: Documentation-as-code; structured navigation; generated API docs; AI-agent interfaces; MCP access; automated doc tasks; analytics; search/chat; custom frontends; private/unpublished pages.
- Updates: Feb 2026 — documentation automations (scheduled/event-driven); Aug 2026 — user-journey analytics (routes, searches, chat behavior).
- Key steal: **Documentation → product-usage feedback loop** (intent → search → article → feature → action → success/failure).

---

## 2. Onboarding & Tour References

### Usertour — Self-Hosted Product Tours
- Source: Product tours, checklists, launchers, surveys; self-hosted; TypeScript/React.
- Relevance: open-source onboarding primitives.

### Tour Kit — Headless React Onboarding
- Source: Tours, persistent hints, onboarding checklists, announcements, microsurveys, feature adoption, analytics, AI Q&A; TypeScript/React.
- Key steal: Component architecture matches Vivim's need for capability-linked tours.

---

## 3. Customer Journey Reference — Frigade
- Source: Full journey model (`Registration → Activation → Adoption → Engagement → Retention`) with checklists, tours, tooltips, banners, surveys, lifecycle re-onboarding.
- Demo journey: Welcome → Onboarding form → Getting-started checklist → Product tour → Contextual banner → Survey → Product updates.
- Key steal: Onboarding is not separate from docs; both project from same knowledge substrate.

---

## 4. Catalog/Relationship Reference — Backstage
- Source: Catalog + metadata + relationships; centralized catalog; extensible plugin architecture.
- Key concept: Technical documentation is easy to create, maintain, find, and use through structured relationships.

---

## 5. What NOT to Do (Anti-Patterns)

Avoid:
- Embedding Mintlify wholesale
- Building separate docs website first (before embedded knowledge)
- Making everything vector embeddings (canonical = structured entities + relationships)
- Letting LLM freely rewrite docs
- Making Markdown only source of truth
- Creating onboarding independently from documentation
- Creating support independently from capabilities
- Hard-coding dozens of tours to fragile DOM selectors
- Requiring cloud docs service
- Making customer data leave local machine

---

## 6. Vivim-Specific Architecture Proposal

### System: Vivim Knowledge (Not "Documentation")

Concept: Knowledge is a first-class Vivim capability. Same knowledge substrate powers:
- Help / Docs / Search / AI Assistant / Onboarding / Product Tours / Troubleshooting / Release Notes / Contextual UI / Agent Context

Architecture:
```
                     VIVIM
                       │
         ┌─────────────┴─────────────┐
         │                           │
   PRODUCT RUNTIME            KNOWLEDGE RUNTIME
         │                           │
    Capabilities              Knowledge Graph
    Providers                 Documentation
    UI                        Workflows
    Events                    Tutorials
    State                     Troubleshooting
         │                           │
         └─────────────┬─────────────┘
                       │
                 CONTEXT ENGINE
                       │
         ┌─────────────┼─────────────┐
         │             │             │
       HELP        ONBOARDING      SEARCH
         │             │             │
       AI Q&A        Tours       Semantic + lexical + graph
       Tooltips      Checklists
       Guides        Hints
         │             │             │
         └─────────────┼─────────────┘
                       │
                 USER EVENTS
                       │
                       ▼
             KNOWLEDGE FEEDBACK
                       │
                       ▼
               DRIFT DETECTION
                       │
                       ▼
              DOC AGENT PROPOSAL
                       │
             ┌─────────┴─────────┐
             │                   │
           AUTO              REVIEW
             │                   │
             └─────────┬─────────┘
                       ▼
                 NEW KNOWLEDGE
```

### Canonical Knowledge Model

Entity types: `Concept`, `Feature`, `Capability`, `Provider`, `Workflow`, `Screen`, `UIElement`, `Setting`, `Integration`, `Tutorial`, `Troubleshooting`, `FAQ`, `Release`, `Limitation`, `Policy`, `GlossaryTerm`.

Relationships (example — Feature):
- `implemented_by` → Capability
- `available_on` → Screen
- `requires` → Provider
- `documented_by` → Guide
- `demonstrated_by` → Tutorial
- `related_to` → Feature
- `replaces` → Feature
- `introduced_in` → Release

### Four Documentation Layers (Separate Deliberately)

1. **Discover** (`What is this?`) — very short
2. **Understand** (`How does it work?`) — architecture/concepts
3. **Accomplish** (`How do I do X?`) — interactive workflows
4. **Recover** (`Something isn't working.`) — diagnostics/troubleshooting

### Contextual Documentation (Killer Feature)

When user is at `Claude → Provider Configuration`, the app knows:
```
current_route, current_component, current_provider, current_capability,
recent_actions, user_experience_level, onboarding_state
```

Help answers with context-specific documentation (not generic docs site). Example: shows "Why am I seeing this?" with explanation about Chrome profile authentication + `[Learn more]` + `[Show me]` guided walkthrough through the UI.

### Instruction Model (Not Just Text)

Doc item optionally contains:
```ts
type Instruction = {
  target: string
  action: "click" | "open" | "type" | "select" | "observe"
  explanation: string
}
```
"How do I connect Claude?" → `[Show me]` → guided walkthrough (`Open Providers → Select Claude → Create Chrome profile → Authenticate → Verify → Send test message`).
Combines OpenWiki knowledge + Frigade onboarding + Vivim capability system.

### AI Retrieval Hierarchy (Constrained, Not Giant Vector DB)

```
1. Current UI context
2. Current user workflow
3. Structured Knowledge Graph
4. Verified documentation
5. Product events
6. Code-derived facts
7. General model knowledge
```
Responses expose provenance (`Based on Vivim 0.x / Claude provider configuration` + `Show source`).

### Self-Improving Feedback Loop

```
User events → Search/guide use → Abandonment detection (e.g., 12/18 abandon at Chrome auth) →
Drift/event analysis → Documentation agent analyzes → Proposes improvement → Human/product approval →
New documentation → Measure outcome
```
Documentation becomes an optimization loop (Mintlify journey analytics confirmation).

### Knowledge Storage (Local-First, Not Embeddings Canonical)

Canonical = structured entities + relationships (`knowledge_entities`, `knowledge_relationships`, etc.). Embeddings optional later. SQLite/Prisma sufficient primary store. No cloud docs service required. Customer data stays local.

### Agent Architecture (Specialized, Not One Giant AI)

- `Knowledge Orchestrator`
- `Code Archaeologist` (discovers system changes)
- `Knowledge Extractor` (converts changes → facts)
- `Documentation Writer` (creates/updates prose)
- `Drift Detector` (finds contradictions)
- `UX Documentation Agent` (maps knowledge → user journeys)
- `Onboarding Designer` (tours/checklists)
- `Troubleshooting Agent` (recovery paths)
- `Verification Agent` (tests claims against reality)

### Verification System (Critical)

Every item has provenance (`id`, `type`, `source`: file paths, `verified_at`, `verification`: `code_exists`/`ui_exists`/`workflow_test`). System knows difference between `Fact` (`Vivim supports cap:chat:send_message`) and `Guidance` (`Most users should start with default provider`). Prevents docs from becoming fiction.

---

## 7. References Studied

| Project | Contribution to This Design |
|---|---|
| **OpenWiki** (LangChain) | Self-maintaining knowledge graph; agent-written/agent-explored wiki; visual graph; CI updates |
| **Agent Wiki** (Onyx) | Controlled autonomous updates; Markdown canonical; Git history; update policies; event triggers |
| **GitHub Agentic Workflows** | Safe automated maintenance: detect → propose PR → review; never silent rewrite |
| **Mintlify** | Documentation architecture (navigation, generated APIs, AI/MCP interfaces, analytics); journey analytics |
| **Tour Kit** | Headless React onboarding primitives (tours, hints, checklists, announcements, microsurveys, AI Q&A) |
| **Usertour** | Self-hosted in-app onboarding platform (tours, checklists, surveys) |
| **Frigade** | Full customer journey (`Registration → Activation → Adoption → Engagement → Retention`); lifecycle onboarding; state tracking |
| **Backstage** | Catalog/metadata/relationship architecture; centralized catalog; extensible plugins |

---

## 8. Key Decisions (Architecture Choice for Vivim)

**Approach**: Don't install any single project wholesale. Combine best ideas from OpenWiki + Agent Wiki + GitHub Agentic Workflows (knowledge-maintenance core) + Tour Kit / Frigade (customer-experience layer). Build around Vivim's existing capability/event model.

**Storage**: SQLite/Prisma sufficient; structured entities canonical; embeddings optional later.
**Deployment**: Local-first; no external docs service; no data leaving machine.
**Maintenance**: Auto-discovery + auto-proposal + review gate (not silent rewrite).
**UI**: Context-aware embedded docs (not separate site); guided walkthrough capability (`[Show me]`); four-layer separation (Discover/Understand/Accomplish/Recover).
**AI**: Specialized agent architecture; constrained retrieval hierarchy (not giant vector DB); provenance exposed.

---

## 9. Related Work in Repo

- `docs/librarian-v3/DESIGN.md` — LIVIN-LIB v3 automated pipeline design
- `docs/librarian-v3/AUTO-LIB.md` — Operator manual (`docs:discover` / `docs:generate` / `docs:verify` / `docs:publish` / `docs:live` / `docs:all`)
- `docs/librarian-v3/scripts/auto-discover.ts` — Starter AST discovery script (89 lines; writes `.runtime/docs-inventory.json`)
- `docs/librarian/` — Original v2 librarian framework (9 `.md` files

---

*Note: This document was saved per user instruction: "Yes. I researched this specifically as a 2026-era architecture problem... save the following as docs so we can assess value add." The assessment of value add against LIVIN-LIB v3 follows separately.*
