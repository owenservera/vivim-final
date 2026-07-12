// src/cli/commands/discovery.ts
// Phase 23.6 — CLI command group: drive a logged-in provider discovery session
// end-to-end, interact with a provider without the UI, and align captured
// streams against the DB parser.
//
//   vivim discovery run <slug> --url <u> --account <id> --profile <dir> --message "hi"
//   vivim discovery interact <slug> --account <id> --profile <dir> --message "..."
//   vivim discovery align <slug> --file captured.txt
//   vivim discovery list
//   vivim discovery show <id>
//   vivim discovery manifest <id>

import { z } from 'zod'
import type { CommandRegistry } from '../command-registry.js'
import {
  buildLocalDiscoveryStack,
  createPageEvalCapturer,
} from '../discovery-stack.js'
import { DiscoverySessionRunner } from '../engines/discovery-session-runner.js'
import type { StreamFormat } from '../engines/stream-align.js'
import { typeMessage, submitMessage } from '../engines/composer-typing.js'

export function registerDiscoveryCommands(registry: CommandRegistry): void {
  registry.register({
    name: 'discovery',
    description: 'Run a logged-in provider discovery session, interact, or align a captured stream',
    subsystem: 'backend',
    schema: z.any(),
    examples: [
      'discovery run claude --url https://claude.ai --account me --profile ./chrome-profiles/claude',
      'discovery interact chatgpt --account me --profile ./chrome-profiles/cg --message "hello"',
      'discovery align claude --file captured.txt',
      'discovery list',
      'discovery show <sessionId>',
      'discovery manifest <sessionId>',
    ],
    handler: async (raw: unknown) => {
      const { args, flags } = raw as { args: string[]; flags: Record<string, string> }
      const sub = args[0]
      switch (sub) {
        case 'run':
          return runSession(args, flags)
        case 'interact':
          return interact(args, flags)
        case 'align':
          return align(flags)
        case 'list':
          return listSessions()
        case 'show':
          return showSession(args[1])
        case 'manifest':
          return showManifest(args[1])
        default:
          return {
            data: {
              error: 'Unknown discovery subcommand',
              usage: [
                'discovery run <slug> --url <u> --account <id> --profile <dir> --message <m>',
                'discovery interact <slug> --account <id> --profile <dir> --message <m>',
                'discovery align <slug> --file <captured.txt>',
                'discovery list | show <id> | manifest <id>',
              ],
            },
          }
      }
    },
  })
}

async function runSession(
  args: string[],
  flags: Record<string, string>,
): Promise<{ data: unknown }> {
  const slug = args[1]
  if (!slug) {
    throw new Error('Usage: discovery run <slug> --url <u> [--account <id>] [--profile <dir>] [--message <m>]')
  }
  const url = flags.url
  if (!url) throw new Error('discovery run requires --url <provider chat url>')

  const stack = await buildLocalDiscoveryStack({ profileBaseDir: flags.profile ? undefined : 'chrome-profiles' })
  const runner = new DiscoverySessionRunner({
    governor: stack.governor,
    discovery: stack.discovery,
    streamParser: stack.streamParser,
    align: stack.align,
    captureStream: stack.captureStream,
  })

  const { session, alignment } = await runner.runSession({
    providerId: slug,
    accountId: flags.account ?? 'default',
    url,
    profileDir: flags.profile,
    probeMessage: flags.message,
    composerSelector: flags.composer,
    composerType: (flags['composer-type'] as 'textarea' | 'contenteditable' | 'quill' | 'codemirror') ?? 'textarea',
    sendSelector: flags.send,
    timeoutMs: flags.timeout ? Number(flags.timeout) : 20_000,
  })

  return {
    data: {
      sessionId: session.id,
      url: session.url,
      shapeId: session.shapeId,
      confidence: session.confidence,
      detectedCapabilities: session.detectedCapabilities,
      alignment: {
        inferredFormat: alignment.inferredFormat,
        parserName: alignment.parserName,
        confidence: alignment.confidence,
        detectedDeltaPath: alignment.detectedDeltaPath,
        textBlocks: alignment.textBlocks,
        ok: alignment.ok,
        mismatches: alignment.mismatches,
        suggestions: alignment.suggestions,
      },
      manifestDraft: session.manifestDraft,
    },
  }
}

async function interact(
  args: string[],
  flags: Record<string, string>,
): Promise<{ data: unknown }> {
  const slug = args[1]
  if (!slug) {
    throw new Error('Usage: discovery interact <slug> --account <id> --profile <dir> --message <m>')
  }
  const message = flags.message ?? 'Hello'
  const url = flags.url ?? `https://${slug}.ai`

  const stack = await buildLocalDiscoveryStack()
  const slave = await stack.governor.ensureRunningForAccount(slug, flags.account ?? 'default', {
    profileDir: flags.profile,
  })
  const capturer = createPageEvalCapturer(stack.governor)

  // Record + navigate on the actual logged-in slave (Governor Canon).
  const session = await stack.discovery.createSession(url, { providerNameHint: slug })
  await stack.governor.cdp.send(slave.slaveId, 'Page.navigate', { url })

  const composer = flags.composer ?? 'textarea, [role="textbox"], [contenteditable]'
  await capturer.arm(slave.slaveId, { urlPattern: new URL(url).hostname, timeoutMs: Number(flags.timeout ?? 20_000) })
  await typeMessage(stack.governor.cdp, slave.slaveId, composer, message, 'textarea')
  await submitMessage(stack.governor.cdp, slave.slaveId, flags.send)
  const bodies = await capturer.collect(slave.slaveId, {
    urlPattern: new URL(url).hostname,
    timeoutMs: Number(flags.timeout ?? 20_000),
  })

  return { data: { sessionId: session.id, capturedSamples: bodies.length, raw: bodies } }
}

async function align(flags: Record<string, string>): Promise<{ data: unknown }> {
  const slug = flags.provider ?? flags.slug
  if (!slug) throw new Error('discovery align requires --provider <slug>')
  const file = flags.file
  if (!file) throw new Error('discovery align requires --file <captured.txt>')

  const text = await Bun.file(file).text()
  // Each blank-line-separated block is treated as one captured body sample.
  const bodies = text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  const stack = await buildLocalDiscoveryStack()
  const configured = flags.format
    ? (flags.format as StreamFormat)
    : null
  const report = await stack.align.alignCaptured(bodies, slug, configured)
  return { data: report }
}

async function listSessions(): Promise<{ data: unknown }> {
  const stack = await buildLocalDiscoveryStack()
  const sessions = await stack.discovery.listSessions({ limit: 50 })
  return {
    data: sessions.map((s) => ({
      id: s.id,
      url: s.url,
      status: s.status,
      shapeId: s.shapeId,
      confidence: s.confidence,
      parserFormat: s.parserFormat,
    })),
  }
}

async function showSession(id: string | undefined): Promise<{ data: unknown }> {
  if (!id) throw new Error('Usage: discovery show <sessionId>')
  const stack = await buildLocalDiscoveryStack()
  const session = await stack.discovery.getSession(id)
  return { data: session ?? { error: 'not found' } }
}

async function showManifest(id: string | undefined): Promise<{ data: unknown }> {
  if (!id) throw new Error('Usage: discovery manifest <sessionId>')
  const stack = await buildLocalDiscoveryStack()
  const session = await stack.discovery.getSession(id)
  return { data: session?.manifestDraft ?? { error: 'no manifest draft' } }
}
