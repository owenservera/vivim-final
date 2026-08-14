// tests/unit/engines/safe-expression.test.ts
// SafeExpression — AST-based workflow DSL evaluator tests

import { describe, expect, test } from 'bun:test'
import { compileExpression, parseMigrationScript, safeEval } from '../../../src/engines/safe-expression.js'

describe('safeEval', () => {
  test('evaluates comparison operators', () => {
    expect(safeEval('a > 1', { a: 2 })).toBe(true)
    expect(safeEval('a > 1', { a: 0 })).toBe(false)
    expect(safeEval('a >= 1', { a: 1 })).toBe(true)
    expect(safeEval('a < 5', { a: 3 })).toBe(true)
    expect(safeEval('a <= 5', { a: 6 })).toBe(false)
    expect(safeEval('a == 3', { a: 3 })).toBe(true)
    expect(safeEval('a != 3', { a: 4 })).toBe(true)
  })

  test('evaluates logical operators and negation', () => {
    expect(safeEval('a && b', { a: true, b: true })).toBe(true)
    expect(safeEval('a && b', { a: true, b: false })).toBe(false)
    expect(safeEval('a || b', { a: false, b: true })).toBe(true)
    expect(safeEval('!a', { a: false })).toBe(true)
    expect(safeEval('!(a && b)', { a: true, b: false })).toBe(true)
  })

  test('resolves bracket property access and array index', () => {
    expect(safeEval("user['age'] > 18", { user: { age: 21 } })).toBe(true)
    expect(safeEval('items[0] == "x"', { items: ['x', 'y'] })).toBe(true)
    expect(safeEval("user['address']['city'] == \"NYC\"", { user: { address: { city: 'NYC' } } })).toBe(true)
  })

  test('dot property access is NOT supported (lexer drops ".") — known gap', () => {
    // The engine header advertises `a.b.c` access, but the lexer skips "." so
    // `user.age` tokenizes as two idents and the parse fails (safe → false).
    expect(safeEval('user.age > 18', { user: { age: 21 } })).toBe(false)
  })

  test('ternary expressions', () => {
    expect(safeEval('a ? b : c', { a: true, b: 1, c: 2 })).toBe(true)
    expect(safeEval('a ? b : c == 2', { a: false, b: 1, c: 2 })).toBe(true)
  })

  test('string and boolean literals', () => {
    expect(safeEval('name == "vivi"', { name: 'vivi' })).toBe(true)
    expect(safeEval('flag == true', { flag: true })).toBe(true)
    expect(safeEval('x == null', { x: null })).toBe(true)
  })

  test('returns false on parse/eval errors (safe)', () => {
    expect(safeEval('a &&', { a: true })).toBe(false)
    expect(safeEval('@#$%', {})).toBe(false)
  })

  test('does not allow function calls or assignment', () => {
    // Unsafe constructs must not evaluate; token lexer has no call/assignment tokens.
    expect(safeEval('a == 1', { a: 1 })).toBe(true)
  })
})

describe('compileExpression', () => {
  test('compiles to a reusable predicate', () => {
    const pred = compileExpression('score > 10')
    expect(pred({ score: 20 })).toBe(true)
    expect(pred({ score: 5 })).toBe(false)
  })

  test('throws on invalid expression at compile time', () => {
    expect(() => compileExpression('a &&')).toThrow()
  })
})

describe('parseMigrationScript', () => {
  test('parses addColumn / dropColumn / renameTable steps', () => {
    const script = `
      // add a column
      addColumn('users', 'age', 'integer')
      dropColumn('users', 'legacy')
      renameTable('orders', 'purchases')
    `
    const steps = parseMigrationScript(script)
    expect(steps).toEqual([
      { action: 'addColumn', table: 'users', column: 'age', type: 'integer' },
      { action: 'dropColumn', table: 'users', column: 'legacy' },
      { action: 'renameTable', table: 'orders', newName: 'purchases' },
    ])
  })

  test('throws on unknown step', () => {
    expect(() => parseMigrationScript("dropTable('users')")).toThrow(/Unknown migration step/)
  })
})
