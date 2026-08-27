// src/engines/safe-expression.ts
// Safe AST-based expression evaluator for workflow DSL conditions.
// Replaces `new Function()` calls in workflow-compiler and workflow-engine.
// Supports: property access, comparisons, logical operators, ternary, string/number literals.
// NO: function calls, prototypes, `this`, assignment, or side effects.

import { EngineError } from '../errors.js'

// ── Token types ────────────────────────────────────────────────────────

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'ident'; value: string }
  | { type: '.' }
  | { type: '[' }
  | { type: ']' }
  | { type: '(' }
  | { type: ')' }
  | { type: '==' | '!=' | '>=' | '<=' | '>' | '<' }
  | { type: '&&' | '||' }
  | { type: '!' }
  | { type: '?' }
  | { type: ':' }
  | { type: ',' }

// ── Lexer ──────────────────────────────────────────────────────────────

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: '(' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: ')' })
      i++
      continue
    }
    if (ch === '[') {
      tokens.push({ type: '[' })
      i++
      continue
    }
    if (ch === ']') {
      tokens.push({ type: ']' })
      i++
      continue
    }
    if (ch === '?') {
      tokens.push({ type: '?' })
      i++
      continue
    }
    if (ch === ':') {
      tokens.push({ type: ':' })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: ',' })
      i++
      continue
    }
    if (ch === '!') {
      if (expr[i + 1] === '=') {
        tokens.push({ type: '!=' })
        i += 2
      } else {
        tokens.push({ type: '!' })
        i++
      }
      continue
    }
    if (ch === '>' || ch === '<' || ch === '=' || ch === '&' || ch === '|') {
      const next = expr[i + 1]
      if (ch === '=' && next === '=') {
        tokens.push({ type: '==' })
        i += 2
      } else if (ch === '>' && next === '=') {
        tokens.push({ type: '>=' })
        i += 2
      } else if (ch === '<' && next === '=') {
        tokens.push({ type: '<=' })
        i += 2
      } else if (ch === '>' && next !== '=') {
        tokens.push({ type: '>' })
        i++
      } else if (ch === '<' && next !== '=') {
        tokens.push({ type: '<' })
        i++
      } else if (ch === '&' && next === '&') {
        tokens.push({ type: '&&' })
        i += 2
      } else if (ch === '|' && next === '|') {
        tokens.push({ type: '||' })
        i += 2
      } else {
        i++
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      let val = ''
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\') {
          i++
          val += expr[i] ?? ''
        } else {
          val += expr[i]!
        }
        i++
      }
      i++ // skip closing quote
      tokens.push({ type: 'string', value: val })
      continue
    }
    if (/[0-9]/.test(ch)) {
      let num = ''
      while (i < expr.length && /[0-9.]/.test(expr[i]!)) {
        num += expr[i]
        i++
      }
      tokens.push({ type: 'number', value: Number(num) })
      continue
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ''
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i]!)) {
        ident += expr[i]
        i++
      }
      if (ident === 'true') tokens.push({ type: 'boolean', value: true })
      else if (ident === 'false') tokens.push({ type: 'boolean', value: false })
      else if (ident === 'null') tokens.push({ type: 'ident', value: 'null' })
      else if (ident === 'undefined') tokens.push({ type: 'ident', value: 'undefined' })
      else tokens.push({ type: 'ident', value: ident })
      continue
    }
    // Skip unknown characters (dash, slash, etc.)
    i++
  }
  return tokens
}

// ── AST nodes ──────────────────────────────────────────────────────────

type ASTNode =
  | { kind: 'literal'; value: string | number | boolean | null | undefined }
  | { kind: 'ident'; name: string }
  | { kind: 'access'; object: ASTNode; property: string }
  | { kind: 'index'; object: ASTNode; index: ASTNode }
  | { kind: 'unary'; op: '!' | '-'; operand: ASTNode }
  | { kind: 'binary'; op: string; left: ASTNode; right: ASTNode }
  | { kind: 'ternary'; condition: ASTNode; consequent: ASTNode; alternate: ASTNode }

// ── Recursive-descent parser ───────────────────────────────────────────

