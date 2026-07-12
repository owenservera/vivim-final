# VIVIM Canvas — Vision & Philosophy

> **Status:** FOUNDATIONAL — north-star document for the vivim-home canvas redesign
> **Created:** 2026-07-12
> **Owner:** Primary user (vision) · devops-roadmap (synthesis)
> **Scope:** The primary user UI. The shell everything else lives inside.

---

## 0. How to read this document

This is the **philosophy anchor** for the `vivim-canvas` roadmap. Every future
spec, atomic unit, and design decision in this folder must trace back to a
principle stated here. It is deliberately opinionated. When an implementation
choice conflicts with this document, this document is the tiebreaker — or it
gets amended on purpose, never by accident.

The **core of this document is the user's own words.** Section 1 is the raw
vision, verbatim. Everything after it is interpretation, grounding, and
SOTA-2026 synthesis in service of that vision — not a replacement for it.

---

## 1. The Vision (verbatim source prompts)

These are the originating prompts. They are the source of truth for intent.

### 1.1 The founding prompt

> I am redesigning the primary user UI.
>
> **Concept:** HTML — infinite canvas with infinite layers **[programmable]**.
> Think of a *system layer* where the user sees visually what they have open,
> core settings etc.; or a *traditional chat layer*; or an *automation layer*;
> etc. etc.
>
> The concept is: **the shell is pure HTML — re-programmable by design** —
> shipped with a robust set of core primitives (e.g. workspace, projects,
> personal knowledge store, etc.).
>
> And instead of these layers being loaded at all times — **the engine just
> swaps into the HTML shell on demand.**
>
> Take a look at the harvested `vivim.html` files. Also: the user would be able
> to **design the canvas from within the canvas**, create agents, visualize
> chat flows, etc.
>
> `/devops-research` once you have a good understanding of the vision to figure
> out SOTA 2026 hints and best practices.

### 1.2 Core requirements (verbatim)

> The `vivim-home` canvas has **global access and visibility — full oracle
> mode**. **Plugin system. Agentic-native. Configurable by core primitives**,
> etc.

### 1.3 The distilled intent

Reduced to its irreducible claims, the vision says:

1. The UI is an **infinite canvas**, not a page or an app screen.
2. The canvas holds **infinite layers**, and layers are **programmable**.
3. The shell is **pure HTML** — **re-programmable by design**, not compiled.
4. It ships with **robust core primitives** (workspace, projects, knowledge store…).
5. Layers are **swapped in on demand**, never all-loaded.
6. The user can **design the canvas from within the canvas**.
7. The home canvas is an **oracle**: global access, global visibility.
8. It is **plugin-based**, **agentic-native**, and **configurable by primitives**.

Every principle below exists to protect one of these eight claims.

---

## 2. Philosophy

### P1 — The frontend is *data*, not *code*

A layer is a `CanvasDefinition` — a row in the database made of HTML, CSS,
optional sandboxed JS, and a binding spec. It is **published**, not compiled.
Anything that can write a row can ship a UI: the user, an agent, or the system
itself. This is what makes the shell "re-programmable by design."

> Corollary: there is no build step between imagining a layer and running it.
> No webpack, no redeploy. Write the definition, spawn the instance.

### P2 — The shell is dumb; the layers are smart

The HTML shell is a thin, permanent host: an infinite canvas viewport, a layer
mounter, an event bus, and a capability bridge. It knows *nothing* about chat,
automation, or settings. Those are layers swapped in on demand. The shell must
stay small enough to never need rewriting; all richness lives in swappable
definitions.

### P3 — On-demand, never all-at-once

Layers are lazy by contract. A layer is fetched, mounted, and bound only when
requested; when dismissed it releases its DOM and its capability bindings. The
canvas can *describe* a thousand layers while *instantiating* three. Memory and
attention are finite; the layer registry is not.

### P4 — Oracle mode: global access, global visibility

The `vivim-home` canvas is privileged. It can see and reach everything —
every provider, every store, every engine's health, every open layer, every
project, the whole knowledge graph. It is the one surface that renders the
*whole system to itself*. Other layers are scoped; home is the oracle.

