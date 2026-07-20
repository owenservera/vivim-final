// src/schema/rich-text.ts
// GFM-rich-text AST model — Zod schemas + parse/serialize helpers.
// Canonical truth: GFM markdown string. AST is a derived/cached form.

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { z } from 'zod'

// ── Mark model (ProseMirror-style composable marks) ──────────────────────────

export const MarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('code') }),
  z.object({ type: z.literal('highlight') }),
  z.object({ type: z.literal('subscript') }),
  z.object({ type: z.literal('superscript') }),
  z.object({ type: z.literal('link'), url: z.string(), title: z.string().optional() }),
])
export type Mark = z.infer<typeof MarkSchema>

// ── Inline nodes (phrasing content) ─────────────────────────────────────────

export const TextNodeSchema: z.ZodType<TextNode> = z.object({
  type: z.literal('text'),
  value: z.string(),
  marks: z.array(MarkSchema).optional(),
})
export interface TextNode {
  type: 'text'
  value: string
  marks?: Mark[]
}

export type PhrasingContent =
  | TextNode
  | EmphNode
  | StrongNode
  | DeleteNode
  | InlineCodeNode
  | LinkNode
  | ImageNode
  | BreakNode
  | MathNode
  | WidgetNode
  | MentionNode

export interface EmphNode {
  type: 'emphasis'
  children: PhrasingContent[]
}
export interface StrongNode {
  type: 'strong'
  children: PhrasingContent[]
}
export interface DeleteNode {
  type: 'delete'
  children: PhrasingContent[]
}
export interface InlineCodeNode {
  type: 'inlineCode'
  value: string
}
export interface LinkNode {
  type: 'link'
  url: string
  title?: string
  children: PhrasingContent[]
}
export interface ImageNode {
  type: 'image'
  url: string
  alt?: string
  title?: string
}
export interface BreakNode {
  type: 'break'
}
export interface MathNode {
  type: 'math'
  value: string
}
export interface WidgetNode {
  type: 'widget'
  kind: string
  props: Record<string, unknown>
}
export interface MentionNode {
  type: 'mention'
  id: string
}

// ── Block nodes (flow content) ────────────────────────────────────────────

export type FlowContent =
  | ParagraphNode
  | HeadingNode
  | BlockquoteNode
  | ListNode
  | ListItemNode
  | CodeNode
  | TableNode
  | TableRowNode
  | TableCellNode
  | ThematicBreakNode
  | HtmlNode
  | MathBlockNode
  | MermaidNode

export interface ParagraphNode {
  type: 'paragraph'
  children: PhrasingContent[]
}
export interface HeadingNode {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  children: PhrasingContent[]
}
export interface BlockquoteNode {
  type: 'blockquote'
  children: FlowContent[]
}
export interface ListNode {
  type: 'list'
  ordered?: boolean
  start?: number
  children: ListItemNode[]
}
export interface ListItemNode {
  type: 'listItem'
  checked?: boolean
  children: FlowContent[]
}
export interface CodeNode {
  type: 'code'
  lang?: string
  value: string
}
export interface TableNode {
  type: 'table'
  align?: Array<'left' | 'center' | 'right' | null>
  children: TableRowNode[]
}
export interface TableRowNode {
  type: 'tableRow'
  children: TableCellNode[]
}
export interface TableCellNode {
  type: 'tableCell'
  children: PhrasingContent[]
}
export interface ThematicBreakNode {
  type: 'thematicBreak'
}
export interface HtmlNode {
  type: 'html'
  value: string
}
export interface MathBlockNode {
  type: 'mathBlock'
  value: string
  display: true
}
export interface MermaidNode {
  type: 'mermaid'
  value: string
}

// ── RichText ─────────────────────────────────────────────────────────────

export type RichNode = FlowContent | PhrasingContent

export type RichText = string | { ast: RichNode[] }

// ── Zod schemas for the AST ────────────────────────────────────────────────
// Recursive discriminated unions produce overly-broad inferred types in Zod.
// Use z.any() for recursive children — the TS interfaces are the source of truth;
// these schemas are for runtime boundary validation only.

export const PhrasingContentSchema: z.ZodType<PhrasingContent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextNodeSchema as any,
    z.object({ type: z.literal('emphasis'), children: z.array(z.any()) }),
    z.object({ type: z.literal('strong'), children: z.array(z.any()) }),
    z.object({ type: z.literal('delete'), children: z.array(z.any()) }),
    z.object({ type: z.literal('inlineCode'), value: z.string() }),
    z.object({
      type: z.literal('link'),
      url: z.string(),
      title: z.string().optional(),
      children: z.array(z.any()),
    }),
    z.object({
      type: z.literal('image'),
      url: z.string(),
      alt: z.string().optional(),
      title: z.string().optional(),
    }),
    z.object({ type: z.literal('break') }),
    z.object({ type: z.literal('math'), value: z.string() }),
    z.object({ type: z.literal('widget'), kind: z.string(), props: z.record(z.unknown()) }),
    z.object({ type: z.literal('mention'), id: z.string() }),
  ] as any),
)

