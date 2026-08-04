'use client';

/**
 * components/canvas/cards/AutomationCard.tsx
 * --------------------------------------------------------------------
 * Automation card. Renders an AutomationDefinition row as a visual DAG
 * (nodes + edges). The builder publishes automation nodes as cards so
 * they're editable live (no rebuild — invariant 7).
 *
 * Each node is a small box; edges are SVG lines. The card supports
 * "Execute" (POST /api/automation/execute) which walks the DAG from
 * the trigger node.
 */

import { useState } from 'react';
import type { AutomationDefinition } from '../../../shared/automation';

export interface AutomationCardProps {
  automation: AutomationDefinition;
  onExecute?: (automationId: string) => void;
}

export function AutomationCard({ automation, onExecute }: AutomationCardProps) {
  const [running, setRunning] = useState(false);

  const handleExecute = () => {
    setRunning(true);
    onExecute?.(automation.id);
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: 'var(--bg)',
      }}
    >
      <header
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          fontSize: 11,
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>{automation.name}</strong>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--color-pink-surface, var(--bg-subtle))',
              color: 'var(--color-pink)',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {automation.trigger.kind}
          </span>
        </div>
        <div style={{ marginTop: 2, fontSize: 10, color: 'var(--muted-foreground)' }}>
          {automation.nodes.length} nodes · v{automation.version} · {automation.status}
        </div>
      </header>

      {/* DAG canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--muted)' }}>
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {automation.edges.map((edge) => {
            const from = automation.nodes.find((n) => n.id === edge.fromNodeId);
            const to = automation.nodes.find((n) => n.id === edge.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from.position.x + 50}
                y1={from.position.y + 18}
                x2={to.position.x + 50}
                y2={to.position.y + 18}
                stroke="var(--border)"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            );
          })}
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--text-muted)" />
            </marker>
          </defs>
        </svg>

        {automation.nodes.map((node) => (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: node.position.x,
              top: node.position.y,
              width: 100,
              padding: '4px 6px',
              borderRadius: 4,
              background:
                node.kind === 'trigger'
                  ? 'var(--color-warning-surface)'
                  : node.kind === 'hitl'
                    ? 'var(--color-error-surface)'
                    : node.kind === 'output'
                      ? 'var(--color-success-surface)'
                      : 'var(--bg)',
              border: '1px solid var(--border)',
              fontSize: 10,
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{node.kind}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>{node.label}</div>
          </div>
        ))}
      </div>

      <footer
        style={{
          padding: '4px 10px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          color: 'var(--text-muted)',
        }}
      >
        <span>
          capability: <code>{automation.capabilityId}</code>
        </span>
        <button
          onClick={handleExecute}
          disabled={running}
          style={{
            padding: '2px 10px',
            border: '1px solid var(--border)',
            background: running ? 'var(--bg-subtle)' : 'var(--bg)',
            borderRadius: 3,
            fontSize: 10,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running…' : '▶ Execute'}
        </button>
      </footer>
    </div>
  );
}
