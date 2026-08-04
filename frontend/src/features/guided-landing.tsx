// src/features/guided-landing.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Vivim 2026 — Guided Landing (chat-as-landing-page)
// ─────────────────────────────────────────────────────────────────────────────
// The first-touch surface for a new user. Replaces the legacy card-wizard
// OnboardFlow with a single, dominant composer on a pure black-or-white
// background. The onboarding agent speaks FIRST — typing character-by-character
// into the same chat thread the user will use — and embeds provider-selection
// chips inline in its own message. When the user clicks a chip or types a
// provider name, the agent detects it, runs the entire Chrome-login walkthrough
// live in the chat (calling /api/setup/* in real-time), and only pauses for
// true user-gated moments (the actual provider login in the spawned Chrome).
//
// Design principles:
//   1. Black-or-white only — no gradients, no card chrome, no hero orb.
//   2. Composer is the canvas — single text input is the dominant surface.
//   3. Agent speaks first — demonstrates the core chat mechanism by typing.
//   4. Inline provider chips — selections happen INSIDE the chat thread.
//   5. Live execution — every step the agent types, it actually performs.
//   6. Minimal request-user — agent only pauses when truly blocked.
//   7. Monochrome + one accent — brand-500 only for cursor + chip hover.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { ProviderLogo, providerColor } from '@/components/canvas/Brand'
import { useIO } from '@/components/canvas/UnifiedIOProvider'
import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ProviderChip {
  id: string
  name: string
  desc: string
  isFree?: boolean
}

interface LandingMessage {
  id: string
  role: 'agent' | 'user'
  text: string
  chips?: ProviderChip[] // inline provider chips (agent messages only)
  chipsDisabled?: boolean // once a chip is picked, disable all chips
  fullyTyped?: boolean // whether the typing animation has completed
}

type LandingState =
  | 'booting'
  | 'awaiting_provider_pick'
  | 'launching_chrome'
  | 'awaiting_login'
  | 'completing'
  | 'done'
  | 'error'

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

interface Conversation {
  id: string
  providerId?: string
}

// ── Provider catalog ─────────────────────────────────────────────────────────

const PROVIDERS: ProviderChip[] = [
  { id: 'chatgpt', name: 'ChatGPT', desc: 'OpenAI', isFree: true },
  { id: 'claude', name: 'Claude', desc: 'Anthropic', isFree: true },
  { id: 'gemini', name: 'Gemini', desc: 'Google', isFree: true },
  { id: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek', isFree: false },
  { id: 'grok', name: 'Grok', desc: 'xAI', isFree: false },
  { id: 'qwen', name: 'Qwen', desc: 'Alibaba', isFree: false },
]

const PROVIDER_NAME_INDEX = new Map(
  PROVIDERS.flatMap((p) => [
    [p.id.toLowerCase(), p.id],
    [p.name.toLowerCase(), p.id],
  ]),
)

// ── Typing hook ──────────────────────────────────────────────────────────────
// Reveals a string character-by-character. Returns the visible substring and a
// `done` flag. Honors reduced-motion (instant reveal).

function useTypewriter(
  text: string,
  opts?: { cps?: number; onDone?: () => void; enabled?: boolean },
) {
  const { cps = 55, onDone, enabled = true } = opts ?? {}
  const [visible, setVisible] = useState('')
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    setVisible('')
    if (!enabled) {
      setVisible(text)
      onDoneRef.current?.()
      return
    }
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setVisible(text)
      onDoneRef.current?.()
      return
    }
    let i = 0
    const intervalMs = Math.max(8, Math.round(1000 / cps))
    const tick = () => {
      i += 1
      setVisible(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(handle)
        onDoneRef.current?.()
      }
    }
    const handle = setInterval(tick, intervalMs)
    return () => clearInterval(handle)
  }, [text, cps, enabled])

  return { visible, done: visible.length >= text.length }
}

// ── Agent message with typewriter ────────────────────────────────────────────

interface AgentBubbleProps {
  message: LandingMessage
  onTyped?: () => void
  onChipClick?: (chip: ProviderChip) => void
  chipsDisabled?: boolean
  isLast: boolean
}

