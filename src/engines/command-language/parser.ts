import type { ParsedCommand, Prefix } from './types.js'
import { isPrefix } from './types.js'

/**
 * Parse user input into a structured ParsedCommand.
 * Detects prefix character, splits tokens, handles quoted strings.
 */
export function parseInput(input: string): ParsedCommand {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return {
      prefix: null,
      command: '',
      rawArgs: '',
      tokens: [],
      isCombo: false,
    }
  }

  const firstChar = trimmed[0] as string
  const prefix = isPrefix(firstChar) ? (firstChar as Prefix) : null

  if (prefix) {
    const rest = trimmed.slice(1).trim()
    const { command, args, tokens } = tokenize(rest)
    return {
      prefix,
      command,
      rawArgs: args,
      tokens,
      isCombo: detectCombo(tokens),
    }
  }

  // No prefix — plain text (NLP route)
  const { command, args, tokens } = tokenize(trimmed)
  return {
    prefix: null,
    command,
    rawArgs: args,
    tokens,
    isCombo: detectComboFromText(trimmed),
  }
}

/**
 * Tokenize a string into command + args, respecting quoted strings.
 */
function tokenize(input: string): { command: string; args: string; tokens: string[] } {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return { command: '', args: '', tokens: [] }
  }

  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const char of trimmed) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false
        tokens.push(current)
        current = ''
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = true
      quoteChar = char
    } else if (char === ' ' || char === '\t') {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  const command = tokens[0] ?? ''
  const args = trimmed.slice(command.length).trim()

  return { command, args, tokens }
}

/**
 * Detect if tokens represent a combo (contains "and", "then", "&", "|").
 */
function detectCombo(tokens: string[]): boolean {
  const comboMarkers = new Set(['and', 'then', '&', '|', ';'])
  return tokens.some((t) => comboMarkers.has(t.toLowerCase()))
}

/**
 * Detect combo from plain text (no prefix).
 */
function detectComboFromText(text: string): boolean {
  const lower = text.toLowerCase()
  const comboPatterns = [/\b(and|then)\b/, /\b(and also|as well as)\b/, /[&|;]/]
  return comboPatterns.some((p) => p.test(lower))
}

/**
 * Extract the first token as a command name (for prefix commands).
 */
export function extractCommandName(input: string): string {
  const parsed = parseInput(input)
  return parsed.command
}

/**
 * Check if input starts with a specific prefix.
 */
export function hasPrefix(input: string, prefix: Prefix): boolean {
  return input.trimStart()[0] === prefix
}
