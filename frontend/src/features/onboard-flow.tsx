// frontend/src/features/onboard-flow.tsx
// 3-step provider onboarding: Pick → Login → Ready
// Reuses: PROVIDERS, api(), checkNeedsSetup(), auto-poll verify pattern
// from provider-setup-wizard.tsx (simplified, no workspace/restore/account-nickname steps)

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface LaunchResult {
  ok: boolean
  profileDir: string
  debugPort: number
  pid: number
  loginUrl: string
}

interface VerifyResult {
  alive: boolean
  loggedIn: boolean
  url: string
  port: number
  method: string
}

interface ProfileEntry {
  providerId: string
  accountSlug: string
  profileDir: string
  hasCookies: boolean
  dbLinked: boolean
}

interface Conversation {
  id: string
  title?: string
  providerId?: string
}

// ── Provider catalog ─────────────────────────────────────────────────────────

export const PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', desc: 'OpenAI' },
  { id: 'claude', name: 'Claude', icon: '🧠', desc: 'Anthropic' },
  { id: 'gemini', name: 'Gemini', icon: '✨', desc: 'Google' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔍', desc: 'DeepSeek' },
  { id: 'grok', name: 'Grok', icon: '⚡', desc: 'xAI' },
  { id: 'qwen', name: 'Qwen', icon: '🌐', desc: 'Alibaba' },
]

// ── API helpers ──────────────────────────────────────────────────────────────

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path.startsWith('/') ? path : `/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Source': 'frontend', ...init?.headers },
  })
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

/** Returns true if no provider accounts exist on disk (first run). */
export async function checkNeedsSetup(): Promise<boolean> {
  try {
    const data = await api<{ profiles: ProfileEntry[] }>('/api/setup/profiles')
    return (data.profiles ?? []).length === 0
  } catch {
    return true
  }
}

// ── Main component ───────────────────────────────────────────────────────────

type Step = 'pick' | 'login' | 'ready'

interface OnboardFlowProps {
  onComplete: (conversationId: string) => void
}

export function OnboardFlow({ onComplete }: OnboardFlowProps) {
  const [step, setStep] = useState<Step>('pick')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // ── Step 1: Pick provider ─────────────────────────────────────────────────

  const handlePick = async (id: string) => {
    setProviderId(id)
    setLaunching(true)
    setError(null)
    try {
      const result = await api<LaunchResult>('/api/setup/launch-visible', {
        method: 'POST',
        body: JSON.stringify({
          providerId: id,
          accountSlug: 'default',
          workspace: 'chrome-profiles',
        }),
      })
      if (!mountedRef.current) return
      setLaunchResult(result)
      setStep('login')
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to launch Chrome')
    } finally {
      if (mountedRef.current) setLaunching(false)
    }
  }

  // ── Step 2: Login (auto-poll verify) ──────────────────────────────────────

  const verifyAndComplete = useCallback(async () => {
    if (!launchResult || !providerId || !mountedRef.current) return
    try {
      const v = await api<VerifyResult>('/api/setup/verify', {
        method: 'POST',
        body: JSON.stringify({ port: launchResult.debugPort, providerId }),
      })
      if (!v.loggedIn || !mountedRef.current) return

      // Login detected — stop polling
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }

      // Register account in DB
      await api('/api/setup/complete', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          accountSlug: 'default',
          workspace: 'chrome-profiles',
          profileDir: launchResult.profileDir,
          debugPort: launchResult.debugPort,
        }),
      })

      // Kill Chrome process (profile stays on disk)
      await api('/api/setup/kill', {
        method: 'POST',
        body: JSON.stringify({ port: launchResult.debugPort }),
      }).catch(() => {}) // non-fatal if kill fails

      // Create conversation linked to this provider
      const conv = await api<Conversation>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ providerId }),
      })

      if (!mountedRef.current) return
      setStep('ready')
      // Small delay so user sees the success state
      setTimeout(() => onComplete(conv.id), 1500)
    } catch {
      // Polling error — retry on next tick
    }
  }, [launchResult, providerId, onComplete])

  useEffect(() => {
    if (step !== 'login') return
    pollRef.current = setInterval(verifyAndComplete, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [step, verifyAndComplete])

  // ── Render ────────────────────────────────────────────────────────────────

  const provider = PROVIDERS.find((p) => p.id === providerId)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <div style={{
        width: 420, maxWidth: '90vw',
        background: 'var(--card, #fff)', borderRadius: 12,
        border: '1px solid var(--border, #e5e7eb)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        padding: 28,
      }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {(['pick', 'login', 'ready'] as Step[]).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: (['pick', 'login', 'ready'].indexOf(step) >= i)
                ? 'var(--ring, #3b82f6)' : 'var(--muted, #e5e7eb)',
            }} />
          ))}
        </div>

        {/* Step 1: Pick */}
        {step === 'pick' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Add a provider</h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', marginBottom: 20 }}>
              Pick the AI you want to chat with.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePick(p.id)}
                  disabled={launching}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 8,
                    border: '1px solid var(--border, #e5e7eb)',
                    background: 'var(--background, #fff)',
                    cursor: launching ? 'wait' : 'pointer',
                    opacity: launching ? 0.6 : 1,
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)' }}>{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {error && (
              <p style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>{error}</p>
            )}
          </div>
        )}

        {/* Step 2: Login */}
        {step === 'login' && provider && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{provider.icon}</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              Log in to {provider.name}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)', marginBottom: 20 }}>
              A Chrome window has opened. Log in, then come back here.
            </p>
            <div style={{
              padding: '14px 18px', borderRadius: 8,
              background: 'var(--muted, #f3f4f6)',
              fontSize: 13, color: 'var(--foreground, #111)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#22c55e', display: 'inline-block',
                  animation: 'pulse 2s infinite',
                }} />
                Waiting for {provider.name} login...
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)', fontFamily: 'monospace' }}>
                Profile: {launchResult?.profileDir}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 'ready' && provider && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24,
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              {provider.name} connected
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>
              Your chat is ready.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
