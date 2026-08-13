import { StreamParserEngine } from './src/engines/stream-parser.ts'
import type { ParserStore, ProviderParserRow } from './src/storage/contracts/parser-store.ts'

function row(id: string, o: Partial<ProviderParserRow> = {}): ProviderParserRow {
  return {
    id, providerId: 'claude', name: `p-${id}`, version: 1, logicType: 'file',
    filePath: null, logicCode: null, hash: `h-${id}`, sampleBody: null,
    isActive: 1, fallbackParserId: null, createdAt: 0, updatedAt: 0, ...o,
  }
}
function mockStore(o: Partial<ParserStore> = {}): ParserStore {
  return {
    getParser: async () => null, getActiveParser: async () => null,
    getParserById: async () => null, getParserByProviderAndVersion: async () => null,
    upsertParser: async () => {}, listParsers: async () => [],
    getParserByFile: async () => null, getParserByHash: async () => null,
    getGenericParser: async () => null, getSystemFallbackParser: async () => null, ...o,
  }
}

const inlineCode = `exports.default = {
  name: 'test-parser', version: 1, providerId: 'test',
  parse(rawBody) { return [{ type: 'text', text: 'inline:' + rawBody }]; },
  detectCompletion() { return true; },
  getConfidence() { return 0.8; }
};`

async function run(label: string, fn: () => Promise<void>) {
  const stop = setTimeout(() => { console.log(`HANG in ${label}`); process.exit(2) }, 8000)
  await fn()
  clearTimeout(stop)
  console.log(`OK ${label}`)
}

await run('inline parser', async () => {
  const store = mockStore({ getParserByProviderAndVersion: async () => row('p1', { logicType: 'inline', logicCode: inlineCode }) })
  const engine = new StreamParserEngine(store)
  const r = await engine.parse('hello', 'test')
  console.log('  blocks=', JSON.stringify(r.blocks))
  if (JSON.stringify(r.blocks) !== JSON.stringify([{ type: 'text', text: 'inline:hello' }])) throw new Error('inline mismatch')
})

await run('primeFromProtocol inline', async () => {
  const store = mockStore({
    getParserByProviderAndVersion: async () => { throw new Error('DB must not be hit') },
    getParserById: async () => { throw new Error('DB must not be hit') },
  })
  const engine = new StreamParserEngine(store)
  await engine.primeFromProtocol({
    providers: [
      {
        slug: 'claude',
        parsers: [
          {
            name: 'claude/001_streaming_sse',
            version: 1,
            hash: 'h-proto-1',
            isActive: true,
            logicCode: `exports.default = { name: 'claude/001_streaming_sse', version: 1, providerId: 'claude', parse(rawBody) { return [{ type: 'text', text: 'proto:' + rawBody }]; }, detectCompletion() { return true; }, getConfidence() { return 0.9; } };`,
          },
        ],
      },
    ],
  })
  const r = await engine.parse('hello', 'claude')
  console.log('  blocks=', JSON.stringify(r.blocks))
  if (JSON.stringify(r.blocks) !== JSON.stringify([{ type: 'text', text: 'proto:hello' }])) throw new Error('proto mismatch')
})
process.exit(0)
