import { type CommandLanguageError, InvalidArgError, MissingArgsError } from '../../errors.js'
import type { ArgSpec, CommandContext } from './types.js'

type Result<T, E = CommandLanguageError> = { ok: true; value: T } | { ok: false; error: E }

/**
 * Validate raw args against an ArgSpec list.
 * Applies defaults, validates choices, runs custom validation.
 */
export function validateArgs(
  specs: ArgSpec[],
  raw: Record<string, unknown>,
  ctx: CommandContext,
): Result<Record<string, unknown>> {
  const validated: Record<string, unknown> = {}
  const missing: string[] = []

  for (const spec of specs) {
    const rawValue = raw[spec.name]

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (spec.required) {
        missing.push(spec.name)
        continue
      }

      // Apply default
      if (spec.default) {
        const defaultVal = typeof spec.default === 'function' ? spec.default(ctx) : spec.default
        if (defaultVal !== null && defaultVal !== undefined) {
          validated[spec.name] = defaultVal
        }
        continue
      }

      // Optional with no default — skip
      continue
    }

    const strValue = String(rawValue)

    // Choice validation
    if (spec.kind === 'choice' && spec.options) {
      const validValues = spec.options.map((o) => o.value)
      if (!validValues.includes(strValue)) {
        return {
          ok: false,
          error: new InvalidArgError(
            spec.name,
            strValue,
            `Must be one of: ${validValues.join(', ')}`,
          ),
        }
      }
    }

    // Custom validation
    if (spec.validation) {
      const error = spec.validation(strValue)
      if (error) {
        return {
          ok: false,
          error: new InvalidArgError(spec.name, strValue, error),
        }
      }
    }

    validated[spec.name] = strValue
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: new MissingArgsError('unknown', missing),
    }
  }

  return { ok: true, value: validated }
}

/**
 * Get suggestions for a specific arg.
 */
export async function getArgSuggestions(
  spec: ArgSpec,
  query: string,
  ctx: CommandContext,
): Promise<Array<{ value: string; label: string }>> {
  if (spec.suggestions) {
    const suggestions = await spec.suggestions(query, ctx)
    return suggestions.map((s) => ({ value: s.id, label: s.label }))
  }

  if (spec.options) {
    return spec.options.filter(
      (o) =>
        o.value.toLowerCase().includes(query.toLowerCase()) ||
        o.label.toLowerCase().includes(query.toLowerCase()),
    )
  }

  return []
}
