// src/schema/content.ts
// Barrel + boundary validation helper for ContentPart / MessageEnvelope / RichText.
// Single import point for any engine/frontend that needs the canonical model.

export type {
  ContentPart,
  ContentBlock,
  TextPart,
  ReasoningPart,
  CodePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  SourcePart,
  CustomPart,
  ErrorPart,
  MetaPart,
  StepStartPart,
  ToolCallState,
  LegacyBlock,
} from './streaming.js'

export type { MessageData } from './message.js'

export {
  ContentPartSchema,
  TextPartSchema,
  ReasoningPartSchema,
  CodePartSchema,
  FilePartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema,
  SourcePartSchema,
  CustomPartSchema,
  ErrorPartSchema,
  MetaPartSchema,
  StepStartPartSchema,
  extractText,
  blockKindOf,
  isStreaming,
  isLegacyBlock,
  migrateLegacyBlock,
  migrateLegacyParts,
} from './streaming.js'

export type {
  RichText,
  RichNode,
  FlowContent,
  PhrasingContent,
  ParagraphNode,
  HeadingNode,
  BlockquoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  ThematicBreakNode,
  HtmlNode,
  MathBlockNode,
  MermaidNode,
  TextNode,
  EmphNode,
  StrongNode,
  DeleteNode,
  InlineCodeNode,
  LinkNode,
  ImageNode,
  BreakNode,
  MathNode,
  WidgetNode,
  MentionNode,
  Mark,
} from './rich-text.js'

export {
  parseRichText,
  serializeRichText,
  extractTextFromAst,
  extractMermaid,
  extractMath,
} from './rich-text.js'

// ── Boundary validation ──────────────────────────────────────────────────
// Every parser output goes through this before reaching storage/UI.

import { type ContentPart, ContentPartSchema } from './streaming.js'

export interface ValidationResult {
  ok: boolean
  part: ContentPart | null
  error?: string
}

export function validateContentPart(raw: unknown): ValidationResult {
  const result = ContentPartSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, part: result.data as ContentPart }
  }
  return {
    ok: false,
    part: null,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}
