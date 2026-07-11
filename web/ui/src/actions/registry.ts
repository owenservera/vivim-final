import { z } from 'zod'

export interface ActionSpec<TParams extends z.ZodSchema = z.ZodSchema> {
  description: string
  params: TParams
  run: (params: z.infer<TParams>) => Promise<void> | void
}

interface RegisteredAction<TParams extends z.ZodSchema = z.ZodSchema> {
  id: string
  spec: ActionSpec<TParams>
}

const actions = new Map<string, RegisteredAction>()

export const ActionRegistry = {
  register<TParams extends z.ZodSchema>(
    id: string,
    spec: ActionSpec<TParams>
  ): void {
    if (actions.has(id)) {
      throw new Error(`Action ${id} already registered`)
    }
    actions.set(id, { id, spec })
  },

  dispatch<T>(id: string, params: T): Promise<void> {
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