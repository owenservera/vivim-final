'use client';

/**
 * hooks/useDrawerState.ts
 * --------------------------------------------------------------------
 * Custom hook for drawer panel management.
 * Extracted from page.tsx to reduce monolith complexity.
 */

import { useState, useCallback } from 'react';

export interface UseDrawerStateReturn {
  activeDrawer: string | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  isDrawerOpen: (id: string) => boolean;
}

export function useDrawerState(): UseDrawerStateReturn {
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  const openDrawer = useCallback((id: string) => {
    setActiveDrawer(id);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  const isDrawerOpen = useCallback((id: string) => {
    return activeDrawer === id;
  }, [activeDrawer]);

  return {
    activeDrawer,
    openDrawer,
    closeDrawer,
    isDrawerOpen,
  };
}