> Oracle ≠ chaos. Visibility is total; mutation still flows through capability
> contracts and the Governor Canon (P7). Home *sees* everything and *routes*
> everything, but it does not bypass the rules.

### P5 — Agentic-native

Every canvas operation (spawn, destroy, mutate, observe, fill, define, list) is
a **capability** — which means it is simultaneously a CLI command, a UI action,
a workflow node, an **MCP tool**, and an API endpoint. An agent drives the
canvas through the exact same surface the user does. There is no "human UI" and
"agent API"; there is one capability plane. Agents are first-class inhabitants
of the canvas, not bolt-ons.

### P6 — Configurable by primitives

The system ships with a robust, closed set of **core primitives** — workspace,
projects, personal knowledge store, conversations, agents, providers. Users and
agents *compose* these primitives into layers; they do not reinvent them.
Primitives are the vocabulary; layers are the sentences. New capability comes
from new *compositions*, not new *frameworks*.

### P7 — Governor Canon holds (inherited invariant)

The canvas never touches Chrome/CDP directly. All browser I/O flows through the
single ChromeGovernor authority. Layers observe and act through capabilities;
they never open their own side-channel to the outside world. Sovereignty and
single-authority I/O are non-negotiable, even for the oracle.

### P8 — Sandboxed by default

Layer JS runs sandboxed (iframe / CSP). No inline `<script>` in templates —
rejected at definition time *and* at render time. A user-published or
agent-published layer cannot exfiltrate, cannot escalate, cannot touch the
kernel. The shell is a hypervisor, not an open `eval`.

### P9 — Self-describing, self-modifying