const _TableRowSchema = z.object({
  type: z.literal('tableRow'),
  children: z.array(
    z.object({
      type: z.literal('tableCell'),
      children: z.array(z.any()),
    }),
  ),
})

const _ListItemSchema = z.object({
  type: z.literal('listItem'),
  checked: z.boolean().optional(),
  children: z.array(z.any()),
})

export const FlowContentSchema: z.ZodType<FlowContent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), children: z.array(z.any()) }),
    z.object({
      type: z.literal('heading'),
      depth: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
      ]),
      children: z.array(z.any()),
    }),
    z.object({ type: z.literal('blockquote'), children: z.array(z.any()) }),
    z.object({
      type: z.literal('list'),
      ordered: z.boolean().optional(),
      start: z.number().optional(),
      children: z.array(z.any()),
    }),
    z.object({
      type: z.literal('listItem'),
      checked: z.boolean().optional(),
      children: z.array(z.any()),
    }),
    z.object({ type: z.literal('code'), lang: z.string().optional(), value: z.string() }),
    z.object({
      type: z.literal('table'),
      align: z
        .array(z.union([z.literal('left'), z.literal('center'), z.literal('right'), z.null()]))
        .optional(),
      children: z.array(z.any()),
    }),
    z.object({ type: z.literal('thematicBreak') }),
    z.object({ type: z.literal('html'), value: z.string() }),
    z.object({ type: z.literal('mathBlock'), value: z.string(), display: z.literal(true) }),
    z.object({ type: z.literal('mermaid'), value: z.string() }),
  ] as any),
)

export const RichNodeSchema: z.ZodType<RichNode> = z.union([
  FlowContentSchema,
  PhrasingContentSchema,
]) as z.ZodType<RichNode>

export const RichTextSchema: z.ZodType<RichText> = z.union([
  z.string(),
  z.object({ ast: z.array(z.any()) }),
]) as z.ZodType<RichText>

// ── Parse / Serialize ─────────────────────────────────────────────────────

