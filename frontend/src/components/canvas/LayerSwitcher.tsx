'use client';

import { Icon, type IconName } from './Icon';
import { useSessionState } from './SessionStateProvider';
import { LAYER_REGISTRY } from './TabConfig';

export function LayerSwitcher() {
  const { state, dispatch } = useSessionState();
  const currentLayer = LAYER_REGISTRY.find((l) => l.id === state.activeLayer)!;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: currentLayer.color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
        {currentLayer.label}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
        {currentLayer.shortcut}
      </span>
    </div>
  );
}
