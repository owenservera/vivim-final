// tests/unit/engines/nlcl/nlcl-engine.test.ts
// Unit tests for the Natural Language Command Layer (NLCL).
// Verifies the deterministic parser, intent router, and composite commands.

import { describe, test, expect } from 'bun:test'
import { NLCLEngine } from '../../../../src/engines/nlcl/nlcl-engine.js'
import { CommandPatternRegistry } from '../../../../src/engines/nlcl/command-registry.js'
import { NLCommandParser } from '../../../../src/engines/nlcl/nl-parser.js'
import { getDefaultCommandPatterns } from '../../../../src/engines/nlcl/catalog.js'
import type { NLCContext } from '../../../../src/engines/nlcl/types.js'

const ctx: NLCContext = { surface: 'frontend', metadata: {} }

describe('NLCommandParser', () => {
  const registry = new CommandPatternRegistry()
  for (const p of getDefaultCommandPatterns()) registry.register(p)
  const parser = new NLCommandParser(registry)

  test('parses "open my resume" as file.open', () => {
    const result = parser.parse('open my resume', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('file.open')
    expect(result!.input.name).toBe('resume')
    expect(result!.confidence).toBeGreaterThan(0.5)
  })

  test('parses "go to cnn" as browser.navigate', () => {
    const result = parser.parse('go to cnn', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('browser.navigate')
    expect(result!.input.url).toContain('cnn')
  })

  test('parses "go to cnn.com" as browser.navigate with URL', () => {
    const result = parser.parse('go to cnn.com', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('browser.navigate')
    expect(result!.input.url).toBe('cnn.com')
  })

  test('parses "search for best restaurants" as browser.search', () => {
    const result = parser.parse('search for best restaurants', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('browser.search')
    expect(result!.input.query).toBe('best restaurants')
  })

  test('parses "ask chatgpt about quantum physics" as llm.ask', () => {
    const result = parser.parse('ask chatgpt about quantum physics', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('llm.ask')
    expect(result!.input.providerId).toBe('chatgpt')
    expect(result!.input.prompt).toBe('quantum physics')
  })

  test('parses "summarize the news" as llm.summarize', () => {
    const result = parser.parse('summarize the news', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('llm.summarize')
  })

  test('parses "summarize the news from cnn" as web.summarize', () => {
    const result = parser.parse('summarize the news from cnn', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('web.summarize')
    expect(result!.input.url).toContain('cnn')
  })

  test('parses "send email to john@example.com about the meeting" as email.send', () => {
    const result = parser.parse('send email to john@example.com about the meeting', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('email.send')
    expect(result!.input.to).toBe('john@example.com')
    expect(result!.input.subject).toBe('the meeting')
  })

  test('parses "open notepad" as app.launch', () => {
    const result = parser.parse('open notepad', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('app.launch')
    expect(result!.input.app).toBe('notepad')
  })

  test('parses "switch to claude" as conversation.switch', () => {
    const result = parser.parse('switch to claude', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('conversation.switch')
    expect(result!.input.providerId).toBe('claude')
  })

  test('parses "what can you do" as system.help', () => {
    const result = parser.parse('what can you do', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('system.help')
  })

  test('parses "list my providers" as system.providers', () => {
    const result = parser.parse('list my providers', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('system.providers')
  })

  test('normalizes filler words — "please open my resume"', () => {
    const result = parser.parse('please open my resume', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('file.open')
  })

  test('normalizes filler words — "can you go to youtube"', () => {
    const result = parser.parse('can you go to youtube', ctx)
    expect(result).not.toBeNull()
    expect(result!.intent).toBe('browser.navigate')
  })

  test('returns alternatives for ambiguous input', () => {
    const result = parser.parse('open calculator', ctx, { maxAlternatives: 3 })
    expect(result).not.toBeNull()
    // "open calculator" could be app.launch or file.open
    expect(result!.alternatives.length).toBeGreaterThan(0)
  })
})

describe('NLCLEngine', () => {
  test('engine initializes with default patterns', () => {
    const engine = new NLCLEngine()
    const commands = engine.listCommands()
    expect(commands.length).toBeGreaterThan(20)
  })

  test('engine returns help with categories', () => {
    const engine = new NLCLEngine()
    const help = engine.getHelp()
    expect(help.totalCommands).toBeGreaterThan(20)
    expect(help.categories.file).toBeDefined()
    expect(help.categories.browser).toBeDefined()
    expect(help.categories.llm).toBeDefined()
    expect(help.categories.email).toBeDefined()
    expect(help.categories.system).toBeDefined()
  })

  test('engine interprets "help" command', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret('help', ctx)
    expect(result.intent).toBe('system.help')
  })

  test('engine interprets "what can you do"', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret('what can you do', ctx)
    expect(result.intent).toBe('system.help')
  })

  test('engine interprets "what\'s my health"', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret("what's my health", ctx)
    expect(result.intent).toBe('system.health')
    expect(result.ok).toBe(true)
  })

  test('engine interprets "version"', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret('version', ctx)
    expect(result.intent).toBe('system.version')
    expect(result.ok).toBe(true)
    expect(result.text).toContain('1.0.0')
  })

  test('engine handles empty input', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret('', ctx)
    expect(result.ok).toBe(false)
    expect(result.intent).toBe('empty')
  })

  test('engine handles unrecognized input gracefully', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret('xyzzy flumph qwerty', ctx)
    expect(result.ok).toBe(false)
  })

  test('engine detects composite command "go to cnn and summarize"', async () => {
    const engine = new NLCLEngine()
    const result = await engine.interpret('go to cnn and summarize the news', ctx)
    // This should be detected as a composite (navigate + summarize)
    expect(result.intent).toBe('composite')
  })

  test('engine audit log records commands', async () => {
    const engine = new NLCLEngine()
    await engine.interpret('help', ctx)
    await engine.interpret('version', ctx)
    const log = engine.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    expect(log[0]!.input).toBe('help')
    expect(log[1]!.input).toBe('version')
  })

  test('engine supports pluggable resolver', async () => {
    const engine = new NLCLEngine()
    const customResolver = {
      name: 'test-resolver',
      async resolve() {
        return null
      },
    }
    engine.setResolver(customResolver)
    expect(engine.getResolver().name).toBe('test-resolver')
  })
})

describe('CommandPatternRegistry', () => {
  test('registers and retrieves patterns', () => {
    const registry = new CommandPatternRegistry()
    const patterns = getDefaultCommandPatterns()
    for (const p of patterns) registry.register(p)
    expect(registry.size()).toBe(patterns.length)
    expect(registry.getByIntent('file.open')).toBeDefined()
    expect(registry.getByIntent('browser.navigate')).toBeDefined()
  })

  test('filters by category', () => {
    const registry = new CommandPatternRegistry()
    for (const p of getDefaultCommandPatterns()) registry.register(p)
    const filePatterns = registry.list({ category: 'file' })
    expect(filePatterns.length).toBeGreaterThan(0)
    expect(filePatterns.every((p) => p.category === 'file')).toBe(true)
  })

  test('searches patterns by query', () => {
    const registry = new CommandPatternRegistry()
    for (const p of getDefaultCommandPatterns()) registry.register(p)
    const results = registry.search('email')
    expect(results.length).toBeGreaterThan(0)
  })

  test('exportForSurface returns metadata', () => {
    const registry = new CommandPatternRegistry()
    for (const p of getDefaultCommandPatterns()) registry.register(p)
    const exported = registry.exportForSurface('frontend')
    expect(exported.length).toBeGreaterThan(0)
    expect(exported[0]!.intent).toBeDefined()
    expect(exported[0]!.examples).toBeDefined()
  })
})
