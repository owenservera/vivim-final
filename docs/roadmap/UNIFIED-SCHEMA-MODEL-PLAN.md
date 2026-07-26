# Unified Internal Data Schema Model — Holistic Design (Design-Once)

> Status: PLAN (read-only). Replaces the narrow first draft. Goal: one canonical
> data model that every parser, engine, and renderer aligns to — covering **all**
> text types (styling, LaTeX, tables, task-lists, diagrams, widgets) and **all**
> data we receive in streaming messages.

---

## 0. The core architectural insight (why the first draft was too narrow)

There are **two independent concerns** that were conflated:

1. **The Message/Streaming envelope** — what travels over the wire and persists:
   a message has a role, an id, and an ordered list of *parts* (text, reasoning,
   tool-call, file, citation, custom, error, meta). This is the **AI SDK
   `UIMessagePart` model** — the de-facto industry standard. Our current
   `ContentBlock` is a ~subset of it.

2. **The Rich-Text / Document model** — what a `text` (and `code`) part
   *contains*: bold, italics, indent, headings, tables, task-lists, LaTeX,
   Mermaid, footnotes, widgets. This is the **mdast / GFM / ProseMirror** layer.
   It must be a **nested** model, not a flat list of part types. mdast (GFM) is
   the open standard AST for rich text; Zettel is an emerging "universal rich-text
   AST" built on the same node/mark principles; ProseMirror/Tiptap/Lexical are the
   editor-tree implementations.

"Design once" = we model **both layers**, with the rich-text AST nested *inside*
the message parts. We do **not** reinvent either — we adopt the established
standards (AI SDK part shapes + mdast/GFM rich-text), expressed as **Zod schemas**
in our repo with **zero new runtime dependencies** (we already depend on `zod`).

---

## 1. The two-layer model

```
Conversation
 └─ MessageEnvelope[]                 ← layer 1: streaming/persistence unit
      id, conversationId, role, model, createdAt, finishReason, metadata
      └─ ContentPart[]                ← layer 1: discriminated union of part TYPES
           ├─ text   → { text: RichText }      ← layer 2 nested INSIDE
           ├─ reasoning → { text: RichText }
           ├─ code   → { text, language }
           ├─ file   → { mediaType, url, filename? }
           ├─ tool-call / tool-result
           ├─ citation (source-url / source-document)
           ├─ custom (provider/data widget)
           ├─ error, meta, step-start
```

### Layer 1 — `ContentPart` (message parts) — adopt AI SDK `UIMessagePart` shapes

| Part `type` | Fields | Maps from old `kind` |
|---|---|---|
| `text` | `text: RichText`, `state?: 'streaming'\|'done'` | `text` |
| `reasoning` | `text: RichText`, `state?` | `thinking` |
| `code` | `text: string`, `language?: string` | `code` |
| `file` | `mediaType: string` (IANA, e.g. `image/png`), `url: string`, `filename?` | `image` |
| `tool-call` | `toolCallId`, `toolName`, `input: Record<string,unknown>`, `state: ToolState` | `tool_use` |
| `tool-result` | `toolCallId`, `output?`, `isError?` | — (new) |
| `citation` | `sourceId`, `url?`, `title?`, `mediaType?` | `citation` |
| `custom` | `kind: \`${ns}.${type}\``, `data: unknown` | `artifact` → `custom:cap-store.artifact` |
| `error` | `message`, `code?` | `error` |
| `meta` | `key`, `value` | `meta` |
| `step-start` | — | — (multi-step markers) |

Old `index` field → **implicit array position** in `parts` (AI SDK standard;
`HubStreamBlock.sequence` already does this).

### Layer 2 — `RichText` (the rich-content AST) — adopt **mdast / GFM** with Zettel-style stability

Two representation options, **both supported, validated by Zod**:

