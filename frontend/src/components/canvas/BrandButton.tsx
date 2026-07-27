'use client';

/**
 * components/canvas/BrandButton.tsx
 * --------------------------------------------------------------------
 * Vivim 2026 cohesive button system.
 *
 * Variants:
 *   - primary:   brand gradient fill, primary-foreground text. Hero CTAs.
 *   - secondary: subtle brand-tinted glass surface. Secondary CTAs.
 *   - ghost:     transparent, hover-muted. Inline actions.
 *   - outline:   bordered, hover brand-tinted.
 *   - destructive: red-tinted. Delete/remove.
 *
 * Sizes: sm | md | lg | icon
 *
 * All variants share:
 *   - focus-ring (visible focus for keyboard users)
 *   - hover-lift (subtle translate-Y on hover, except ghost)
 *   - disabled state with reduced opacity
 *   - forwardRef so it can be used as a child of Link etc.
 */

import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type BrandButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
export type BrandButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrandButtonVariant;
  size?: BrandButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  iconSize?: number;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const SIZE_DIMS: Record<BrandButtonSize, { padding: string; fontSize: number; minHeight: number; iconSize: number }> = {
  sm:    { padding: '6px 12px',   fontSize: 12, minHeight: 30, iconSize: 13 },
  md:    { padding: '8px 16px',   fontSize: 13, minHeight: 36, iconSize: 15 },
  lg:    { padding: '12px 22px',  fontSize: 14, minHeight: 44, iconSize: 17 },
  icon:  { padding: '0',          fontSize: 13, minHeight: 36, iconSize: 16 },
};

const VARIANT_STYLES: Record<BrandButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--brand-gradient)',
    color: 'var(--primary-foreground)',
    border: 'none',
    boxShadow: 'var(--elevation-1), inset 0 1px 0 color-mix(in oklch, white 20%, transparent)',
  },
  secondary: {
    background: 'color-mix(in oklch, var(--brand-500) 8%, var(--secondary))',
    color: 'var(--foreground)',
    border: '1px solid color-mix(in oklch, var(--brand-500) 18%, var(--border))',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--foreground)',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
  },
  destructive: {
    background: 'color-mix(in oklch, var(--destructive) 10%, var(--card))',
    color: 'var(--destructive)',
    border: '1px solid color-mix(in oklch, var(--destructive) 25%, transparent)',
  },
};

const VARIANT_HOVER: Record<BrandButtonVariant, React.CSSProperties> = {
  primary: {
    filter: 'brightness(1.08)',
    boxShadow: 'var(--elevation-2), inset 0 1px 0 color-mix(in oklch, white 25%, transparent)',
  },
  secondary: {
    background: 'color-mix(in oklch, var(--brand-500) 14%, var(--secondary))',
    borderColor: 'color-mix(in oklch, var(--brand-500) 30%, var(--border))',
  },
  ghost: {
    background: 'var(--muted)',
  },
  outline: {
    background: 'color-mix(in oklch, var(--brand-500) 6%, transparent)',
    borderColor: 'color-mix(in oklch, var(--brand-500) 30%, var(--border))',
  },
  destructive: {
    background: 'color-mix(in oklch, var(--destructive) 18%, var(--card))',
    borderColor: 'color-mix(in oklch, var(--destructive) 40%, transparent)',
  },
};

export const BrandButton = forwardRef<HTMLButtonElement, BrandButtonProps>(function BrandButton(
  {
    variant = 'primary',
    size = 'md',
    iconLeft,
    iconRight,
    iconSize,
    loading = false,
    fullWidth = false,
    disabled,
    children,
    className,
    style,
    onMouseEnter,
    onMouseLeave,
    ...rest
  },
  ref,
) {
  const dims = SIZE_DIMS[size];
  const effectiveIconSize = iconSize ?? dims.iconSize;
  const isDisabled = disabled || loading;

  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      const styleMap = e.currentTarget.style;
      Object.entries(VARIANT_HOVER[variant]).forEach(([k, v]) => {
        (styleMap as unknown as Record<string, string>)[k] = v as string;
      });
    }
    onMouseEnter?.(e);
  };
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const styleMap = e.currentTarget.style;
    Object.entries(VARIANT_STYLES[variant]).forEach(([k, v]) => {
      (styleMap as unknown as Record<string, string>)[k] = v as string;
    });
    onMouseLeave?.(e);
  };

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`focus-ring ${variant !== 'ghost' ? 'hover-lift' : ''} ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: dims.padding,
        fontSize: dims.fontSize,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        minHeight: dims.minHeight,
        width: size === 'icon' ? dims.minHeight : fullWidth ? '100%' : undefined,
        borderRadius: 'calc(var(--radius) - 2px)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: isDisabled ? 0.55 : 1,
        transition: 'transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease',
        userSelect: 'none',
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: effectiveIconSize,
            height: effectiveIconSize,
            borderRadius: '50%',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            animation: 'rotate-slow 0.8s linear infinite',
          }}
          aria-hidden="true"
        />
      ) : (
        iconLeft && <Icon name={iconLeft} size={effectiveIconSize} />
      )}
      {size !== 'icon' && children}
      {!loading && iconRight && <Icon name={iconRight} size={effectiveIconSize} />}
    </button>
  );
});

// ── Button group (horizontal cluster, e.g. for hero CTAs) ──────────

export interface BrandButtonGroupProps {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function BrandButtonGroup({ children, align = 'start', gap = 8, className, style }: BrandButtonGroupProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        justifyContent: align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
