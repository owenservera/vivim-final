// web/ui/src/features/canvas/ErrorBoundary.tsx
// React error boundary wrapping each canvas component (sandbox, layer host, UiComponent iframe).
// On crash, shows error state with "Reload Component" button and emits canvas:layer:error event.

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  instanceId?: string
  componentKey?: string
  onError?: (instanceId: string | undefined, error: Error) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo): void {
    this.props.onError?.(this.props.instanceId, error)
    try {
      window.dispatchEvent(
        new CustomEvent('canvas:layer:error', {
          detail: {
            instanceId: this.props.instanceId,
            componentKey: this.props.componentKey,
            message: error.message,
            stack: error.stack,
          },
        }),
      )
    } catch {
      // best-effort event emission
    }
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: '#1f1f2e',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            fontSize: 13,
            textAlign: 'center',
            minHeight: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>Component Error</div>
          <div style={{ fontSize: 12, color: '#f87171', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: 4,
              padding: '4px 12px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid #ef4444',
              background: 'transparent',
              color: '#fca5a5',
              cursor: 'pointer',
            }}
          >
            Reload Component
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
