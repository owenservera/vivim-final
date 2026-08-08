const pw = 'opencode-test-pw'
const b64 = btoa(`opencode:${pw}`)
const base = 'http://127.0.0.1:14795'
const sid = 'ses_0211482c4ffemwAQl5iI4O2v3S'
const H = { Authorization: `Basic ${b64}` }

for (const p of [
  `/session/${sid}/message`,
  `/api/session/${sid}`,
  `/api/session/${sid}/history`,
  `/api/session/active`,
]) {
  try {
    const r = await fetch(`${base}${p}`, { headers: H })
    const t = await r.text()
    console.log(`\n### ${p} -> ${r.status}`)
    console.log(t.slice(0, 1500))
  } catch (e) {
    console.log(`\n### ${p} ERR`, e instanceof Error ? e.message : String(e))
  }
}