function AgentBubble({ message, onTyped, onChipClick, chipsDisabled, isLast }: AgentBubbleProps) {
  // Only animate the LAST agent message — prior messages show fully.
  const shouldAnimate = isLast && !message.fullyTyped
  const { visible, done } = useTypewriter(message.text, {
    cps: 60,
    enabled: shouldAnimate,
    onDone: () => {
      onTyped?.()
    },
  })

  // Once typing is done, lock it as fully-typed (parent will persist this).
  useEffect(() => {
    if (done && shouldAnimate && !message.fullyTyped) {
      onTyped?.()
    }
  }, [done, shouldAnimate, message.fullyTyped, onTyped])

  const showCursor = shouldAnimate && !done
  const displayText = shouldAnimate ? visible : message.text

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
      <div
        style={{
          maxWidth: '78%',
          padding: '12px 16px',
          borderRadius: '14px 14px 14px 4px',
          background: 'transparent',
          color: 'var(--foreground)',
          fontSize: 15,
          lineHeight: 1.55,
          letterSpacing: '-0.005em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {displayText}
        {showCursor && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 7,
              height: 17,
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              background: 'var(--brand-500)',
              animation: 'guided-cursor-blink 1s steps(2, start) infinite',
              borderRadius: 1,
            }}
          />
        )}
        {/* Inline provider chips — render after the bubble text */}
        {message.chips && message.chips.length > 0 && (shouldAnimate ? done : true) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 14,
            }}
          >
            {message.chips.map((chip) => {
              const tint = providerColor(chip.id)
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={chipsDisabled}
                  onClick={() => onChipClick?.(chip)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px 7px 8px',
                    borderRadius: 999,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: chipsDisabled ? 'default' : 'pointer',
                    opacity: chipsDisabled ? 0.45 : 1,
                    transition:
                      'border-color 0.15s ease, transform 0.12s ease, background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (chipsDisabled) return
                    e.currentTarget.style.borderColor = `color-mix(in oklch, ${tint} 45%, var(--border))`
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: `color-mix(in oklch, ${tint} 14%, transparent)`,
                      color: tint,
                      flexShrink: 0,
                    }}
                  >
                    <ProviderLogo provider={chip.id} size={13} />
                  </span>
                  {chip.name}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      background: chip.isFree
                        ? 'rgba(34, 197, 94, 0.12)'
                        : 'rgba(168, 85, 247, 0.12)',
                      color: chip.isFree ? '#22c55e' : '#a855f7',
                      border: `1px solid ${
                        chip.isFree ? 'rgba(34, 197, 94, 0.25)' : 'rgba(168, 85, 247, 0.25)'
                      }`,
                      marginLeft: 2,
                    }}
                  >
                    {chip.isFree ? 'Free' : 'Pro'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── User bubble ──────────────────────────────────────────────────────────────

function UserBubble({ message }: { message: LandingMessage }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
      <div
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: '14px 14px 4px 14px',
          background: 'var(--foreground)',
          color: 'var(--background)',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontWeight: 500,
        }}
      >
        {message.text}
      </div>
    </div>
  )
}

// ── Composer (minimal) ───────────────────────────────────────────────────────

interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (text: string) => void
  disabled: boolean
  placeholder: string
  autoFocus: boolean
}

function MinimalComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  autoFocus,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 200)}px`
  }, [value])

  // Autofocus
  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) onSubmit(value.trim())
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 0,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '6px 6px 6px 18px',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 1px 2px rgb(0 0 0 / 0.03)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor =
          'color-mix(in oklch, var(--foreground) 25%, var(--border))'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label="Message Vivim"
        style={{
          flex: 1,
          resize: 'none',
          padding: '10px 0',
          border: 'none',
          background: 'transparent',
          color: 'var(--foreground)',
          fontSize: 15,
          lineHeight: 1.5,
          fontFamily: 'inherit',
          outline: 'none',
          minHeight: 24,
          maxHeight: 200,
          opacity: disabled ? 0.55 : 1,
        }}
      />
      <button
        type="button"
        onClick={() => value.trim() && !disabled && onSubmit(value.trim())}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          marginTop: 4,
          marginLeft: 8,
          borderRadius: '50%',
          border: 'none',
          background: disabled || !value.trim() ? 'var(--muted)' : 'var(--foreground)',
          color: 'var(--background)',
          cursor: disabled || !value.trim() ? 'default' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease, transform 0.12s ease',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 8L13 3.5L10.5 13L8.5 9L3 8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export type GuidedLandingMode = 'onboarding' | 'assistant'

interface GuidedLandingProps {
  isOpen: boolean
  mode?: GuidedLandingMode
  onClose?: () => void
  onComplete: (conversationId: string, providerId: string) => void
}

export function GuidedLanding({
  isOpen,
  mode = 'onboarding',
  onClose,
  onComplete,
}: GuidedLandingProps) {
  const io = useIO()
  const [messages, setMessages] = useState<LandingMessage[]>([])
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<LandingState>('booting')
  const [lastTypedId, setLastTypedId] = useState<string | null>(null)
  const [pickedProviderId, setPickedProviderId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const launchResultRef = useRef<LaunchResult | null>(null)
  const mountedRef = useRef(true)
  const stateRef = useRef<LandingState>('booting')
  // Refs to avoid stale-closure bugs in async flows that need to read latest state
  const messagesRef = useRef<LandingMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  })
  useEffect(() => {
    stateRef.current = state
  })

  // Cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, lastTypedId])

  // Escape key closes the overlay
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Reset state when opening fresh
  useEffect(() => {
    if (!isOpen) return
    setMessages([])
    setDraft('')
    setState('booting')
    setLastTypedId(null)
    setPickedProviderId(null)
  }, [isOpen])

  // ── Message queue helpers ────────────────────────────────────────────────

  const pushAgent = useCallback(
    (text: string, opts?: { chips?: ProviderChip[]; chipsDisabled?: boolean }) => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const msg: LandingMessage = {
        id,
        role: 'agent',
        text,
        chips: opts?.chips,
        chipsDisabled: opts?.chipsDisabled,
        fullyTyped: false,
      }
      setMessages((prev) => [...prev, msg])
      return id
    },
    [],
  )

  const pushUser = useCallback((text: string) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const msg: LandingMessage = {
      id,
      role: 'user',
      text,
      fullyTyped: true,
    }
    setMessages((prev) => [...prev, msg])
    return id
  }, [])

  const markFullyTyped = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, fullyTyped: true } : m)))
    setLastTypedId(id)
  }, [])

  // Wait for a message's typing animation to complete (ref-based, no stale closure)
  const waitForMessageTyped = useCallback((id: string, timeoutMs = 8000): Promise<void> => {
    return new Promise((resolve) => {
      const start = Date.now()
      const check = () => {
        const found = messagesRef.current.find((m) => m.id === id)
        if (found?.fullyTyped) {
          resolve()
          return
        }
        if (Date.now() - start > timeoutMs) {
          resolve()
          return
        } // safety timeout
        setTimeout(check, 60)
      }
      check()
    })
  }, [])

  // ── Boot sequence — agent introduces itself and asks for provider pick ──

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await new Promise((r) => setTimeout(r, 350))
      if (cancelled || !mountedRef.current) return
      if (mode === 'assistant') {
        pushAgent("Hey — I'm Vivim. What can I help you with?", {})
      } else {
        pushAgent("Hey — I'm Vivim. I'll be your canvas.", {})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pushAgent, mode])

  // When the first agent message finishes typing, push the second.
  useEffect(() => {
    if (messages.length !== 1) return
    if (messages[0]?.role !== 'agent' || !messages[0]?.fullyTyped) return
    if (state !== 'booting') return
    let cancelled = false
    ;(async () => {
      await new Promise((r) => setTimeout(r, 280))
      if (cancelled || !mountedRef.current) return
      if (mode === 'assistant') {
        pushAgent(
          'You can ask me to set up a new provider, troubleshoot connections, or anything else about Vivim. Pick a provider below to get started, or just type what you need.',
          { chips: PROVIDERS, chipsDisabled: false },
        )
      } else {
        pushAgent(
          "Pick the AI you already use and I'll wire it into your canvas automatically. You can also just type its name below.",
          { chips: PROVIDERS, chipsDisabled: false },
        )
      }
      setState('awaiting_provider_pick')
    })()
    return () => {
      cancelled = true
    }
  }, [messages, state, pushAgent, mode])

  // ── Onboarding flow runner (shared by chip-click and typed-provider paths) ─
  // Launches Chrome, polls for login, finalizes account + conversation.

  const runOnboardingFlow = useCallback(
    async (provider: ProviderChip) => {
      setState('launching_chrome')
      const launchMsgId = pushAgent(
        `Opening ${provider.name} in a Chrome window so you can log in. I'll watch for it — log in there and come back here when you're done.`,
      )

      // Wait for the launch message to finish typing before actually calling the API
      await waitForMessageTyped(launchMsgId)

      try {
        const { data: result } = await io.post<LaunchResult>('/api/setup/launch-visible', {
          providerId: provider.id,
          accountSlug: 'default',
          workspace: 'chrome-profiles',
        })
        if (!mountedRef.current) return
        launchResultRef.current = result
        setState('awaiting_login')
        pushAgent(`Chrome is up. Waiting for your ${provider.name} login…`)

        let attempts = 0
        pollRef.current = setInterval(async () => {
          attempts += 1
          if (!mountedRef.current || !launchResultRef.current) return
          try {
            const { data: v } = await io.post<VerifyResult>('/api/setup/verify', {
              port: launchResultRef.current.debugPort,
              providerId: provider.id,
            })
            if (!v.loggedIn) return
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            if (!mountedRef.current) return
            setState('completing')
            pushAgent('Login detected. Saving your profile…')
            await io.post('/api/setup/complete', {
              providerId: provider.id,
              accountSlug: 'default',
              workspace: 'chrome-profiles',
              profileDir: launchResultRef.current.profileDir,
              debugPort: launchResultRef.current.debugPort,
            })
            await io
              .post('/api/setup/kill', {
                port: launchResultRef.current.debugPort,
              })
              .catch(() => {})
            if (!mountedRef.current) return
            pushAgent('Creating your first conversation…')
            const { data: conv } = await io.post<Conversation>('/api/conversations', {
              providerId: provider.id,
            })
            if (!mountedRef.current) return
            pushAgent(
              `${provider.name} is connected. Dropping you into your canvas — say hi to get started.`,
            )
            setState('done')
            // Allow the user to read the final message + the fade-out animation
            // (0.6s delay + 0.6s transition = 1.2s) before handing off.
            setTimeout(() => {
              if (mountedRef.current) onComplete(conv.id, provider.id)
            }, 2200)
          } catch {
            if (attempts > 100 && pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
              if (mountedRef.current) {
                setState('error')
                pushAgent(
                  'I lost the connection to Chrome. You can click below to re-open the browser window.',
                  {
                    chips: [provider],
                    chipsDisabled: false,
                  },
                )
              }
            }
          }
        }, 3000)
      } catch (err) {
        if (!mountedRef.current) return
        setState('error')
        const msg = err instanceof Error ? err.message : 'Failed to launch Chrome'
        pushAgent(`I couldn't open Chrome: ${msg}. Click the chip below to try again:`, {
          chips: [provider],
          chipsDisabled: false,
        })
      }
    },
    [pushAgent, io, onComplete, waitForMessageTyped],
  )

  const activeProvider = PROVIDERS.find((p) => p.id === pickedProviderId)

  const relaunchChrome = useCallback(async () => {
    if (!activeProvider || !mountedRef.current) return
    try {
      pushAgent(`Re-opening Chrome for ${activeProvider.name}…`)
      const { data: result } = await io.post<LaunchResult>('/api/setup/launch-visible', {
        providerId: activeProvider.id,
        accountSlug: 'default',
        workspace: 'chrome-profiles',
      })
      if (!mountedRef.current) return
      launchResultRef.current = result
      setState('awaiting_login')
      pushAgent(
        `Chrome window re-opened on CDP port ${result.debugPort}. Log in there to continue.`,
      )
    } catch (err) {
      if (!mountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Re-launch failed'
      pushAgent(`Couldn't re-open Chrome: ${msg}`)
    }
  }, [activeProvider, io, pushAgent])

  const manualCheckLogin = useCallback(async () => {
    if (!activeProvider || !launchResultRef.current || !mountedRef.current) return
    try {
      const { data: v } = await io.post<VerifyResult>('/api/setup/verify', {
        port: launchResultRef.current.debugPort,
        providerId: activeProvider.id,
      })
      if (v.loggedIn) {
        pushAgent('Login verified! Completing setup…')
      } else {
        pushAgent(
          `Checked CDP port ${launchResultRef.current.debugPort} — still waiting for ${activeProvider.name} cookies. Complete your login in Chrome.`,
        )
      }
    } catch {
      pushAgent('Could not reach Chrome debug port. Click "Re-open Chrome Window" below.')
    }
  }, [activeProvider, io, pushAgent])

  // ── Provider pick handler (chip-click path) ──────────────────────────────

  const handleProviderPicked = useCallback(
    (provider: ProviderChip) => {
      if (stateRef.current !== 'awaiting_provider_pick') return
      if (pickedProviderId) return
      setPickedProviderId(provider.id)

      // Disable all chips on prior agent message
      setMessages((prev) =>
        prev.map((m) => (m.chips && m.chips.length > 0 ? { ...m, chipsDisabled: true } : m)),
      )

      // Echo user selection
      pushUser(`Use ${provider.name}.`)

      // Kick off the onboarding flow
      void runOnboardingFlow(provider)
    },
    [pickedProviderId, pushAgent, pushUser, runOnboardingFlow],
  )

  // ── Composer submit ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (text: string) => {
      const lower = text.toLowerCase().trim()

      // Provider detection — accept "chatgpt", "chat gpt", "i want chatgpt", "use claude", etc.
      const matched = detectProvider(lower)

      if (stateRef.current === 'awaiting_provider_pick' && matched) {
        const provider = PROVIDERS.find((p) => p.id === matched)
        if (provider) {
          setDraft('')
          pushUser(text)
          setPickedProviderId(provider.id)
          setMessages((prev) =>
            prev.map((m) => (m.chips && m.chips.length > 0 ? { ...m, chipsDisabled: true } : m)),
          )
          void runOnboardingFlow(provider)
          return
        }
      }

      // Otherwise: just echo the user's message and have the agent gently redirect
      setDraft('')
      pushUser(text)
      if (stateRef.current === 'awaiting_provider_pick') {
        pushAgent(
          'I didn\'t catch a provider name. Pick one of the chips above, or type its name (e.g. "ChatGPT").',
        )
      } else if (stateRef.current === 'awaiting_login') {
        pushAgent(
          "Still watching for your login in the Chrome window — once you log in there, I'll detect it.",
        )
      } else if (stateRef.current === 'done') {
        pushAgent('Almost there — taking you to your canvas now.')
      } else {
        pushAgent("One sec — I'm working on it.")
      }
    },
    [pushAgent, pushUser, runOnboardingFlow],
  )

  // ── Determine composer state ─────────────────────────────────────────────

  // Composer stays enabled through most states — the user should always be able
  // to type. Only disabled in terminal 'done' state (handoff is imminent) or
  // fatal 'error' state (they need to refresh).
  const composerDisabled = state === 'done'
  const composerPlaceholder = (() => {
    if (state === 'awaiting_provider_pick') return 'Type a provider name (e.g. ChatGPT, Claude)…'
    if (state === 'launching_chrome') return 'Opening Chrome… (you can still type)'
    if (state === 'awaiting_login') return 'Log in to Chrome — type here while you wait…'
    if (state === 'completing') return 'Finalizing…'
    if (state === 'done') return 'Taking you to your canvas…'
    return 'Message…'
  })()

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isOpen) return null

  return (
    <div
      className="guided-landing-root"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 2000,
        animation: 'guided-fade-in 0.5s ease-out',
        // Smooth fade-out when state becomes 'done' — gives a graceful handoff
        // to the canvas underneath instead of a jarring unmount.
        opacity: state === 'done' ? 0 : 1,
        transition: 'opacity 0.6s ease-out 0.6s',
        pointerEvents: state === 'done' ? 'none' : 'auto',
        // Pure monochrome — no gradient, no ambient glow, no card chrome.
        // Just the conversation and the composer, dead center.
      }}
    >
      {/* Tiny wordmark — top-left, almost invisible */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 24,
          left: 28,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--foreground)',
          opacity: 0.4,
        }}
      >
        Vivim
      </div>

      {/* Close button — top-right */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--card)',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            transition: 'background 0.15s ease, color 0.15s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--muted)'
            e.currentTarget.style.color = 'var(--foreground)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--card)'
            e.currentTarget.style.color = 'var(--muted-foreground)'
          }}
        >
          ×
        </button>
      )}

      {/* Conversation thread — scrollable, max-width for readability */}
      <div
        ref={scrollRef}
        className="guided-landing-thread scrollbar-thin"
        style={{
          width: '100%',
          maxWidth: 680,
          flex: 1,
          overflowY: 'auto',
          padding: '96px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          scrollbarWidth: 'thin',
        }}
      >
        {messages.map((m, i) =>
          m.role === 'agent' ? (
            <AgentBubble
              key={m.id}
              message={m}
              isLast={i === messages.length - 1}
              onTyped={() => markFullyTyped(m.id)}
              onChipClick={(chip) => handleProviderPicked(chip)}
              chipsDisabled={m.chipsDisabled || pickedProviderId !== null}
            />
          ) : (
            <UserBubble key={m.id} message={m} />
          ),
        )}

        {/* Live status indicator — shown while agent is actively working */}
        {(state === 'launching_chrome' || state === 'awaiting_login' || state === 'completing') && (
          <div
            aria-live="polite"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--muted-foreground)',
              fontFamily: 'var(--font-mono)',
              width: '100%',
              maxWidth: '78%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: state === 'completing' ? '#22c55e' : 'var(--brand-500)',
                    display: 'inline-block',
                    animation: 'guided-status-pulse 1.4s ease-in-out infinite',
                  }}
                />
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                  {state === 'launching_chrome' && 'Launching Chrome…'}
                  {state === 'awaiting_login' &&
                    `Watching for ${activeProvider?.name ?? 'Provider'} login…`}
                  {state === 'completing' && 'Finalizing setup & registering profile…'}
                </span>
              </div>
              {launchResultRef.current?.debugPort && (
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  CDP Port: {launchResultRef.current.debugPort}
                </span>
              )}
            </div>

            {state === 'awaiting_login' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => void relaunchChrome()}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--muted)',
                    color: 'var(--foreground)',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Re-open Chrome Window
                </button>
                <button
                  type="button"
                  onClick={() => void manualCheckLogin()}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--muted-foreground)',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Verify Login Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer — anchored to bottom, max-width matches thread */}
      <div
        className="guided-landing-composer-wrap"
        style={{
          width: '100%',
          maxWidth: 680,
          padding: '0 24px 36px',
        }}
      >
        <MinimalComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          autoFocus
        />
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
            fontSize: 11,
            color: 'var(--muted-foreground)',
          }}
        >
          <span>
            <kbd
              style={{
                padding: '1px 5px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                background: 'var(--muted)',
              }}
            >
              ↵
            </kbd>{' '}
            send
          </span>
          <span style={{ width: 1, height: 11, background: 'var(--border)' }} />
          <span>
            <kbd
              style={{
                padding: '1px 5px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                background: 'var(--muted)',
              }}
            >
              ⇧ ↵
            </kbd>{' '}
            new line
          </span>
        </div>
      </div>

      {/* Keyframes — scoped to this landing experience */}
      <style>{`
        @keyframes guided-cursor-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
        @keyframes guided-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes guided-status-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .guided-landing-root { animation: none !important; }
          @keyframes guided-cursor-blink {
            0%, 100% { opacity: 1; }
          }
        }
        /* Mobile-first responsive — composer + thread stay readable on phones */
        @media (max-width: 640px) {
          .guided-landing-thread { padding: 80px 16px 16px !important; }
          .guided-landing-composer-wrap { padding: 0 16px 24px !important; }
        }
      `}</style>
    </div>
  )
}

