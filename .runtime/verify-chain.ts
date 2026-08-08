const PORT = Number(process.env.CAP_STORE_PORT) || 9420
const base = `http://127.0.0.1:${PORT}`

async function probe(path: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(`${base}${path}`, { signal: ac.signal })
    const txt = await r.text()
    let body: unknown
    try { body = JSON.parse(txt) } catch { body = txt.slice(0, 200) }
    return { ok: r.ok, status: r.status, body }
  } catch (e) {
    return { ok: false, status: 0, body: String(e) }
  } finally {
    clearTimeout(t)
  }
}

const readyz = await probe('/readyz', 15000)
console.log('readyz        ', readyz.status, readyz.ok ? 'OK' : 'FAIL', JSON.stringify(readyz.body).slice(0, 120))

if (readyz.ok) {
  const caps = await probe('/api/capabilities?surface=cli')
  const list = (caps.body as any)?.capabilities ?? (caps.body as any)?.items ?? []
  console.log('capabilities  ', caps.status, Array.isArray(list) ? `${list.length} caps` : JSON.stringify(caps.body).slice(0, 160))
  const opencodeCaps = Array.isArray(list) ? list.filter((c: any) => c.slug?.startsWith('cap:opencode')) : []
  console.log('opencode caps', opencodeCaps.map((c: any) => c.slug).join(', ') || '(none)')

  const health = await probe('/health')
  console.log('health        ', health.status, JSON.stringify(health.body).slice(0, 160))
}
