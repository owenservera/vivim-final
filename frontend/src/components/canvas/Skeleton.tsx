'use client';

/**
 * components/canvas/Skeleton.tsx
 * --------------------------------------------------------------------
 * Shimmer skeleton primitives for async content placeholders.
 *
 * Variants:
 *   - Skeleton:        bare rectangular shimmer block
 *   - SkeletonCircle:  circular shimmer (avatars, icons)
 *   - SkeletonText:    multi-line text block with realistic line widths
 *   - SkeletonList:    repeating row skeleton for lists (conversations, providers)
 *   - SkeletonCard:    card-shaped skeleton (node cards, capability cards)
 */

import { type CSSProperties } from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 14, radius = 4, className, style }: SkeletonProps) {
  return (
    <div
      className={`shimmer ${className ?? ''}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCircle({ size = 32, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`shimmer ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

export function SkeletonText({ lines = 3, lineHeight = 12, gap = 6, className, style }: SkeletonTextProps) {
  // Realistic line widths: 100%, 92%, 78%, 88%, 65% pattern
  const widths = ['100%', '92%', '78%', '88%', '65%', '95%', '70%'];
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        ...style,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={widths[i % widths.length]}
          height={lineHeight}
        />
      ))}
    </div>
  );
}

export interface SkeletonListProps {
  rows?: number;
  avatar?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SkeletonList({ rows = 4, avatar = true, className, style }: SkeletonListProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 8,
        ...style,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 4px',
          }}
        >
          {avatar && <SkeletonCircle size={28} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width="60%" height={11} />
            <Skeleton width="40%" height={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  width?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function SkeletonCard({ width = 220, className, style }: SkeletonCardProps) {
  return (
    <div
      className={className}
      style={{
        width,
        padding: 14,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        ...style,
      }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SkeletonCircle size={20} />
        <Skeleton width="50%" height={11} />
      </div>
      <SkeletonText lines={3} lineHeight={9} gap={4} />
    </div>
  );
}
