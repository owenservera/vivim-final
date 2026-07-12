// src/engines/adaptive-workspace.ts
// AdaptiveWorkspaceEngine — three workspace modes (chat, expert, agent) with
// progressive panel disclosure.

import type { WorkspaceStore } from '../storage/contracts/workspace-store.js'

// ── Types ───────────────────────────────────────────────────────────────

export type WorkspaceMode = 'chat' | 'expert' | 'agent'

export interface PanelConfig {
  id: string
  name: string
  position: 'left' | 'right' | 'bottom' | 'top'
  visible: boolean
  order: number
  mode: WorkspaceMode
}

// ── Panel configurations per mode ──────────────────────────────────────────

const PANEL_CONFIGS: Record<WorkspaceMode, PanelConfig[]> = {
  chat: [
    { id: 'messages', name: 'Messages', position: 'right', visible: true, order: 1, mode: 'chat' },
    { id: 'composer', name: 'Composer', position: 'bottom', visible: true, order: 2, mode: 'chat' },
  ],
  expert: [
    {
      id: 'messages',
      name: 'Messages',
      position: 'right',
      visible: true,
      order: 1,
      mode: 'expert',
    },
    {
      id: 'composer',
      name: 'Composer',
      position: 'bottom',
      visible: true,
      order: 2,
      mode: 'expert',
    },
    {
      id: 'context',
      name: 'Context Panel',
      position: 'left',
      visible: true,
      order: 3,
      mode: 'expert',
    },
    { id: 'memory', name: 'Memory', position: 'right', visible: true, order: 4, mode: 'expert' },
  ],
  agent: [
    { id: 'messages', name: 'Messages', position: 'right', visible: true, order: 1, mode: 'agent' },
    {
      id: 'composer',
      name: 'Composer',
      position: 'bottom',
      visible: true,
      order: 2,
      mode: 'agent',
    },
    {
      id: 'context',
      name: 'Context Panel',
      position: 'left',
      visible: true,
      order: 3,
      mode: 'agent',
    },
    { id: 'memory', name: 'Memory', position: 'right', visible: true, order: 4, mode: 'agent' },
    {
      id: 'capabilities',
      name: 'Capabilities',
      position: 'left',
      visible: true,
      order: 5,
      mode: 'agent',
    },
    {
      id: 'workflows',
      name: 'Workflows',
      position: 'bottom',
      visible: true,
      order: 6,
      mode: 'agent',
    },
    {
      id: 'autonomous',
      name: 'Autonomous Agent',
      position: 'right',
      visible: true,
      order: 7,
      mode: 'agent',
    },
  ],
}

// Promotion thresholds
const PROMOTION_THRESHOLDS: Record<WorkspaceMode, { messages: number; capabilities: number }> = {
  chat: { messages: 20, capabilities: 3 },
  expert: { messages: 50, capabilities: 10 },
  agent: { messages: Number.POSITIVE_INFINITY, capabilities: Number.POSITIVE_INFINITY },
}

// ── AdaptiveWorkspaceEngine ──────────────────────────────────────────────

export class AdaptiveWorkspaceEngine {
  constructor(private store: WorkspaceStore) {}

  async getMode(userId: string): Promise<WorkspaceMode> {
    const mode = await this.store.getMode(userId)
    return (mode as WorkspaceMode) ?? 'chat'
  }

  async setMode(userId: string, mode: WorkspaceMode): Promise<void> {
    await this.store.setMode(userId, mode)
  }

  async checkPromotion(userId: string): Promise<WorkspaceMode | null> {
    const currentMode = await this.getMode(userId)
    const stats = await this.store.getUserStats(userId)
    const threshold = PROMOTION_THRESHOLDS[currentMode]

    if (!threshold) return null

    if (
      currentMode === 'chat' &&
      stats.messageCount >= threshold.messages &&
      stats.capabilityCount >= threshold.capabilities
    ) {
      return 'expert'
    }

    if (
      currentMode === 'expert' &&
      stats.messageCount >= threshold.messages &&
      stats.capabilityCount >= threshold.capabilities
    ) {
      return 'agent'
    }

    return null
  }

  async getPanelConfig(mode: WorkspaceMode): Promise<PanelConfig[]> {
    return PANEL_CONFIGS[mode] ?? PANEL_CONFIGS.chat
  }
}
