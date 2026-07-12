// web/sandbox/src/features/skeletons.tsx
// Unit 10.2 — Loading + skeleton states for all async surfaces

export function Skeleton({ width, height, className }: {
  width?: string
  height?: string
  className?: string
}) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`}
      style={{ width, height }}
    />
  )
}

export function MessageSkeleton() {
  return (
    <div className="mb-3">
      <div className="inline-block max-w-[80%]">
        <Skeleton width="60%" height="12px" className="mb-1" />
        <Skeleton width="90%" height="12px" className="mb-1" />
        <Skeleton width="70%" height="12px" />
      </div>
    </div>
  )
}

export function ConversationListSkeleton() {
  return (
    <div className="w-64 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-2 mb-1">
          <Skeleton width="80%" height="14px" className="mb-1" />
          <Skeleton width="40%" height="10px" />
        </div>
      ))}
    </div>
  )
}

export function HealthDashboardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton width="24px" height="24px" className="rounded-full" />
          <div className="flex-1">
            <Skeleton width="60%" height="12px" className="mb-1" />
            <Skeleton width="40%" height="10px" />
          </div>
          <Skeleton width="60px" height="20px" className="rounded" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r border-gray-800 p-2">
        <ConversationListSkeleton />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-gray-800 flex items-center px-4">
          <Skeleton width="120px" height="16px" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
