const port = '9420'
for (const path of ['/api/opencode/sessions','/api/agent/sessions','/api/agentic/sessions','/api/sessions?surface=opencode']) {
  try {
    const r = await fetch('http://localhost:' + port + path, { signal: AbortSignal.timeout(5000) })
    const j = await r.json()
    console.log(path, '->', r.status, JSON.stringify(j).slice(0, 400))
  } catch (e) { console.log(path, 'ERR', String(e)) }
}
