import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/notification/seed — seed a few demo notifications */
import { NextResponse } from 'next/server'

export async function POST() {
  const bag = getEngineBag()
  const now = Date.now()
  const seeds = [
    {
      kind: 'hitl' as const,
      priority: 'urgent' as const,
      title: 'Approval needed',
      body: 'Automation "draft-blog" is waiting for human approval at node "Review draft".',
      sourceCapabilityId: 'cap:automation:execute',
      sourceEntityId: 'auto:draft-blog',
    },
    {
      kind: 'completion' as const,
      priority: 'normal' as const,
      title: 'Agent finished',
      body: 'Agent "research-assistant" completed in 4.2s.',
      sourceCapabilityId: 'cap:agent:invoke',
      sourceEntityId: 'agent:research-assistant',
    },
    {
      kind: 'error' as const,
      priority: 'high' as const,
      title: 'Capability failed',
      body: 'cap:media:transcribe failed: MediaBridge timeout after 5000ms.',
      sourceCapabilityId: 'cap:media:transcribe',
    },
    {
      kind: 'mention' as const,
      priority: 'normal' as const,
      title: 'You were mentioned',
      body: 'Maya mentioned you in ws:research: "check this doc?"',
      sourceEntityId: 'doc:welcome-to-vivim',
    },
    {
      kind: 'system' as const,
      priority: 'low' as const,
      title: 'Workspace created',
      body: 'Workspace "Automation Lab" was created from template "DevOps Pipeline".',
      sourceEntityId: 'ws:automation-lab',
    },
    {
      kind: 'info' as const,
      priority: 'low' as const,
      title: 'Daily digest ready',
      body: '5 new docs, 2 completed automations, 1 HITL pending.',
      sourceCapabilityId: 'cap:automation:daily-digest',
    },
  ]
  for (const s of seeds) {
    await bag.notificationEngine.create({
      userId: 'user:demo',
      ...s,
      traceId: `seed-${now.toString(36)}`,
    })
  }
  return NextResponse.json({ ok: true, seeded: seeds.length })
}
