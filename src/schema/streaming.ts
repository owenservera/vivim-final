// src/schema/streaming.ts
// ContentBlock union type — used by StreamParserEngine and StreamBlockStore.

export type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number }

export function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is ContentBlock & { kind: 'text' } => b.kind === 'text')
    .map((b) => b.content)
    .join('')
}
