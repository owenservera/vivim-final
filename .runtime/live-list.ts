const port = '9420'
const r = await fetch('http://localhost:' + port + '/api/opencode/sessions')
const j = await r.json()
console.log('STATUS', r.status)
console.log(JSON.stringify(j, null, 2).slice(0, 1500))
