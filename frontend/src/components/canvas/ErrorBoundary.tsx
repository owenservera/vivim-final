// components/canvas/ErrorBoundary.tsx
// React error boundary that catches render errors and shows a fallback UI.
// Used by SandboxedNode and CanvasNode to prevent one broken node from
// crashing the entire canvas.

'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** If true, automatically retry rendering after a delay. */
  autoRetry?: boolean
  /** Delay in ms before auto-retry (default 3000). */
  retryDelay?: number
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  retryCount: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(_prev: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
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
          retryCount: s.retryCount + 1,
        }))
      }, delay)
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          data-error-boundary="true"
          style={{
            padding: 12,
            borderRadius: 6,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: 12,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Render error</div>
          <div style={{ opacity: 0.8, marginBottom: 8 }}>
            {this.state.error?.message ?? 'Unknown error'}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #fecaca',
              background: '#fff',
              color: '#991b1b',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
