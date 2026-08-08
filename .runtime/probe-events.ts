// .runtime/probe-events.ts — enumerate v1 /event stream vocabulary from live serve
const pw = 'opencode-test-pw'
const b64 = btoa('opencode:' + pw)
const r = await fetch('http://127.0.0.1:53409/doc', {
  headers: { Authorization: 'Basic ' + b64 },
})
const spec = await r.json()
const comps = spec.components.schemas
const ev = comps.Event
const names = ev.anyOf.map((o: { $ref?: string }) => (o.$ref ?? '').split('/').pop())
console.log('total event variants:', names.length)
for (const n of names) {
  const s = comps[n]
  const te = s?.properties?.type?.enum
  console.log((te?.[0] ?? n))
}
