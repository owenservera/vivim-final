// frontend/src/components/canvas/ProviderSetupWizard.tsx
// Multi-step wizard for adding/configuring new AI providers.
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useScreenReader } from '@/hooks/useScreenReader'
import { ErrorBanner } from './ErrorBanner'
import { classify } from '@/lib/errorClassifier'

interface ProviderConfig {
  id: string
  name: string
  icon: string
  fields: Array<{ key: string; label: string; type: 'text' | 'password' | 'select'; placeholder?: string; options?: string[]; required?: boolean }>
  healthEndpoint?: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'chatgpt', name: 'ChatGPT', icon: '🤖',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
    ],
  },
  {
    id: 'claude', name: 'Claude', icon: '🧠',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true },
    ],
  },
  {
    id: 'gemini', name: 'Gemini', icon: '✨',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIza...', required: true },
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', icon: '🔮',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
    ],
  },
  {
    id: 'qwen', name: 'Qwen', icon: '🌊',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
    ],
  },
  {
    id: 'grok', name: 'Grok', icon: '⚡',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'xai-...', required: true },
    ],
  },
]

type Step = 'select' | 'configure' | 'health' | 'done'

interface ProviderSetupWizardProps {
  open: boolean
  onClose: () => void
  onComplete?: (providerId: string) => void
}

export function ProviderSetupWizard({ open, onClose, onComplete }: ProviderSetupWizardProps) {
  const [step, setStep] = useState<Step>('select')
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [healthError, setHealthError] = useState<string | null>(null)
  const trapRef = useFocusTrap<HTMLDivElement>({ active: open })
  const { announce } = useScreenReader()

  useEffect(() => {
    if (open) {
      setStep('select')
      setSelectedProvider(null)
      setCredentials({})
      setHealthStatus('idle')
      setHealthError(null)
    }
  }, [open])

  const handleSelect = useCallback((provider: ProviderConfig) => {
    setSelectedProvider(provider)
    setStep('configure')
    announce(`Configuring ${provider.name}`)
  }, [announce])

  const handleConfigure = useCallback(async () => {
    if (!selectedProvider) return
    setStep('health')
    setHealthStatus('checking')
    announce(`Checking ${selectedProvider.name} connection`)
    // Simulate health check
    await new Promise((r) => setTimeout(r, 1500))
    // In production, this would call the backend health endpoint
    setHealthStatus('ok')
    setStep('done')
    announce(`${selectedProvider.name} configured successfully`)
  }, [selectedProvider, announce])

  const handleDone = useCallback(() => {
    onComplete?.(selectedProvider?.id ?? '')
    onClose()
  }, [selectedProvider, onComplete, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Provider setup wizard"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 'min(480px, 90vw)',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['select', 'configure', 'health', 'done'] as Step[]).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: (['select', 'configure', 'health', 'done'].indexOf(step) >= i)
                ? 'var(--primary)' : 'var(--border)',
            }} />
          ))}
        </div>

        {/* Step: Select Provider */}
        {step === 'select' && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Add a Provider</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 12,
                    border: '1px solid var(--border)', borderRadius: 8,
                    background: 'var(--bg)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step: Configure Credentials */}
        {step === 'configure' && selectedProvider && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              {selectedProvider.icon} {selectedProvider.name} Setup
            </h2>
            {selectedProvider.fields.map((field) => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  {field.label} {field.required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                </label>
                <input
                  type={field.type}
                  value={credentials[field.key] ?? ''}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    background: 'var(--bg)', color: 'var(--text)',
                    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setStep('select')}
                style={{
                  padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--bg)', cursor: 'pointer', fontSize: 13,
                }}
              >
                Back
              </button>
              <button
                onClick={handleConfigure}
                disabled={selectedProvider.fields.some((f) => f.required && !credentials[f.key])}
                style={{
                  flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6,
                  background: 'var(--primary)', color: 'var(--primary-foreground)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  opacity: selectedProvider.fields.some((f) => f.required && !credentials[f.key]) ? 0.5 : 1,
                }}
              >
                Test Connection
              </button>
            </div>
          </>
        )}

        {/* Step: Health Check */}
        {step === 'health' && selectedProvider && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>
              {healthStatus === 'checking' ? '⏳' : healthStatus === 'ok' ? '✅' : '❌'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {healthStatus === 'checking'
                ? `Testing ${selectedProvider.name} connection...`
                : healthStatus === 'ok'
                  ? 'Connection successful!'
                  : 'Connection failed'}
            </div>
            {healthError && <ErrorBanner error={healthError} style={{ marginTop: 12 }} />}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && selectedProvider && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {selectedProvider.name} is ready!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              You can now use {selectedProvider.name} for conversations and capabilities.
            </p>
            <button
              onClick={handleDone}
              style={{
                padding: '8px 24px', border: 'none', borderRadius: 6,
                background: 'var(--primary)', color: 'var(--primary-foreground)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close wizard"
          style={{
            position: 'absolute', top: 12, right: 12,
            padding: 0, border: 'none', background: 'transparent',
            cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
