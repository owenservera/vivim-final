'use client';

import { useEffect, useState } from 'react';

type Step = 'welcome' | 'workspace' | 'model' | 'provider' | 'task';

interface OnboardingState {
  completed: boolean
  step: Step
  workspace: 'chat' | 'canvas' | 'both'
  model: string
  provider: string
}

const STORAGE_KEY = 'vivim:onboarding:v1';

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  step: 'welcome',
  workspace: 'both',
  model: 'default',
  provider: 'chatgpt',
}

export function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
  const [open, setOpen] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as OnboardingState
        if (parsed.completed) {
          return
        }
      }
    } catch {
      // ignore
    }
    setTimeout(() => { setOpen(true) }, 0)
    return () => {}
  }, [])

  // Initialize open state from localStorage on mount
  useEffect(() => {
    const initializeOpen = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as OnboardingState
          if (parsed.completed) {
            setOpen(false)
          } else {
            setOpen(true)
          }
        } else {
          setOpen(true)
        }
      } catch {
        setOpen(true)
      }
    }
    setTimeout(initializeOpen, 0)
  }, [])

  const advance = (patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const finish = () => {
    const done = { ...state, completed: true }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done))
    setOpen(false)
    onComplete?.()
  }

  if (!open) return null

  const stepOrder: Step[] = ['welcome', 'workspace', 'model', 'provider', 'task']
  const currentIndex = stepOrder.indexOf(state.step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border bg-white p-6 shadow-xl">
        {state.step === 'welcome' && (
          <WelcomeStep onNext={() => advance({ step: 'workspace' })} />
        )}
        {state.step === 'workspace' && (
          <WorkspaceStep
            value={state.workspace}
            onSelect={(workspace) => advance({ step: 'model', workspace })}
          />
        )}
        {state.step === 'model' && (
          <ModelStep
            value={state.model}
            onSelect={(model) => advance({ step: 'provider', model })}
          />
        )}
        {state.step === 'provider' && (
          <ProviderStep
            value={state.provider}
            onSelect={(provider) => advance({ step: 'task', provider })}
          />
        )}
        {state.step === 'task' && (
          <TaskStep onFinish={finish} provider={state.provider} />
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1">
            {stepOrder.map((s, i) => (
              <div
                key={s}
                className={`h-1 w-8 rounded ${
                  i <= currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {currentIndex + 1} / {stepOrder.length}
          </span>
        </div>
      </div>
    </div>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Welcome to vivim</h2>
      <p className="text-gray-600">
        Your local-first AI conversation workspace. Chat with ChatGPT, Claude, and Gemini
        side-by-side, capture every response, and build your knowledge graph.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Get Started
        </button>
      </div>
    </div>
  )
}

function WorkspaceStep({
  value,
  onSelect,
}: {
  value: 'chat' | 'canvas' | 'both'
  onSelect: (workspace: 'chat' | 'canvas' | 'both') => void
}) {
  const options: { id: 'chat' | 'canvas' | 'both'; label: string; desc: string }[] = [
    { id: 'chat', label: 'Chat', desc: 'Classic multi-turn conversations' },
    { id: 'canvas', label: 'Canvas', desc: 'Infinite node-based workspace' },
    { id: 'both', label: 'Both', desc: 'Chat + Canvas side-by-side' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Choose your workspace</h2>
      <p className="text-gray-600">Pick the layout that fits how you work.</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`p-3 rounded-lg border text-left ${
              value === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="font-medium">{opt.label}</div>
            <div className="text-xs text-gray-500">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ModelStep({
  value,
  onSelect,
}: {
  value: string
  onSelect: (model: string) => void
}) {
  const models = [
    { id: 'default', label: 'Auto (provider default)' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pick a default model</h2>
      <p className="text-gray-600">You can change this anytime in settings.</p>
      <div className="space-y-2">
        {models.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`w-full p-3 rounded-lg border text-left ${
              value === m.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProviderStep({
  value,
  onSelect,
}: {
  value: string
  onSelect: (provider: string) => void
}) {
  const providers = [
    { id: 'chatgpt', name: 'ChatGPT', icon: '🤖' },
    { id: 'claude', name: 'Claude', icon: '🪨' },
    { id: 'gemini', name: 'Gemini', icon: '💎' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍' },
    { id: 'qwen', name: 'Qwen', icon: '🌐' },
    { id: 'grok', name: 'Grok', icon: '⚡' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Select your primary provider</h2>
      <p className="text-gray-600">You can add more later.</p>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`p-3 rounded-lg border text-left flex items-center gap-2 ${
              value === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{p.icon}</span>
            <span className="font-medium">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TaskStep({ onFinish, provider }: { onFinish: () => void; provider: string }) {
  const sample = `Explain quantum computing in one paragraph.`

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Try your first task</h2>
      <p className="text-gray-600">
        Send this sample message to <strong>{provider}</strong> to see streaming in action.
      </p>
      <div className="p-3 bg-gray-50 rounded border text-sm text-gray-700">{sample}</div>
      <button
        onClick={onFinish}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Launch {provider}
      </button>
    </div>
  )
}