- **(A) Structured AST** — a `RichText` is either:
  - a plain `string` (fast path, no formatting), **or**
  - `{ ast: RichNode[] }` where `RichNode` is the mdast/GFM node set:
    - *Block nodes*: `paragraph`, `heading` (depth 1–6), `blockquote`,
      `list` (ordered/unordered/bullet), `listItem` (+ `checked?` for task
      lists), `code` (fenced, `lang`, `value`), `table` (`rows:
      TableRow[]`), `thematicBreak`, `html` (sanitized passthrough).
    - *Inline/phrasing nodes*: `text` (with `value`), `emphasis` (italic),
      `strong` (bold), `delete` (strikethrough), `inlineCode`, `link`
      (`url`, `title?`), `image` (inline), `break` (hard/soft line break),
      `math` (inline LaTeX `$..$`), `mathBlock` (block LaTeX `$$..$$`,
      optionally `display`), `mermaid` (diagram source — a `code` subclass
      tagged `lang:'mermaid'`), `footnoteReference`, `mention` (`@id`),
      `widget` (custom interactive node: `{ kind, props }`).
    - *Marks* (applied to inline runs, not separate nodes): `bold`, `italic`,
      `underline`, `strike`, `code`, `link`, `highlight`, `subscript`,
      `superscript`. (ProseMirror/Tiptap "marks" model — applied to text runs,
      composable.)
- **(B) Markdown source** — `text: string` holding **GFM markdown** (the wire
  format LLMs actually emit). We parse/serialize to (A) at the boundary with
  `mdast-util-from-markdown` + `mdast-util-gfm`. Rendering uses **Streamdown**
  (Vercel, GFM + KaTeX + Mermaid + Shiki) — the same stack assistant-ui uses.

**Decision: store `text` as GFM markdown string (B) at rest; expose the parsed
AST (A) via a `parseRichText()` helper for editors/diffing.** This matches what
LLMs emit, keeps storage compact, and lets the renderer handle LaTeX/Mermaid/
tables uniformly. The Zod schema validates the *markdown string* and the
optional structured form.

### Complete data-type checklist (everything we must receive — verified against research)

| Category | Type | Representation |
|---|---|---|
| Text styling | bold, italic, underline, strike, highlight, sub/sup | mdast marks / GFM `**` `*` `~~` |
| Structure | heading, paragraph, blockquote, hr, list, task-list | mdast block nodes + GFM task items |
| Indent / nesting | listItem nesting, blockquote nesting | tree structure (not whitespace) |
| Code | inline code, fenced code w/ lang | `inlineCode`, `code` |
| Tables | GFM tables (align, header, cells) | `table` node |
| Math | inline `$..$`, block `$$..$$`, `\begin{}` | `math` / `mathBlock` → KaTeX |
| Diagrams | Mermaid (flow/seq/class/state/ER/xy) | `code(lang:'mermaid')` → Mermaid render |
| Media | image, audio, video, file, generic file | `file` part + inline `image` |
| Citations | URL source, document source, footnote | `citation` part + `footnoteReference` |
| Tooling | tool call/result, approval | `tool-call`/`tool-result` parts |
| Thinking | reasoning/thinking blocks | `reasoning` part |
| Interactive | widgets, custom app data, live data | `custom` part + `widget` rich node |
| Meta/signalling | error, step markers, finish reason | `error`/`step-start` parts |
| Imported docs | ChatGPT/Claude/Gemini exports | **adapter** → `MessageEnvelope[]` |
| Harness capture | DOM-normalized blocks | **adapter** → `ContentPart[]` |
| Protocol frames | loop-mode frames | **adapter** → `ContentPart[]` |

---

## 2. Source of truth & file layout

Single canon in `src/schema/`:

- `src/schema/streaming.ts` — `ContentPart` union (Zod) + `MessageEnvelope` +
  `extractText(parts)`. (Promoted from current duplicate.)
- `src/schema/rich-text.ts` — `RichText` = Zod union of `string | { ast: RichNode[] }`;
  `RichNode` discriminators; `parseRichText(md): RichText`;
  `serializeRichText(rt): string`. GFM node set + marks. (New.)
- `src/schema/content.ts` — **barrel re-export** of both + `ContentPartSchema`
  (discriminated union) + `validateContentPart()` (safeParse boundary helper).

**Delete the duplicates:**
- `src/engines/stream-parser.ts` local `ContentBlock` → import from `schema/content.js`
- `src/storage/contracts/stream-block-store.ts` local `ContentBlock` → import
- `src/shared/stream-blocks.ts` → re-export from `schema/content.js` (shared boundary)
- `src/executor/content-blocks.ts` → delete; `index.ts:106` → export canon
- `dev-poc/.../stream-blocks.ts` → leave (throwaway POC)

