/**
 * frontend/src/lib/db.ts
 * --------------------------------------------------------------------
 * Frontend Prisma client — read-only by convention.
 *
 * Table ownership:
 *   Backend-owned (src/engines): Conversation, Message, Provider, Account,
 *     Capability, CapabilityBinding, StreamBlock, ProviderAccount, LoginState,
 *     TelemetrySpan, WebhookConfig, AlertRule, AlertDelivery, Version
 *   Frontend-owned: Workspace, AgentNode, AgentNodeEdge, AgentWorkspace,
 *     AgentWorkspaceAgent, AgentWorkspaceNode, AgentWorkspaceConnection,
 *     CanvasWorkspace, MemoryNode, AgentCanvasAuditLog
 *
 * WRITE RULE: The frontend must only write to frontend-owned tables.
 * If you need to write to backend-owned tables, use the backend API instead.
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const _backendOwned = new Set([
  'Conversation', 'Message', 'Provider', 'Account',
  'Capability', 'CapabilityBinding', 'StreamBlock', 'ProviderAccount',
  'LoginState', 'TelemetrySpan', 'WebhookConfig', 'AlertRule',
  'AlertDelivery', 'Version',
])

const _base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

// Wrap with a write-guard that warns on backend-table mutations
export const db = new Proxy(_base, {
  get(target, prop) {
    if (typeof prop !== 'string') return Reflect.get(target, prop)
    const val = Reflect.get(target, prop)
    if (typeof val !== 'function') return val

    // Intercept model access (e.g. db.Conversation, db.Message)
    if (_backendOwned.has(prop)) {
      return new Proxy(val, {
        get(model, method) {
          if (typeof method !== 'string') return Reflect.get(model, method)
          const fn = Reflect.get(model, method)
          if (typeof fn !== 'function') return fn

          const writeMethods = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany']
          if (writeMethods.includes(method)) {
            return (...args: unknown[]) => {
              console.warn(
                `[db-guard] WARNING: Frontend writing to backend-owned table "${prop}.${method}()". ` +
                `This violates table ownership — use the backend API instead.`
              )
              return (fn as Function).apply(model, args)
            }
          }
          return fn
        },
      })
    }
    return val
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _base