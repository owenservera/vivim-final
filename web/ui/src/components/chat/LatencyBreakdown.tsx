'use client';

export interface TimingInfo {
  totalMs: number;
  stages: { name: string; ms: number }[];
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function LatencyBreakdown({ timing }: { timing: TimingInfo }) {
  if (!timing.stages || timing.stages.length === 0) return null;

  const maxMs = Math.max(...timing.stages.map((s) => s.ms), 1);

  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 12px',
        background: 'var(--bg-subtle)',
        borderRadius: 6,
        fontSize: 11,
        color: 'var(--text-muted)',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text)' }}>
        Latency • {formatMs(timing.totalMs)}
      </div>
      {timing.stages.map((stage) => (
        <div
          key={stage.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span style={{ width: 80, flexShrink: 0 }}>{stage.name}</span>
          <div
            style={{
              flex: 1,
              height: 6,
              background: 'var(--border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(stage.ms / maxMs) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <span style={{ width: 50, textAlign: 'right', flexShrink: 0 }}>
            {formatMs(stage.ms)}
          </span>
        </div>
      ))}
    </div>
  );
}
