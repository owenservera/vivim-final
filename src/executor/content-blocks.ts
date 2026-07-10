// src/executor/content-blocks.ts
// Content block types for stream parsing.

export type ContentBlockKind =
  | 'text'
  | 'thinking'
  | 'code'
  | 'artifact'
  | 'image'
  | 'citation'
  | 'tool_use'
  | 'error'
  | 'meta'

export interface ContentBlock {
  kind: ContentBlockKind
  content: string
  metadata?: Record<string, unknown>
}
