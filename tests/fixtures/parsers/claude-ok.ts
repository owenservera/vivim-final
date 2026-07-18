// tests/fixtures/parsers/claude-ok.ts
import type { ParserModule } from '../../../src/engines/stream-parser.js'

const mod: ParserModule = {
  name: 'claude-ok',
  version: 1,
  providerId: 'claude',
  parse: (raw) => [{ type: 'text', text: `claude:${raw}` }],
  detectCompletion: () => true,
  getConfidence: () => 0.99,
}

export default mod
