// src/engines/code-audit/tokenizer.ts
// Strings/comments-aware lexer. Produces a line-preserving "code-only"
// projection and the meaningful code tokens. Every static rule matches against
// this projection, never the raw source, so string literals and comments can
// never masquerade as real code (e.g. `line.includes('eval(')` is data, not an
// eval call).

import type { Token, TokenizedFile } from './types.js'

const KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'class',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'typeof',
  'instanceof',
  'in',
  'of',
  'await',
  'async',
  'yield',
  'import',
  'export',
  'from',
  'extends',
  'super',
  'this',
  'null',
  'undefined',
  'true',
  'false',
  'delete',
  'void',
  'default',
  'static',
  'interface',
  'type',
  'enum',
  'namespace',
  'as',
  'is',
  'satisfies',
  'readonly',
  'implements',
  'public',
  'private',
  'protected',
  'abstract',
  'get',
  'set',
])

function isIdentStart(c: string): boolean {
  return /[A-Za-z_$]/.test(c)
}
function isIdentPart(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c)
}
function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

/**
 * Lex a source file into tokens, blanking strings/comments/template-literal
 * bodies so the `code` projection keeps only real code (line numbers intact).
 * Template literal `${...}` expressions are skipped entirely — acceptable for
 * pattern detection and avoids a full nested lexer.
 */
export function tokenize(filePath: string, source: string): TokenizedFile {
  const lines = source.split('\n')
  const chars: string[] = Array.from(source)
  // Start from a full copy of the source; blank() replaces non-code regions
  // with spaces while preserving newlines, leaving real code in place.
  const codeChars = Array.from(source)
  const tokens: Token[] = []

  let i = 0
  const n = chars.length

  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      if (chars[k] !== '\n') codeChars[k] = ' '
    }
  }

  // Precompute line start positions for O(log n) line/column lookups.
  const lineStarts: number[] = [0]
  for (let k = 0; k < chars.length; k++) {
    if (chars[k] === '\n') lineStarts.push(k + 1)
  }

  const lineOf = (pos: number): number => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (lineStarts[mid]! <= pos) lo = mid + 1
      else hi = mid - 1
    }
    return hi + 1
  }

  const colOf = (pos: number): number => pos - lineStarts[lineOf(pos) - 1]!

  while (i < n) {
    const c = chars[i]!

    // Line comment
    if (c === '/' && chars[i + 1] === '/') {
      const start = i
      while (i < n && chars[i] !== '\n') i++
      blank(start, i)
      continue
    }

    // Block comment
    if (c === '/' && chars[i + 1] === '*') {
      const start = i
      i += 2
      while (i < n && !(chars[i] === '*' && chars[i + 1] === '/')) i++
      i = Math.min(i + 2, n)
      blank(start, i)
      continue
    }

    // String literals (single/double)
    if (c === "'" || c === '"') {
      const quote = c
      const start = i
      i++
      while (i < n) {
        if (chars[i] === '\\') {
          i += 2
          continue
        }
        if (chars[i] === quote) {
          i++
          break
        }
        i++
      }
      blank(start, i)
      continue
    }

    // Template literal — blank until the closing backtick (skip ${...} bodies)
    if (c === '`') {
      const start = i
      i++
      while (i < n) {
        if (chars[i] === '\\') {
          i += 2
          continue
        }
        if (chars[i] === '`') {
          i++
          break
        }
        i++
      }
      blank(start, i)
      continue
    }

    // Regex literal heuristic: `/.../ ` following a punct or keyword that opens
    // an expression position. Cheap approximation — only blanks obvious
    // standalone regex literals to avoid division confusion.
    if (c === '/' && isRegexStart(chars, i)) {
      const start = i
      i++
      let inClass = false
      while (i < n) {
        if (chars[i] === '\\') {
          i += 2
          continue
        }
        if (chars[i] === '[') inClass = true
        else if (chars[i] === ']') inClass = false
        else if (chars[i] === '/' && !inClass) {
          i++
          break
        } else if (chars[i] === '\n') {
          break
        }
        i++
      }
      blank(start, i)
      continue
    }

    // Identifiers / keywords
    if (isIdentStart(c)) {
      const start = i
      i++
      while (i < n && isIdentPart(chars[i]!)) i++
      const word = source.slice(start, i)
      tokens.push({
        text: word,
        line: lineOf(start),
        column: colOf(start),
        kind: KEYWORDS.has(word) ? 'keyword' : 'identifier',
      })
      continue
    }

    // Numbers
    if (isDigit(c)) {
      const start = i
      i++
      while (i < n && /[0-9a-fA-FxXoObB_.]/.test(chars[i]!)) i++
      const text = source.slice(start, i)
      tokens.push({ text, line: lineOf(start), column: colOf(start), kind: 'number' })
      continue
    }

    // Punctuation — keep meaningful operators, blank whitespace/other
    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') {
      i++
      continue
    }
    // Preserve code punctuation in the projection
    const start = i
    i++
    const text = source.slice(start, i)
    tokens.push({ text, line: lineOf(start), column: colOf(start), kind: 'punct' })
  }

  return {
    filePath,
    source,
    lines,
    code: codeChars.join(''),
    tokens,
  }
}

function isRegexStart(chars: string[], i: number): boolean {
  let j = i - 1
  while (j >= 0 && (chars[j] === ' ' || chars[j] === '\t')) j--
  if (j < 0) return true
  const prev = chars[j]!
  // After = ( [ { , : ; ! & | ? return => new — an expression position
  return '=([{,:;!&|?><+-*%'.includes(prev) || prev === '(' || prev === '{' || prev === '['
}

/** Convenience: all tokens on a given 1-based line. */
export function tokensOnLine(tf: TokenizedFile, line: number): Token[] {
  return tf.tokens.filter((t) => t.line === line)
}

/** Convenience: does the code projection contain a real call token? */
export function hasCodeCall(tf: TokenizedFile, callee: string): boolean {
  return tf.tokens.some((t, idx) => {
    if (t.text !== callee || t.kind !== 'identifier') return false
    const next = tf.tokens[idx + 1]
    return next !== undefined && next.text === '('
  })
}

/** Index code tokens for fast multi-pattern scanning. */
export function tokenIndex(tf: TokenizedFile): Map<string, Token[]> {
  const m = new Map<string, Token[]>()
  for (const t of tf.tokens) {
    const arr = m.get(t.text)
    if (arr) arr.push(t)
    else m.set(t.text, [t])
  }
  return m
}
