'use client';

/**
 * features/onboarding/SpotlightOverlay.tsx
 * --------------------------------------------------------------------
 * Animated spotlight overlay with CSS-clip-path cutout.
 *
 * Features:
 *   - Smooth 300ms ease-out transition on spotlight position/size
 *   - Backdrop blur (2px) for depth
 *   - Pulse animation option for attention
 *   - Respects prefers-reduced-motion
 *   - Click-outside to dismiss
 */

import { useEffect, useRef, useState } from 'react';

interface SpotlightTarget {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightOverlayProps {
  /** Target element rect to spotlight. null = center spotlight (no cutout). */
  target: SpotlightTarget | null;
  /** Whether the overlay is visible. */
  isOpen: boolean;
  /** Whether the spotlight should pulse. */
  pulse?: boolean;
  /** Called when user clicks the backdrop (outside spotlight). */
  onBackdropClick?: () => void;
  /** Padding around the spotlight cutout (px). */
  padding?: number;
  /** Border radius of the spotlight cutout. */
  borderRadius?: number;
  /** z-index of the overlay. */
  zIndex?: number;
  /** Children rendered inside the overlay (for step content). */
  children?: React.ReactNode;
}

export function SpotlightOverlay({
  target,
  isOpen,
  pulse = false,
  onBackdropClick,
  padding = 8,
  borderRadius = 10,
  zIndex = 1100,
  children,
}: SpotlightOverlayProps) {
  const [animatedRect, setAnimatedRect] = useState<SpotlightTarget | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTargetRef = useRef<SpotlightTarget | null>(null);
  const prefersReduced = useRef(false);

  // Check reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    prefersReduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  // Animate spotlight position changes
  useEffect(() => {
    if (!isOpen) {
      setAnimatedRect(null);
      return;
    }

    if (!target) {
      setAnimatedRect(null);
      return;
    }

    const prev = prevTargetRef.current;
    prevTargetRef.current = target;

    // If first appearance or reduced motion, snap instantly
    if (!prev || prefersReduced.current) {
      setAnimatedRect(target);
      return;
    }

    // Animate from previous position
    setIsAnimating(true);
    setAnimatedRect(prev);

    // Use requestAnimationFrame for smooth transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimatedRect(target);
        setTimeout(() => setIsAnimating(false), 320);
      });
    });
  }, [target, isOpen]);

  if (!isOpen) return null;

  // Build clip-path for spotlight cutout
  const getClipPath = (): string => {
    if (!animatedRect) return 'none';
    const { top, left, width, height } = animatedRect;
    const p = padding;
    const r = borderRadius;
    const x1 = left - p;
    const y1 = top - p;
    const x2 = left + width + p;
    const y2 = top + height + p;

    // Full viewport minus the spotlight rectangle
    // Using polygon for rounded-rect cutout via inset
    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${x1}px ${y1}px,
      ${x1}px ${y2}px,
      ${x2}px ${y2}px,
      ${x2}px ${y1}px,
      ${x1}px ${y1}px
    )`;
  };

  // Spotlight border glow style
  const spotlightBorderStyle: React.CSSProperties = animatedRect
    ? {
        position: 'fixed',
        top: animatedRect.top - padding - 2,
        left: animatedRect.left - padding - 2,
        width: animatedRect.width + padding * 2 + 4,
        height: animatedRect.height + padding * 2 + 4,
        border: '2px solid var(--accent, #3b82f6)',
        borderRadius: borderRadius + 2,
        pointerEvents: 'none',
        zIndex: zIndex + 2,
        opacity: 1,
        transition: prefersReduced.current ? 'none' : 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: pulse
          ? '0 0 20px rgba(59, 130, 246, 0.4), 0 0 60px rgba(59, 130, 246, 0.15)'
          : '0 0 12px rgba(59, 130, 246, 0.25)',
        animation: pulse ? 'spotlight-pulse 2s ease-in-out infinite' : undefined,
      }
    : {};

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onBackdropClick?.();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex,
          pointerEvents: 'auto',
          transition: prefersReduced.current ? 'none' : 'opacity 300ms ease-out',
          // Use clip-path for the spotlight cutout
          clipPath: getClipPath(),
          WebkitClipPath: getClipPath(),
        }}
      />

      {/* Spotlight border glow */}
      {animatedRect && <div style={spotlightBorderStyle} />}

      {/* Children (step content) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: zIndex + 3, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </div>

      {/* Pulse keyframes */}
      {pulse && (
        <style>{`
          @keyframes spotlight-pulse {
            0%, 100% { box-shadow: 0 0 12px rgba(59, 130, 246, 0.25); }
            50% { box-shadow: 0 0 24px rgba(59, 130, 246, 0.45), 0 0 60px rgba(59, 130, 246, 0.15); }
          }
          @media (prefers-reduced-motion: reduce) {
            .spotlight-pulse { animation: none !important; }
          }
        `}</style>
      )}
    </>
  );
}

/**
 * Helper: resolve a CSS selector to a DOMRect with smooth tracking.
 * Returns null if the element doesn't exist.
 */
export function useSpotlightTarget(selector: string | null): SpotlightTarget | null {
  const [rect, setRect] = useState<SpotlightTarget | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    };

    // Initial measurement
    update();

    // Track scroll/resize for dynamic elements
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Periodic check for elements that may mount later
    const interval = setInterval(update, 500);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', onScroll);
      clearInterval(interval);
    };
  }, [selector]);

  return rect;
}
