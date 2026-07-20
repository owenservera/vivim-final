// web/ui/src/features/canvas/LoadingSkeleton.tsx
// Loading and empty state components for canvas layers (PRD-C2 §4).

import type { ReactNode } from 'react'

interface SkeletonProps {
  width?: number
  height?: number
  /** Show shimmer animation for mounting layers. */
  active?: boolean
}

export function LoadingSkeleton({ width = 300, height = 120, active = true }: SkeletonProps): ReactNode {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: '#1f2937',
        border: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontSize: 13,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ zIndex: 1 }}>Loading...</div>
      {active && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }}
        />
      )}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

interface EmptyLayerProps {
  message?: string
  children?: ReactNode
}

export function EmptyLayer({ message = 'Empty layer — drag components here', children }: EmptyLayerProps): ReactNode {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 8,
        border: '1px dashed #374151',
        background: '#111827',
        color: '#6b7280',
        fontSize: 13,
        textAlign: 'center',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <div>{message}</div>
      {children}
    </div>
  )
}
