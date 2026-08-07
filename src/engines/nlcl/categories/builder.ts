// src/engines/nlcl/categories/builder.ts
// Shared command-pattern builder. This is the ONLY place the default command
// data flows through when a category file is read — keeping every category a
// pure data module with a single, uniform construction path.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'

/** Build a CommandPattern from a category file's opts. */
export function pattern(
  id: string,
  intent: string,
  description: string,
  opts: {
    patterns: CommandPattern['patterns']
    aliases?: string[]
    examples?: string[]
    inputSchema?: z.ZodSchema
    outputSchema?: z.ZodSchema
    executor: CommandPattern['executor']
    category: string
    surfaces?: CommandPattern['surfaces']
    requiresConfirmation?: boolean
    classification?: CommandPattern['classification']
    aiFallback?: boolean
    tags?: string[]
    execute: CommandPattern['execute']
    capabilityId?: string
  },
): CommandPattern {
  return {
    id,
    intent,
    description,
    patterns: opts.patterns,
    aliases: opts.aliases ?? [],
    examples: opts.examples ?? [],
    inputSchema: opts.inputSchema ?? z.object({}).passthrough(),
    outputSchema: opts.outputSchema ?? z.unknown(),
    executor: opts.executor,
    execute: opts.execute,
    category: opts.category,
    surfaces: opts.surfaces ?? ['cli', 'ui', 'frontend', 'mcp', 'api'],
    requiresConfirmation: opts.requiresConfirmation ?? false,
    classification: opts.classification ?? 'read',
    aiFallback: opts.aiFallback ?? false,
    tags: opts.tags ?? [],
    capabilityId: opts.capabilityId,
  }
}

// ── Shared helper functions (used by category files) ─────────────────────

export function extractEmails(text: string): string[] {
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
  const matches = text.match(emailRegex)
  return matches ?? []
}

export function dayToCron(day: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIdx = days.indexOf(day.toLowerCase())
  if (dayIdx >= 0) {
    return `0 9 * * ${dayIdx}`
  }
  if (day === 'day') return '0 9 * * *'
  if (day === 'hour') return '0 * * * *'
  return '0 9 * * *'
}
