'use client';

/**
 * components/canvas/ZLayerPanel.tsx (E2)
 * --------------------------------------------------------------------
 * Configurable Z-layer panel. Shows the 6 canonical layers
 * (background/base/content/overlay/modal/cursor) with:
 *   - Visibility toggles (eye icon)
 *   - Lock toggles (lock icon)
 *   - Opacity sliders
 *   - Depth display (z-index base)
 *   - Active layer selector (where new nodes land)
 *   - Reorder (drag handles — stubbed for now)
 *
 * Data-driven from the ZLayerStore via /api/zlayer.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceZLayerConfig, ZLayerId, ZLayerConfig } from '../../shared/z-layer';
import { Z_LAYER_DEFAULTS } from '../../shared/z-layer';
import { useIO } from './UnifiedIOProvider';

const LAYER_ORDER: ZLayerId[] = ['cursor', 'modal', 'overlay', 'content', 'base', 'background'];

export function ZLayerPanel({ workspaceId }: { workspaceId: string }) {
  const io = useIO();
  const [config, setConfig] = useState<WorkspaceZLayerConfig | null>(null);

  const fetchConfig = async () => {
    const res = await io.get<{ config: WorkspaceZLayerConfig }>(`/api/zlayer/get?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setConfig(res.data.config);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfig();
  }, [workspaceId]);

  const updateLayer = async (layerId: ZLayerId, patch: Partial<ZLayerConfig>) => {
    if (!config) return;
    // Optimistic update.
    setConfig({
      ...config,
      layers: { ...config.layers, [layerId]: { ...config.layers[layerId], ...patch } },
    });
    await io.post('/api/zlayer/update', { workspaceId, layerId, patch });
  };

  const setActive = async (layerId: ZLayerId) => {
    if (!config) return;
    setConfig({ ...config, activeLayer: layerId });
    await io.post('/api/zlayer/set_active', { workspaceId, layerId });
  };

  if (!config) return <div style={{ padding: 16, color: 'var(--text-muted)' }}>Loading layers…</div>;

  return (
    <div style={{ padding: 12, fontFamily: 'ui-sans-serif, system-ui', color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>Z-Layers</strong>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Active: <code style={{ fontSize: 10 }}>{config.activeLayer}</code>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {LAYER_ORDER.map((id) => {
          const layer = config.layers[id];
          const def = Z_LAYER_DEFAULTS[id];
          const isActive = config.activeLayer === id;
          return (
            <div
              key={id}
              style={{
                padding: '6px 8px',
                border: '1px solid',
                borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                borderRadius: 6,
                background: isActive ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
              }}
            >
              <span style={{ fontSize: 14 }}>{def.icon}</span>
              <button
                onClick={() => setActive(id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {def.label}
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-subtle)', minWidth: 40, textAlign: 'right' }}>
                z={layer.depth}
              </span>
              <button
                onClick={() => updateLayer(id, { visible: !layer.visible })}
                title={layer.visible ? 'Hide' : 'Show'}
                style={iconBtn}
              >
                {layer.visible ? '' : ''}
              </button>
              <button
                onClick={() => updateLayer(id, { locked: !layer.locked })}
                title={layer.locked ? 'Unlock' : 'Lock'}
                style={iconBtn}
              >
                {layer.locked ? '' : ''}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={layer.opacity}
                onChange={(e) => updateLayer(id, { opacity: Number(e.target.value) })}
                title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                style={{ width: 50, accentColor: 'var(--accent)' }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, padding: 8, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        New nodes land on the <strong>{Z_LAYER_DEFAULTS[config.activeLayer].label}</strong> layer (z={config.layers[config.activeLayer].depth}).
        Click a layer name to set it active.
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13,
  padding: '0 2px',
  fontFamily: 'inherit',
};
