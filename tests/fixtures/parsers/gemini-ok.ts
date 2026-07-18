// tests/fixtures/parsers/gemini-ok.ts
import type { ParserModule } from '../../../src/engines/stream-parser.js'

const mod: ParserModule = {
  name: 'gemini-ok',
  version: 1,
  providerId: 'gemini',
  parse: (raw) => [{ type: 'text', text: `gemini:${raw}` }],
  detectCompletion: () => true,
  getConfidence: () => 0.99,
}

export default mod
