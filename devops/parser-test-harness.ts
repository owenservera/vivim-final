// devops/parser-test-harness.ts
// ParserTestHarness — executes a generated seed parser (`logic_code`) against a
// captured raw body and reports pass/fail + edge cases. The parser is compiled in
// a function scope with an injected `exports` object so `exports.default = {...}`
// assignments resolve (Governor Canon-safe: pure JS, no CDP).

export interface ParserTestResult {
  passed: boolean
  blocks: number
  reason?: string
  edgeCases: string[]
}

export interface ParserUnderTest {
  /** The `logic_code` string from a seed parser. Must define parse/detectCompletion/getConfidence. */
  logicCode: string
}

interface CompiledParser {
  parse: (raw: string) => unknown[]
  detectCompletion: (raw: string) => boolean
  getConfidence: (raw: string) => number
}

/**
 * Compile a seed `logic_code` string into a runnable parser object.
 * Injects a local `exports` so `exports.default = {...}` assignments resolve.
 */
export function compileParser(logicCode: string): CompiledParser {
  type ModuleShape = { default?: unknown }
  // biome-ignore lint: harness compiles trusted, generated parser code
  // Seed parsers assign `module.exports.default`; inject both `module` and
  // `exports` so the CommonJS-style assignment resolves (mirrors
  // StreamParserEngine.loadInlineParser).
  const factory = new Function('module', 'exports', `"use strict";\n${logicCode}`) as (
    module: ModuleShape & { exports: ModuleShape },
    exports: ModuleShape,
  ) => void
  const exportsObj: ModuleShape = {}
  const moduleObj: ModuleShape & { exports: ModuleShape } = { exports: exportsObj }
  factory(moduleObj, exportsObj)
  const mod = moduleObj.default ?? exportsObj.default
  if (!mod || typeof (mod as { parse?: unknown }).parse !== 'function') {
    throw new Error('parser logic_code did not produce a parse function')
  }
  const m = mod as {
    parse: (raw: string) => unknown[]
    detectCompletion?: (raw: string) => boolean
    getConfidence?: (raw: string) => number
  }
  return {
    parse: m.parse,
    detectCompletion: typeof m.detectCompletion === 'function' ? m.detectCompletion : () => false,
    getConfidence: typeof m.getConfidence === 'function' ? m.getConfidence : () => 0,
  }
}

/**
 * Run a parser test against a captured raw body.
 * @param parser     the parser under test (logic_code)
 * @param rawBody    captured streaming response body
 * @param expected   optional assertions (min block count / expected substring)
 */
export function runParserTest(
  parser: ParserUnderTest,
  rawBody: string,
  expected?: { minBlocks?: number; expectedText?: string },
): ParserTestResult {
  const edgeCases: string[] = []
  try {
    const compiled = compileParser(parser.logicCode)
    const blocks = compiled.parse(rawBody)
    const blockCount = Array.isArray(blocks) ? blocks.length : 0

    if (!Array.isArray(blocks)) {
      return { passed: false, blocks: 0, reason: 'parse() did not return an array', edgeCases }
    }

    if (rawBody.trim().length === 0) edgeCases.push('empty body')
    if (rawBody.includes('[DONE]') && !compiled.detectCompletion(rawBody)) {
      edgeCases.push('[DONE] present but detectCompletion returned false')
    }
    if (/data:\s*not-json/.test(rawBody)) edgeCases.push('malformed data line handled')

    let passed = true
    let reason: string | undefined
    if (expected?.minBlocks != null && blockCount < expected.minBlocks) {
      passed = false
      reason = `expected >= ${expected.minBlocks} blocks, got ${blockCount}`
    }
    if (expected?.expectedText != null) {
      const allText = blocks
        .filter((b): b is { kind: string; content: string } => !!b && (b as { kind?: unknown }).kind === 'text')
        .map((b) => b.content)
        .join('')
      if (!allText.includes(expected.expectedText)) {
        passed = false
        reason = `expected text "${expected.expectedText}" not found in parsed blocks`
      }
    }

    return { passed, blocks: blockCount, reason, edgeCases }
  } catch (e) {
    return {
      passed: false,
      blocks: 0,
      reason: `parser threw: ${e instanceof Error ? e.message : String(e)}`,
      edgeCases,
    }
  }
}
