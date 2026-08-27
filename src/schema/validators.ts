// src/schema/validators.ts
// Zod validators for all write endpoints

import { z } from 'zod'

export const CreateAccountSchema = z.object({ email: z.string().email() })

export const SendMessageSchema = z.object({
  message: z.string().min(1).max(100000),
})

export const CreateConversationSchema = z.object({
  providerId: z.string().min(1),
  title: z.string().max(200).optional(),
})

export const UpdateConversationSchema = z.object({
  title: z.string().max(200).optional(),
  state: z.enum(['active', 'archived', 'deleted']).optional(),
})

export const FleetStartSchema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
})

export const FleetStopSchema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
})

export const ConfigUpdateSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  scopeType: z.enum(['global', 'provider', 'account', 'engine']).optional(),
  scopeId: z.string().optional(),
})

export const RollbackSchema = z.object({
  version: z.number().int().positive(),
})

export const CapabilitySearchSchema = z.object({
  query: z.string().min(1).max(100),
  planTier: z.enum(['free', 'pro', 'max', 'enterprise']).optional(),
})
