// src/engines/code-audit/symbols.ts
// Indexed topology reconstruction: exported/named symbol extraction with
// per-symbol cyclomatic complexity and import/call edge detection over a
// symbol-name index (O(tokens) per file, not O(files × symbols)).

import * as path from 'node:path'
import type { CodebaseTopology, GraphEdge, GraphNode, Token, TokenizedFile } from './types.js'

export interface SymbolRecord {
  node: GraphNode
}

const COMPLEXITY_RE = /(?:\b(?:if|for|while|case|catch|switch|try|catch)\b|&&|\|\||\?)/g

/**
 * Extract symbols from a tokenized file. Supports `export class/function`,
 * named `function`, `class`, and `const X = (…) =>` arrows.
 */
export function extractSymbols(tf: TokenizedFile): SymbolRecord[] {
  const { tokens, lines, code } = tf
  const decls: { name: Token; kind: GraphNode['kind'] }[] = []

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.kind !== 'keyword') continue
    const next = tokens[i + 1]
    if (!next) continue

    if (t.text === 'export' && (next.text === 'class' || next.text === 'function')) {
      const nameTok = tokens[i + 2]
      if (nameTok && nameTok.kind === 'identifier') {
        decls.push({ name: nameTok, kind: next.text === 'class' ? 'CLASS' : 'FUNCTION' })
      }
      continue
    }
    if ((t.text === 'function' || t.text === 'class') && next.kind === 'identifier') {
      const prev = tokens[i - 1]
      if (prev && (prev.text === 'export' || prev.text === '.')) continue
      decls.push({ name: next, kind: t.text === 'class' ? 'CLASS' : 'FUNCTION' })
      continue
    }
    if (t.text === 'const' || t.text === 'let' || t.text === 'var') {
      const nameTok = tokens[i + 1]
      const eq = tokens[i + 2]
      if (nameTok && nameTok.kind === 'identifier' && eq && eq.text === '=' && isArrowFunction(tokens, i + 3)) {
        decls.push({ name: nameTok, kind: 'EXPRESSION' })
      }
    }
  }

  const out: SymbolRecord[] = []
  const codeLines = code.split('\n')

  for (let d = 0; d < decls.length; d++) {
    const decl = decls[d]!
    const lineStart = decl.name.line
    const nextLine = d + 1 < decls.length ? decls[d + 1]!.name.line : lines.length + 1
    const lineEnd = Math.min(Math.max(nextLine - 1, lineStart), lines.length)

    const bodySlice = codeLines.slice(lineStart - 1, lineEnd).join('\n')
    const complexity = countMatches(bodySlice) + 1

    out.push({
      node: {
        id: `sym:${tf.filePath}:${decl.name.text}`,
        label: decl.name.text,
        kind: decl.kind,
        filePath: tf.filePath,
        lineStart,
        lineEnd,
        complexity,
      },
    })
  }

  return out
}

function isArrowFunction(tokens: Token[], i: number): boolean {
  for (let j = i; j < Math.min(i + 10, tokens.length); j++) {
    const t = tokens[j]!
    if (t.text === '=>') return true
    if (t.text === 'function') return true
  }
  return false
}

function countMatches(body: string): number {
  let count = 0
  COMPLEXITY_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = COMPLEXITY_RE.exec(body)) !== null) {
    count++
    if (m.index === COMPLEXITY_RE.lastIndex) COMPLEXITY_RE.lastIndex++
  }
  return count
}

/**
 * Build the workspace topology. Edges: CALLS (this file calls another file's
 * exported symbol) and IMPORTS (relative import resolves to a file that has
 * symbols).
 */
export function buildTopology(
  files: TokenizedFile[],
  symbolsByFile: Map<string, SymbolRecord[]>,
): CodebaseTopology {
  const nodes: GraphNode[] = []
  const nodeMap = new Map<string, GraphNode[]>()
  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  for (const [file, syms] of symbolsByFile) {
    for (const s of syms) {
      nodes.push(s.node)
      const arr = nodeMap.get(s.node.label)
      if (arr) arr.push(s.node)
      else nodeMap.set(s.node.label, [s.node])
    }
  }

  const addEdge = (sourceId: string, targetId: string, relation: GraphEdge['relation']) => {
    const key = `${relation}:${sourceId}:${targetId}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push({ sourceId, targetId, relation })
  }

  // File path set for import resolution.
  const filePaths = new Set(files.map((f) => f.filePath))

  for (const tf of files) {
    const fileId = `file:${tf.filePath}`
    const selfSymbols = new Set((symbolsByFile.get(tf.filePath) ?? []).map((s) => s.node.label))

    // IMPORTS: resolve relative imports against the collected file set.
    const importRe = /(?:from\s+|import\s+)['"](\.[^'"]+)['"]/g
    let m: RegExpExecArray | null
    importRe.lastIndex = 0
    while ((m = importRe.exec(tf.source)) !== null) {
      const target = resolveImport(tf.filePath, m[1]!)
      if (target && filePaths.has(target)) {
        const targetSyms = symbolsByFile.get(target)
        if (targetSyms && targetSyms.length > 0) addEdge(fileId, `file:${target}`, 'IMPORTS')
      }
    }

    // CALLS: identifiers in this file (not its own symbols) followed by `(`.
    const calledNames = new Set<string>()
    for (let idx = 0; idx < tf.tokens.length; idx++) {
      const t = tf.tokens[idx]!
      if (t.kind !== 'identifier') continue
      if (selfSymbols.has(t.text)) continue
      const next = tf.tokens[idx + 1]
      if (next && next.text === '(') calledNames.add(t.text)
    }

    const hitFiles = new Set<string>()
    for (const name of calledNames) {
      const targets = nodeMap.get(name)
      if (!targets) continue
      for (const tgt of targets) {
        if (tgt.filePath === tf.filePath) continue
        if (hitFiles.has(tgt.filePath)) continue
        hitFiles.add(tgt.filePath)
        addEdge(fileId, tgt.id, 'CALLS')
      }
    }
  }

  const cyclomaticComplexitySum = nodes.reduce((acc, n) => acc + n.complexity, 0)
  let maxComplexityNode: GraphNode | undefined
  for (const n of nodes) {
    if (!maxComplexityNode || n.complexity > maxComplexityNode.complexity) maxComplexityNode = n
  }

  const symbolFiles = new Set(symbolsByFile.keys())
  return {
    nodes,
    edges,
    cyclomaticComplexitySum,
    maxComplexityNode,
    orphanFiles: files.map((f) => f.filePath).filter((f) => !symbolFiles.has(f)),
  }
}

function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.dirname(fromFile)
  const resolved = path.resolve(base, spec)
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
  ]
  for (const c of candidates) {
    const norm = path.normalize(c)
    if (norm.endsWith('.ts') || norm.endsWith('.tsx') || norm.endsWith('.js') || norm.endsWith('.jsx') || norm.endsWith('index.ts')) {
      return norm
    }
  }
  return resolved
}
