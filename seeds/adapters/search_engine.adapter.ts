// seeds/adapters/search_engine.adapter.ts
// Search engine adapter — transforms search-specific capabilities to universal contract

export default {
  shapeId: 'search_engine',
  toUniversal(cap: Record<string, unknown>) {
    if (cap.type === 'search') {
      return { ...cap, uiComponent: 'text_input', uiPosition: 'composer' }
    }
    return cap
  },
  fromUniversal(action: Record<string, unknown>) {
    if (action.slug === 'send_message') {
      return { ...action, type: 'search_query' }
    }
    return action
  },
  projectState(rawState: Record<string, unknown>) {
    return {
      composerValue: rawState.searchQuery ?? '',
      resultCount: Array.isArray(rawState.results) ? rawState.results.length : 0,
    }
  },
}
