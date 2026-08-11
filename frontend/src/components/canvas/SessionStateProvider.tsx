'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { z } from 'zod';
import type { LayerId, PanelType } from './TabConfig';
import { getPanelType } from './TabConfig';
import { getLayerConfig } from './TabConfig';

export interface LayerState {
  openPanels: string[];
  activePanel: string | null;
  panelSizes: Record<string, { width: number; height: number }>;
}

export interface CanvasSessionState {
  activeLayer: LayerId;
  layers: Record<LayerId, LayerState>;
  tabs: {
    position: 'left' | 'right';
    collapsedWidth: number;
    expandedWidth: number;
    autoOrganize: boolean;
    showLabels: boolean;
  };
  composer: {
    draft: string;
    selectedModel: string | null;
    enabledAddOns: string[];
  };
  session: {
    id: string;
    userId: string;
    workspaceId: string;
    createdAt: number;
    lastActiveAt: number;
  };
}

export type SessionAction =
  | { type: 'LAYER_SWITCH'; layerId: LayerId }
  | { type: 'PANEL_OPEN'; layerId: LayerId; panelId: string }
  | { type: 'PANEL_CLOSE'; layerId: LayerId; panelId: string }
  | { type: 'PANEL_TOGGLE'; layerId: LayerId; panelId: string }
  | { type: 'PANEL_RESIZE'; layerId: LayerId; panelId: string; size: { width: number; height: number } }
  | { type: 'TAB_SET_POSITION'; position: 'left' | 'right' }
  | { type: 'TAB_AUTO_ORGANIZE'; enabled: boolean }
  | { type: 'TAB_SET_SHOW_LABELS'; showLabels: boolean }
  | { type: 'COMPOSER_SET_DRAFT'; draft: string }
  | { type: 'COMPOSER_SET_MODEL'; modelId: string }
  | { type: 'SESSION_HYDRATE'; state: CanvasSessionState }
  | { type: 'SESSION_RESET' };

const STORAGE_KEY = 'vivim:canvas:ssoa';

function makeLayerState(): LayerState {
  return { openPanels: [], activePanel: null, panelSizes: {} };
}

function getInitialState(): CanvasSessionState {
  return {
    activeLayer: 'chat',
    layers: {
      chat: makeLayerState(),
      build: makeLayerState(),
      admin: makeLayerState(),
    },
    tabs: {
      position: 'right',
      collapsedWidth: 48,
      expandedWidth: 320,
      autoOrganize: false,
      showLabels: true,
    },
    composer: {
      draft: '',
      selectedModel: null,
      enabledAddOns: [],
    },
    session: {
      id: `session-${Date.now()}`,
      userId: 'user:demo',
      workspaceId: 'ws:global',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    },
  };
}

// R2-P2-2: Zod schema for localStorage hydration validation
const LayerStateSchema = z.object({
  openPanels: z.array(z.string()),
  activePanel: z.string().nullable(),
  panelSizes: z.record(z.string(), z.object({ width: z.number(), height: z.number() })),
});

const SessionStateSchema = z.object({
  activeLayer: z.enum(['chat', 'build', 'admin']),
  layers: z.object({
    chat: LayerStateSchema,
    build: LayerStateSchema,
    admin: LayerStateSchema,
  }),
  tabs: z.object({
    position: z.enum(['left', 'right']),
    collapsedWidth: z.number(),
    expandedWidth: z.number(),
    autoOrganize: z.boolean(),
    showLabels: z.boolean(),
  }),
  composer: z.object({
    draft: z.string(),
    selectedModel: z.string().nullable(),
    enabledAddOns: z.array(z.string()),
  }),
  session: z.object({
    id: z.string(),
    userId: z.string(),
    workspaceId: z.string(),
    createdAt: z.number(),
    lastActiveAt: z.number(),
  }),
});

function loadFromStorage(): CanvasSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // R2-P2-2: Validate shape — return null on invalid data (triggers fresh state)
    const result = SessionStateSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data as CanvasSessionState;
  } catch {
    return null;
  }
}

