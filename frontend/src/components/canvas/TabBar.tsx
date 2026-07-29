'use client';

import { useCallback, useRef } from 'react';
import { Icon, type IconName } from './Icon';
import { useSessionState } from './SessionStateProvider';
import { LAYER_REGISTRY, PANEL_REGISTRY, getTabsForLayer, CATEGORY_COLORS } from './TabConfig';
import { Truncate } from './Truncate';
import type { SessionAction } from './SessionStateProvider';

interface TabBarProps {
  workspaceId: string;
  onPanelClick: (panelId: string) => void;
}

export function TabBar({ workspaceId, onPanelClick }: TabBarProps) {
  const { state, dispatch, isPanelOpen } = useSessionState();
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const currentLayer = state.activeLayer;
  const tabs = getTabsForLayer(currentLayer);
  const layerConfig = LAYER_REGISTRY.find((l) => l.id === currentLayer)!;
  const position = state.tabs.position;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // R2-P1-4: Cmd+1/2/3 and Cmd+0 handled globally in page.tsx — removed from here

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === state.layers[currentLayer]?.activePanel);
        // R2-P2-4: Wrap-around navigation
        const nextIndex = e.key === 'ArrowDown'
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        if (nextTab) {
          tabRefs.current.get(nextTab.id)?.focus();
        }
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.dataset.panelId) {
          onPanelClick(focused.dataset.panelId);
        }
      }

      if (e.key === 'Escape') {
        const active = state.layers[currentLayer]?.activePanel;
        if (active) {
          dispatch({ type: 'PANEL_CLOSE', layerId: currentLayer, panelId: active });
        }
      }
    },
    [currentLayer, tabs, state.layers, dispatch, onPanelClick],
  );

  return (
    <div
      role="tablist"
      aria-label="Canvas tabs"
      aria-orientation="vertical"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: 48,
        bottom: 0,
        [position]: 0,
        width: state.tabs.collapsedWidth,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elevated)',
        borderRight: position === 'left' ? '1px solid var(--border)' : 'none',
        borderLeft: position === 'right' ? '1px solid var(--border)' : 'none',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Layer switcher */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 4px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {LAYER_REGISTRY.map((layer) => {
          const isActive = layer.id === currentLayer;
          return (
            <button
              key={layer.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`${layer.label} layer (${layer.shortcut})`}
              onClick={() => dispatch({ type: 'LAYER_SWITCH', layerId: layer.id })}
              title={`${layer.label} — ${layer.shortcut}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 4px',
                border: 'none',
                borderRadius: 4,
                background: isActive ? layer.color : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'inherit',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              <Icon name={layer.icon as IconName} size={12} />
              {state.tabs.showLabels && (
                <span style={{ fontSize: 9, lineHeight: 1 }}>{layer.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div style={{ height: 2, background: layerConfig.color, margin: '4px 8px', borderRadius: 1, opacity: 0.5 }} />

      {/* Panel tabs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 4px',
          flex: 1,
        }}
      >
        {tabs.map((tab) => {
          const isOpen = isPanelOpen(tab.id);
          const isActive = state.layers[currentLayer]?.activePanel === tab.id;
          const categoryColor = CATEGORY_COLORS[tab.category];

          return (
            <button
              key={tab.id}
              ref={(el) => { if (el) tabRefs.current.set(tab.id, el); }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              data-panel-id={tab.id}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onPanelClick(tab.id)}
              title={tab.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 6px',
                border: 'none',
                borderLeft: isActive ? `3px solid ${categoryColor}` : '3px solid transparent',
                borderRadius: 0,
                background: isActive ? 'color-mix(in oklch, var(--bg-subtle) 80%, transparent)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 0.12s ease, color 0.12s ease',
                position: 'relative',
              }}
            >
              <Icon name={tab.icon as IconName} size={14} />
              {state.tabs.showLabels && (
                <Truncate style={{ flex: 1 }}>
                  {tab.label}
                </Truncate>
              )}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    minWidth: 14,
                    height: 14,
                    padding: '0 3px',
                    background: categoryColor,
                    color: '#fff',
                    borderRadius: 7,
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: '14px',
                    textAlign: 'center',
                  }}
                >
                  {tab.badge}
                </span>
              )}
              {tab.panelType === 'indicator' && tab.indicatorColor && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: tab.indicatorColor,
                    marginLeft: 'auto',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* P2-7: Show/hide labels toggle */}
      <div
        style={{
          padding: '4px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={() => dispatch({ type: 'TAB_SET_SHOW_LABELS', showLabels: !state.tabs.showLabels })}
          title={state.tabs.showLabels ? 'Hide labels' : 'Show labels'}
          aria-label={state.tabs.showLabels ? 'Hide tab labels' : 'Show tab labels'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 28,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'inherit',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--muted)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Icon name={state.tabs.showLabels ? 'list' : 'grid'} size={12} />
        </button>
      </div>
    </div>
  );
}
