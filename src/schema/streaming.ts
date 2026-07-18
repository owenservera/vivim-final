// src/schema/streaming.ts
// ContentPart union — the layer-1 message parts model.
// AI SDK UIMessagePart shapes. Rich text nesting handled by RichText type.
// This is the data payload type for 'cap-store.message' nodes.

import { z } from 'zod'
import type { RichText } from './rich-text.js'

// ── ToolCallState ──────────────────────────────────────────────────────────

export const ToolCallStateSchema = z.enum([
  'pending',
  'input-streaming',
  'input-available',
  'output-available',
  'output-error',
  'approval-requested',
  'approval-responded',
  'output-denied',
])
export type ToolCallState = z.infer<typeof ToolCallStateSchema>

// ── ContentPart — discriminated union of message parts ─────────────────────

export interface TextPart { type: 'text'; text: RichText; state?: 'streaming' | 'done'; lang?: string }
export interface ReasoningPart { type: 'reasoning'; text: RichText; state?: 'streaming' | 'done'; signature?: string }
export interface CodePart { type: 'code'; text: string; language?: string }
export interface FilePart { type: 'file'; mediaType: string; url: string; filename?: string; data?: string }
export interface ToolCallPart { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown>; state?: ToolCallState; approvalId?: string }
export interface ToolResultPart { type: 'tool-result'; toolCallId: string; output?: unknown; isError?: boolean }
export interface SourcePart { type: 'source'; sourceId: string; url?: string; title?: string; mediaType?: string }
export interface CustomPart { type: 'custom'; kind: string; data: unknown; state?: 'streaming' | 'done' }
export interface ErrorPart { type: 'error'; message: string; code?: string }
export interface MetaPart { type: 'meta'; key: string; value: unknown }
export interface StepStartPart { type: 'step-start' }

export type ContentPart =
  | TextPart
  | ReasoningPart
  | CodePart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | SourcePart
  | CustomPart
  | ErrorPart
  | MetaPart
  | StepStartPart

// Backward-compat alias — old code referenced ContentBlock.
export type ContentBlock = ContentPart

// ── Zod schemas ────────────────────────────────────────────────────────────

const richTextSchema: z.ZodType<RichText> = z.union([
  z.string(),
  z.object({ ast: z.array(z.any()) }),
])

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: richTextSchema,
  state: z.enum(['streaming', 'done']).optional(),
  lang: z.string().optional(),
})

export const ReasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: richTextSchema,
  state: z.enum(['streaming', 'done']).optional(),
  signature: z.string().optional(),
})

export const CodePartSchema = z.object({
  type: z.literal('code'),
  text: z.string(),
  language: z.string().optional(),
})

export const FilePartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.string(),
  url: z.string(),
  filename: z.string().optional(),
  data: z.string().optional(),
})

export const ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.record(z.unknown()),
  state: ToolCallStateSchema.optional(),
  approvalId: z.string().optional(),
})

export const ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  output: z.unknown().optional(),
  isError: z.boolean().optional(),
})

export const SourcePartSchema = z.object({
  type: z.literal('source'),
  sourceId: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  mediaType: z.string().optional(),
})

export const CustomPartSchema = z.object({
  type: z.literal('custom'),
  kind: z.string(),
  data: z.unknown(),
  state: z.enum(['streaming', 'done']).optional(),
})

export const ErrorPartSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
})

export const MetaPartSchema = z.object({
  type: z.literal('meta'),
  key: z.string(),
  value: z.unknown(),
})

export const StepStartPartSchema = z.object({ type: z.literal('step-start') })

export const ContentPartSchema = z.discriminatedUnion('type', [
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
])

// ── Helpers ────────────────────────────────────────────────────────────────

export function extractText(parts: ContentPart[]): string {
  const pieces: string[] = []
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') pieces.push(part.text)
    if (part.type === 'reasoning' && typeof part.text === 'string') pieces.push(part.text)
  }
  return pieces.join('')
}

export function blockKindOf(part: ContentPart): string {
  return part.type
}

export function isStreaming(parts: ContentPart[]): boolean {
  return parts.some(
    (p) =>
      (p.type === 'text' && p.state === 'streaming') ||
      (p.type === 'reasoning' && p.state === 'streaming') ||
      (p.type === 'custom' && p.state === 'streaming'),
  )
}

// ── Legacy migration (old {kind, content, index} blocks) ──────────────────

export interface LegacyBlock {
  kind: string; content: string; index: number
  language?: string; url?: string; alt?: string; source?: string
  toolName?: string; input?: Record<string, unknown>
  message?: string; code?: string; key?: string; value?: unknown; artifactType?: string
}

export function isLegacyBlock(obj: unknown): obj is LegacyBlock {
  const b = obj as LegacyBlock
  return typeof b === 'object' && b !== null && typeof b.kind === 'string' && typeof b.index === 'number'
}

export function migrateLegacyBlock(legacy: LegacyBlock): ContentPart {
  switch (legacy.kind) {
    case 'text': return { type: 'text', text: legacy.content }
    case 'thinking': return { type: 'reasoning', text: legacy.content }
    case 'code': return { type: 'code', text: legacy.content, language: legacy.language }
    case 'image': return { type: 'file', mediaType: 'image/png', url: legacy.url ?? legacy.content, filename: legacy.alt }
    case 'tool_use': return { type: 'tool-call', toolCallId: `tc_${legacy.index}`, toolName: legacy.toolName ?? 'unknown', input: legacy.input ?? {} }
    case 'artifact': return { type: 'custom', kind: 'artifact', data: { content: legacy.content, artifactType: legacy.artifactType } }
    case 'citation': return { type: 'source', sourceId: `src_${legacy.index}`, url: legacy.url ?? legacy.source, title: legacy.content }
    case 'error': return { type: 'error', message: legacy.message ?? legacy.content, code: legacy.code }
    case 'meta': return { type: 'meta', key: legacy.key ?? 'unknown', value: legacy.value }
    default: return { type: 'text', text: legacy.content }
  }
}

export function migrateLegacyParts(blocks: LegacyBlock[]): ContentPart[] {
  return blocks.map(migrateLegacyBlock)
}
