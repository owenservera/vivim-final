'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: 16,
          margin: 8,
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 8,
          background: 'var(--bg-secondary, #f9fafb)',
          color: 'var(--text, #111827)',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Something went wrong{this.props.name ? ` in ${this.props.name}` : ''}
          </div>
          <div style={{ color: 'var(--text-muted, #6b7280)', fontSize: 12 }}>
            {this.state.error?.message ?? 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8,
              padding: '4px 12px',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 4,
              background: 'var(--bg, #fff)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
