// scripts/test-parser.ts — verify Claude SSE parser works end-to-end
import { CapStoreDb } from '../src/storage/db.js'
import { StreamParserEngine } from '../src/engines/stream-parser.js'
import { ParserStoreImpl } from '../src/storage/impl/parser-store-impl.js'

const db = new CapStoreDb()
const store = new ParserStoreImpl(db)
const engine = new StreamParserEngine(store)

const sample = `data: {"type":"message_start","message":{"id":"msg_001"}}\n\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world!"}}\n\ndata: {"type":"message_stop"}\n\ndata: [DONE]`

const result = await engine.parse(sample, 'claude')
// [audit] removed: console.log('Parser:', result.parserName, 'v' + result.parserVersion, 'conf:', result.confidence)
// [audit] removed: console.log('Blocks:', JSON.stringify(result.blocks, null, 2))
