const pw = 'opencode-test-pw'
const b64 = btoa(`opencode:${pw}`)
const base = 'http://127.0.0.1:14795'
const sid = 'ses_0211482c4ffemwAQl5iI4O2v3S'
const H = { Authorization: `Basic ${b64}` }

const sessions = await (await fetch(`${base}/session`, { headers: H })).json()
console.log('GET /session shape:', JSON.stringify(sessions, null, 1).slice(0, 2500))

const msgs = await (await fetch(`${base}/session/${sid}/message`, { headers: H })).json()
console.log('\nGET /session/:id/message isArray:', Array.isArray(msgs), 'len', (msgs as unknown[]).length)
console.log(JSON.stringify(msgs, null, 1).slice(0, 4000))
