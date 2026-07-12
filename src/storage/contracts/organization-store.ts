// src/storage/contracts/organization-store.ts
// OrganizationStore — persistence contract for ConversationOrganizer.

export interface Project {
  id: string
  name: string
  description: string
  createdAt: number
}

export interface Topic {
  id: string
  name: string
  description: string
  projectId: string | null
  createdAt: number
}

export interface ConversationTreeNode {
  id: string
  name: string
  type: 'project' | 'topic' | 'conversation'
  children: ConversationTreeNode[]
}

export interface OrganizationStore {
  createProject(project: Project): Promise<void>
  createTopic(topic: Topic): Promise<void>
  getProjects(): Promise<Project[]>
  getTopics(projectId?: string): Promise<Topic[]>
  assignConversationToProject(conversationId: string, projectId: string): Promise<void>
  assignConversationToTopic(conversationId: string, topicId: string): Promise<void>
  getConversationsByProject(projectId: string): Promise<Array<{ id: string; title: string | null }>>
  getConversationsByTopic(topicId: string): Promise<Array<{ id: string; title: string | null }>>
}
