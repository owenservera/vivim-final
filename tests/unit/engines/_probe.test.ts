import { describe, it, mock } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { ConversationManager } from '../../../src/engines/conversation-manager.js'

function makeConv(o?: any) {
  return {
    id: 'conv_1',
    providerSessionId: 's',
    providerId: 'claude',
    title: null,
    state: 'active',
    messageCount: 0,
    lastMessageAt: null,
    contextJson: '{}',
    createdAt: 0,
    updatedAt: 0,
    providerConversationUrl: null,
    ...o,
  }
}
const store: any = {
  getConversation: mock(() => Promise.resolve(makeConv())),
  createConversation: mock((i: any) => Promise.resolve(makeConv({ id: 'n', ...i }))),
  updateConversation: mock(() => Promise.resolve()),
  deleteConversation: mock(() => Promise.resolve()),
  listConversations: mock(() => Promise.resolve([])),
  createMessage: mock((i: any) => Promise.resolve({ id: 'm', ...i })),
  getMessage: mock(() => Promise.resolve({} as any)),
  getMessages: mock(() => Promise.resolve([])),
  updateMessage: mock(() => Promise.resolve()),
  deleteMessage: mock(() => Promise.resolve()),
  listMessages: mock(() => Promise.resolve([])),
  getOrCreateConversation: mock(() => Promise.resolve(makeConv())),
}
const gov: any = {
  ensureRunning: mock(async () => ({
    slaveId: 's',
    providerId: 'claude',
    accountId: 'a',
    debugPort: 1,
    profileDir: '/t',
    status: 'running',
    superState: 'idle',
    pid: 1,
    consecutiveFailures: 0,
    circuitState: 'closed',
    lastHealthCheck: 0,
  })),
  ensureRunningForAccount: mock(async () => ({}) as any),
  cdp: {
    executeHarnessPlan: mock(async () => ({ success: true, stepsCompleted: 1 })),
    capture: mock(async () => ({ url: 'u', body: '{}', headers: {}, status: 200 })),
    send: mock(async () => ({ result: { value: true } })),
    getPageState: mock(async () => ({
      url: 'https://claude.ai/chat/abc-123-uuid',
      title: 't',
      readyState: 'complete',
    })),
    enable: mock(async () => ({})),
    disable: mock(async () => ({})),
    captureScreenshot: mock(async () => 'b'),
  },
  setSlaveSuperState: mock(async () => {}),
}
const res: any = {
  composer: [
    {
      capabilityId: 'c',
      selector: 'textarea',
      label: 'x',
      kind: 'composer',
      priority: 1,
      configJson: '{}',
    },
  ],
  header: [],
  message: [],
  sidebar: [],
  inline: [],
  total: 1,
  resolvedAt: 0,
}
const parser: any = {
  parse: mock(async () => ({
    blocks: [{ kind: 'text', content: 'hi', index: 0 }],
    confidence: 0.9,
    parserName: 'p',
    parserVersion: 1,
    durationMs: 1,
  })),
}
const blocks: any = { storeBlocks: mock(async () => {}) }
const bus: any = { emit: mock(() => {}), on: mock(() => {}), off: mock(() => {}) }
const memo: any = {
  get: mock(() => undefined),
  set: mock(() => {}),
  getEpisode: mock(() => undefined),
  recordEpisode: mock(() => {}),
  getStrategy: mock(() => undefined),
  setStrategy: mock(() => {}),
}
describe('x', () => {
  it('count', async () => {
    const m = new ConversationManager(gov, res, parser, blocks, store, bus, memo)
    await m.send('conv_1', 'first')
    await m.send('conv_1', 'second')
    writeFileSync(
      'C:/Users/VIVIM.inc/AppData/Local/Temp/opencode/probe.txt',
      JSON.stringify(
        (store.updateConversation as any).mock.calls.map((c: any) => Object.keys(c[1])),
      ),
    )
  })
})
