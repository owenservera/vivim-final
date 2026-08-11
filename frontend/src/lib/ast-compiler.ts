/**
 * AST Compiler — parses raw markdown/stream text into structured AST nodes.
 *
 * Harvested from edge-pwa frontend observatory. Provider-agnostic.
 * Supports: headers, code blocks (incl. Mermaid), LaTeX, tables,
 * blockquotes (nested), lists (nested, task), inline formatting,
 * thinking blocks, media, citations, and more.
 */

// ── Node Types ────────────────────────────────────────────────────

export type ASTNodeType =
  | 'root'
  | 'header'
  | 'paragraph'
  | 'text'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inline_code'
  | 'code_block'
  | 'latex_inline'
  | 'latex_block'
  | 'mermaid'
  | 'horizontal_rule'
  | 'reasoning'
  | 'citation'
  | 'list'
  | 'list_item'
  | 'media'
  | 'blockquote'
  | 'table'
  | 'table_row'
  | 'table_cell'
  | 'inline_html'

export type TableAlignment = 'left' | 'center' | 'right' | null

export interface ASTNode {
  type: ASTNodeType
  text?: string
  level?: number
  language?: string
  content?: string
  children?: ASTNode[]
  metadata?: Record<string, unknown>
  headers?: string[]
  alignments?: TableAlignment[]
  isHeader?: boolean
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Compiles raw markdown/stream text into a canonical AST.
 *
 * @example
 * const nodes = compileMessageToAST('# Hello\n```js\nconsole.log(1)\n```')
 */
export function compileMessageToAST(content: string): ASTNode[] {
  if (!content) return []

  const nodes: ASTNode[] = []
  let remaining = content

  while (remaining.length > 0) {
    // 1. Detect thinking blocks (<think>...</think>, <thinking>...</thinking>)
    const thinkStartMatch = remaining.match(/<(think|thinking)[^>]*>/i)
    if (thinkStartMatch && thinkStartMatch.index !== undefined) {
      const startIdx = thinkStartMatch.index
      const tag = thinkStartMatch[0]!
      const closeTag = tag.startsWith('<thinking') ? '</thinking>' : '</think>'
      const closeIdx = remaining.indexOf(closeTag, startIdx)

      if (startIdx > 0) {
        nodes.push(...parseMarkdownBlocks(remaining.substring(0, startIdx)))
      }

      if (closeIdx !== -1) {
        const reasonContent = remaining.substring(startIdx + tag.length, closeIdx)
        nodes.push({
          type: 'reasoning',
          content: reasonContent.trim(),
          children: compileMessageToAST(reasonContent),
        })
        remaining = remaining.substring(closeIdx + closeTag.length)
      } else {
        nodes.push({
          type: 'reasoning',
          content: remaining.substring(startIdx + tag.length),
          children: compileMessageToAST(remaining.substring(startIdx + tag.length)),
          metadata: { incomplete: true },
        })
        remaining = ''
      }
      continue
    }

    // 2. Detect block LaTeX ($$...$$)
    const latexBlockMatch = remaining.match(/\$\$\n([\s\S]*?)\n\$\$/)
    if (latexBlockMatch && latexBlockMatch.index !== undefined && latexBlockMatch.index === 0) {
      nodes.push({ type: 'latex_block', content: latexBlockMatch[1].trim() })
      remaining = remaining.substring(latexBlockMatch[0].length)
      continue
    }

    // 3. Detect fenced code blocks (and Mermaid)
    const codeBlockMatch = remaining.match(/^```(\w*)\n([\s\S]*?)\n```/m)
    if (codeBlockMatch && codeBlockMatch.index !== undefined && codeBlockMatch.index === 0) {
      const lang = codeBlockMatch[1].toLowerCase()
      if (lang === 'mermaid') {
        nodes.push({ type: 'mermaid', content: codeBlockMatch[2].trim() })
      } else {
        nodes.push({
          type: 'code_block',
          language: lang || 'plaintext',
          content: codeBlockMatch[2],
        })
      }
      remaining = remaining.substring(codeBlockMatch[0].length)
      continue
    }

    // 4. Default: parse standard markdown chunks
    const nextToken = findNextBlockTokenIndex(remaining)
    if (nextToken !== -1 && nextToken > 0) {
      nodes.push(...parseMarkdownBlocks(remaining.substring(0, nextToken)))
      remaining = remaining.substring(nextToken)
    } else {
      nodes.push(...parseMarkdownBlocks(remaining))
      remaining = ''
    }
  }

  return nodes
}

function findNextBlockTokenIndex(str: string): number {
  const tokens = [/^```/m, /<thinking>/i, /\$$/]
  let minIdx = -1
  for (const token of tokens) {
    const match = str.match(token)
    if (match && match.index !== undefined) {
      if (minIdx === -1 || match.index < minIdx) minIdx = match.index
    }
  }
  return minIdx
}

function parseMarkdownBlocks(chunk: string): ASTNode[] {
  const nodes: ASTNode[] = []
  const lines = chunk.split('\n')

  interface ListFrame {
    items: ASTNode[]
    indent: number
    isOrdered: boolean
  }
  const listStack: ListFrame[] = []

  function flushLists(toIndent: number): void {
    while (listStack.length > 0 && listStack[listStack.length - 1].indent >= toIndent) {
      const frame = listStack.pop()!
      if (frame.items.length === 0) continue
      const listNode: ASTNode = { type: 'list', children: frame.items }
      if (listStack.length > 0) {
        const parentFrame = listStack[listStack.length - 1]
        const lastItem = parentFrame.items[parentFrame.items.length - 1]
        if (lastItem) {
          if (!lastItem.children) lastItem.children = []
          lastItem.children.push(listNode)
        }
      } else {
        nodes.push(listNode)
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Table
    if (line.trimStart().startsWith('|') && line.trimEnd().endsWith('|')) {
      const tableLines: string[] = [line]
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim()
        if (next.startsWith('|') && next.endsWith('|')) {
          tableLines.push(lines[i + 1])
          i++
        } else break
      }
      if (tableLines.length >= 2) {
        const table = parsePipeTable(tableLines)
        if (table) {
          flushLists(0)
          nodes.push(table)
          continue
        }
      }
    }

    // Header
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      flushLists(0)
      nodes.push({
        type: 'header',
        level: headerMatch[1].length,
        children: parseInline(headerMatch[2]),
      })
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushLists(0)
      nodes.push({ type: 'horizontal_rule' })
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      flushLists(0)
      const bqLines: Array<{ content: string; depth: number }> = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        let depth = 0
        let content = lines[i]
        while (content.startsWith('>')) {
          depth++
          content = content.substring(1)
          if (content.startsWith(' ')) content = content.substring(1)
        }
        bqLines.push({ content, depth })
        i++
      }
      i--
      nodes.push(buildNestedBlockquotes(bqLines))
      continue
    }

    // Task list / ordered / unordered
    const indent = getListIndent(line)
    const trimmed = line.trimStart()
    const taskMatch = trimmed.match(/^(\*|-|\d+\.)\s+\[([ x])\]\s+(.*)$/)
    if (taskMatch) {
      const isOrdered = /^\d+\.$/.test(taskMatch[1])
      const itemNode: ASTNode = {
        type: 'list_item',
        children: parseInline(taskMatch[3]),
        metadata: { checked: taskMatch[2] === 'x' },
      }
      flushLists(indent + 1)
      if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
        listStack.push({ items: [itemNode], indent, isOrdered })
      } else {
        const top = listStack[listStack.length - 1]
        if (top.isOrdered === isOrdered && top.indent === indent) {
          top.items.push(itemNode)
        } else {
          flushLists(indent)
          listStack.push({ items: [itemNode], indent, isOrdered })
        }
      }
      continue
    }
    const listMatch = trimmed.match(/^(\*|-|\d+\.)\s+(.*)$/)
    if (listMatch) {
      const isOrdered = /^\d+\.$/.test(listMatch[1])
      const itemNode: ASTNode = { type: 'list_item', children: parseInline(listMatch[2]) }
      flushLists(indent + 1)
      if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
        listStack.push({ items: [itemNode], indent, isOrdered })
      } else {
        const top = listStack[listStack.length - 1]
        if (top.isOrdered === isOrdered && top.indent === indent) {
          top.items.push(itemNode)
        } else {
          flushLists(indent)
          listStack.push({ items: [itemNode], indent, isOrdered })
        }
      }
      continue
    }

    // Blank line
    if (line.trim() === '') {
      flushLists(0)
      continue
    }

    // Paragraph
    flushLists(0)
    nodes.push({ type: 'paragraph', children: parseInline(line) })
  }
  flushLists(0)
  return nodes
}

function buildNestedBlockquotes(bqLines: { content: string; depth: number }[]): ASTNode {
  function process(lines: { content: string; depth: number }[], baseDepth: number): ASTNode[] {
    const children: ASTNode[] = []
    let idx = 0
    while (idx < lines.length) {
      const { content, depth } = lines[idx]
      if (depth === baseDepth) {
        children.push({ type: 'paragraph', children: parseInline(content) })
        idx++
      } else if (depth > baseDepth) {
        const deeper: { content: string; depth: number }[] = []
        while (idx < lines.length && lines[idx].depth > baseDepth) {
          deeper.push(lines[idx])
          idx++
        }
        children.push({ type: 'blockquote', children: process(deeper, baseDepth + 1) })
      } else {
        idx++
      }
    }
    return children
  }
  const inner = process(bqLines, 1)
  return [{ type: 'blockquote', children: inner }]
}
function parsePipeTable(lines: string[]): ASTNode | null {
  if (lines.length < 2) return null
  const headerRow = parseTableRow(lines[0])
  if (!headerRow || headerRow.length < 2) return null
  const sepCells = lines[1].split('|').filter((c) => c.trim().length > 0)
  const alignments: TableAlignment[] = sepCells.map((cell) => {
    const c = cell.trim()
    if (c.startsWith(':') && c.endsWith(':')) return 'center'
    if (c.endsWith(':')) return 'right'
    if (c.startsWith(':')) return 'left'
    return null
  })
  const rows: string[][] = []
  for (let i = 2; i < lines.length; i++) {
    const row = parseTableRow(lines[i])
    if (row) rows.push(row)
  }
  return {
    type: 'table',
    headers: headerRow,
    alignments,
    children: rows.map((rowTexts) => ({
      type: 'table_row' as ASTNodeType,
      children: rowTexts.map((cellText) => ({
        type: 'table_cell' as ASTNodeType,
        children: parseInline(cellText.trim()),
      })),
    })),
  }
}
function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim())
}
function parseInline(text: string): ASTNode[] {
  const inlineNodes: ASTNode[] = []
  let index = 0
  while (index < text.length) {
    const remaining = text.substring(index)
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      inlineNodes.push({ type: 'inline_code', text: codeMatch[1] })
      index += codeMatch[0].length
      continue
    }
    // Inline LaTeX
    const latexMatch = remaining.match(/^\$([^$]+)\$/)
    if (latexMatch) {
      inlineNodes.push({ type: 'latex_inline', content: latexMatch[1] })
      index += latexMatch[0].length
      continue
    }
    // Citations
    const citationMatch = remaining.match(/^\[\^?(\d+)\]/)
    if (citationMatch) {
      inlineNodes.push({ type: 'citation', text: citationMatch[1] })
      index += citationMatch[0].length
      continue
    }
    // Strikethrough
    const strikeMatch = remaining.match(/^~~(.+?)~~/)
    if (strikeMatch) {
      inlineNodes.push({
        type: 'strikethrough' as ASTNodeType,
        text: strikeMatch[1],
        children: parseInline(strikeMatch[1]),
      })
      index += strikeMatch[0].length
      continue
    }
    // Bold
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/)
    if (boldMatch) {
      inlineNodes.push({ type: 'bold', text: boldMatch[2], children: parseInline(boldMatch[2]) })
      index += boldMatch[0].length
      continue
    }
    // Italic
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/)
    if (italicMatch) {
      inlineNodes.push({
        type: 'italic',
        text: italicMatch[2],
        children: parseInline(italicMatch[2]),
      })
      index += italicMatch[0].length
      continue
    }
    // Media ![alt](url)
    const mediaMatch = remaining.match(/^!\[(.*?)\]\((.*?)\)/)
    if (mediaMatch) {
      inlineNodes.push({ type: 'media', text: mediaMatch[1], content: mediaMatch[2] })
      index += mediaMatch[0].length
      continue
    }
    // Inline HTML
    const htmlMatch = remaining.match(
      /^<(kbd|mark|sub|sup|del|ins|abbr|code|var|samp)(\s[^>]*)?>([\s\S]*?)<\/\1>/,
    )
    if (htmlMatch) {
      inlineNodes.push({
        type: 'inline_html' as ASTNodeType,
        text: htmlMatch[0],
        content: htmlMatch[3],
      })
      index += htmlMatch[0].length
      continue
    }
    // Escape sequence
    const escapeMatch = remaining.match(/^\\([`*_${}~\\#\-!()[\].|])/)
    if (escapeMatch) {
      const last = inlineNodes[inlineNodes.length - 1]
      if (last && last.type === 'text') last.text += escapeMatch[1]
      else inlineNodes.push({ type: 'text', text: escapeMatch[1] })
      index += escapeMatch[0].length
      continue
    }
    // Fallback: character
    const char = text[index]
    const last = inlineNodes[inlineNodes.length - 1]
    if (last && last.type === 'text') last.text += char
    else inlineNodes.push({ type: 'text', text: char })
    index++
  }
  return inlineNodes
}

function getListIndent(line: string): number {
  return line.length - line.trimStart().length
}
