'use client';

/**
 * components/canvas/cards/AgentCard.tsx
 * --------------------------------------------------------------------
 * Agent card. Renders an AgentDefinition row as a visual DAG (steps +
 * edges). The Agents Builder publishes agent cards on the canvas so
 * they're editable live (no rebuild).
 *
 * "Invoke" walks the step DAG from the entry step.
 */

import { useState } from 'react';
import type { AgentDefinition } from '../../../shared/agent';

export interface AgentCardProps {
  agent: AgentDefinition;
  onInvoke?: (agentId: string) => void;
}

export function AgentCard({ agent, onInvoke }: AgentCardProps) {
  const [running, setRunning] = useState(false);

  const handleInvoke = () => {
    setRunning(true);
    onInvoke?.(agent.id);
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: 'white',
      }}
    >
      <header
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: 11,
          color: '#374151',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>{agent.name}</strong>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: '#ede9fe',
              color: '#4c1d95',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            agent
          </span>
        </div>
        <div style={{ marginTop: 2, fontSize: 10, color: 'var(--muted-foreground)' }}>
          {agent.steps.length} steps · max {agent.maxLoopIterations} iters · v{agent.version}
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--muted)' }}>
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {agent.edges.map((edge) => {
            const from = agent.steps.find((s) => s.id === edge.fromStepId);
            const to = agent.steps.find((s) => s.id === edge.toStepId);
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from.position.x + 55}
                y1={from.position.y + 18}
                x2={to.position.x + 55}
                y2={to.position.y + 18}
                stroke="var(--border)"
                strokeWidth={1.5}
                markerEnd="url(#arrow-agent)"
              />
            );
          })}
          <defs>
            <marker id="arrow-agent" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#9ca3af" />
            </marker>
          </defs>
        </svg>

        {agent.steps.map((step) => (
          <div
            key={step.id}
            style={{
              position: 'absolute',
              left: step.position.x,
              top: step.position.y,
              width: 110,
              padding: '4px 6px',
              borderRadius: 4,
              background:
                step.kind === 'perceive'
                  ? '#dbeafe'
                  : step.kind === 'think'
                    ? '#fef3c7'
                    : step.kind === 'act'
                      ? '#d1fae5'
                      : step.kind === 'hitl'
                        ? '#fee2e2'
                        : step.kind === 'output'
                          ? '#e9d5ff'
                          : 'white',
              border: '1px solid #d1d5db',
              fontSize: 10,
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: '#374151' }}>{step.kind}</div>
            <div style={{ color: '#6b7280', fontSize: 9 }}>{step.label}</div>
          </div>
        ))}
      </div>

      <footer
        style={{
          padding: '4px 10px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          color: '#6b7280',
        }}
      >
        <span>
          capability: <code>{agent.capabilityId}</code>
        </span>
        <button
          onClick={handleInvoke}
          disabled={running}
          style={{
            padding: '2px 10px',
            border: '1px solid #d1d5db',
            background: running ? '#f3f4f6' : 'white',
            borderRadius: 3,
            fontSize: 10,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Invoking…' : '▶ Invoke'}
        </button>
      </footer>
    </div>
  );
}
