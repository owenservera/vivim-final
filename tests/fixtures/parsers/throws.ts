// tests/fixtures/parsers/throws.ts
import type { ParserModule } from '../../../src/engines/stream-parser.js'

const mod: ParserModule = {
  name: 'throws',
  version: 1,
  providerId: 'claude',
  parse: () => {
    throw new Error('boom')
  },
  detectCompletion: () => true,
  getConfidence: () => 0,
}

export default mod
