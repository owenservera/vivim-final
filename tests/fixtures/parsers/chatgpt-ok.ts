// tests/fixtures/parsers/chatgpt-ok.ts
import type { ParserModule } from '../../../src/engines/stream-parser.js'

const mod: ParserModule = {
  name: 'chatgpt-ok',
  version: 1,
  providerId: 'chatgpt',
  parse: (raw) => [{ type: 'text', text: `chatgpt:${raw}` }],
  detectCompletion: () => true,
  getConfidence: () => 0.99,
}

export default mod
