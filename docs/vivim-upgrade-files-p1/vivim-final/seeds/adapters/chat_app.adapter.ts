// seeds/adapters/chat_app.adapter.ts
// Chat app adapter — identity adapter (chat apps already use universal contract)

export default {
  shapeId: 'chat_app',
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