export function parseRichText(md: string): RichNode[] {
  if (!md) return []
  const stripped = stripCodeFenceDelimiters(md)
  const tree = fromMarkdown(stripped, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const nodes = normalizeTree(tree.children as MdastNode[])
  return nodes
}

export function serializeRichText(ast: RichNode[]): string {
  const parts: string[] = []
  for (const node of ast) {
    parts.push(serializeNode(node))
  }
  return parts.join('\n\n')
}

export function extractTextFromAst(ast: RichNode[]): string {
  const parts: string[] = []
  function walk(nodes: RichNode[]): void {
    for (const n of nodes) {
      if ('children' in n && n.children) {
        walk(n.children as RichNode[])
      }
      if ('value' in n && typeof (n as { value: unknown }).value === 'string') {
        parts.push((n as { value: string }).value)
      }
    }
  }
  walk(ast)
  return parts.join('')
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function extractMermaid(ast: RichNode[]): MermaidNode[] {
  return ast.filter((n): n is MermaidNode => n.type === 'mermaid')
}

export function extractMath(ast: RichNode[]): MathNode[] {
  const result: MathNode[] = []
  function walk(nodes: RichNode[]): void {
    for (const n of nodes) {
      if (n.type === 'math') result.push(n)
      if ('children' in n && n.children) walk(n.children as RichNode[])
    }
  }
  walk(ast)
  return result
}

// ── Private ────────────────────────────────────────────────────────────────

type MdastNode = {
  type: string
  children?: MdastNode[]
  value?: string
  url?: string
  alt?: string
  title?: string
  depth?: number
  ordered?: boolean
  start?: number
  checked?: boolean | null
  lang?: string
  align?: Array<'left' | 'center' | 'right' | null>
}

function stripCodeFenceDelimiters(md: string): string {
  return md
    .replace(/^```[\s\S]*?```$/gm, (match) => {
      const langMatch = match.match(/^```(\w*)\n?/)
      const lang = langMatch?.[1] ?? ''
      const content = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      return `~~~${lang ? `${lang}\n` : '\n'}${content}\n~~~`
    })
    .replace(/^~~~(\w*)\n?([\s\S]*?)~~~/gm, (_, lang, content) => {
      return `\`\`\`${lang}\n${content.trim()}\n\`\`\``
    })
}

const FLOW_TYPES = new Set<string>([
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'listItem',
  'code',
  'table',
  'thematicBreak',
  'html',
  'mathBlock',
  'mermaid',
])
function isFlowNode(type: string): boolean {
  return FLOW_TYPES.has(type)
}

function normalizeTree(nodes: MdastNode[]): FlowContent[] {
  const result: FlowContent[] = []
  for (const mdast of nodes) {
    const node = convertMdastNode(mdast)
    if (node && isFlowNode(node.type)) result.push(node as FlowContent)
  }
  return result
}

function convertMdastNode(n: MdastNode): RichNode | null {
  switch (n.type) {
    case 'paragraph':
      return { type: 'paragraph', children: normalizePhrasing(n.children ?? []) }
    case 'heading':
      return {
        type: 'heading',
        depth: (n.depth ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: normalizePhrasing(n.children ?? []),
      }
    case 'blockquote':
      return { type: 'blockquote', children: normalizeTree(n.children ?? []) }
    case 'list':
      return {
        type: 'list',
        ordered: n.ordered,
        start: n.start,
        children: normalizeListItems(n.children ?? []),
      }
    case 'listItem':
      return {
        type: 'listItem',
        checked: n.checked ?? undefined,
        children: normalizeTree(n.children ?? []),
      }
    case 'code':
      if (n.lang === 'mermaid') return { type: 'mermaid', value: n.value ?? '' }
      return { type: 'code', lang: n.lang, value: n.value ?? '' }
    case 'table':
      return { type: 'table', align: n.align, children: normalizeTableBody(n.children ?? []) }
    case 'thematicBreak':
      return { type: 'thematicBreak' }
    case 'html':
      return { type: 'html', value: n.value ?? '' }
    case 'text':
      return { type: 'text', value: n.value ?? '' }
    case 'emphasis':
      return { type: 'emphasis', children: normalizePhrasing(n.children ?? []) }
    case 'strong':
      return { type: 'strong', children: normalizePhrasing(n.children ?? []) }
    case 'delete':
      return { type: 'delete', children: normalizePhrasing(n.children ?? []) }
    case 'inlineCode':
      return { type: 'inlineCode', value: n.value ?? '' }
    case 'link':
      return {
        type: 'link',
        url: n.url ?? '',
        title: n.title,
        children: normalizePhrasing(n.children ?? []),
      }
    case 'image':
      return { type: 'image', url: n.url ?? '', alt: n.alt, title: n.title }
    case 'break':
      return { type: 'break' }
    case 'math':
      return { type: 'math', value: n.value ?? '' }
    default:
      return null
  }
}

function normalizePhrasing(nodes: MdastNode[]): PhrasingContent[] {
  return nodes
    .map(convertMdastNode)
    .filter((n): n is PhrasingContent => n !== null && !('paragraph' in n))
}

function normalizeListItems(nodes: MdastNode[]): ListItemNode[] {
  return nodes.map((n) => ({
    type: 'listItem' as const,
    checked: n.checked ?? undefined,
    children: normalizeTree(n.children ?? []),
  }))
}

function normalizeTableBody(nodes: MdastNode[]): TableRowNode[] {
  return nodes.map((row) => ({
    type: 'tableRow' as const,
    children: (row.children ?? []).map((cell) => ({
      type: 'tableCell' as const,
      children: normalizePhrasing(cell.children ?? []),
    })),
  }))
}

function serializeNode(node: RichNode): string {
  switch (node.type) {
    case 'paragraph':
      return serializePhrasing(node.children)
    case 'heading':
      return `${'#'.repeat(node.depth)} ${serializePhrasing(node.children)}`
    case 'blockquote':
      return node.children.map((c) => `> ${serializeNode(c)}`).join('\n')
    case 'list': {
      const items = node.children.map((item, i) => {
        const prefix = node.ordered ? `${(node.start ?? 1) + i}. ` : '- '
        return item.children
          .map((c, j) => {
            const serialized = serializeNode(c)
            return j === 0 ? prefix + serialized : `  ${serialized}`
          })
          .join('\n')
      })
      return items.join('\n')
    }
    case 'listItem':
      return node.children.map(serializeNode).join('\n')
    case 'code':
      return `\`\`\`${node.lang ?? ''}\n${node.value}\n\`\`\``
    case 'table':
      return serializeTable(node)
    case 'thematicBreak':
      return '---'
    case 'html':
      return node.value
    case 'mathBlock':
      return `$$\n${node.value}\n$$`
    case 'mermaid':
      return `\`\`\`mermaid\n${node.value}\n\`\`\``
    default:
      return serializePhrasing([node as PhrasingContent])
  }
}

function serializePhrasing(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.value
        case 'emphasis':
          return `*${serializePhrasing(n.children)}*`
        case 'strong':
          return `**${serializePhrasing(n.children)}**`
        case 'delete':
          return `~~${serializePhrasing(n.children)}~~`
        case 'inlineCode':
          return `\`${n.value}\``
        case 'link':
          return `[${serializePhrasing(n.children)}](${n.url}${n.title ? ` "${n.title}"` : ''})`
        case 'image':
          return `![${n.alt ?? ''}](${n.url}${n.title ? ` "${n.title}"` : ''})`
        case 'break':
          return '\n'
        case 'math':
          return `$${n.value}$`
        case 'widget':
          return `<widget:${n.kind}>`
        case 'mention':
          return `@${n.id}`
        default:
          return ''
      }
    })
    .join('')
}

function serializeTable(table: TableNode): string {
  if (table.children.length === 0) return ''
  const rows = table.children.map((row) => {
    return `| ${row.children.map((cell) => serializePhrasing(cell.children)).join(' | ')} |`
  })
  const align = table.align ?? []
  const headerDivider = `| ${align
    .map((a) => {
      switch (a) {
        case 'left':
          return ':---'
        case 'center':
          return ':--:'
        case 'right':
          return '---:'
        default:
          return '---'
      }
    })
    .join(' | ')} |`
  rows.splice(1, 0, headerDivider)
  return rows.join('\n')
}