Borrowed from the harvest lineage: the canvas carries a manifest of its own
structure so agents can understand and safely modify it. The system can export
and re-import its own state. The canvas is legible to the very agents that
extend it — designing the canvas from within the canvas (claim #6) is only
possible because the canvas describes itself.

---

## 3. The Canvas Model

### 3.1 Anatomy

```
┌───────────────────────────────────────────────────────────────┐
│  VIVIM-HOME  (oracle shell — pure HTML, permanent, dumb)        │
│                                                                 │
│   ∞ canvas viewport  (pan / zoom / infinite coordinate space)   │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │  LAYER      │   │  LAYER      │   │  LAYER      │  …swap    │
│   │  (system)   │   │  (chat)     │   │ (automation)│   on      │
│   │             │   │             │   │             │  demand   │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                 │
│   Layer Mounter · Event Bus · Capability Bridge · Manifest      │
└───────────────────────────────────────────────────────────────┘
        │                    │                      │
        ▼                    ▼                      ▼
   CanvasRegistry     UnifiedCapability        Core Primitives
   (definitions)         Registry            (workspace/projects/
                    (spawn/mutate/observe)     knowledge/agents)
```

### 3.2 Layer taxonomy (illustrative, not exhaustive)

| Layer | Purpose | Reads (oracle) | Writes (via capabilities) |
|-------|---------|----------------|---------------------------|
| **system** | Visual map of what's open; core settings; engine health | everything | config, layer lifecycle |
| **chat** | Traditional conversation surface | conversation store | send, select model, branch |
| **automation** | n8n-style visual workflow builder | workflow defs | create/run workflows, triggers |
| **agents** | Create, configure, chain, visualize agents | agent registry | agent CRUD, flow wiring |
| **projects** | Workspace + files + context | project store | project/file CRUD, context |
| **knowledge** | Personal knowledge store; graph view | knowledge graph | ingest, query, link |
| **designer** | Design layers *from within* the canvas | canvas registry | `canvas_define`, `canvas_mutate` |

Layers are **defined**, so this table is a *starting seed*, not a fixed menu.
The `designer` layer exists to grow the table at runtime.

### 3.3 Lifecycle of a layer

```
describe → register → (on demand) spawn → mount → bind → live
                                                          │
                                       dismiss ◄──────────┘
                                          │
                                   release DOM + bindings
```

- **describe / register** — a `CanvasDefinition` lands in the registry (P1).
- **spawn** — an instance is requested (by user, agent, or system).
- **mount** — HTML/CSS injected into a canvas node; JS booted sandboxed (P8).
- **bind** — the binding spec wires capability I/O ⇄ DOM (P5).
- **live** — the layer mirrors state bidirectionally.
- **dismiss** — DOM and bindings released; definition persists (P3).

### 3.4 "Design from within the canvas"

The `designer` layer is the reflexive core of the vision. Inside it, a user (or
agent) can:

- lay out a new layer visually,
- pick which primitives/capabilities it binds to,
- preview it live on the canvas,
- publish it as a `CanvasDefinition` (`canvas_define`),
- and immediately spawn it.

Because publishing is just writing a row (P1) and every canvas op is a
capability (P5), the human designer and an agent designer use the identical
path. The canvas builds the canvas.

---

## 4. Core Requirements → Mechanisms

Mapping the verbatim requirements (§1.2) to concrete mechanisms.

| Requirement | Mechanism | Principle |
|-------------|-----------|-----------|
| Global access & visibility | Oracle scope for `vivim-home`; reads across all stores/engines | P4 |
| Full oracle mode | System layer renders whole-system topology + health | P4, P9 |
| Plugin system | `CanvasDefinition` registry + sandboxed layer runtime | P1, P8 |
| Agentic-native | Canvas ops as `UnifiedCapability` → MCP/CLI/UI/API/workflow | P5 |
| Configurable by core primitives | Closed primitive set; layers compose them | P6 |
| Re-programmable shell | Frontend-as-data; no build step | P1, P2 |
| On-demand layers | Lazy spawn/mount/bind; release on dismiss | P3 |

---

## 5. SOTA 2026 Hints & Best Practices

Synthesized from the `/devops-research` pass over the merged-design-v2 SOTA
suite and the harvest lineage. These are the "how to build it well in 2026"
notes.

### 5.1 Zero-build, data-driven UI
Frontends-as-data is now mainstream SOTA: ship a thin runtime, express screens
as declarative specs, hot-swap without redeploy. This directly validates P1/P2.
Keep the shell framework-agnostic; the layer runtime should not care whether a
definition's JS is vanilla, a web component, or a micro-framework bundle.

### 5.2 Bidirectional live mirror (from SOTA-01)
Adopt the MirrorEngine pattern for layer ⇄ state sync: optimistic updates,
per-stage latency budgets, and a non-blocking observation tap. A layer should
feel instant (optimistic) while the real state catches up. Target: user never
waits to know their action registered.

### 5.3 Sandboxed capability bridge, not raw DOM access
2026 best practice for plugin UIs is a **postMessage capability bridge** into a
sandboxed iframe, never shared globals. The layer asks the bridge to execute a
capability; it never reaches into the host. This is P8 made concrete and is how
untrusted (agent-authored) layers stay safe.

### 5.4 Accessibility-tree grounding for agent-driven layers (from SOTA-05)
When an agent designs or drives a layer, ground its actions in the
accessibility tree + a semantic binding spec, not brittle CSS coordinates.
Self-healing selectors keep agent-built layers alive as definitions evolve.

### 5.5 Living manifest + memory substrate (from SOTA-06, harvest lineage)
Keep a machine-readable manifest of the canvas's own regions (harvest `@region`
pattern) so agents can navigate and mutate safely. Feed every spawn/mutate into
the memory substrate so the system *learns* which layer compositions work and
can propose them (transfer acceleration).

### 5.6 Progressive rendering & streaming (from SOTA-07)
Layers that display model output should render progressively (block streaming),
not wait for completion. The canvas is real-time by default.

### 5.7 Infinite-canvas UX ergonomics
- Spatial memory: layers keep position; the map *is* the navigation.
- Semantic zoom: zoomed-out = system map; zoomed-in = live layer.
- Minimap + command palette for teleport-navigation across infinite space.
- Never trap focus: dismissing a layer returns the user to where they were.

### 5.8 Local-first & sovereign (inherited from Phase 20)
Canvas state is local-first, exportable, air-gap-capable. The oracle sees all,
but the data stays the user's. E2E-encrypted sync is opt-in, never default.

---

## 6. Harvest Lineage

