import { CapStoreDb } from '../src/storage/db.js'

const db = new CapStoreDb()
const row = await db.prisma.providerParser.findFirst({ where: { providerId: 'claude', isActive: 1 } })
// [audit] removed: if (!row) { console.log('No parser'); process.exit(1) }

const code = row.parserLogicCode!
// [audit] removed: console.log('Code length:', code.length)
// [audit] removed: console.log('Has exports.default:', code.includes('exports.default'))
// [audit] removed: console.log('Has module.exports:', code.includes('module.exports'))

// Try the exact same execution as StreamParserEngine
const mod = { exports: {} as Record<string, unknown> }
try {
  const factory = new Function('module', 'exports', code)
  factory(mod, mod.exports)
  // [audit] removed: console.log('Factory executed OK')
  // [audit] removed: console.log('mod.exports keys:', Object.keys(mod.exports))
  // [audit] removed: console.log('mod.exports.default type:', typeof mod.exports.default)
  const candidate = (mod.exports.default ?? mod.exports) as any
  // [audit] removed: console.log('candidate.parse type:', typeof candidate.parse)
  // [audit] removed: console.log('candidate.detectCompletion type:', typeof candidate.detectCompletion)
  
  if (typeof candidate.parse === 'function') {
    const sample = 'data: {"type":"message_start"}\n\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\ndata: {"type":"message_stop"}\n\ndata: [DONE]'
    const blocks = candidate.parse(sample)
    // [audit] removed: console.log('Parse result:', JSON.stringify(blocks))
  }
} catch (e) {
  // [audit] removed: console.error('Factory failed:', e)
}