**Adapters (not part of the union):**
- `src/engines/parsers/to-envelope.ts` — `ParsedConversation[]` → `MessageEnvelope[]`
- `src/engines/harness/content-pipeline-adapter.ts` — `NormalizedBlock` → `ContentPart`
- `src/engines/harness/harness-contract.ts` — `HubStreamBlock.blockKind` ↔ `ContentPart.type`

---

## 3. Boundary validation (Zod at the parser edge — AGENTS.md rule)

`StreamParserEngine.parse()` runs every emitted block through
`ContentPartSchema.safeParse`. On failure → emit an `error` part (never crash,
never silently swallow — preserves Governor-Canon / no-silent-failure invariants).
`parseRichText()` validates markdown at the point a structured AST is requested.

---

## 4. Persistence (migration-safe)

`StreamBlockStore` persists `MessageEnvelope`/parts:
- `blockData` = `JSON.stringify(parts)` (the parts array).
- `blockKind` derived via `blockKindOf(part)` for the filter column.
- **Reader tolerates legacy rows**: map old `kind`→`type`, drop `index`, wrap
  legacy `text`/`thinking`/`code` content into the new part shape. No forced
  migration; old rows keep rendering.

---

## 5. Cross-surface parity (AGENTS.md One-Entry-Point)

The `ContentPart`/`MessageEnvelope` model is the single contract shared by
CLI / UI / API / MCP. Frontend (`frontend`) renders via **Streamdown** (GFM +
KaTeX + Mermaid + Shiki) reading `ContentPart[]` from `shared/stream-blocks.js`
(re-exported from canon). This aligns with the assistant-ui rendering stack the
project already targets (`docs` reference `MarkdownTextPrimitive` + Mermaid).

---

## 6. Implementation steps

1. **`src/schema/rich-text.ts`** — Zod `RichText` + `RichNode` (GFM block/inline
   + marks + math/mermaid/widget), `parseRichText`, `serializeRichText`.
2. **`src/schema/streaming.ts`** — rewrite as `ContentPart` union (AI SDK shapes)
   + `MessageEnvelope` + `extractText` + `blockKindOf`. `text`/`reasoning` carry
   `RichText`.
3. **`src/schema/content.ts`** — barrel + `ContentPartSchema` + `validateContentPart`.
4. **Delete duplicates** (engine, storage contract, shared, executor) → import canon.
5. **Boundary validation** in `StreamParserEngine.parse` + `parseRichText`.
6. **Adapters**: import `to-envelope`, harness `NormalizedBlock`/`HubStreamBlock`.
7. **`StreamBlockStore`** update + legacy-row-tolerant reader.
8. **Consumers**: `streaming-protocol.ts`, `conversation-manager.ts`,
   `plugin-system.ts`, `parser-repair.ts`, seed parsers (`seeds/parsers/**`),
   frontend `useStreamBlocks.ts`.
9. **Tests**: `tests/unit/schema/{streaming,rich-text}.test.ts` (Zod round-trip,
   every variant, boundary rejection, GFM table/math/mermaid parse). Update
   `stream-block-store` / `conversation-manager` tests.
10. **Verify**: `bun run typecheck`, `bun test`, `bun run lint`, and grep proves
    exactly **one** `ContentPart`/`RichText` definition.

---

## 7. Open decisions to confirm before implementation

1. **Rich-text storage form**: GFM markdown string at rest (recommended, matches
   LLM output, compact) vs. always-structured AST. (Plan assumes markdown-at-rest.)
2. **Scope of `custom`/`widget`**: do we need a first-class interactive widget node
   in v1, or is `custom` part enough and widgets come later? (Plan includes a
   `widget` rich node but marks it optional.)
3. **Markdown parser dependency**: adopt `mdast-util-from-markdown` +
   `mdast-util-gfm` (tiny, unist ecosystem, MIT) for parse/serialize, or hand-roll
   a minimal GFM subset to keep deps at zero? (Plan recommends the unist libs;
   confirm if you want strictly zero new deps.)
4. **Renderer**: confirm **Streamdown** (Vercel, assistant-ui-aligned) as the
   frontend renderer for `text` parts.
