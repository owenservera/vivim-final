// src/schema/task.ts
// Task and project node types for the second brain.

import { z } from 'zod'

// ── TaskNode (cap-store.task) ─────────────────────────────────────────────
// Action items, todos, reminders, follow-ups.

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'deferred'

export interface TaskData {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  dueAt?: number
  completedAt?: number
  startAt?: number
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
    interval?: number
    endAt?: number
    daysOfWeek?: number[]
  }
  assignee?: string
  tags?: string[]
  parentTaskId?: string
  projectId?: string
  order?: number
  estimatedMinutes?: number
  actualMinutes?: number
  source?: string
  createdAt: number
  updatedAt: number
}

export const TaskDataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'cancelled', 'deferred']),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  dueAt: z.number().optional(),
  completedAt: z.number().optional(),
  startAt: z.number().optional(),
  recurrence: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
    interval: z.number().int().positive().optional(),
    endAt: z.number().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  }).optional(),
  assignee: z.string().optional(),
  tags: z.array(z.string()).optional(),
  parentTaskId: z.string().optional(),
  projectId: z.string().optional(),
  order: z.number().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  actualMinutes: z.number().int().positive().optional(),
  source: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── ProjectNode (cap-store.project) ────────────────────────────────────────
// Group of related tasks, milestones, deadlines.

export interface ProjectData {
  name: string
  description?: string
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled'
  deadline?: number
  startAt?: number
  completedAt?: number
  priority: TaskPriority
  tags?: string[]
  members?: string[]
  taskIds?: string[]
  milestoneIds?: string[]
  milestones?: Array<{
    title: string
    dueAt?: number
    completed?: boolean
    completedAt?: number
  }>
  source?: string
  createdAt: number
  updatedAt: number
}

export const MilestoneSchema = z.object({
  title: z.string(),
  dueAt: z.number().optional(),
  completed: z.boolean().optional(),
  completedAt: z.number().optional(),
})

export const ProjectDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']),
  deadline: z.number().optional(),
  startAt: z.number().optional(),
  completedAt: z.number().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  tags: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional(),
  milestoneIds: z.array(z.string()).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  source: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const taskNodeSchema = {
  type: 'cap-store.task' as const,
  version: 1,
  schema: TaskDataSchema,
  indexContent: (data: TaskData) => `${data.title} ${data.description ?? ''} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: TaskData) => data.title,
}

export const projectNodeSchema = {
  type: 'cap-store.project' as const,
  version: 1,
  schema: ProjectDataSchema,
  indexContent: (data: ProjectData) => `${data.name} ${data.description ?? ''} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: ProjectData) => data.name,
}