// ── Provider name detection ──────────────────────────────────────────────────

function detectProvider(text: string): string | null {
  // Strip filler words
  const cleaned = text
    .replace(
      /^(i\s+want\s+to\s+use|i\s+want\s+to|use|i\s+want|let'?s\s+use|let'?s|pick|choose|go\s+with|try)\s+/i,
      '',
    )
    .trim()

  // Direct match against id or name
  const direct = PROVIDER_NAME_INDEX.get(cleaned)
  if (direct) return direct

  // Try first word
  const firstWord = cleaned.split(/\s+/)[0] ?? ''
  const firstMatch = PROVIDER_NAME_INDEX.get(firstWord)
  if (firstMatch) return firstMatch

  // Loose containment — does any provider name appear in the text?
  for (const p of PROVIDERS) {
    if (cleaned.includes(p.id) || cleaned.includes(p.name.toLowerCase())) {
      return p.id
    }
  }

  return null
}

// ── Export for page.tsx integration ─────────────────────────────────────────

export { detectProvider as _detectProvider }

/** Returns true if no provider accounts exist on disk (first run). */
export async function checkNeedsSetup(): Promise<boolean> {
  try {
    const res = await fetch('/api/setup/profiles');
    const data = await res.json();
    return !data?.profiles || data.profiles.length === 0;
  } catch {
    return true;
  }
}
