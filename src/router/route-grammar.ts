/**
 * @module router/route-grammar
 *
 * Route spec grammar parser — parses CLI strings like "claude,gemini"
 * or "@all -chatgpt" into a structured RouteSpec AST.
 *
 * Harvested from edge-pwa capabilit-lab route grammar.
 * Provider-agnostic: validates providers against a registry callback.
 */

// ── Types ────────────────────────────────────────────────────────

export interface RouteTarget {
  provider: string
  account?: string
}

export type RouteSpecKind = 'single' | 'list' | 'preset' | 'diff'

export interface SingleRouteSpec {
  kind: 'single'
  provider: string
  account?: string
}

export interface ListRouteSpec {
  kind: 'list'
  targets: RouteTarget[]
}

export interface PresetRouteSpec {
  kind: 'preset'
  name: string
}

export interface DiffRouteSpec {
  kind: 'diff'
  include: RouteSpec
  exclude: RouteSpec
}

export type RouteSpec = SingleRouteSpec | ListRouteSpec | PresetRouteSpec | DiffRouteSpec

// ── Parser ──────────────────────────────────────────────────────

/** Valid preset names. */
const VALID_PRESETS = ['@all', '@ready', '@needs-auth', '@cold', '@headless'] as const
export type PresetName = (typeof VALID_PRESETS)[number]

/**
 * Parse a route spec string into a RouteSpec AST.
 *
 * @example
 * parseRouteSpec('claude')             → { kind: 'single', provider: 'claude' }
 * parseRouteSpec('claude,gemini')     → { kind: 'list', targets: [...] }
 * parseRouteSpec('@ready -chatgpt')  → { kind: 'diff', ... }
 *
 * @param input         The route spec string to parse.
 * @param validProvider Optional validator; defaults to allowing any provider name.
 * @throws {Error} If the string is malformed or contains an unknown preset.
 */
export function parseRouteSpec(
  input: string,
  validProvider?: (name: string) => boolean,
): RouteSpec {
  const trimmed = input.trim()

  // Check for set difference (exclude) FIRST — before preset check.
  const diffIndex = findDiffOperator(trimmed)
  if (diffIndex !== -1) {
    return parseDiff(trimmed, diffIndex, validProvider)
  }

  // Check for preset
  if (trimmed.startsWith('@')) {
    return parsePreset(trimmed)
  }

  return parseSingleOrList(trimmed, validProvider)
}

/**
 * Stringify a RouteSpec back to a canonical string.
 */
export function stringifyRouteSpec(spec: RouteSpec): string {
  switch (spec.kind) {
    case 'single':
      return spec.account ? `${spec.provider}:${spec.account}` : spec.provider
    case 'list':
      return spec.targets
        .map((t) => (t.account ? `${t.provider}:${t.account}` : t.provider))
        .join(',')
    case 'preset':
      return spec.name
    case 'diff':
      return `(${stringifyRouteSpec(spec.include)}) - (${stringifyRouteSpec(spec.exclude)})`
  }
}

// ── Internal ────────────────────────────────────────────────────

function parsePreset(input: string): PresetRouteSpec {
  if (!VALID_PRESETS.includes(input as PresetName)) {
    throw new Error(`Unknown preset: "${input}". Valid presets: ${VALID_PRESETS.join(', ')}`)
  }
  return { kind: 'preset', name: input as PresetName }
}

function findDiffOperator(input: string): number {
  let depth = 0
  let foundIndex = -1
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++
    if (input[i] === ')') depth--
    if (depth === 0 && input[i] === '-') {
      const left = input[i - 1] ?? ''
      const right = input[i + 1] ?? ''
      if (/\s/.test(left) || /\s/.test(right)) {
        foundIndex = i
      }
    }
  }
  return foundIndex
}

function parseDiff(
  input: string,
  diffIndex: number,
  validProvider?: (name: string) => boolean,
): DiffRouteSpec {
  const leftStr = input.slice(0, diffIndex).trim()
  const rightStr = input.slice(diffIndex + 1).trim()
  return {
    kind: 'diff',
    include: parseRouteSpec(leftStr, validProvider),
    exclude: parseRouteSpec(rightStr, validProvider),
  }
}

function parseSingleOrList(input: string, validProvider?: (name: string) => boolean): RouteSpec {
  if (input.startsWith('(') && input.endsWith(')')) {
    return parseRouteSpec(input.slice(1, -1), validProvider)
  }
  const parts = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new Error(`Empty route spec: "${input}"`)
  if (parts.length === 1) {
    const target = parseSingleTarget(parts[0]!, validProvider)
    return { kind: 'single', ...target }
  }
  return {
    kind: 'list',
    targets: parts.map((p) => parseSingleTarget(p, validProvider)),
  }
}

function parseSingleTarget(input: string, validProvider?: (name: string) => boolean): RouteTarget {
  const colonIndex = input.indexOf(':')
  if (colonIndex === -1) {
    const provider = input
    if (validProvider && !validProvider(provider)) {
      throw new Error(`Unknown provider: "${provider}"`)
    }
    return { provider }
  }
  const provider = input.slice(0, colonIndex)
  const accountPart = input.slice(colonIndex + 1)
  if (validProvider && !validProvider(provider)) {
    throw new Error(`Unknown provider: "${provider}"`)
  }
  if (!accountPart) {
    throw new Error(`Account ID cannot be empty. Use "${provider}" for default.`)
  }
  return { provider, account: accountPart }
}
