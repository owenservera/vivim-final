import { useReducer, useCallback } from 'react';

export type ActiveModal = 'none' | 'menu' | 'search' | 'theme' | 'devConsole' | 'guidedLanding' | 'panelPalette';

export interface CanvasUiState {
  activeModal: ActiveModal;
  activePanelId: string | null;
  guidedComplete: boolean;
  needsSetup: boolean | null;
}

type UiAction =
  | { type: 'OPEN_MODAL'; modal: ActiveModal }
  | { type: 'CLOSE_MODAL' }
  | { type: 'TOGGLE_MODAL'; modal: ActiveModal }
  | { type: 'SET_ACTIVE_PANEL'; panelId: string | null }
  | { type: 'SET_GUIDED_COMPLETE'; complete: boolean }
  | { type: 'SET_NEEDS_SETUP'; needs: boolean };

const initialState: CanvasUiState = {
  activeModal: 'none',
  activePanelId: null,
  guidedComplete: false,
  needsSetup: null,
};

function uiReducer(state: CanvasUiState, action: UiAction): CanvasUiState {
  switch (action.type) {
    case 'OPEN_MODAL':
      return { ...state, activeModal: action.modal };
    case 'CLOSE_MODAL':
      return { ...state, activeModal: 'none' };
    case 'TOGGLE_MODAL':
      return {
        ...state,
        activeModal: state.activeModal === action.modal ? 'none' : action.modal,
      };
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanelId: action.panelId };
    case 'SET_GUIDED_COMPLETE':
      return { ...state, guidedComplete: action.complete };
    case 'SET_NEEDS_SETUP':
      return { ...state, needsSetup: action.needs };
    default:
      return state;
  }
}

export function useCanvasUiState() {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const openModal = useCallback((modal: ActiveModal) => dispatch({ type: 'OPEN_MODAL', modal }), []);
  const closeModal = useCallback(() => dispatch({ type: 'CLOSE_MODAL' }), []);
  const toggleModal = useCallback((modal: ActiveModal) => dispatch({ type: 'TOGGLE_MODAL', modal }), []);
  const setActivePanel = useCallback((panelId: string | null) => dispatch({ type: 'SET_ACTIVE_PANEL', panelId }), []);
  const setGuidedComplete = useCallback((complete: boolean) => dispatch({ type: 'SET_GUIDED_COMPLETE', complete }), []);
  const setNeedsSetup = useCallback((needs: boolean) => dispatch({ type: 'SET_NEEDS_SETUP', needs }), []);

  return {
    state,
    openModal,
    closeModal,
    toggleModal,
    setActivePanel,
    setGuidedComplete,
    setNeedsSetup,
  };
}