class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }
  private advance(): Token | undefined {
    return this.tokens[this.pos++]
  }

  private expect<T extends Token['type']>(type: T): Extract<Token, { type: T }> {
    const tok = this.advance()
    if (!tok || tok.type !== type)
      throw new EngineError(`Expected ${String(type)}, got ${tok ? String(tok.type) : 'EOF'}`)
    return tok as Extract<Token, { type: T }>
  }

  parse(): ASTNode {
    const node = this.parseTernary()
    if (this.pos < this.tokens.length) throw new EngineError('Unexpected token after expression')
    return node
  }

  private parseTernary(): ASTNode {
    const cond = this.parseOr()
    if (this.peek()?.type === '?') {
      this.advance()
      const consequent = this.parseOr()
      this.expect(':')
      const alternate = this.parseOr()
      return { kind: 'ternary', condition: cond, consequent, alternate }
    }
    return cond
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd()
    while (this.peek()?.type === '||') {
      this.advance()
      const right = this.parseAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    return left
  }

  private parseAnd(): ASTNode {
    let left = this.parseComparison()
    while (this.peek()?.type === '&&') {
      this.advance()
      const right = this.parseComparison()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  private parseComparison(): ASTNode {
    let left = this.parseUnary()
    while (
      this.peek()?.type === '==' ||
      this.peek()?.type === '!=' ||
      this.peek()?.type === '>' ||
      this.peek()?.type === '<' ||
      this.peek()?.type === '>=' ||
      this.peek()?.type === '<='
    ) {
      const op = this.advance()?.type as string
      const right = this.parseUnary()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseUnary(): ASTNode {
    if (this.peek()?.type === '!') {
      this.advance()
      const operand = this.parseUnary()
      return { kind: 'unary', op: '!', operand }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary()
    while (true) {
      if (this.peek()?.type === '.') {
        this.advance()
        const prop = this.expect('ident').value
        node = { kind: 'access', object: node, property: prop }
      } else if (this.peek()?.type === '[') {
        this.advance()
        const index = this.parseTernary()
        this.expect(']')
        node = { kind: 'index', object: node, index }
      } else {
        break
      }
    }
    return node
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek()
    if (!tok) throw new EngineError('Unexpected end of expression')
    if (tok.type === 'number') {
      this.advance()
      return { kind: 'literal', value: tok.value }
    }
    if (tok.type === 'string') {
      this.advance()
      return { kind: 'literal', value: tok.value }
    }
    if (tok.type === 'boolean') {
      this.advance()
      return { kind: 'literal', value: tok.value }
    }
    if (tok.type === 'ident') {
      this.advance()
      if (tok.value === 'null') return { kind: 'literal', value: null }
      if (tok.value === 'undefined') return { kind: 'literal', value: undefined }
      return { kind: 'ident', name: tok.value }
    }
    if (tok.type === '(') {
      this.advance()
      const node = this.parseTernary()
      this.expect(')')
      return node
    }
    throw new EngineError(`Unexpected token: ${String(tok.type)}`)
  }
}

// ── Evaluator ──────────────────────────────────────────────────────────

function _resolvePath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function evaluate(node: ASTNode, vars: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value
    case 'ident':
      return vars[node.name]
    case 'access': {
      const obj = evaluate(node.object, vars)
      if (obj == null) return undefined
      if (typeof obj !== 'object') return undefined
      return (obj as Record<string, unknown>)[node.property]
    }
    case 'index': {
      const obj = evaluate(node.object, vars)
      const idx = evaluate(node.index, vars)
      if (obj == null) return undefined
      if (typeof obj === 'string') return (obj as string)[idx as number]
      if (Array.isArray(obj)) return obj[idx as number]
      if (typeof obj === 'object') return (obj as Record<string, unknown>)[String(idx)]
      return undefined
    }
    case 'unary': {
      const val = evaluate(node.operand, vars)
      if (node.op === '!') return !val
      if (node.op === '-') return -(val as number)
      return undefined
    }
    case 'binary': {
      const left = evaluate(node.left, vars)
      const right = evaluate(node.right, vars)
      switch (node.op) {
        case '==':
          return left === right || left === right
        case '!=':
          return left !== right && left !== right
        case '>':
          return (left as number) > (right as number)
        case '<':
          return (left as number) < (right as number)
        case '>=':
          return (left as number) >= (right as number)
        case '<=':
          return (left as number) <= (right as number)
        case '&&':
          return Boolean(left) && Boolean(right)
        case '||':
          return Boolean(left) || Boolean(right)
        default:
          return undefined
      }
    }
    case 'ternary': {
      const cond = evaluate(node.condition, vars)
      return cond ? evaluate(node.consequent, vars) : evaluate(node.alternate, vars)
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Safely evaluate a workflow DSL expression without `new Function()`.
 * Supports: property access (a.b.c), array index (a[0]), comparisons (==, !=, >, <, >=, <=),
 * logical operators (&&, ||, !), ternary (a ? b : c), string/number/boolean literals.
 *
 * Throws EngineError on parse failure. Returns false on evaluation error.
 */
export function safeEval(expr: string, vars: Record<string, unknown>): boolean {
  try {
    const tokens = tokenize(expr)
    const parser = new Parser(tokens)
    const ast = parser.parse()
    const result = evaluate(ast, vars)
    return Boolean(result)
  } catch {
    return false
  }
}

/**
 * Compile an expression string into a reusable evaluation function.
 * Replacement for the `new Function('vars', ...)` pattern.
 */
export function compileExpression(expr: string): (vars: Record<string, unknown>) => boolean {
  const tokens = tokenize(expr)
  const parser = new Parser(tokens)
  const ast = parser.parse()
  return (vars: Record<string, unknown>) => Boolean(evaluate(ast, vars))
}

/**
 * Safe alternative to `new Function()` for plugin migration scripts.
 * Instead of arbitrary code execution, runs a structured migration DSL:
 * - `addColumn(table, column, type)` — add a column
 * - `dropColumn(table, column)` — drop a column
 * - `renameTable(old, new)` — rename a table
 * This is intentionally limited — plugin authors must express migrations
 * through the DSL, not raw SQL/JS.
 */
export interface MigrationStep {
  action: 'addColumn' | 'dropColumn' | 'renameTable'
  table?: string
  column?: string
  type?: string
  newName?: string
}

export function parseMigrationScript(script: string): MigrationStep[] {
  const steps: MigrationStep[] = []
  const lines = script
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
  for (const line of lines) {
    const addMatch = line.match(
      /^addColumn\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*\)/,
    )
    if (addMatch) {
      steps.push({
        action: 'addColumn',
        table: addMatch[1],
        column: addMatch[2],
        type: addMatch[3],
      })
      continue
    }
    const dropMatch = line.match(/^dropColumn\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*\)/)
    if (dropMatch) {
      steps.push({ action: 'dropColumn', table: dropMatch[1], column: dropMatch[2] })
      continue
    }
    const renameMatch = line.match(/^renameTable\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*\)/)
    if (renameMatch) {
      steps.push({ action: 'renameTable', table: renameMatch[1], newName: renameMatch[2] })
      continue
    }
    throw new EngineError(`Unknown migration step: ${line}`)
  }
  return steps
}