The vision did not appear from nothing. The `docs/harvest/vivim-canvas/` corpus
(34 HTML iterations, 2025-10 → 2026-02) is the ancestral R&D. Patterns proven
there that this roadmap *inherits*:

| Harvest pattern | File(s) | Carried forward as |
|-----------------|---------|--------------------|
| Self-describing `VIVIM_MANIFEST` / `@region` tags | `unified-v1`, `unified-v6` | P9 living manifest |
| IndexedDB kernel + hydration from own source | `unified-v1` | Frontend-as-data seed (P1) |
| Theme engine via CSS variables (stealth palette) | `unified-v1` | Shell theming primitive |
| Plugin mount points | `630KB-plugins`, `655KB-L0-plugins` | Layer mounter (P2/P3) |
| P2P / BroadcastChannel comms | `p2p-vivim`, `COMMS-4MB` | Cross-tab / peer layer sync |
| Local memory store | `localmem`, `localmem-plugins` | Local-first substrate (5.8) |
| Multi-agent / multi-API canvas | `222KB-ref-vivim`, `mono-vivim` | Agentic-native plane (P5) |
| Space-optimized single-file shell | `space-optimized*` | Thin permanent shell (P2) |

> The harvest proves the *feel*. This roadmap gives it a *spine*: capability
> contracts, a real registry, sandboxing, and the oracle.

---

## 7. Relationship to existing work

This vision is **not** greenfield. It aligns to and elevates the existing
`docs/atomic-v3/phase-03-html-canvas/` units (3.1–3.13), which already spec:

- `3.1` CanvasDefinition + CanvasRegistry (P1 foundation)
- `3.2` templates · `3.3` spawner · `3.4` binder (mount/bind lifecycle)
- `3.5`/`3.6` mirror (agent + user) — the live bridge (5.2)
- `3.7`/`3.8` discovery read/write (observation + form drive)
- `3.9` runtime · `3.10` router · `3.11` WS · `3.12` security (P8)
- `3.13` agent tools — canvas ops as capabilities (P5)

**What this roadmap adds on top:** the **oracle home canvas**, the **infinite
layer model**, **on-demand layer swapping as a first-class engine**, the
**designer layer** (design-from-within), and the **plugin/primitive
composition model**. Phase-03 gives us the canvas *primitive*; vivim-canvas
gives us the *home*.

> DRIFT note: if any decision here contradicts phase-03 specs, it must be logged
> and reconciled via the merge gate — never silently diverged.

---

## 8. Non-negotiables (the short list)

1. Shell is pure HTML, permanent, and dumb. (P2)
2. Layers are data, sandboxed, and swapped on demand. (P1, P3, P8)
3. Home is the oracle: sees all, routes all, bypasses nothing. (P4, P7)
4. Every canvas op is a capability — one plane for humans and agents. (P5)
5. Compose primitives; don't reinvent frameworks. (P6)
6. The canvas can build the canvas. (§3.4)

---

## 9. Open questions (for the next roadmap pass)

These are deliberately unanswered here; they belong in dedicated specs.

1. **Layer coordinate model** — absolute infinite plane, or nested frames?
2. **Oracle read contract** — a dedicated read-only aggregation store, or
   fan-out reads across existing stores?
3. **Layer state persistence** — where does a dismissed layer's transient
   state go, and for how long?
4. **Primitive boundary** — what is the *exact* closed set of core primitives,
   and what is the amendment process to add one?
5. **Designer layer authoring UX** — visual drag-drop, DSL, or both?
6. **Cross-layer composition** — can a layer embed another layer, and how do
   bindings compose without leaking scope?
7. **Multiplayer/oracle in a team** — how does oracle mode behave when the
   knowledge store and projects are shared?

---

## 10. Next steps

1. Review & ratify this document (user is the tiebreaker).
2. Run `bun run devops roadmap --discover` scoped to canvas to surface gaps.
3. Draft the **oracle read contract** spec (Q2) — it gates the system layer.
4. Draft the **infinite layer engine** spec (on-demand swap) as the first new
   atomic unit above phase-03.
5. Interview → atomic specs for the designer layer and the primitive set.

---

*This is a living document. Amend it on purpose, cite it always.*
