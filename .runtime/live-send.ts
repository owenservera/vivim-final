const port = '9420'
const ctl = new AbortController()
const t = setTimeout(() => ctl.abort(), 20000)
try {
  const r = await fetch('http://localhost:' + port + '/api/opencode/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'ses_0215b7a86ffeDTfzyUqAfnug1w', prompt: 'Reply with exactly: vivim-opencode-live-ok' }),
    signal: ctl.signal,
  })
  clearTimeout(t)
  const txt = await r.text()
  console.log('STATUS', r.status)
  console.log('BODY', txt.slice(0, 500))
} catch (e) { clearTimeout(t); console.log('ERR', String(e)) }
