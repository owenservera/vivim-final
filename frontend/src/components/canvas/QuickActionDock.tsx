'use client';

import React from 'react';
import { Icon } from './Icon';

export interface QuickActionDockProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleGrid?: () => void;
  onToggleDevConsole: () => void;
  zoomLevel: number;
}

export function QuickActionDock({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleGrid,
  onToggleDevConsole,
  zoomLevel,
}: QuickActionDockProps) {
  return (
    <div
      aria-label="Canvas Quick Actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-xl"
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-800 transition-colors"
        title="Zoom Out (-)"
        aria-label="Zoom Out"
      >
        <Icon name="minus" className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onResetView}
        className="px-2 py-1 text-xs font-mono text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition-colors"
        title="Reset Zoom (100%)"
        aria-label="Reset View to 100%"
      >
        {Math.round(zoomLevel * 100)}%
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        className="p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-800 transition-colors"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <Icon name="plus" className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-700/60 mx-1" />

      {onToggleGrid && (
        <button
          type="button"
          onClick={onToggleGrid}
          className="p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-800 transition-colors"
          title="Toggle Grid"
          aria-label="Toggle Grid"
        >
          <Icon name="grid" className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleDevConsole}
        className="p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-800 transition-colors"
        title="Dev Console (Cmd+`)"
        aria-label="Toggle Developer Console"
      >
        <Icon name="terminal" className="w-4 h-4" />
      </button>
    </div>
  );
}
