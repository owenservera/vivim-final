// tests/unit/engines/claude-parser-live.test.ts (runner)
import { CapStoreDb } from '../src/storage/db.js'
import { StreamParserEngine } from '../src/engines/stream-parser.js'
import { ParserStoreImpl } from '../src/storage/impl/parser-store-impl.js'

const db = new CapStoreDb()
const parserStore = new ParserStoreImpl(db)
const engine = new StreamParserEngine(parserStore)

// Simulated Claude SSE response (content_block_start, content_block_delta, message_stop)
const sample = `data: {"type":"message_start","message":{"id":"msg_001"}}

data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world!"}}

data: {"type":"content_block_stop","index":0}

data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}

data: {"type":"message_stop"}

data: [DONE]
`

const result = await engine.parse(sample, 'claude')
// [audit] removed: console.log(JSON.stringify({
  confidence: result.confidence,
  parserName: result.parserName,
  blocks: result.blocks
}, null, 2))
