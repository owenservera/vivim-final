'use client';

/**
 * components/canvas/Brand.tsx
 * --------------------------------------------------------------------
 * Vivim 2026 brand system — logo mark, wordmark, and SVG provider logos.
 *
 * Design intent:
 *   - BrandMark: a layered-stacking glyph (echoes the canvas metaphor)
 *     rendered with the indigo→violet→fuchsia brand gradient.
 *   - BrandWordmark: "Vivim" set with the brand gradient as foreground.
 *   - ProviderLogo: crisp SVG marks for each AI provider, replacing emoji.
 *
 * All SVGs are stroke- or fill-based with currentColor where possible so
 * they inherit text color. Brand gradients use defined <linearGradient>s.
 */

import { type CSSProperties } from 'react';

// ── Brand mark ─────────────────────────────────────────────────────

export interface BrandMarkProps {
  size?: number;
  withGradient?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * BrandMark — three stacked layered diamonds, evoking the living canvas.
 * Gradient-filled by default; set withGradient={false} for monochrome.
 */
export function BrandMark({ size = 24, withGradient = true, className, style }: BrandMarkProps) {
  const gradId = 'vivim-brand-grad';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.65 0.19 290)" />
          <stop offset="45%" stopColor="oklch(0.62 0.21 310)" />
          <stop offset="100%" stopColor="oklch(0.68 0.22 330)" />
        </linearGradient>
      </defs>
      <g fill={withGradient ? `url(#${gradId})` : 'currentColor'}>
        {/* back layer — largest, faded */}
        <path
          d="M16 3 L28 11 L16 19 L4 11 Z"
          opacity={withGradient ? 0.35 : 0.3}
        />
        {/* mid layer — medium */}
        <path
          d="M16 9 L26 15.5 L16 22 L6 15.5 Z"
          opacity={withGradient ? 0.65 : 0.6}
        />
        {/* front layer — smallest, full opacity */}
        <path
          d="M16 14 L23 18.5 L16 23 L9 18.5 Z"
        />
      </g>
    </svg>
  );
}

// ── Brand wordmark ─────────────────────────────────────────────────

export interface BrandWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  withMark?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function BrandWordmark({ size = 'md', withMark = true, className, style }: BrandWordmarkProps) {
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 17;
  const markSize = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
    >
      {withMark && <BrandMark size={markSize} />}
      <span
        className="brand-text"
        style={{
          fontSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        Vivim
      </span>
    </div>
  );
}

// ── Brand orb (large ambient hero element) ─────────────────────────

export interface BrandOrbProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * BrandOrb — a large ambient gradient orb for hero sections.
 * Subtly breathes when not in reduced-motion mode.
 */
export function BrandOrb({ size = 120, className, style }: BrandOrbProps) {
  return (
    <div
      className={`breathe ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--brand-radial)',
        boxShadow:
          '0 0 60px color-mix(in oklch, var(--brand-500) 40%, transparent), inset 0 0 40px color-mix(in oklch, var(--accent-fuchsia) 25%, transparent)',
        position: 'relative',
        ...style,
      }}
      aria-hidden="true"
    >
      {/* highlight ring */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '1px solid color-mix(in oklch, white 30%, transparent)',
          maskImage: 'radial-gradient(circle at 30% 25%, black 0%, transparent 50%)',
          WebkitMaskImage: 'radial-gradient(circle at 30% 25%, black 0%, transparent 50%)',
        }}
      />
    </div>
  );
}

// ── Provider logos (SVG marks, no emojis) ──────────────────────────

export type ProviderId = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'grok' | 'qwen' | string;

export interface ProviderLogoProps {
  provider: ProviderId;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * ProviderLogo — crisp SVG mark for each AI provider.
 * Replaces the emoji icons previously used in OnboardFlow.
 * Falls back to a generic sparkle mark for unknown providers.
 */
export function ProviderLogo({ provider, size = 28, className, style }: ProviderLogoProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    className,
    style,
    'aria-hidden': true,
  } as const;

  switch (provider) {
    case 'chatgpt':
      // OpenAI hexagonal knot
      return (
        <svg {...common}>
          <path
            d="M16 4 L26 10 V22 L16 28 L6 22 V10 Z M16 4 L16 28 M6 10 L26 22 M26 10 L6 22"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </svg>
      );
    case 'claude':
      // Anthropic radiating sunburst
      return (
        <svg {...common}>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M16 6 L16 26" opacity="0.9" />
            <path d="M8 9 L24 23" opacity="0.7" />
            <path d="M24 9 L8 23" opacity="0.7" />
            <path d="M5 16 L27 16" opacity="0.5" />
          </g>
          <circle cx="16" cy="16" r="2.5" fill="currentColor" />
        </svg>
      );
    case 'gemini':
      // Google Gemini spark
      return (
        <svg {...common}>
          <path
            d="M16 4 C17 11 21 15 28 16 C21 17 17 21 16 28 C15 21 11 17 4 16 C11 15 15 11 16 4 Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case 'deepseek':
      // DeepSeek whale-fluke abstraction
      return (
        <svg {...common}>
          <path
            d="M4 16 C8 10 14 10 16 14 C18 10 24 10 28 16 C26 20 22 22 19 21 C18 20 17 20 16 21 C13 22 10 22 8 21 C6 20 5 18 4 16 Z"
            fill="currentColor"
            opacity="0.85"
          />
          <circle cx="11" cy="15" r="1" fill="var(--card)" />
        </svg>
      );
    case 'grok':
      // xAI bolt
      return (
        <svg {...common}>
          <path
            d="M18 4 L8 18 L14 18 L12 28 L24 12 L17 12 Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case 'qwen':
      // Alibaba Qwen concentric hex
      return (
        <svg {...common}>
          <g stroke="currentColor" strokeWidth="1.6" fill="none">
            <path d="M16 5 L25 10 V22 L16 27 L7 22 V10 Z" opacity="0.5" />
            <path d="M16 10 L21 13 V19 L16 22 L11 19 V13 Z" opacity="0.85" />
          </g>
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </svg>
      );
    default:
      // Generic sparkle fallback
      return (
        <svg {...common}>
          <path
            d="M16 4 C17 11 21 15 28 16 C21 17 17 21 16 28 C15 21 11 17 4 16 C11 15 15 11 16 4 Z"
            fill="currentColor"
            opacity="0.7"
          />
        </svg>
      );
  }
}

// ── Provider color (for logo backgrounds) ──────────────────────────

export function providerColor(provider: ProviderId): string {
  switch (provider) {
    case 'chatgpt':   return 'oklch(0.65 0.18 165)';   // teal-green
    case 'claude':    return 'oklch(0.55 0.14 35)';    // warm coral
    case 'gemini':    return 'oklch(0.65 0.18 250)';   // blue
    case 'deepseek':  return 'oklch(0.60 0.18 220)';   // indigo-blue
    case 'grok':      return 'oklch(0.20 0.02 250)';   // near-black
    case 'qwen':      return 'oklch(0.65 0.16 25)';    // red-orange
    default:          return 'var(--brand-500)';
  }
}
