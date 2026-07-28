// tests/unit/engines/workspace-presets.test.ts
// Unit 4.2 — Workspace default layouts + presets

import { describe, expect, it } from 'bun:test'
import { WorkspacePresets } from '../../../src/engines/workspace-presets.js'
import type { WorkspaceLayoutRow } from '../../../src/engines/workspace-presets.js'

class MockManager {
  layouts = new Map<string, WorkspaceLayoutRow>()
  lastSetPanelCount = 0

  async setLayout(userId: string, panels: WorkspaceLayoutRow['panels'], name: string) {
    const layout: WorkspaceLayoutRow = {
      id: `layout:${userId}:${name}`,
      userId,
      name,
      panels,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.layouts.set(layout.id, layout)
    this.lastSetPanelCount = panels.length
    return layout
  }
  async getLayout() {
    return null
  }
}

class MockSpawner {
  spawns: string[] = []
  async spawn(opts: { definitionId: string }) {
    this.spawns.push(opts.definitionId)
    return { canvasId: `canvas:${opts.definitionId}` }
  }
}

describe('WorkspacePresets', () => {
  it('list() returns the 5 preset ids', () => {
    const presets = new WorkspacePresets(new MockManager(), new MockSpawner())
    expect(presets.list()).toEqual([
      'chat',
      'dual',
      'dashboard',
      'agent-monitor',
      'memory-workbench',
    ])
  })

  it('apply(userId, chat) → layout with one conversation-list builtin panel', async () => {
    const mgr = new MockManager()
    const presets = new WorkspacePresets(mgr, new MockSpawner())
    const layout = await presets.apply('u1', 'chat')
    expect(mgr.lastSetPanelCount).toBe(1)
    expect(layout.panels[0]!.kind).toBe('builtin')
    expect((layout.panels[0] as any).builtinSurfaceId).toBe('conversation-list')
  })

  it('apply(userId, dual) → spawns 2 canvases and references their canvasInstanceId', async () => {
    const mgr = new MockManager()
    const spawner = new MockSpawner()
    const presets = new WorkspacePresets(mgr, spawner)
    const layout = await presets.apply('u1', 'dual')
    expect(mgr.lastSetPanelCount).toBe(2)
    expect(spawner.spawns).toContain('cv:system:chat-pane')
    expect(spawner.spawns).toContain('cv:system:markdown-viewer')
    for (const p of layout.panels) {
      if (p.kind === 'canvas') {
        expect(typeof p.canvasInstanceId).toBe('string')
      }
    }
  })

  it('ensureDefault with no layout → applies chat', async () => {
    const mgr = new MockManager()
    const presets = new WorkspacePresets(mgr, new MockSpawner())
    const layout = await presets.ensureDefault('u1', null)
    expect(layout.panels.length).toBe(1)
  })

  it('ensureDefault with existing panels → no spawn, returns as-is', async () => {
    const existing: WorkspaceLayoutRow = {
      id: 'existing',
      userId: 'u1',
      name: 'default',
      panels: [{ kind: 'builtin', builtinSurfaceId: 'something' }],
      createdAt: 0,
      updatedAt: 0,
    }
    const presets = new WorkspacePresets(new MockManager(), new MockSpawner())
    const layout = await presets.ensureDefault('u1', existing)
    // Should return the existing layout unchanged
    expect(layout.id).toBe('existing')
  })
})
