const port = '9420'
const ctl = new AbortController()
const t = setTimeout(() => ctl.abort(), 15000)
try {
  const r = await fetch('http://localhost:' + port + '/api/opencode/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'opencode/deepseek-v4-flash-free' }),
    signal: ctl.signal,
  })
  clearTimeout(t)
  console.log('STATUS', r.status)
  console.log(JSON.stringify(await r.json()))
} catch (e) { clearTimeout(t); console.log('ERR', String(e)) }
