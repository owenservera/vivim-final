// web/ui/src/features/command-bar.tsx
// NLCL Command Bar — the consumer-facing natural language input.
// User types "open my resume" or "go to cnn and summarize the news"
// and the system deterministically parses + executes — no AI needed.

import { useState, useRef, useCallback, useEffect } from 'react'

export interface CommandBarResult {
  ok: boolean
  intent: string
  text: string
  error?: string
  followUp?: string
  latencyMs: number
}

interface CommandBarProps {
  apiBase?: string
  providerId?: string
  conversationId?: string
  onResult?: (result: CommandBarResult) => void
  placeholder?: string
}

export function CommandBar({
  apiBase = '',
  providerId,
  conversationId,
  onResult,
  placeholder = 'Type a command... (e.g. "open my resume", "go to cnn and summarize the news")',
}: CommandBarProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CommandBarResult | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const execute = useCallback(async (rawInput: string) => {
    if (!rawInput.trim()) return
    setLoading(true)
    setResult(null)

    setHistory((prev) => [...prev, rawInput])
    setHistoryIndex(-1)

    try {
      const response = await fetch(`${apiBase}/api/nlcl/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: rawInput,
          surface: 'frontend',
          providerId,
          conversationId,
        }),
      })

      const data = (await response.json()) as CommandBarResult
      setResult(data)
      onResult?.(data)
    } catch (err) {
      const errorResult: CommandBarResult = {
        ok: false,
        intent: 'error',
        text: '',
        error: err instanceof Error ? err.message : 'Request failed',
        latencyMs: 0,
      }
      setResult(errorResult)
      onResult?.(errorResult)
    } finally {
      setLoading(false)
    }
  }, [apiBase, providerId, conversationId, onResult])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    execute(input)
    setInput('')
  }, [input, execute])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIndex)
      setInput(history[newIndex] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return
      const newIndex = historyIndex + 1
      if (newIndex >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(newIndex)
        setInput(history[newIndex] ?? '')
      }
    } else if (e.key === 'Escape') {
      setInput('')
      setResult(null)
      setHistoryIndex(-1)
    }
  }, [history, historyIndex])

  const loadHelp = useCallback(async () => {
    setShowHelp((prev) => !prev)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="nlcl-command-bar">
      <form onSubmit={handleSubmit} className="nlcl-form">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className="nlcl-input"
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()} className="nlcl-submit">
          {loading ? '...' : 'Run'}
        </button>
        <button type="button" onClick={loadHelp} className="nlcl-help-btn">
          ?
        </button>
      </form>

      {result && (
        <div className={`nlcl-result ${result.ok ? 'ok' : 'error'}`}>
          <div className="nlcl-result-intent">{result.intent}</div>
          {result.text && <div className="nlcl-result-text">{result.text}</div>}
          {result.error && <div className="nlcl-result-error">{result.error}</div>}
          {result.followUp && <div className="nlcl-result-followup">{result.followUp}</div>}
          <div className="nlcl-result-meta">{result.latencyMs}ms</div>
        </div>
      )}

      {showHelp && <HelpPanel apiBase={apiBase} />}
    </div>
  )
}

function HelpPanel({ apiBase }: { apiBase: string }) {
  const [help, setHelp] = useState<{ categories: Record<string, string[]>; totalCommands: number } | null>(null)

  useEffect(() => {
    fetch(`${apiBase}/api/nlcl/help`)
      .then((r) => r.json())
      .then(setHelp)
      .catch(() => {})
  }, [apiBase])

  if (!help) return <div className="nlcl-help-loading">Loading...</div>

  return (
    <div className="nlcl-help-panel">
      <h3>Available Commands ({help.totalCommands})</h3>
      {Object.entries(help.categories).map(([category, commands]) => (
        <div key={category} className="nlcl-help-category">
          <h4>{category}</h4>
          <ul>
            {commands.map((cmd, i) => (
              <li key={i}>{cmd}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
