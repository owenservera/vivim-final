# Conceptual Reference: Provider-Type UI Primitive Matrix

**Purpose:** Expose the full permutation space of UI primitives across the four
first-version surface families, so the database schema (and the renderer that
consumes it) can be designed to support:

1. **Provider-type globals** — primitives shared by *every* member of a family
   (e.g. every AI-chat webapp has a prompt box + message bubble).
2. **Provider-type uniques** — primitives only one member needs
   (e.g. claude.ai's "artifacts" pane, gmail's "labels", instagram's "stories").
3. **Variants** — the *same logical primitive* expressed differently per provider
   (e.g. composer = textarea on chatgpt, contenteditable on gemini,
   rich-editor on gmail, inline-reply box on whatsapp).
4. **Cross-type shared primitives** — one primitive used by members of *different*
   families (e.g. the same "message bubble card" concept appears in AI-chat,
   Messengers, and Social feeds; the same "attach-doc" concept appears in
   AI-chat, Email, and Messengers).

This document is the **source of truth for the schema design** in
`09-conceptual-model-plan.md`. It is derived from the real product surfaces of
these categories, not from any in-repo provider seed.

> **As-built status:** Implemented. The schema (§4) is realized as `ProviderType`,
> `Primitive`, and `UiComponent` tables (single `(scope, ownerId, primitiveId,
> variant)` key) in `prisma/schema.prisma`. The 4-tier precedence (§3) is encoded in
> `src/storage/impl/ui-component-store-impl.ts` (`resolve()`) and resolved by
> `src/engines/conceptual-model-service.ts`. Endpoints in §1 of
> `08-backend-integration.md` (6–9) serve it. The `ai-chat` family is seeded;
> cross-type + per-family primitives and `UiComponent` rows are populated at server
> boot via `seeds/conceptual-model/seed.ts`.

---

## 1. The Four First-Version Families

| Family | Slug | Members (examples) | Core mental model |
|--------|------|-------------------|-------------------|
| AI Chat Webapp | `ai-chat` | chatgpt.com, claude.ai, gemini.google.com, grok, copilot | composer + transcript thread + bubbles |
| Email | `email` | gmail.com, outlook.com, protonmail, fastmail | folder list + message list + reader + compose |
| Messengers | `messenger` | whatsapp, telegram, signal, imessage, discord | conversation list + chat + bubbles |
| Social | `social` | facebook feed, linkedin, instagram, twitter/x, reddit | feed + post cards + composer + reactions |

Each family is a **provider type**. A provider (e.g. `chatgpt`) *instantiates* a
family (`ai-chat`).

---

## 2. Primitive Taxonomy (3 levels of sharing)

### Level A — Cross-Type Shared Globals (used by MANY families)
These primitives are conceptually identical across families and should be defined
**once** and *reused* (the "shared across provider types" requirement):

| Primitive | Appears in | Notes |
|-----------|-----------|-------|
| `message-bubble` | ai-chat, messenger, social | A card representing one message from one sender. Differs in chrome (avatar/name/timestamp), not in essence. |
| `attach-doc` | ai-chat, email, messenger, social | Attach file / image / doc before sending. |
| `composer` | ai-chat, email, messenger, social | The text-entry surface that produces a message/post. Varies in richness. |
| `send-action` | ai-chat, email, messenger, social | Commit the composed content. |
| `thread` / `conversation-list` | ai-chat, messenger, email, social | The scroll region of past messages. |
| `sender-identity` | all | Who is "me" (account switcher / avatar). |
| `search` | all | Find within the surface. |
| `notification` | all | Toast / badge surface. |
| `settings` | all | Gear / preferences entry. |
| `error-surface` | all | Error / empty / blocked state. |

### Level B — Family Globals (shared by all providers of ONE family)
Defined once **per family**, reused across its providers:

**ai-chat globals:** `prompt-box` (composer variant), `response-bubble`
(assistant), `user-bubble`, `model-switcher`, `new-chat`, `chat-history-sidebar`,
`streaming-indicator`, `regenerate`, `copy-message`, `branch`.

**email globals:** `folder-list` (inbox/sent/drafts), `message-list`,
`message-reader`, `compose-window`, `to-cc-bcc`, `send`, `archive`, `label`,
`signature`, `draft-autosave`.

**messenger globals:** `conversation-list`, `chat-header` (contact name/status),
`message-bubble`, `typing-indicator`, `emoji-picker`, `voice-note`,
`read-receipt`, `status/presence`.

**social globals:** `feed` (infinite scroll), `post-card`, `composer`
(top-of-feed or modal), `like/react`, `comment`, `share`, `follow-button`,
`stories-tray`, `profile-header`.

### Level C — Provider Uniques & Variants
Defined **per provider**, override the family global when present:

| Provider | Unique / variant primitive | Kind |
|----------|---------------------------|------|
| chatgpt | `canvas-whiteboard` (canvas mode), `memory-row` | unique |
| claude.ai | `artifacts-pane`, `projects-sidebar` | unique |
| gemini | `extensions-toggle`, `double-panel` | variant of layout |
| gmail | `labels`, `snooze`, `priority-inbox`, `confidential-mode` | unique |
| outlook | `focused-inbox`, `categories`, `rules` | unique |
| whatsapp | `status-updates`, `broadcast`, `disappearing-messages` | unique |
| telegram | `channels`, `bots`, `secret-chats`, `stickers` | unique |
| discord | `servers-rail`, `guilds`, `threads` | unique |
| facebook | `stories`, `friend-requests`, `groups` | unique |
| instagram | `reels`, `stories-fullscreen`, `reels-editor` | unique |
| linkedin | `connections`, `jobs`, `endorsements` | unique |
| twitter/x | `timeline-algorithmic`, `communities`, `bookmarks` | variant |

**Variant examples (same primitive, different expression):**
- `composer`: textarea (chatgpt) / contenteditable (gemini) / rich HTML editor
  (gmail) / inline reply box (whatsapp) / character-limited box (twitter).
- `message-bubble`: left/right aligned (messenger) / sequential prose (ai-chat) /
  card with reactions (social) / quoted-reply nested (telegram).
- `attach-doc`: paperclip (email) / `+` menu (whatsapp) / drag-image (chatgpt) /
  gif/sticker tray (social).

---

## 3. The Resolution Precedence (must be encoded in schema)

For any rendered slot on a provider's surface, the active UI component resolves
in this order (highest → lowest):

```
provider-unique   (providerId + slot)         e.g. claude.artifacts-pane
  > family-variant (familyId + slot + variant) e.g. ai-chat.gemini.composer
  > family-global (familyId + slot)            e.g. ai-chat.composer
  > cross-type    (crossTypeId + slot)         e.g. shared.message-bubble
  > system-default (slot)                       e.g. built-in message-bubble
```

The schema must make each tier addressable as a row so the renderer can walk the
chain and pick the highest match.

---

## 4. Required Schema Capabilities (derived from the matrix)

To support the above without a migration every time a new provider/variant
appears, the schema needs:

1. **`ProviderType` (family) table** — `ai-chat`, `email`, `messenger`, `social`.
   Owns the family-global slot catalog + default region layout.

2. **`Provider` → `ProviderType` link** — every provider belongs to one family
   (chatgpt → ai-chat). Many-to-one.

3. **`Primitive` (slot) registry** — the *vocabulary* of all primitives
   (cross-type + family + unique), each with a `scope`:
   `cross-type | family | provider`. A primitive is declared once; instances
   reference it. This is the **closed vocabulary** that keeps the system modular.

4. **`UiComponent` (the code node)** — stores `html/css/js/sandbox` for ONE
   (primitive, owner) pairing. The `owner` is the *scope context*:
   - `scope='cross-type'` + `primitiveId` → shared component (one row, many users)
   - `scope='family'` + `familyId` + `primitiveId` → family global
   - `scope='family'` + `familyId` + `primitiveId` + `variant` → family variant
   - `scope='provider'` + `providerId` + `primitiveId` → provider unique
   This single table with a `(scope, ownerId, primitiveId, variant)` shape
   expresses **all four tiers** of §3. No new table per tier.

5. **`ProviderPrimitiveOverride`** — optional per-provider *selection* of a
   variant or a remap (provider X wants primitive Y to actually render primitive
   Z's component). Keeps overrides declarative.

6. **`RegionLayout`** — per (owner, primitive) default position/size on the
   infinite canvas. Family owns the canonical layout; provider can override a
   region without touching the component.

7. **`InteractionGrammar`** — per family (and overridable per provider):
   composer-send-gesture (enter vs button), infinite-scroll vs paginate,
   reaction model, etc. Stored as JSON; the renderer reads it to decide behavior.

---

## 5. Evolution Rules (graceful growth)

- **New provider in existing family:** just add a `Provider` row + any
  `UiComponent` rows for its uniques/variants. Zero schema change.
- **New family:** add a `ProviderType` row + its family-global `UiComponent`s.
  Zero schema change (tables are generic).
- **New cross-type primitive:** add a `Primitive` (scope=cross-type) + one
  `UiComponent`. Any family can now reference it.
- **New variant of an existing primitive:** add a `UiComponent` with
  `scope='family', variant='gemini'`. Resolution picks it automatically.
- **Deprecate:** flip `UiComponent.status='deprecated'`; renderer falls back to
  the next tier. No deletion required.

This is the modularity contract the schema must satisfy.

---

## 6. Mapping to Existing Repo Concepts (for compatibility)

- The existing `SLOT_IDS` (`chat.entry`, `chat.thread`, …) become **family-global
  primitives** of the `ai-chat` family. New families add their own primitive ids.
- The existing `UIComponentRegistry.resolve(capabilitySlug > providerSlug >
  default)` maps onto the §3 precedence: capability→provider-unique,
  provider→family-variant/global, default→cross-type/system.
- `CanvasDefinition` (existing) remains the *canvas layer* concept; `UiComponent`
  is the *primitive code node* — deliberately separate so a layer can compose
  many primitives.
