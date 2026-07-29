/**
 * lib/prisma-write-guard.ts
 * --------------------------------------------------------------------
 * Write-guard proxy pattern for PrismaClient.
 *
 * Intercepts writes to backend-owned tables and warns in dev mode.
 * This enforces the table ownership boundary:
 *   - Backend-owned: Conversation, Message, Provider, Account, Capability,
 *     CapabilityBinding, StreamBlock, ProviderAccount, LoginState,
 *     TelemetrySpan, WebhookConfig, AlertRule, AlertDelivery, Version
 *   - Frontend-owned: Workspace, AgentNode, AgentNodeEdge, AgentWorkspace,
 *     AgentWorkspaceAgent, AgentWorkspaceNode, AgentWorkspaceConnection,
 *     CanvasWorkspace, MemoryNode, AgentCanvasAuditLog
 *
 * Harvested from lib/db.ts (2026-07-26) — the file had zero consumers
 * but this pattern is valuable for preventing accidental cross-boundary writes.
 *
 * Usage:
 *   import { PrismaClient } from '@prisma/client'
 *   import { withWriteGuard } from '@/lib/prisma-write-guard'
 *   export const db = withWriteGuard(new PrismaClient())
 */

import type { PrismaClient } from '@prisma/client'

const BACKEND_OWNED = new Set([
  'Conversation', 'Message', 'Provider', 'Account',
  'Capability', 'CapabilityBinding', 'StreamBlock', 'ProviderAccount',
  'LoginState', 'TelemetrySpan', 'WebhookConfig', 'AlertRule',
  'AlertDelivery', 'Version',
])

const WRITE_METHODS = [
  'create', 'update', 'delete', 'upsert',
  'createMany', 'updateMany', 'deleteMany',
]

export function withWriteGuard<T extends PrismaClient>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      if (typeof prop !== 'string') return Reflect.get(target, prop)
      const val = Reflect.get(target, prop)
      if (typeof val !== 'function') return val

      if (BACKEND_OWNED.has(prop)) {
        return new Proxy(val, {
          get(model, method) {
            if (typeof method !== 'string') return Reflect.get(model, method)
            const fn = Reflect.get(model, method)
            if (typeof fn !== 'function') return fn

            if (WRITE_METHODS.includes(method)) {
              return (...args: unknown[]) => {
                console.warn(
                  `[db-guard] WARNING: Frontend writing to backend-owned table "${prop}.${method}()". ` +
                  `This violates table ownership — use the backend API instead.`
                )
                return (fn as (...args: unknown[]) => unknown).apply(model, args)
              }
            }
            return fn
          },
        })
      }
      return val
    },
  }) as T
}
