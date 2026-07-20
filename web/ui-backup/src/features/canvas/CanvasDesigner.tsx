// web/ui/src/features/canvas/CanvasDesigner.tsx
// Spec 002 (P2) — frontend designer tool for creating/editing canvas layer
// definitions (HTML, CSS, scriptUrl, bindings). Publishes via cap:canvas:define,
// which the backend CanvasDesigner.engine handles. Live preview updates as HTML
// changes. (The backend designer already exists; this is the UI surface.)

import { useCallback, useState, type ReactNode } from 'react'
import { capabilityApi } from '../../api/client.js'

interface CanvasDesignerProps {
  open: boolean
  onClose: () => void
  onPublished?: (slug: string) => void
}

export function CanvasDesigner({ open, onClose, onPublished }: CanvasDesignerProps): ReactNode {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('plugin')
  const [html, setHtml] = useState('<div class="layer-root">\n  <!-- your layer markup -->\n</div>')
  const [css, setCss] = useState('.layer-root { padding: 16px; }')
  const [scriptUrl, setScriptUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const publish = useCallback(async () => {
    if (!slug.trim() || !name.trim() || !html.trim()) {
      setError('slug, name, and html are required')
      return
    }
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await capabilityApi.execute('cap:canvas:define', {
        slug,
        name,
        category,
        html,
        css,
        scriptUrl: scriptUrl || undefined,
        bindings: [],
        layout: { x: 0, y: 0, z: 10, w: 320, h: 240 },
      })
      if (res.ok) {
        setDone(`Published "${name}" (${slug})`)
        onPublished?.(slug)
      } else {
        setError(res.error ?? 'Publish failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }, [slug, name, category, html, css, scriptUrl, onPublished])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9995,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(900px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--bg-secondary, #1f2937)',
          border: '1px solid var(--border-primary, #374151)',
          borderRadius: 12,
          color: 'var(--text-primary, #f9fafb)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-primary, #374151)' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Canvas Designer</h2>
          <button type="button" onClick={onClose} style={iconBtn}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Slug">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-layer" style={input} />
            </Field>
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Layer" style={input} />
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>
                <option value="plugin">plugin</option>
                <option value="chat">chat</option>
                <option value="knowledge">knowledge</option>
                <option value="system">system</option>
              </select>
            </Field>
            <Field label="Script URL (optional)">
              <input value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)} placeholder="https://…/layer.js" style={input} />
            </Field>
            <Field label="HTML">
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={8} style={input} />
            </Field>
            <Field label="CSS">
              <textarea value={css} onChange={(e) => setCss(e.target.value)} rows={4} style={input} />
            </Field>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>Preview</div>
            <iframe
              title="layer-preview"
              sandbox="allow-scripts"
              srcDoc={`<style>${css}</style>${html}`}
              style={{ flex: 1, minHeight: 280, border: '1px solid var(--border-primary, #374151)', borderRadius: 8, background: '#fff' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: '1px solid var(--border-primary, #374151)' }}>
          {error && <span style={{ color: 'var(--danger, #ef4444)', fontSize: 13, marginRight: 'auto', alignSelf: 'center' }}>{error}</span>}
          {done && <span style={{ color: 'var(--success, #10b981)', fontSize: 13, marginRight: 'auto', alignSelf: 'center' }}>{done}</span>}
          <button type="button" onClick={onClose} style={btn}>Cancel</button>
          <button type="button" onClick={() => void publish()} disabled={busy} style={{ ...btn, background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none' }}>
            {busy ? 'Publishing…' : 'Publish Layer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary, #d1d5db)' }}>
      {label}
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border-primary, #374151)',
  background: 'var(--bg-primary, #111827)',
  color: 'var(--text-primary, #f9fafb)',
  fontFamily: 'inherit',
}

const btn: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border-primary, #374151)',
  background: 'transparent',
  color: 'var(--text-secondary, #d1d5db)',
  cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary, #d1d5db)',
  fontSize: 16,
  cursor: 'pointer',
}