function sessionReducer(state: CanvasSessionState, action: SessionAction): CanvasSessionState {
  switch (action.type) {
    case 'LAYER_SWITCH':
      return { ...state, activeLayer: action.layerId, session: { ...state.session, lastActiveAt: Date.now() } };

    case 'PANEL_OPEN': {
      const layer = state.layers[action.layerId];
      if (layer.openPanels.includes(action.panelId)) return state;
      const incomingType = getPanelType(action.panelId);
      let openPanels = [...layer.openPanels, action.panelId];
      if (incomingType === 'full') {
        openPanels = openPanels.filter((id) => id === action.panelId || getPanelType(id) !== 'full');
      }
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            openPanels,
            activePanel: action.panelId,
          },
        },
      };
    }

    case 'PANEL_CLOSE': {
      const layer = state.layers[action.layerId];
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            openPanels: layer.openPanels.filter((id) => id !== action.panelId),
            activePanel: layer.activePanel === action.panelId ? null : layer.activePanel,
          },
        },
      };
    }

    case 'PANEL_TOGGLE': {
      const layer = state.layers[action.layerId];
      const isOpen = layer.openPanels.includes(action.panelId);
      if (isOpen) {
        return {
          ...state,
          layers: {
            ...state.layers,
            [action.layerId]: {
              ...layer,
              openPanels: layer.openPanels.filter((id) => id !== action.panelId),
              activePanel: layer.activePanel === action.panelId ? null : layer.activePanel,
            },
          },
        };
      }
      const incomingType = getPanelType(action.panelId);
      let openPanels = [...layer.openPanels, action.panelId];
      if (incomingType === 'full') {
        openPanels = openPanels.filter((id) => id === action.panelId || getPanelType(id) !== 'full');
      }
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            openPanels,
            activePanel: action.panelId,
          },
        },
      };
    }

    case 'PANEL_RESIZE': {
      const layer = state.layers[action.layerId];
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            panelSizes: { ...layer.panelSizes, [action.panelId]: action.size },
          },
        },
      };
    }

    case 'TAB_SET_POSITION':
      return { ...state, tabs: { ...state.tabs, position: action.position } };

    case 'TAB_AUTO_ORGANIZE':
      return { ...state, tabs: { ...state.tabs, autoOrganize: action.enabled } };

    case 'TAB_SET_SHOW_LABELS':
      return { ...state, tabs: { ...state.tabs, showLabels: action.showLabels } };

    case 'COMPOSER_SET_DRAFT':
      return { ...state, composer: { ...state.composer, draft: action.draft } };

    case 'COMPOSER_SET_MODEL':
      return { ...state, composer: { ...state.composer, selectedModel: action.modelId } };

    case 'SESSION_HYDRATE':
      return action.state;

    case 'SESSION_RESET':
      return getInitialState();

    default:
      return state;
  }
}

interface SessionStateContextValue {
  state: CanvasSessionState;
  dispatch: React.Dispatch<SessionAction>;
  isPanelOpen: (panelId: string) => boolean;
  activeLayerPanels: string[];
  activeLayerConfig: ReturnType<typeof getLayerConfig>;
}

const SessionStateContext = createContext<SessionStateContextValue | null>(null);

export function SessionStateProvider({
  children,
  workspaceId = 'ws:global',
  userId = 'user:demo',
}: {
  children: ReactNode;
  workspaceId?: string;
  userId?: string;
}) {
  const [state, dispatch] = useReducer(sessionReducer, null, () => {
    const stored = loadFromStorage();
    if (stored) {
      // R2-P3-1: Immutable update instead of direct mutation
      stored.session = { ...stored.session, workspaceId, userId };
      return stored;
    }
    const initial = getInitialState();
    initial.session = { ...initial.session, workspaceId, userId };
    return initial;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* storage full */ }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  // P3-1: Plain function — useCallback provides no benefit (state ref changes every dispatch)
  const isPanelOpen = (panelId: string) =>
    state.layers[state.activeLayer]?.openPanels.includes(panelId) ?? false;

  const activeLayerPanels = state.layers[state.activeLayer]?.openPanels ?? [];

  const activeLayerConfig = getLayerConfig(state.activeLayer);

  const contextValue: SessionStateContextValue = {
    state,
    dispatch,
    isPanelOpen,
    activeLayerPanels,
    activeLayerConfig,
  };

  return (
    <SessionStateContext.Provider value={contextValue}>
      {children}
    </SessionStateContext.Provider>
  );
}

export function useSessionState(): SessionStateContextValue {
  const ctx = useContext(SessionStateContext);
  if (!ctx) throw new Error('useSessionState must be used inside SessionStateProvider');
  return ctx;
}
