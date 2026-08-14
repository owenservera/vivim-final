// src/schema/content.ts
// Barrel + boundary validation helper for ContentPart / MessageEnvelope / RichText.
// Single import point for any engine/frontend that needs the canonical model.

export type { MessageData } from './message.js'
export type {
  BlockquoteNode,
  BreakNode,
  CodeNode,
  DeleteNode,
  EmphNode,
  FlowContent,
  HeadingNode,
  HtmlNode,
  ImageNode,
  InlineCodeNode,
  LinkNode,
  ListItemNode,
  ListNode,
  Mark,
  MathBlockNode,
  MathNode,
  MentionNode,
  MermaidNode,
  ParagraphNode,
  PhrasingContent,
  RichNode,
  RichText,
  StrongNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextNode,
  ThematicBreakNode,
  WidgetNode,
} from './rich-text.js'
export {
  extractMath,
  extractMermaid,
  extractTextFromAst,
  parseRichText,
  serializeRichText,
} from './rich-text.js'
export type {
  CodePart,
  ContentBlock,
  ContentPart,
  CustomPart,
  ErrorPart,
  FilePart,
  LegacyBlock,
  MetaPart,
  ReasoningPart,
  SourcePart,
  StepStartPart,
  TextPart,
  ToolCallPart,
  ToolCallState,
  ToolResultPart,
} from './streaming.js'
export {
  blockKindOf,
  CodePartSchema,
  ContentPartSchema,
  CustomPartSchema,
  ErrorPartSchema,
  extractText,
  FilePartSchema,
  isLegacyBlock,
  isStreaming,
  MetaPartSchema,
  migrateLegacyBlock,
  migrateLegacyParts,
  ReasoningPartSchema,
  SourcePartSchema,
  StepStartPartSchema,
  TextPartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema,
} from './streaming.js'

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
