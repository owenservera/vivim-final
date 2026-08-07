// tests/unit/engines/conversation-organizer.test.ts
// ConversationOrganizer (Unit) — projects/topics tree from a mocked store.

import { describe, expect, it } from 'bun:test'
import { ConversationOrganizer } from '../../../src/engines/conversation-organizer.js'

function makeStore() {
  const projects: any[] = []
  const topics: any[] = []
  const byTopic: any[] = []
  const byProject: any[] = []
  return {
    projects,
    createProject: async (p: any) => {
      projects.push(p)
    },
    createTopic: async (t: any) => {
      topics.push(t)
    },
    assignConversationToProject: async (cId: string, pId: string) => {
      byProject.push({ id: cId, title: `conv-${cId}`, projectId: pId })
    },
    getProjects: async () => projects,
    getTopics: async (pId: string) => topics.filter((t) => t.projectId === pId),
    getConversationsByTopic: async (tId: string) =>
      byTopic.filter((c) => c.topicId === tId).map((c) => ({ id: c.id, title: c.title })),
    getConversationsByProject: async (pId: string) =>
      byProject.filter((c) => c.projectId === pId).map((c) => ({ id: c.id, title: c.title })),
    _topicConv: (id: string, title: string, topicId: string) =>
      byTopic.push({ id, title, topicId }),
    byProject,
    byTopic,
  }
}

describe('ConversationOrganizer', () => {
  it('creates projects and topics', async () => {
    const store = makeStore()
    const org = new ConversationOrganizer(store as any)
    const p = await org.createProject('Work')
    const t = await org.createTopic('Bugs', 'defects', p.id)
    expect(p.name).toBe('Work')
    expect(t.projectId).toBe(p.id)
    expect(store.projects.length).toBe(1)
  })

  it('assigns a conversation to a project', async () => {
    const store = makeStore()
    const org = new ConversationOrganizer(store as any)
    await org.assignToProject('c1', 'p1')
    expect(store.byProject.some((c: any) => c.id === 'c1')).toBe(true)
  })

  it('builds a tree with topics and unassigned conversations', async () => {
    const store = makeStore()
    const org = new ConversationOrganizer(store as any)
    const p = await org.createProject('P1')
    const t = await org.createTopic('T1', undefined, p.id)
    store._topicConv('conv1', 'First', t.id)
    await org.assignToProject('conv2', p.id)

    const tree = await org.getTree()
    expect(tree.length).toBe(1)
    const projectNode = tree[0]
    expect(projectNode).toBeDefined()
    expect(projectNode?.type).toBe('project')
    const topicNodes = projectNode?.children.filter((c: any) => c.type === 'topic')
    const convNodes = projectNode?.children.filter((c: any) => c.type === 'conversation')
    expect(topicNodes.length).toBe(1)
    expect(topicNodes[0]?.children[0]?.id).toBe('conv1')
    expect(convNodes[0]?.id).toBe('conv2')
  })

  it('autoAssignTopic returns null without a search engine', async () => {
    const store = makeStore()
    const org = new ConversationOrganizer(store as any)
    expect(await org.autoAssignTopic('c1')).toBeNull()
  })

  it('autoAssignTopic returns the most common similar conversation id', async () => {
    const store = makeStore()
    const search = {
      search: async () => [
        { type: 'conversation', conversationId: 'cA' },
        { type: 'conversation', conversationId: 'cA' },
        { type: 'conversation', conversationId: 'cB' },
      ],
    }
    const org = new ConversationOrganizer(store as any, search as any)
    expect(await org.autoAssignTopic('cX')).toBe('cA')
  })
})
