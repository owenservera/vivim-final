const SESSION = "ses_020dd8f11ffeqwIFkZqIh41UXG"
const base = "http://127.0.0.1:9420"

async function post(path: string, body: unknown, timeoutMs = 30000): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal })
    const txt = await r.text()
    let b: unknown
    try { b = JSON.parse(txt) } catch { b = txt.slice(0, 300) }
    return { ok: r.ok, status: r.status, body: b }
  } catch (e) {
    return { ok: false, status: 0, body: String(e) }
  } finally { clearTimeout(t) }
}

console.log("sending message to", SESSION)
const r = await post("/api/opencode/send", { sessionId: SESSION, prompt: "Reply with exactly: OPENCODE-OK" }, 45000)
console.log("status", r.status, r.ok ? "OK" : "FAIL")
console.log(JSON.stringify(r.body).slice(0, 800))
