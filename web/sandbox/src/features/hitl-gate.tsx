// web/sandbox/src/features/hitl-gate.tsx
// HITL Gate UI — modal for human-in-the-loop approval/denial/skip.
// Listens for autonomous:gate_created events via WebSocket and
// renders the gate prompt with options.

import { useEffect, useState, useCallback } from 'react'

export interface HitlGateProps {
  gate: {
    id: string
    taskId: string
    stepId: string
    gateType: string
    prompt: string
    options: string[]
    defaultValue: string | null
    status: string
    expiresAt: number | null
  }
  onResolve: (gateId: string, response: string) => void
  onDismiss: (gateId: string) => void
}

function formatTimeLeft(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const seconds = Math.floor(remaining / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

export function HitlGateModal({ gate, onResolve, onDismiss }: HitlGateProps) {
  const [inputValue, setInputValue] = useState(gate.defaultValue ?? '')
  const [timeLeft, setTimeLeft] = useState(
    gate.expiresAt ? formatTimeLeft(gate.expiresAt) : '',
  )
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!gate.expiresAt) return
    const interval = setInterval(() => {
      const remaining = gate.expiresAt! - Date.now()
      if (remaining <= 0) {
        setExpired(true)
        clearInterval(interval)
      }
      setTimeLeft(formatTimeLeft(gate.expiresAt!))
    }, 1000)
    return () => clearInterval(interval)
  }, [gate.expiresAt])

  const handleOption = useCallback(
    (value: string) => {
      onResolve(gate.id, value)
    },
    [gate.id, onResolve],
  )

  const handleSubmit = useCallback(() => {
    if (inputValue.trim()) {
      onResolve(gate.id, inputValue.trim())
    }
  }, [gate.id, inputValue, onResolve])

  const handleDismiss = useCallback(() => {
    onDismiss(gate.id)
  }, [gate.id, onDismiss])

  if (gate.status !== 'pending') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              {gate.gateType}
            </span>
            {timeLeft && (
              <span
                className={`text-xs font-mono ${expired ? 'text-red-400' : 'text-gray-400'}`}
              >
                {expired ? 'Expired' : timeLeft}
              </span>
            )}
          </div>

          <p className="text-white text-sm mb-4">{gate.prompt}</p>

          {gate.gateType === 'question' || gate.gateType === 'input' ? (
            <div className="space-y-3">
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
                placeholder="Type your response..."
                disabled={expired}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || expired}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Submit
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-gray-400 text-sm hover:text-gray-200"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : gate.options.length > 0 ? (
            <div className="space-y-2">
              {gate.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleOption(option)}
                  disabled={expired}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm text-left hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {option}
                </button>
              ))}
              <button
                onClick={handleDismiss}
                className="w-full px-3 py-1.5 text-gray-500 text-sm hover:text-gray-300"
              >
                Skip
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleOption('approve')}
                disabled={expired}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleOption('deny')}
                disabled={expired}
                className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                Deny
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-gray-400 text-sm hover:text-gray-200"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Hook that subscribes to WebSocket for live HITL gates. */
export function useHitlGates(wsRef: React.MutableRefObject<WebSocket | null>) {
  const [gates, setGates] = useState<HitlGateProps['gate'][]>([])

  useEffect(() => {
    // Fetch existing pending gates on mount
    fetch('/api/autonomous/gates/pending')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGates(data)
      })
      .catch(() => {})
  }, [])

  const resolveGate = useCallback(async (gateId: string, response: string) => {
    try {
      await fetch(`/api/autonomous/gates/${gateId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      setGates((prev) => prev.filter((g) => g.id !== gateId))
    } catch (err) {
      console.error('Failed to resolve gate:', err)
    }
  }, [])

  const dismissGate = useCallback((gateId: string) => {
    setGates((prev) => prev.filter((g) => g.id !== gateId))
  }, [])

  return { gates, resolveGate, dismissGate }
}
