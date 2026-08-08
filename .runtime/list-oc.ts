const port = '9420'
const r = await fetch('http://localhost:' + port + '/api/capabilities?surface=api')
const j = await r.json()
const caps = (j.capabilities ?? [])
console.log('TOTAL', caps.length)
for (const c of caps.filter(c => /opencode/i.test(c.slug ?? ''))) console.log(c.slug, c.name ?? '')
