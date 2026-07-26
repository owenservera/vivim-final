import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

/**
 * Three-dot loading indicator (typing / waiting).
 * Pure CSS — no JS timers.
 */
function LoadingDots({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn("inline-flex gap-1 items-center", className)} style={style} aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: 'loading-dot-bounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes loading-dot-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  )
}

/**
 * Spinning indicator for async operations.
 */
function Spinner({ size = 14, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn("inline-block animate-spin", className)}
      style={{
        width: size,
        height: size,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        ...style,
      }}
      role="status"
      aria-label="Loading"
    />
  )
}

export { Skeleton, LoadingDots, Spinner }
