// seeds/adapters/coding_ide.adapter.ts
// Coding IDE adapter — transforms IDE-specific capabilities to universal contract

export default {
  shapeId: 'coding_ide',
  toUniversal(cap: Record<string, unknown>) {
    if (cap.type === 'run_code') {
      return { ...cap, uiComponent: 'action_button', uiPosition: 'header' }
    }
    return cap
  },
  fromUniversal(action: Record<string, unknown>) {
    if (action.slug === 'send_message') {
      return { ...action, type: 'execute_in_terminal' }
    }
    return action
  },
  projectState(rawState: Record<string, unknown>) {
    return {
      composerValue: rawState.editorContent ?? '',
      activeFile: rawState.filePath ?? null,
      isRunning: rawState.isExecuting ?? false,
    }
  },
}
