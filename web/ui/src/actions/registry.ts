import { z } from 'zod'

export interface ActionSpec<TParams extends z.ZodSchema = z.ZodSchema> {
  description: string
  params: TParams
  run: (params: z.infer<TParams>) => Promise<unknown> | void
}

interface RegisteredAction {
  id: string
  spec: ActionSpec
}

const actions = new Map<string, RegisteredAction>()

export const ActionRegistry = {
  register<TParams extends z.ZodSchema>(
    id: string,
    spec: ActionSpec<TParams>
  ): void {
    // Idempotent upsert (Unit 24.9): auto-population may re-run on every
    // mount, and the same capability can be re-registered safely.
    actions.set(id, { id, spec: spec as unknown as ActionSpec })
  },

  async dispatch(id: string, params: unknown): Promise<unknown> {
    const action = actions.get(id)
    if (!action) {
      throw new Error(`Action ${id} not found. Available actions: ${ActionRegistry.list().join(', ')}`)
    }
    const validated = action.spec.params.parse(params)
    return Promise.resolve(action.spec.run(validated))
  },

  getAction(id: string): RegisteredAction | undefined {
    return actions.get(id)
  },

  list(): string[] {
    return [...actions.keys()]
  },

  listWithMetadata(): Array<{ id: string; description: string }> {
    return [...actions.entries()].map(([id, action]) => ({
      id,
      description: action.spec.description,
    }))
  },
}