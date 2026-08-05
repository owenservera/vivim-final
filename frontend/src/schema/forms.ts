'use client'

import { z } from 'zod'

const emailSchema = z.string().email('Please enter a valid email address')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export type LoginFormData = z.infer<typeof loginSchema>

const portRangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([start, end]) => start <= end, 'Start port must be less than or equal to end port')
  .refine(([start, end]) => start >= 0, 'Start port must be non-negative')
  .refine(([start, end]) => end <= 65535, 'End port must be 65535 or less')

export const workspaceSettingsSchema = z.object({
  workspacePath: z
    .string()
    .min(1, 'Profile directory is required')
    .regex(
      /^[a-zA-Z0-9_\-\/\\. ]+$/,
      'Only alphanumeric characters, dashes, underscores, slashes, dots, and spaces allowed',
    ),
  fleetConfig: z.object({
    portRange: portRangeSchema,
    healthProbeIntervalMs: z
      .number()
      .min(1000, 'Health probe interval must be at least 1000ms')
      .max(300000, 'Health probe interval must be at most 300000ms (5 minutes)'),
    autoRestart: z.boolean(),
    maxRestarts: z
      .number()
      .min(1, 'Max restarts must be at least 1')
      .max(10, 'Max restarts must be at most 10'),
    circuitBreakerThreshold: z
      .number()
      .min(1, 'Circuit breaker threshold must be at least 1')
      .max(20, 'Circuit breaker threshold must be at most 20'),
    circuitBreakerResetMs: z
      .number()
      .min(1000, 'Circuit breaker reset must be at least 1000ms')
      .max(300000, 'Circuit breaker reset must be at most 300000ms (5 minutes)'),
  }),
  chromeConfig: z.object({
    path: z.string().min(0, 'Chrome binary path can be empty or a file path').optional(),
    extraArgs: z.array(z.string()),
    disableGpu: z.boolean(),
  }),
})

export type WorkspaceSettingsFormData = z.infer<typeof workspaceSettingsSchema>
