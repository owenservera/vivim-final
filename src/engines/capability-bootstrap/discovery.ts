// src/engines/capability-bootstrap/discovery.ts
// registerDiscoveryCapabilities — registers discovery/onboarding capabilities.
// Session 7 (2026-08-07): Extracted from capability-bootstrap.ts.

import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { makeCapability } from './types.js'

export function registerDiscoveryCapabilities(registry: UnifiedCapabilityRegistry): void {
  const readSurfaces: CapabilitySurface[] = ['cli', 'ui', 'api']
  const devSurfaces: CapabilitySurface[] = ['cli', 'api']

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:run',
        slug: 'discovery_run',
        name: 'Discovery Run',
        description: 'Run a logged-in provider discovery session end-to-end.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            accountId: { type: 'string' },
            url: { type: 'string' },
            profileDir: { type: 'string' },
            probeMessage: { type: 'string' },
            composerSelector: { type: 'string' },
            composerType: { type: 'string' },
            sendSelector: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
          required: ['providerId', 'url'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'discovery run',
          aliases: ['drun'],
          examples: ['discovery run claude --url https://claude.ai'],
        },
        ui: { component: 'action-button', position: 'admin', order: 15 },
        mcpToolName: 'discovery_run',
        apiEndpoint: { method: 'POST', path: '/api/discovery/run' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack({ profileBaseDir: undefined })
        const runner = new DiscoverySessionRunner({
          governor: stack.governor,
          discovery: stack.discovery,
          streamParser: stack.streamParser,
          align: stack.align,
          captureStream: stack.captureStream,
        })
        const { session, alignment } = await runner.runSession({
          providerId: String(input.providerId),
          accountId: input.accountId ? String(input.accountId) : 'default',
          url: String(input.url),
          profileDir: input.profileDir ? String(input.profileDir) : undefined,
          probeMessage: input.probeMessage ? String(input.probeMessage) : undefined,
          composerSelector: input.composerSelector ? String(input.composerSelector) : undefined,
          composerType: (input.composerType as ComposerType | undefined) ?? 'textarea',
          sendSelector: input.sendSelector ? String(input.sendSelector) : undefined,
          timeoutMs: input.timeoutMs ? Number(input.timeoutMs) : 20_000,
        })
        return {
          sessionId: session.id,
          url: session.url,
          shapeId: session.shapeId,
          confidence: session.confidence,
          detectedCapabilities: session.detectedCapabilities,
          alignment: {
            inferredFormat: alignment.inferredFormat,
            parserName: alignment.parserName,
            confidence: alignment.confidence,
            ok: alignment.ok,
          },
          manifestDraft: session.manifestDraft,
        }
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:interact',
        slug: 'discovery_interact',
        name: 'Discovery Interact',
        description: 'Interact with a provider in a discovery session.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            accountId: { type: 'string' },
            url: { type: 'string' },
            message: { type: 'string' },
            profileDir: { type: 'string' },
            composer: { type: 'string' },
            send: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
          required: ['providerId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'discovery interact',
          aliases: ['dint'],
          examples: ['discovery interact chatgpt --message "hello"'],
        },
        ui: { component: 'action-button', position: 'admin', order: 16 },
        mcpToolName: 'discovery_interact',
        apiEndpoint: { method: 'POST', path: '/api/discovery/interact' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const slug = String(input.providerId)
        const message = input.message ? String(input.message) : 'Hello'
        const url = input.url ? String(input.url) : `https://${slug}.ai`
        const stack = await buildLocalDiscoveryStack()
        const slave = await stack.governor.ensureRunningForAccount(
          slug,
          input.accountId ? String(input.accountId) : 'default',
          {
            profileDir: input.profileDir ? String(input.profileDir) : undefined,
          },
        )
        const capturer = createPageEvalCapturer(stack.governor)
        const session = await stack.discovery.createSession(url, { providerNameHint: slug })
        await stack.governor.cdp.send(slave.slaveId, 'Page.navigate', { url })
        const composer = input.composer
          ? String(input.composer)
          : 'textarea, [role="textbox"], [contenteditable]'
        const timeoutMs = Number(input.timeoutMs ?? 20_000)
        await capturer.arm(slave.slaveId, { urlPattern: new URL(url).hostname, timeoutMs })
        await typeMessage(stack.governor.cdp, slave.slaveId, composer, message, 'textarea')
        await submitMessage(
          stack.governor.cdp,
          slave.slaveId,
          input.send ? String(input.send) : undefined,
        )
        const bodies = await capturer.collect(slave.slaveId, {
          urlPattern: new URL(url).hostname,
          timeoutMs,
        })
        return { sessionId: session.id, capturedSamples: bodies.length, raw: bodies }
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:align',
        slug: 'discovery_align',
        name: 'Discovery Align',
        description: 'Align captured stream bodies against the DB parser.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            slug: { type: 'string' },
            file: { type: 'string' },
            format: { type: 'string' },
          },
          required: ['provider', 'file'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'discovery align',
          aliases: ['dali'],
          examples: ['discovery align claude --file captured.txt'],
        },
        ui: { component: 'action-button', position: 'admin', order: 17 },
        mcpToolName: 'discovery_align',
        apiEndpoint: { method: 'POST', path: '/api/discovery/align' },
        surfaces: devSurfaces,
      },
      async (input) => {
        const slug = String(input.provider ?? input.slug ?? '')
        const text = await Bun.file(String(input.file)).text()
        const bodies = text
          .split(/\n\n+/)
          .map((b) => b.trim())
          .filter(Boolean)
        const stack = await buildLocalDiscoveryStack()
        const configured = input.format ? (String(input.format) as never) : null
        const report = await stack.align.alignCaptured(bodies, slug, configured)
        await stack.discovery.persistParserFindings(slug, report)
        return report
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:list',
        slug: 'discovery_list',
        name: 'Discovery List',
        description: 'List discovery sessions.',
        category: 'discovery',
        inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
        outputSchema: { type: 'array' },
        cliCommand: { name: 'discovery list', aliases: ['dls'], examples: ['discovery list'] },
        ui: { component: 'action-button', position: 'admin', order: 18 },
        mcpToolName: 'discovery_list',
        apiEndpoint: { method: 'POST', path: '/api/discovery/list' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack()
        const sessions = await stack.discovery.listSessions({ limit: Number(input.limit ?? 50) })
        return sessions.map((s) => ({
          id: s.id,
          url: s.url,
          status: s.status,
          shapeId: s.shapeId,
          confidence: s.confidence,
        }))
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:show',
        slug: 'discovery_show',
        name: 'Discovery Show',
        description: 'Show a discovery session.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: { sessionId: { type: 'string' } },
          required: ['sessionId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'discovery show', aliases: ['dsh'], examples: ['discovery show <id>'] },
        ui: { component: 'action-button', position: 'admin', order: 19 },
        mcpToolName: 'discovery_show',
        apiEndpoint: { method: 'POST', path: '/api/discovery/show' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack()
        return stack.discovery.getSession(String(input.sessionId ?? '')) ?? { error: 'not found' }
      },
    ),
  )

  registry.register(
    makeCapability(
      {
        id: 'cap:discovery:manifest',
        slug: 'discovery_manifest',
        name: 'Discovery Manifest',
        description: 'Show the manifest draft for a discovery session.',
        category: 'discovery',
        inputSchema: {
          type: 'object',
          properties: { sessionId: { type: 'string' } },
          required: ['sessionId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'discovery manifest',
          aliases: ['dman'],
          examples: ['discovery manifest <id>'],
        },
        ui: { component: 'action-button', position: 'admin', order: 20 },
        mcpToolName: 'discovery_manifest',
        apiEndpoint: { method: 'POST', path: '/api/discovery/manifest' },
        surfaces: readSurfaces,
      },
      async (input) => {
        const stack = await buildLocalDiscoveryStack()
        const session = await stack.discovery.getSession(String(input.sessionId ?? ''))
        return session?.manifestDraft ?? { error: 'no manifest draft' }
      },
    ),
  )
}
