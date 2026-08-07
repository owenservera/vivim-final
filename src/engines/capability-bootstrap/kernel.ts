// src/engines/capability-bootstrap/kernel.ts
// registerKernelCapabilities — registers kernel/oracle capabilities.
// Session 7 (2026-08-07): Extracted from capability-bootstrap.ts.

import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { makeCapability } from './types.js'

export function registerKernelCapabilities(
  registry: UnifiedCapabilityRegistry,
  kernel: import('./kernel/kernel-context.js').Kernel,
): void {
  const ctx = kernel.context()
  const oracle = ctx.oracle

  const readSurfaces: import('./unified-registry.js').CapabilitySurface[] = ['cli', 'ui', 'api']
  const writeSurfaces: import('./unified-registry.js').CapabilitySurface[] = ['cli', 'api']

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:query',
        slug: 'oracle_query',
        name: 'Oracle Query',
        description: 'Query the kernel oracle (health, topology, capability, config, all).',
        category: 'kernel',
        inputSchema: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['health', 'topology', 'capability', 'config', 'all'] },
            filter: { type: 'object' },
            limit: { type: 'number' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'kernel oracle query',
          aliases: ['koq'],
          examples: ['kernel oracle query --op health'],
        },
        ui: { component: 'action-button', position: 'admin', order: 9 },
        mcpToolName: 'oracle_query',
        apiEndpoint: { method: 'POST', path: '/api/oracle/query' },
        surfaces: readSurfaces,
      },
      async (input) => {
        if (!oracle) return { error: 'Oracle not available' }
        return oracle.query.query({
          type: String(input.op ?? 'all') as never,
          filter: input.filter as Record<string, unknown> | undefined,
          limit: input.limit as number | undefined,
        })
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:heal',
        slug: 'oracle_heal',
        name: 'Oracle Heal',
        description: 'Trigger oracle self-healing for an issue.',
        category: 'kernel',
        inputSchema: {
          type: 'object',
          properties: { issueId: { type: 'string' } },
          required: ['issueId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'kernel oracle heal',
          aliases: ['koh'],
          examples: ['kernel oracle heal --issueId issue:123'],
        },
        ui: { component: 'action-button', position: 'admin', order: 10 },
        mcpToolName: 'oracle_heal',
        apiEndpoint: { method: 'POST', path: '/api/oracle/heal' },
        surfaces: writeSurfaces,
      },
      async (input) => {
        if (!oracle) return { error: 'Actuator not available' }
        return oracle.actuator.heal(String(input.issueId ?? ''))
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:scan',
        slug: 'oracle_scan',
        name: 'Oracle Scan',
        description: 'Scan the system for issues.',
        category: 'kernel',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'kernel oracle scan',
          aliases: ['kos'],
          examples: ['kernel oracle scan'],
        },
        ui: { component: 'action-button', position: 'admin', order: 11 },
        mcpToolName: 'oracle_scan',
        apiEndpoint: { method: 'POST', path: '/api/oracle/scan' },
        surfaces: readSurfaces,
      },
      async () => {
        if (!oracle) return { error: 'Diagnostic not available' }
        return oracle.diagnostic.scan()
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:events',
        slug: 'oracle_events',
        name: 'Oracle Events',
        description: 'Get recent oracle events.',
        category: 'kernel',
        inputSchema: { type: 'object', properties: { tail: { type: 'number' } } },
        outputSchema: { type: 'array' },
        cliCommand: {
          name: 'kernel oracle events',
          aliases: ['koe'],
          examples: ['kernel oracle events --tail 10'],
        },
        ui: { component: 'action-button', position: 'admin', order: 12 },
        mcpToolName: 'oracle_events',
        apiEndpoint: { method: 'POST', path: '/api/oracle/events' },
        surfaces: readSurfaces,
      },
      async (input) => {
        if (!oracle) return { error: 'Events not available' }
        return oracle.events.getRecentEvents(Number(input.tail ?? 50))
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:visibility',
        slug: 'oracle_visibility',
        name: 'Oracle Visibility',
        description: 'Get oracle visibility snapshot.',
        category: 'kernel',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'kernel oracle visibility',
          aliases: ['kov'],
          examples: ['kernel oracle visibility'],
        },
        ui: { component: 'action-button', position: 'admin', order: 13 },
        mcpToolName: 'oracle_visibility',
        apiEndpoint: { method: 'POST', path: '/api/oracle/visibility' },
        surfaces: readSurfaces,
      },
      async () => {
        if (!oracle) return { error: 'Query not available' }
        return oracle.query.query({ type: 'all' as never })
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:oracle:manifest',
        slug: 'oracle_manifest',
        name: 'Oracle Manifest',
        description: 'Get canvas manifest from oracle.',
        category: 'kernel',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'kernel oracle manifest',
          aliases: ['kom'],
          examples: ['kernel oracle manifest'],
        },
        ui: { component: 'action-button', position: 'admin', order: 14 },
        mcpToolName: 'oracle_manifest',
        apiEndpoint: { method: 'POST', path: '/api/oracle/manifest' },
        surfaces: readSurfaces,
      },
      async () => ({ manifest: ctx.registry.describe() }),
    ),
  )
}

/**
 * Unit 24.6 — fold discovery CLI commands into capabilities so the frontend can
 * drive discovery too. Handlers build the local discovery stack server-side via
 * buildLocalDiscoveryStack (which uses getDb() internally).
 */
