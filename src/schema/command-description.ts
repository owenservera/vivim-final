// ─── Command Description Zod Schema ─────────────────────────────────
// Validation for CommandDescription model data.

import { z } from 'zod'

/**
 * Zod schema for CommandDescription validation.
 */
export const CommandDescriptionSchema = z.object({
  id: z.string(),
  commandId: z.string().min(1),
  description: z.string().min(1),
  patterns: z.array(z.string().min(1)).min(1),
  category: z.string().min(1),
  prefix: z.string().nullable(),
  confidence: z.number().min(0).max(1).default(0.7),
  enabled: z.boolean().default(true),
})

export type CommandDescriptionInput = z.infer<typeof CommandDescriptionSchema>

/**
 * Validate a CommandDescription input.
 */
export function validateCommandDescription(
  input: unknown,
): { success: true; data: CommandDescriptionInput } | { success: false; error: string } {
  const result = CommandDescriptionSchema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error.errors.map((e) => e.message).join(', '),
  }
}
