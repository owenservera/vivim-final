// web/ui/src/features/canvas/FirstRunWizard.tsx
// Guided first-run wizard: Welcome → Install Providers → Set Up Workspace →
// Import Conversations → Done.
// v2: provider install via API, workspace templates, import preview + upload.

import { useState, useCallback, type ReactNode, type ChangeEvent } from 'react'

export type WizardStep = 'welcome' | 'providers' | 'workspace' | 'import' | 'done'

interface FirstRunWizardProps {
  onComplete: () => void
}

type WorkspaceTemplate = 'ai-chat' | 'developer' | 'researcher' | 'blank'

interface ProviderInfo {
  slug: string
  name: string
  description: string
  selected: boolean
}

const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  { slug: 'chatgpt', name: 'ChatGPT', description: 'OpenAI ChatGPT', selected: true },
  { slug: 'claude', name: 'Claude', description: 'Anthropic Claude', selected: true },
  { slug: 'gemini', name: 'Gemini', description: 'Google Gemini', selected: false },
]

const TEMPLATES: { id: WorkspaceTemplate; name: string; description: string; layers: string[] }[] = [
  { id: 'ai-chat', name: 'AI Chat', description: 'Chat + Knowledge layers', layers: ['Chat', 'Knowledge'] },
  { id: 'developer', name: 'Developer', description: 'Chat + Projects + Docs', layers: ['Chat', 'Projects', 'Docs'] },
  { id: 'researcher', name: 'Researcher', description: 'Chat + Knowledge + Projects', layers: ['Chat', 'Knowledge', 'Projects'] },
  { id: 'blank', name: 'Blank Canvas', description: 'No pre-built layers', layers: [] },
]

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export function FirstRunWizard({ onComplete }: FirstRunWizardProps): ReactNode {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [providers, setProviders] = useState(AVAILABLE_PROVIDERS)
  const [installing, setInstalling] = useState(false)
  const [installResults, setInstallResults] = useState<Record<string, string>>({})
  const [template, setTemplate] = useState<WorkspaceTemplate>('ai-chat')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ count: number; titles: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  const STEPS = [
    { id: 'welcome' as WizardStep, label: 'Welcome', description: 'About VIVIM' },
    { id: 'providers' as WizardStep, label: 'Providers', description: 'Connect your AI accounts' },
    { id: 'workspace' as WizardStep, label: 'Workspace', description: 'Configure your workspace' },
    { id: 'import' as WizardStep, label: 'Import', description: 'Bring in your history' },
    { id: 'done' as WizardStep, label: 'Done', description: 'Start using VIVIM' },
  ]

  const currentIdx = STEPS.findIndex((s) => s.id === step)

  const toggleProvider = useCallback((slug: string) => {
    setProviders((prev) => prev.map((p) => (p.slug === slug ? { ...p, selected: !p.selected } : p)))
  }, [])

  const handleInstall = useCallback(async () => {
    const toInstall = providers.filter((p) => p.selected)
    setInstalling(true)
    const results: Record<string, string> = {}
    for (const p of toInstall) {
      try {
        const res = await fetch(`${BASE_URL}/api/plugins/install`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Source': 'frontend' },
          body: JSON.stringify({ providerSlug: p.slug }),
        })
        if (res.ok) {
          results[p.slug] = 'ok'
        } else {
          results[p.slug] = `Error: ${res.status}`
        }
      } catch (e) {
        results[p.slug] = (e as Error).message
      }
    }
    setInstallResults(results)
    setInstalling(false)
    setStep('workspace')
  }, [providers])

  const handleWorkspaceCreate = useCallback(async () => {
    const tpl = TEMPLATES.find((t) => t.id === template)
    if (!tpl) return
    try {
      await fetch(`${BASE_URL}/api/canvas/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Source': 'frontend' },
        body: JSON.stringify({ name: 'Workspace', category: 'system', z: 0 }),
      })
      for (let i = 0; i < tpl.layers.length; i++) {
        await fetch(`${BASE_URL}/api/canvas/layers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Source': 'frontend' },
          body: JSON.stringify({ name: tpl.layers[i], category: tpl.layers[i].toLowerCase(), z: (i + 1) * 10 }),
        })
      }
      window.localStorage.setItem('vivim.welcome_completed', 'true')
    } catch {}
    setStep('import')
  }, [template])

  const handleFilePreview = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    // Simulate preview by reading first 20 lines
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        const convos = Array.isArray(data) ? data : (data.conversations ?? data.messages ?? [])
        const titles = convos.slice(0, 20).map((c: { title?: string }) => c.title ?? 'Untitled')
        setImportPreview({ count: convos.length, titles })
      } catch {
        setImportPreview({ count: 0, titles: ['Unable to parse file'] })
      }
    }
    reader.readAsText(file.slice(0, 1024 * 1024))
  }, [])

  const handleImport = useCallback(async () => {
    if (!importFile) return
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', importFile)
      await fetch(`${BASE_URL}/api/knowledge/import`, {
        method: 'POST',
        headers: { 'X-Source': 'frontend' },
        body: form,
      })
    } catch {}
    setImporting(false)
    setStep('done')
  }, [importFile])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary, #111827)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9990,
        color: 'var(--text-primary, #f9fafb)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Progress bar */}
      <div style={{ padding: '24px 48px', borderBottom: '1px solid var(--border-primary, #374151)' }}>
        <div style={{ display: 'flex', gap: 0, maxWidth: 700, margin: '0 auto' }}>
          {STEPS.map((s, idx) => (
            <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, fontWeight: 600,
                background: idx < currentIdx ? 'var(--accent-primary, #6366f1)' : idx === currentIdx ? 'var(--accent-primary, #6366f1)' : 'var(--bg-tertiary, #374151)',
                color: idx <= currentIdx ? '#fff' : 'var(--text-muted, #6b7280)',
              }}>
                {idx < currentIdx ? '\u2713' : idx + 1}
              </div>
              <div style={{ fontSize: 11, color: idx <= currentIdx ? 'var(--text-secondary, #d1d5db)' : 'var(--text-muted, #6b7280)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, overflow: 'auto' }}>
        {step === 'welcome' && (
          <WizardCard title="Welcome to VIVIM">
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.6 }}>
              VIVIM is your local-first platform for managing AI conversations across multiple providers on an infinite canvas. Let's get you set up in a few quick steps.
            </p>
          </WizardCard>
        )}

        {step === 'providers' && (
          <WizardCard title="Install Providers">
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)', marginBottom: 16 }}>
              Choose which AI providers to install. You can add more later from Settings.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {providers.map((p) => (
                <label
                  key={p.slug}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderRadius: 8, border: '1px solid var(--border-primary, #374151)',
                    background: 'var(--bg-secondary, #1f2937)', cursor: 'pointer',
                    opacity: installResults[p.slug] ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={p.selected}
                    disabled={!!installResults[p.slug]}
                    onChange={() => toggleProvider(p.slug)}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent-primary, #6366f1)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>{p.description}</div>
                  </div>
                  {installResults[p.slug] && (
                    <span style={{ fontSize: 12, color: installResults[p.slug] === 'ok' ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)' }}>
                      {installResults[p.slug] === 'ok' ? '\u2713 Installed' : installResults[p.slug]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </WizardCard>
        )}

        {step === 'workspace' && (
          <WizardCard title="Choose Workspace Template">
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)', marginBottom: 16 }}>
              Pick a starting layout for your canvas. You can customize everything later.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  style={{
                    padding: '16px', borderRadius: 8, border: template === t.id ? '2px solid var(--accent-primary, #6366f1)' : '1px solid var(--border-primary, #374151)',
                    background: template === t.id ? 'var(--bg-secondary, #1f2937)' : 'transparent',
                    color: 'var(--text-primary, #f9fafb)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>{t.description}</div>
                  {t.layers.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {t.layers.map((l) => (
                        <span key={l} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary, #374151)', fontSize: 11 }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </WizardCard>
        )}

        {step === 'import' && (
          <WizardCard title="Import Conversations">
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)', marginBottom: 16 }}>
              Import your AI conversation history from ChatGPT, Claude, or Gemini.
            </p>
            <div style={{
              border: '2px dashed var(--border-primary, #374151)', borderRadius: 8, padding: 32,
              textAlign: 'center', background: 'var(--bg-secondary, #1f2937)',
            }}>
              {!importPreview ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)', marginBottom: 12 }}>
                    Drag & drop a JSON export file here, or click to browse
                  </p>
                  <input type="file" accept=".json,.zip" onChange={handleFilePreview}
                    style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)' }} />
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 14, marginBottom: 8 }}>
                    Found <strong>{importPreview.count}</strong> conversations
                  </p>
                  {importPreview.titles.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', textAlign: 'left', maxHeight: 200, overflow: 'auto' }}>
                      {importPreview.titles.slice(0, 10).map((t, i) => (
                        <li key={i} style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', padding: '2px 0' }}>
                          {t}
                        </li>
                      ))}
                      {importPreview.titles.length > 10 && (
                        <li style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>
                          ...and {importPreview.titles.length - 10} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </WizardCard>
        )}

        {step === 'done' && (
          <WizardCard title="You're All Set!">
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.6 }}>
              Your workspace is ready. Start chatting, managing knowledge, and building automations on the infinite canvas.
            </p>
          </WizardCard>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '16px 48px',
        borderTop: '1px solid var(--border-primary, #374151)', maxWidth: 700, margin: '0 auto', width: '100%',
      }}>
        <button
          type="button"
          disabled={step === 'welcome'}
          onClick={() => {
            const prev = STEPS[currentIdx - 1]
            if (prev) setStep(prev.id)
          }}
          style={{
            padding: '8px 20px', fontSize: 14, borderRadius: 6,
            border: '1px solid var(--border-primary, #374151)', background: 'transparent',
            color: step === 'welcome' ? 'var(--text-muted, #6b7280)' : 'var(--text-secondary, #d1d5db)',
            cursor: step === 'welcome' ? 'default' : 'pointer',
          }}
        >
          Back
        </button>
        <button
          type="button"
          disabled={installing || importing}
          onClick={() => {
            if (step === 'done') { onComplete(); return }
            if (step === 'providers') { handleInstall(); return }
            if (step === 'workspace') { handleWorkspaceCreate(); return }
            if (step === 'import') {
              if (importFile) { handleImport(); return }
              setStep('done'); return
            }
            const next = STEPS[currentIdx + 1]
            if (next) setStep(next.id)
          }}
          style={{
            padding: '8px 20px', fontSize: 14, fontWeight: 600, borderRadius: 6, border: 'none',
            background: (installing || importing) ? 'var(--bg-tertiary, #374151)' : 'var(--accent-primary, #6366f1)',
            color: '#fff', cursor: (installing || importing) ? 'default' : 'pointer',
          }}
        >
          {installing ? 'Installing...' : importing ? 'Importing...' : step === 'done' ? 'Start Using VIVIM' : step === 'providers' ? 'Install Providers' : step === 'workspace' ? 'Create Workspace' : step === 'import' ? (importFile ? 'Import' : 'Skip Import') : 'Next'}
        </button>
      </div>
    </div>
  )
}

function WizardCard({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div style={{
      maxWidth: 560, width: '100%', padding: 32, borderRadius: 12,
      border: '1px solid var(--border-primary, #374151)',
      background: 'var(--bg-secondary, #1f2937)',
    }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600 }}>{title}</h2>
      {children}
    </div>
  )
}
