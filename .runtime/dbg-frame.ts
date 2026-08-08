import { mock } from 'bun:test'
import { SemanticGroundingEngine } from '../src/engines/browser-automation/semantic-grounding.js'

const calls = []
const gov = {
  calls,
  enableDomains: mock(() => Promise.resolve()),
  evaluate: mock((_s, expr) => {
    calls.push(expr)
    if (expr.includes("querySelectorAll('iframe').length")) return Promise.resolve(1)
    if (expr.includes('getBoundingClientRect')) {
      if (expr.includes('contentDocument')) return Promise.resolve({ x: 5, y: 6, w: 30, h: 8 })
      return Promise.resolve(null)
    }
    return Promise.resolve(null)
  }),
  cdp: { send: mock(() => Promise.resolve({})) },
}
const eng = new SemanticGroundingEngine(gov)
try {
  const r = await eng.resolveBySelector('s1', '#in-frame')
  console.log('RESULT', JSON.stringify(r))
} catch (e) {
  console.log('THREW', e.message)
}
for (const c of calls) console.log('EXPR:', c.slice(0, 260))
