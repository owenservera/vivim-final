'use client';

import React from 'react';
import { Spinner } from './Spinner';

export interface StreamStatusPillProps {
  isStreaming: boolean;
  providerId?: string;
  tokenCount?: number;
  error?: string | null;
}

export function StreamStatusPill({ isStreaming, providerId, tokenCount = 0, error }: StreamStatusPillProps) {
  if (!isStreaming && !error) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-xs font-medium border border-slate-700/60 shadow-lg transition-all animate-in fade-in slide-in-from-top-2"
    >
      {error ? (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 font-semibold">Error: {error}</span>
        </>
      ) : (
        <>
          <Spinner size={14} />
          <span className="text-slate-100 capitalize">{providerId ?? 'Provider'} streaming...</span>
          {tokenCount > 0 && <span className="text-slate-400 font-mono text-[10px]">({tokenCount} tokens)</span>}
        </>
      )}
    </div>
  );
}
