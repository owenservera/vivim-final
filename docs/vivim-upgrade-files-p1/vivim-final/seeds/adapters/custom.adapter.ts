// seeds/adapters/custom.adapter.ts
// Custom adapter — generic fallback, identity transform

export default {
  shapeId: 'custom',
  toUniversal(cap: Record<string, unknown>) {
    return cap
  },
  fromUniversal(action: Record<string, unknown>) {
    return action
  },
  projectState(state: Record<string, unknown>) {
    return state
  },
}
