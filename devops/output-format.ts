/**
 * devops/output-format.ts
 * Shared structured output formatter. Every devops CLI command that produces
 * structured data should call formatOutput() so that `--json` and `--out=<path>`
 * work uniformly. This eliminates truncation, PowerShell banner leakage, and
 * ad-hoc JSON serialization.
 *
 * Usage:
 *   const data = { provider, protocol, selectors }
 *   formatOutput(data, process.argv.slice(2))
 *     → --json: writes clean JSON to stdout
 *     → --out=x.json: writes JSON to file + human-readable to stdout
 *     → default: writes human-readable to stdout
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface OutputOptions {
  json: boolean
  out: string | null
}

export function parseOutputOptions(args: string[]): OutputOptions {
  const json = args.includes('--json')
  const outIdx = args.findIndex((a) => a.startsWith('--out='))
  const out = outIdx >= 0 ? args[outIdx].slice('--out='.length) : null
  return { json, out }
}

export function formatOutput(data: unknown, args: string[]): void {
  const { json, out } = parseOutputOptions(args)

  const jsonStr = JSON.stringify(data, null, 2)

  if (json) {
    // --json: ONLY write JSON to stdout, nothing else
    console.log(jsonStr)
    return
  }

  if (out) {
    // --out=<path>: write JSON to file, print human-readable
    const resolved = join(process.cwd(), out)
    writeFileSync(resolved, jsonStr, 'utf8')
    console.log(typeof data === 'object' && data !== null ? humanReadable(data as Record<string, unknown>) : `${data}`)
    return
  }

  // Default: human-readable
  console.log(typeof data === 'object' && data !== null ? humanReadable(data as Record<string, unknown>) : `${data}`)
}

function humanReadable(data: Record<string, unknown>, indent = ''): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      if (value.length <= 5 && value.every((v) => typeof v === 'string')) {
        lines.push(`${indent}${key}: ${value.join(', ')}`)
      } else if (typeof value[0] === 'object') {
        lines.push(`${indent}${key}:`)
        for (const item of value) {
          lines.push(humanReadable(item as Record<string, unknown>, indent + '  '))
        }
      } else {
        lines.push(`${indent}${key}: ${value.length} item(s)`)
      }
    } else if (typeof value === 'object') {
      lines.push(`${indent}${key}:`)
      lines.push(humanReadable(value as Record<string, unknown>, indent + '  '))
    } else {
      lines.push(`${indent}${key}: ${value}`)
    }
  }
  return lines.join('\n')
}

/**
 * Strip ANSI / banner lines from a JSON output string.
 * Useful when capturing output that may have leaked banners.
 */
export function tryParseJson(raw: string): unknown {
  // Find first { or [ after stripping banners
  const jsonStart = raw.search(/[\[{]/)
  if (jsonStart < 0) return null
  try {
    return JSON.parse(raw.slice(jsonStart))
  } catch {
    return null
  }
}
