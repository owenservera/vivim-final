// src/schema/event.ts
// Calendar event, reminder, and location node types.

import { z } from 'zod'

// ── EventNode (cap-store.event) ────────────────────────────────────────────
// Calendar events with attendees, recurrence, location.

export interface EventData {
  title: string
  description?: string
  startAt: number
  endAt: number
  allDay?: boolean
  timezone?: string
  location?: string
  locationNodeId?: string
  virtualMeetingUrl?: string
  attendees?: Array<{
    name?: string
    email?: string
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'pending'
  }>
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number
    endAt?: number
    count?: number
    daysOfWeek?: number[]
  }
  recurrenceId?: string
  organizer?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  source?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export const AttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  responseStatus: z.enum(['accepted', 'declined', 'tentative', 'pending']).optional(),
})

export const EventDataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startAt: z.number(),
  endAt: z.number(),
  allDay: z.boolean().optional(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  locationNodeId: z.string().optional(),
  virtualMeetingUrl: z.string().optional(),
  attendees: z.array(AttendeeSchema).optional(),
  recurrence: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      interval: z.number().int().positive().optional(),
      endAt: z.number().optional(),
      count: z.number().int().positive().optional(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
  recurrenceId: z.string().optional(),
  organizer: z.string().optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── ReminderNode (cap-store.reminder) ──────────────────────────────────────

export interface ReminderData {
  title: string
  note?: string
  dueAt?: number
  triggeredAt?: number
  completedAt?: number
  snoozedUntil?: number
  priority: 'none' | 'low' | 'medium' | 'high'
  sourceNodeId?: string
  sourceType?: string
  createdAt: number
}

export const ReminderDataSchema = z.object({
  title: z.string(),
  note: z.string().optional(),
  dueAt: z.number().optional(),
  triggeredAt: z.number().optional(),
  completedAt: z.number().optional(),
  snoozedUntil: z.number().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high']),
  sourceNodeId: z.string().optional(),
  sourceType: z.string().optional(),
  createdAt: z.number(),
})

// ── LocationNode (cap-store.location) ──────────────────────────────────────

export interface LocationData {
  name?: string
  address?: string
  latitude?: number
  longitude?: number
  placeId?: string
  mapUrl?: string
  phone?: string
  website?: string
  categories?: string[]
  notes?: string
  tags?: string[]
  createdAt: number
}

export const LocationDataSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
  mapUrl: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  categories: z.array(z.string()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const eventNodeSchema = {
  type: 'cap-store.event' as const,
  version: 1,
  schema: EventDataSchema,
  indexContent: (data: EventData) =>
    `${data.title} ${data.description ?? ''} ${data.location ?? ''} ${data.attendees?.map((a) => a.name ?? '').join(' ') ?? ''}`,
  embeddingText: (data: EventData) => `${data.title} ${data.description ?? ''}`,
}

export const reminderNodeSchema = {
  type: 'cap-store.reminder' as const,
  version: 1,
  schema: ReminderDataSchema,
  indexContent: (data: ReminderData) => `${data.title} ${data.note ?? ''}`,
  embeddingText: (data: ReminderData) => data.title,
}

export const locationNodeSchema = {
  type: 'cap-store.location' as const,
  version: 1,
  schema: LocationDataSchema,
  indexContent: (data: LocationData) =>
    `${data.name ?? ''} ${data.address ?? ''} ${data.categories?.join(' ') ?? ''}`,
  embeddingText: (data: LocationData) => data.name ?? data.address ?? '',
}
