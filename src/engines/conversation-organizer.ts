// src/engines/conversation-organizer.ts
// ConversationOrganizer — organize conversations into projects and topics.

import { newId } from '../ids.js'
import type {
  ConversationTreeNode,
  OrganizationStore,
  Project,
  Topic,
} from '../storage/contracts/organization-store.js'
import type { SemanticSearchEngine } from './semantic-search.js'

// ── ConversationOrganizer ──────────────────────────────────────────────

export class ConversationOrganizer {
  constructor(
    private store: OrganizationStore,
    private search?: SemanticSearchEngine,
  ) {}

  async createProject(name: string, description?: string): Promise<Project> {
    const project: Project = {
      id: newId(),
      name,
      description: description ?? '',
      createdAt: Date.now(),
    }
    await this.store.createProject(project)
    return project
  }

  async createTopic(name: string, description?: string, projectId?: string): Promise<Topic> {
    const topic: Topic = {
      id: newId(),
      name,
      description: description ?? '',
      projectId: projectId ?? null,
      createdAt: Date.now(),
    }
    await this.store.createTopic(topic)
    return topic
  }

  async assignToProject(conversationId: string, projectId: string): Promise<void> {
    await this.store.assignConversationToProject(conversationId, projectId)
  }

  async autoAssignTopic(conversationId: string): Promise<string | null> {
    if (!this.search) return null

    // Search for similar conversations to find their topics
    const results = await this.search.search({
      text: conversationId,
      limit: 5,
    })

    // Find the most common topic from similar conversations
    const topicCounts = new Map<string, number>()
    for (const result of results) {
      if (result.type === 'conversation' && result.conversationId) {
        // In a real implementation, we'd look up the topic for this conversation
        // For now, use the conversation ID as a proxy
        topicCounts.set(result.conversationId, (topicCounts.get(result.conversationId) ?? 0) + 1)
      }
    }

    // Return the most frequent conversation's topic (simplified)
    const sorted = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] ?? null
  }

  async getTree(): Promise<ConversationTreeNode[]> {
    const projects = await this.store.getProjects()
    const tree: ConversationTreeNode[] = []

    for (const project of projects) {
      const topics = await this.store.getTopics(project.id)
      const topicNodes: ConversationTreeNode[] = []

      for (const topic of topics) {
        const conversations = await this.store.getConversationsByTopic(topic.id)
        topicNodes.push({
          id: topic.id,
          name: topic.name,
          type: 'topic',
          children: conversations.map((c) => ({
            id: c.id,
            name: c.title ?? 'Untitled',
            type: 'conversation' as const,
            children: [],
          })),
        })
      }

      // Add unassigned conversations
      const unassigned = await this.store.getConversationsByProject(project.id)
      tree.push({
        id: project.id,
        name: project.name,
        type: 'project',
        children: [
          ...topicNodes,
          ...unassigned.map((c) => ({
            id: c.id,
            name: c.title ?? 'Untitled',
            type: 'conversation' as const,
            children: [],
          })),
        ],
      })
    }

    return tree
  }
}
