'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { logError } from '@/lib/errorLogger'
import { FullPageError } from '@/components/FullPageError'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
  /** Callback when an error is caught. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** If true, automatically retry rendering after a delay. */
  autoRetry?: boolean
  /** Delay in ms before auto-retry (default 3000). */
  retryDelay?: number
  /** Use full-page fallback (for top-level boundary). */
  fullPage?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
    logError(error, this.props.name, errorInfo.componentStack ?? undefined)
  }

  componentDidUpdate(_prev: Props, prevState: State): void {
    if (
      this.props.autoRetry &&
      this.state.hasError &&
      !prevState.hasError &&
      this.state.retryCount < 3
    ) {
      const delay = this.props.retryDelay ?? 3000
      setTimeout(() => {
        this.setState((s) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: s.retryCount + 1,
        }))
      }, delay)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      if (this.props.fullPage && this.state.error) {
        return (
          <FullPageError
            error={this.state.error}
            errorInfo={this.state.errorInfo ?? undefined}
            onRetry={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          />
        )
      }

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
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
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
