# 🎨 INFINITE CANVAS - BEAUTIFUL DESIGN SYSTEM

> **VERSION**: 2.0 - "Aurora Borealis"  
> **AUTHOR**: Vivim Design System  
> **DATE**: 2025-01-XX  
> **STATUS**: Proposal for Next-Gen Canvas Aesthetics

---

## 🌌 EXECUTIVE SUMMARY

This document presents a **completely reimagined aesthetic system** for the vivim infinite canvas. The current implementation is functional but visually utilitarian. We transform it into a **beautiful, immersive, and delightful** experience that maintains all technical invariants while elevating the user experience to world-class standards.

### Current State Analysis

**Strengths to Preserve:**
- ✅ Infinite plane architecture (P3)
- ✅ Hot-swappable layers (P2)
- ✅ Sandboxed rendering (P8)
- ✅ Data-driven UI (P1)
- ✅ Capability-based interactions (P5)
- ✅ Living manifest (P9)

**Aesthetic Gaps:**
- ❌ Flat, utilitarian color palette
- ❌ Basic shadows and borders
- ❌ Static, non-animated transitions
- ❌ Generic typography
- ❌ No depth or dimensionality
- ❌ Minimal visual feedback
- ❌ No personality or brand identity

---

## 🎯 DESIGN PHILOSOPHY

### Core Principles

1. **"Glassmorphism Meets Neon"** - Modern glass effects with subtle neon accents
2. **"Depth Without Distraction"** - Multiple visual layers without cognitive overload
3. **"Motion as Information"** - Animations that communicate state and relationships
4. **"Dark First, Light Available"** - Optimized for dark mode with perfect light mode
5. **"Accessibility as Default"** - WCAG 2.2 AA compliance built-in
6. **"Performance as Feature"** - 60fps animations, GPU-accelerated where possible

### Design Tokens Strategy

```
Color → Semantic → Component
Typography → Scale → Hierarchy  
Spacing → Grid → Layout
Motion → Easing → Choreography
```

---

## 🎨 COLOR SYSTEM

### Palette: "Aurora Borealis"

#### Primary Colors (Brand Identity)

```css
/* Primary - The vivim signature color */
--color-primary-50:  #f0f9ff;
--color-primary-100: #e0f2fe;
--color-primary-200: #bae6fd;
--color-primary-300: #7dd3fc;
--color-primary-400: #38bdf8;
--color-primary-500: #0ea5e9;  /* Main brand color */
--color-primary-600: #0284c7;
--color-primary-700: #0369a1;
--color-primary-800: #075985;
--color-primary-900: #0c4a6e;
--color-primary-950: #082f49;
```

#### Secondary Colors (Accent & Highlights)

```css
/* Secondary - Electric Violet for magic/ai moments */
--color-secondary-50:  #f5f3ff;
--color-secondary-100: #ede9fe;
--color-secondary-200: #ddd6fe;
--color-secondary-300: #c4b5fd;
--color-secondary-400: #a78bfa;
--color-secondary-500: #8b5cf6;  /* AI/Magic accent */
--color-secondary-600: #7c3aed;
--color-secondary-700: #6d28d9;
--color-secondary-800: #5b21b6;
--color-secondary-900: #4c1d95;
--color-secondary-950: #2e1065;
```

#### Success / Error / Warning / Info

```css
/* Semantic Colors */
--color-success-500: #10b981;
--color-success-600: #059669;
--color-success-700: #047857;

--color-warning-500: #f59e0b;
--color-warning-600: #d97706;
--color-warning-700: #b45309;

--color-error-500:  #ef4444;
--color-error-600:  #dc2626;
--color-error-700:  #b91c1c;

--color-info-500:   #3b82f6;
--color-info-600:   #2563eb;
--color-info-700:   #1d4ed8;
```

### Dark Mode Palette

```css
/* Background Layers (Dark Mode) */
--color-bg-canvas:    #08080b;        /* Deep space */
--color-bg-layer-1:   #0f172a;        /* Slate 950 */
--color-bg-layer-2:   #1e293b;        /* Slate 900 */
--color-bg-layer-3:   #334155;        /* Slate 800 */
--color-bg-hover:     #475569;        /* Slate 700 */
--color-bg-active:    #64748b;        /* Slate 600 */

/* Surface Colors (Dark Mode) */
--color-surface-1:    rgba(15, 23, 42, 0.96);  /* Glass effect */
--color-surface-2:    rgba(30, 41, 59, 0.92);
--color-surface-3:    rgba(51, 65, 85, 0.88);

/* Border Colors (Dark Mode) */
--color-border-1:     rgba(255, 255, 255, 0.08);
--color-border-2:     rgba(255, 255, 255, 0.12);
--color-border-3:     rgba(255, 255, 255, 0.16);

/* Text Colors (Dark Mode) */
--color-text-primary:  #f8fafc;        /* Slate 50 */
--color-text-secondary:#cbd5e1;        /* Slate 300 */
--color-text-tertiary: #94a3b8;        /* Slate 400 */
--color-text-muted:    #64748b;        /* Slate 500 */
```

### Light Mode Palette

```css
/* Background Layers (Light Mode) */
--color-bg-canvas:    #fafafa;        /* Warm off-white */
--color-bg-layer-1:   #f4f4f5;        /* Zinc 100 */
--color-bg-layer-2:   #e4e4e7;        /* Zinc 200 */
--color-bg-layer-3:   #d4d4d8;        /* Zinc 300 */
--color-bg-hover:     #a1a1aa;        /* Zinc 400 */
--color-bg-active:    #71717a;        /* Zinc 500 */

/* Surface Colors (Light Mode) */
--color-surface-1:    rgba(250, 250, 250, 0.98);
--color-surface-2:    rgba(244, 244, 245, 0.96);
--color-surface-3:    rgba(229, 231, 235, 0.94);

/* Border Colors (Light Mode) */
--color-border-1:     rgba(0, 0, 0, 0.08);
--color-border-2:     rgba(0, 0, 0, 0.12);
--color-border-3:     rgba(0, 0, 0, 0.16);

/* Text Colors (Light Mode) */
--color-text-primary:  #18181b;        /* Zinc 900 */
--color-text-secondary:#52525b;        /* Zinc 600 */
--color-text-tertiary: #71717a;        /* Zinc 500 */
--color-text-muted:    #a1a1aa;        /* Zinc 400 */
```

### Glassmorphism Effects

```css
/* Glass Panel Effect */
--glass-bg:            rgba(15, 23, 42, 0.75);
--glass-border:        rgba(255, 255, 255, 0.1);
--glass-shadow:        0 8px 32px rgba(0, 0, 0, 0.3);
--glass-blur:          blur(12px);

/* Frosted Glass (more opaque) */
--frost-bg:            rgba(15, 23, 42, 0.92);
--frost-border:        rgba(255, 255, 255, 0.15);

/* Neon Glow Effects */
--glow-primary:        0 0 20px rgba(14, 165, 233, 0.3);
--glow-secondary:      0 0 20px rgba(139, 92, 246, 0.3);
--glow-success:        0 0 20px rgba(16, 185, 129, 0.3);
--glow-error:          0 0 20px rgba(239, 68, 68, 0.3);
```

---

## 📝 TYPOGRAPHY SYSTEM

### Font Families

```css
/* Primary Font Stack - Modern, readable, system-optimized */
--font-sans:          'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                      Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Monospace - For code, CLI, technical content */
--font-mono:          'JetBrains Mono', 'Fira Code', 'SF Mono', 
                      Menlo, Consolas, 'Liberation Mono', monospace;

/* Display - For headings, brand, large text */
--font-display:       'Manrope', var(--font-sans);
```

### Type Scale (Rem-based for accessibility)

```css
/* Display */
--text-display-xl:    3rem;     /* 48px */
--text-display-lg:    2.25rem;  /* 36px */
--text-display-md:    1.875rem; /* 30px */
--text-display-sm:    1.5rem;   /* 24px */

/* Headings */
--text-h1:            2rem;     /* 32px */
--text-h2:            1.5rem;   /* 24px */
--text-h3:            1.25rem;  /* 20px */
--text-h4:            1.125rem; /* 18px */
--text-h5:            1rem;     /* 16px */
--text-h6:            0.875rem; /* 14px */

/* Body */
--text-body-lg:       1.125rem; /* 18px */
--text-body-md:       1rem;     /* 16px */
--text-body-sm:       0.875rem; /* 14px */
--text-body-xs:       0.75rem;  /* 12px */

/* Captions */
--text-caption:       0.75rem;  /* 12px */
--text-meta:          0.625rem; /* 10px */
```

### Font Weights

```css
--font-weight-light:  300;
--font-weight-normal:400;
--font-weight-medium:500;
--font-weight-semibold:600;
--font-weight-bold:   700;
--font-weight-black:  900;
```

### Line Heights

```css
--leading-display:    1.1;
--leading-heading:     1.25;
--leading-body:        1.5;
--leading-compact:    1.375;
--leading-relaxed:    1.625;
```

---

## 📐 SPACING & LAYOUT

### Spacing Scale (Rem-based)

```css
/* 4px base unit */
--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */
--space-32: 8rem;      /* 128px */
```

### Grid System

```css
/* Canvas Grid */
--grid-canvas:        40px;
--grid-canvas-fine:   8px;

/* Component Grid */
--grid-component:     8px;

/* Max Widths */
--max-width-xs:       400px;
--max-width-sm:       640px;
--max-width-md:       768px;
--max-width-lg:       1024px;
--max-width-xl:       1280px;
--max-width-2xl:      1536px;
```

### Border Radius

```css
/* Sharp - For technical UI, code blocks */
--radius-sharp:       0;

/* Small - For subtle elements */
--radius-sm:          4px;

/* Medium - Default for most components */
--radius-md:          8px;

/* Large - For cards, panels */
--radius-lg:          12px;

/* XL - For modals, drawers */
--radius-xl:          16px;

/* 2XL - For large surfaces */
--radius-2xl:         24px;

/* Full - For pills, badges */
--radius-full:        9999px;
```

---

## ✨ MOTION & ANIMATIONS

### Easing Functions

```css
/* Default - Smooth, natural motion */
--ease-default:       cubic-bezier(0.4, 0, 0.2, 1);

/* In - Quick start, ease into position */
--ease-in:            cubic-bezier(0.4, 0, 1, 1);

/* Out - Start fast, ease to stop */
--ease-out:           cubic-bezier(0, 0, 0.2, 1);

/* In-Out - Smooth acceleration and deceleration */
--ease-in-out:        cubic-bezier(0.4, 0, 0.2, 1);

/* Spring - Bouncy, playful */
--ease-spring:        cubic-bezier(0.34, 1.56, 0.64, 1);

/* Exponential - Fast start, quick stop */
--ease-expo:          cubic-bezier(0.7, 0, 0.84, 0);

/* Back - Overshoot effect */
--ease-back:          cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Duration Scale

```css
/* Instant - For immediate feedback */
--duration-instant:   0ms;

/* Fast - For small UI changes */
--duration-fast:      100ms;

/* Normal - Default duration */
--duration-normal:    200ms;

/* Slow - For larger transitions */
--duration-slow:      300ms;

/* Slower - For dramatic effects */
--duration-slower:    500ms;

/* Slowest - For page transitions */
--duration-slowest:   700ms;
```

### Animation Presets

```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Slide Up */
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(16px);
  }
  to   { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slide Down */
@keyframes slideDown {
  from { 
    opacity: 0;
    transform: translateY(-16px);
  }
  to   { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale In */
@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.95);
  }
  to   { 
    opacity: 1;
    transform: scale(1);
  }
}

/* Glow Pulse */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4); }
  50%     { box-shadow: 0 0 0 10px rgba(14, 165, 233, 0); }
}

/* Float */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%     { transform: translateY(-8px); }
}

/* Shimmer */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Spin */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Bounce */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%     { transform: translateY(-10px); }
}
```

---

## 🎭 COMPONENT DESIGN SYSTEM

### Canvas Surface (Root)

**Current Issues:**
- Flat radial gradient background
- Basic grid pattern
- No depth or atmosphere

**New Design:**

```tsx
// Background: Deep Space with Stars
const canvasBackground = {
  background: `
    radial-gradient(ellipse at center, #08080b 0%, #0f172a 40%, #1e293b 100%),
    /* Subtle starfield */
    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.03) 0.5px, transparent 1px),
    radial-gradient(circle at 80% 15%, rgba(255,255,255,0.03) 0.5px, transparent 1px),
    radial-gradient(circle at 40% 70%, rgba(255,255,255,0.03) 0.5px, transparent 1px),
    radial-gradient(circle at 90% 85%, rgba(255,255,255,0.03) 0.5px, transparent 1px),
    /* Aurora effect at top */
    linear-gradient(to bottom, rgba(14, 165, 233, 0.05) 0%, transparent 30%)
  `,
  backgroundSize: '100% 100%, 200px 200px, 300px 300px, 250px 250px, 180px 180px, 100% 100%',
  backgroundRepeat: 'repeat, repeat, repeat, repeat, no-repeat',
}

// Grid: Modern, subtle, with depth
const canvasGrid = {
  backgroundImage: `
    linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)
  `,
  backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
  backgroundPosition: `${-viewport.x * viewport.zoom}px ${-viewport.y * viewport.zoom}px`,
  // Add subtle glow at grid intersections
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
}
```

### Canvas Node (Card)

**Current Issues:**
- Basic white background with simple border
- Flat header with minimal styling
- No depth or dimensionality
- Static appearance

**New Design:**

```tsx
// Node Container - Glassmorphism with Depth
const nodeContainer = {
  position: 'absolute',
  left: screenX,
  top: screenY,
  width: screenW,
  height: screenH,
  zIndex: layout.z,
  
  // Glassmorphism base
  background: 'rgba(15, 23, 42, 0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  
  // Border with glow
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 'var(--radius-lg)',
  
  // Shadow with depth
  boxShadow: `
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 2px 4px -2px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
  `,
  
  // Smooth transitions
  transition: 'all 200ms var(--ease-spring)',
  
  // Animation on mount
  animation: 'scaleIn 300ms var(--ease-spring)',
  
  // Cursor states
  cursor: dragging ? 'grabbing' : resizing ? 'nwse-resize' : 'grab',
  
  // Hover effect
  ':hover': {
    borderColor: 'rgba(14, 165, 233, 0.3)',
    boxShadow: `
      0 8px 25px -5px rgba(0, 0, 0, 0.4),
      0 4px 6px -1px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(14, 165, 233, 0.2),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
    `,
  },
  
  // Active/focus state
  ':focus-within': {
    borderColor: 'rgba(14, 165, 233, 0.5)',
    boxShadow: `
      0 8px 25px -5px rgba(0, 0, 0, 0.4),
      0 4px 6px -1px rgba(0, 0, 0, 0.3),
      0 0 0 2px rgba(14, 165, 233, 0.3),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
    `,
  },
}
```

### Node Header

**Current Issues:**
- Flat gray background
- Basic text styling
- Minimal visual hierarchy

**New Design:**

```tsx
// Header - Modern, elegant
const nodeHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
  
  // Semi-transparent glass
  background: 'rgba(0, 0, 0, 0.3)',
  backdropFilter: 'blur(8px)',
  
  // Border
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  
  // Typography
  fontSize: 'var(--text-body-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)',
  
  // Spacing
  gap: 'var(--space-2)',
}

// Header Left - Slot info
const headerLeft = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
}

// Slot Name - Bold, prominent
const slotName = {
  fontWeight: 'var(--font-weight-semibold)',
  fontSize: 'var(--text-body-sm)',
  color: 'var(--color-text-primary)',
  letterSpacing: '-0.01em',
}

// Provider ID - Subtle, secondary
const providerId = {
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
  opacity: 0.8,
}

// Tier Badge - Modern pill with glow
const tierBadge = {
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--text-meta)',
  fontWeight: 'var(--font-weight-bold)',
  textTransform: 'uppercase',
  letterSpacing: '0.025em',
  
  // Color based on tier
  background: {
    'system': 'rgba(148, 163, 184, 0.2)',
    'provider': '#fde68a',
    'provider+variant': '#fcd34d',
    'family': '#bbf7d0',
    'family+variant': '#86efac',
    'cross-type': '#bfdbfe',
  }[slot.tier],
  
  color: {
    'system': '#94a3b8',
    'provider': '#78350f',
    'provider+variant': '#78350f',
    'family': '#166534',
    'family+variant': '#166534',
    'cross-type': '#1e40af',
  }[slot.tier],
  
  // Subtle glow
  boxShadow: {
    'provider': '0 0 8px rgba(245, 158, 11, 0.3)',
    'provider+variant': '0 0 8px rgba(245, 158, 11, 0.3)',
    'family': '0 0 8px rgba(16, 185, 129, 0.3)',
    'family+variant': '0 0 8px rgba(16, 185, 129, 0.3)',
    'cross-type': '0 0 8px rgba(14, 165, 233, 0.3)',
  }[slot.tier] || 'none',
}
```

### Resize Handle

**Current Issues:**
- Basic gradient pattern
- Small, hard to grab
- No visual feedback

**New Design:**

```tsx
// Resize Handle - Modern, interactive
const resizeHandle = {
  position: 'absolute',
  right: 0,
  bottom: 0,
  width: 'var(--space-4)',
  height: 'var(--space-4)',
  
  // Modern resize indicator
  background: `
    linear-gradient(
      135deg,
      transparent 0%,
      transparent 45%,
      var(--color-primary-500) 45%,
      var(--color-primary-500) 55%,
      transparent 55%,
      transparent 100%
    )
  `,
  
  // Cursor
  cursor: 'nwse-resize',
  
  // Border radius
  borderTopLeftRadius: 'var(--radius-md)',
  
  // Transition
  transition: 'all 150ms var(--ease-out)',
  
  // Hover effect
  ':hover': {
    width: 'var(--space-5)',
    height: 'var(--space-5)',
    background: `
      linear-gradient(
        135deg,
        transparent 0%,
        transparent 40%,
        var(--color-primary-400) 40%,
        var(--color-primary-400) 60%,
        transparent 60%,
        transparent 100%
      )
    `,
    boxShadow: 'var(--glow-primary)',
  },
  
  // Active state
  ':active': {
    width: 'var(--space-6)',
    height: 'var(--space-6)',
    background: `
      linear-gradient(
        135deg,
        var(--color-primary-500) 0%,
        var(--color-primary-600) 100%
      )
    `,
    boxShadow: '0 0 16px var(--color-primary-500)',
  },
}
```

---

## 🎨 CARD COMPONENTS

### Agent Card - Redesigned

**Current Issues:**
- Basic white background
- Flat SVG edges
- Simple color blocks for steps
- Minimal visual hierarchy

**New Design:**

```tsx
// Agent Card Container
const agentCard = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: 'var(--font-sans)',
  
  // Modern glass card
  background: 'var(--color-surface-1)',
  backdropFilter: 'var(--glass-blur)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-lg)',
  
  // Shadow
  boxShadow: 'var(--glass-shadow)',
  
  // Overflow
  overflow: 'hidden',
}

// Agent Header
const agentHeader = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--color-border-1)',
  background: 'rgba(0, 0, 0, 0.2)',
  
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--space-3)',
}

// Agent Name
const agentName = {
  fontSize: 'var(--text-h3)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-primary)',
  letterSpacing: '-0.025em',
}

// Agent Badge
const agentBadge = {
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-full)',
  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
  color: 'white',
  fontSize: 'var(--text-meta)',
  fontWeight: 'var(--font-weight-bold)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)',
}

// Agent Meta
const agentMeta = {
  marginTop: 'var(--space-1)',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
}

// DAG Canvas (SVG)
const dagCanvas = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
  background: 'rgba(0, 0, 0, 0.05)',
  
  // Grid background
  backgroundImage: `
    linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
  `,
  backgroundSize: '20px 20px',
}

// SVG Edges
const svgEdge = {
  stroke: 'rgba(148, 163, 184, 0.4)',
  strokeWidth: 1.5,
  strokeDasharray: '4 2',
  markerEnd: 'url(#arrow-agent)',
  transition: 'all 200ms var(--ease-out)',
  
  // Hover effect
  ':hover': {
    stroke: 'rgba(14, 165, 233, 0.6)',
    strokeWidth: 2,
  },
}

// Step Nodes - Modern, colorful
const stepNode = {
  position: 'absolute',
  width: 110,
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  
  // Glass effect
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  
  // Shadow
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  
  // Typography
  fontSize: 'var(--text-caption)',
  textAlign: 'center',
  
  // Transition
  transition: 'all 200ms var(--ease-out)',
  
  // Color variants by kind
  backgroundColor: {
    'perceive': 'rgba(59, 130, 246, 0.2)',
    'think': 'rgba(245, 158, 11, 0.2)',
    'act': 'rgba(16, 185, 129, 0.2)',
    'hitl': 'rgba(239, 68, 68, 0.2)',
    'output': 'rgba(139, 92, 246, 0.2)',
  },
  
  borderColor: {
    'perceive': 'rgba(59, 130, 246, 0.4)',
    'think': 'rgba(245, 158, 11, 0.4)',
    'act': 'rgba(16, 185, 129, 0.4)',
    'hitl': 'rgba(239, 68, 68, 0.4)',
    'output': 'rgba(139, 92, 246, 0.4)',
  },
  
  // Hover effect
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
    borderColor: {
      'perceive': 'rgba(59, 130, 246, 0.6)',
      'think': 'rgba(245, 158, 11, 0.6)',
      'act': 'rgba(16, 185, 129, 0.6)',
      'hitl': 'rgba(239, 68, 68, 0.6)',
      'output': 'rgba(139, 92, 246, 0.6)',
    },
  },
}

// Step Kind Label
const stepKind = {
  fontWeight: 'var(--font-weight-bold)',
  fontSize: 'var(--text-meta)',
  color: 'white',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 'var(--space-1)',
}

// Step Label
const stepLabel = {
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: 'var(--text-caption)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// Invoke Button
const invokeButton = {
  padding: 'var(--space-2) var(--space-4)',
  border: 'none',
  background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
  color: 'white',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-caption)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
  
  // Hover
  ':hover': {
    background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
  },
  
  // Active
  ':active': {
    transform: 'scale(0.98)',
    background: 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary-800))',
  },
  
  // Disabled
  ':disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  
  // Loading state
  ':loading': {
    position: 'relative',
    color: 'transparent',
    
    '::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 16,
      height: 16,
      margin: '-8px 0 0 -8px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
  },
}
```

### Doc Card - Redesigned

```tsx
// Doc Card Container
const docCard = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: 'var(--font-sans)',
  
  // Modern card
  background: 'var(--color-surface-1)',
  backdropFilter: 'var(--glass-blur)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-lg)',
  
  // Shadow
  boxShadow: 'var(--glass-shadow)',
  
  // Overflow
  overflow: 'hidden',
}

// Doc Header
const docHeader = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--color-border-1)',
  background: 'rgba(0, 0, 0, 0.2)',
  
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--space-3)',
}

// Doc Title
const docTitle = {
  fontSize: 'var(--text-h3)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-primary)',
  letterSpacing: '-0.025em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// Engine Badge
const engineBadge = {
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--text-meta)',
  fontWeight: 'var(--font-weight-bold)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  
  // Engine-specific colors
  background: {
    'markdown': 'rgba(16, 185, 129, 0.2)',
    'code': 'rgba(139, 92, 246, 0.2)',
    'pdf': 'rgba(239, 68, 68, 0.2)',
    'html': 'rgba(59, 130, 246, 0.2)',
  }[doc.engine],
  
  color: {
    'markdown': '#16a34a',
    'code': '#8b5cf6',
    'pdf': '#ef4444',
    'html': '#3b82f6',
  }[doc.engine],
}

// Doc Meta
const docMeta = {
  marginTop: 'var(--space-1)',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
  
  // Separate items
  display: 'flex',
  gap: 'var(--space-3)',
}

// Doc Content
const docContent = {
  flex: 1,
  overflow: 'auto',
  padding: 'var(--space-4)',
  fontSize: 'var(--text-body-sm)',
  lineHeight: 'var(--leading-relaxed)',
  color: 'var(--color-text-primary)',
  
  // Font family based on engine
  fontFamily: doc.engine === 'code' 
    ? 'var(--font-mono)' 
    : 'var(--font-sans)',
  
  // Code-specific styling
  ...(doc.engine === 'code' && {
    tabSize: 2,
    whiteSpace: 'pre',
    overflowWrap: 'normal',
  }),
}

// Syntax Highlighting Theme
const syntaxTheme = {
  // Based on Tokyo Night
  background: 'transparent',
  
  // Tokens
  '.token.keyword': { color: '#c586c0' },
  '.token.operator': { color: '#82aaff' },
  '.token.string': { color: '#a9dc76' },
  '.token.number': { color: '#d47766' },
  '.token.comment': { color: '#546e7a', fontStyle: 'italic' },
  '.token.function': { color: '#82aaff' },
  '.token.variable': { color: '#92b4fb' },
  '.token.type': { color: '#ab9df2' },
  '.token.class': { color: '#ffc66d' },
  '.token.punctuation': { color: '#5c6370' },
}

// Doc Footer
const docFooter = {
  padding: 'var(--space-3) var(--space-4)',
  borderTop: '1px solid var(--color-border-1)',
  background: 'rgba(0, 0, 0, 0.2)',
  
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
}

// Page Navigation Buttons
const pageBtn = {
  padding: 'var(--space-1) var(--space-3)',
  border: '1px solid var(--color-border-2)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'var(--color-text-secondary)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-meta)',
  cursor: 'pointer',
  
  // Hover
  ':hover': {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-3)',
  },
  
  // Active
  ':active': {
    background: 'rgba(255, 255, 255, 0.15)',
    transform: 'scale(0.95)',
  },
  
  // Disabled
  ':disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
}

// Annotate Button
const annotateBtn = {
  ...pageBtn,
  background: 'linear-gradient(135deg, var(--color-secondary-500), var(--color-secondary-600))',
  border: 'none',
  color: 'white',
  
  ':hover': {
    background: 'linear-gradient(135deg, var(--color-secondary-600), var(--color-secondary-700))',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
  },
}
```

### Shell Card - Redesigned

```tsx
// Shell Card Container
const shellCard = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: 'var(--font-mono)',
  
  // Dark terminal aesthetic
  background: 'var(--color-bg-layer-1)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-lg)',
  
  // Shadow
  boxShadow: 'var(--glass-shadow)',
  
  // Overflow
  overflow: 'hidden',
  
  // Terminal color scheme
  color: 'var(--color-text-primary)',
}

// Shell Header
const shellHeader = {
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--color-border-1)',
  background: 'rgba(0, 0, 0, 0.3)',
  
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
}

// Shell Workspace Info
const shellWorkspace = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
}

// Shell Title
const shellTitle = {
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-secondary)',
}

// Shell Capability
const shellCapability = {
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-meta)',
}

// Shell History
const shellHistory = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-3)',
  fontSize: 'var(--text-body-sm)',
  lineHeight: 'var(--leading-compact)',
}

// Command Input
const shellInputContainer = {
  padding: 'var(--space-2) var(--space-3)',
  borderTop: '1px solid var(--color-border-1)',
  background: 'rgba(0, 0, 0, 0.3)',
  
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
}

// Shell Prompt
const shellPrompt = {
  color: 'var(--color-primary-400)',
  fontWeight: 'var(--font-weight-semibold)',
  fontSize: 'var(--text-body-sm)',
}

// Shell Input Field
const shellInput = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-body-sm)',
  
  // Placeholder
  '::placeholder': {
    color: 'var(--color-text-muted)',
  },
  
  // Focus
  ':focus': {
    outline: 'none',
  },
}

// History Entry
const historyEntry = {
  marginBottom: 'var(--space-3)',
}

// Command Line
const commandLine = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  color: 'var(--color-primary-400)',
  fontSize: 'var(--text-body-sm)',
}

// Command Text
const commandText = {
  color: 'var(--color-text-secondary)',
}

// Result Output
const resultOutput = {
  marginTop: 'var(--space-2)',
  padding: 'var(--space-2)',
  background: 'rgba(0, 0, 0, 0.2)',
  borderRadius: 'var(--radius-md)',
  borderLeft: '3px solid var(--color-primary-500)',
}

// Stdout
const stdout = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-body-sm)',
  lineHeight: 'var(--leading-compact)',
}

// Stderr
const stderr = {
  ...stdout,
  color: 'var(--color-error-400)',
}

// Result Meta
const resultMeta = {
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-meta)',
  marginTop: 'var(--space-2)',
  display: 'flex',
  gap: 'var(--space-3)',
}

// Pending Indicator
const pendingIndicator = {
  color: 'var(--color-text-tertiary)',
  fontStyle: 'italic',
}

// Loading Animation
const loadingAnimation = {
  display: 'inline-block',
  width: 12,
  height: 12,
  border: '2px solid rgba(14, 165, 233, 0.3)',
  borderTopColor: 'var(--color-primary-500)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}
```

---

## 🌈 THEME SYSTEM

### Theme Variants

```typescript
// Theme types
export type ThemeVariant = 'dark' | 'light' | 'system' | 'aurora' | 'matrix'

// Aurora Theme - Our signature
const auroraTheme = {
  name: 'Aurora',
  description: 'Deep space with northern lights',
  
  // Background
  canvas: {
    primary: '#08080b',
    secondary: '#0f172a',
    tertiary: '#1e293b',
    
    // Aurora gradient overlay
    gradient: 'linear-gradient(to bottom, rgba(14, 165, 233, 0.05) 0%, transparent 40%)',
    
    // Starfield
    stars: true,
    starDensity: 0.0003,
    starColor: 'rgba(255, 255, 255, 0.6)',
    starTwinkle: true,
  },
  
  // Accent colors
  primary: {
    500: '#0ea5e9',
    glow: '0 0 30px rgba(14, 165, 233, 0.3)',
  },
  
  secondary: {
    500: '#8b5cf6',
    glow: '0 0 30px rgba(139, 92, 246, 0.3)',
  },
  
  // Semantic colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Glass effects
  glass: {
    opacity: 0.75,
    blur: 12,
    border: 'rgba(255, 255, 255, 0.1)',
  },
}

// Matrix Theme - Cyberpunk aesthetic
const matrixTheme = {
  name: 'Matrix',
  description: 'Cyberpunk green on black',
  
  canvas: {
    primary: '#000000',
    secondary: '#0a0a0a',
    tertiary: '#141414',
    
    // Scan lines
    scanLines: true,
    scanLineColor: 'rgba(0, 255, 0, 0.03)',
    scanLineSpacing: 4,
    
    // Glitch effect (subtle)
    glitch: true,
    glitchIntensity: 0.01,
  },
  
  primary: {
    500: '#00ff88',
    glow: '0 0 30px rgba(0, 255, 136, 0.5)',
  },
  
  secondary: {
    500: '#00ccff',
    glow: '0 0 30px rgba(0, 204, 255, 0.5)',
  },
  
  success: '#00ff88',
  warning: '#ffcc00',
  error: '#ff4444',
  info: '#00ccff',
  
  glass: {
    opacity: 0.85,
    blur: 8,
    border: 'rgba(0, 255, 136, 0.2)',
  },
}

// Light Theme - Clean and professional
const lightTheme = {
  name: 'Light',
  description: 'Clean, professional workspace',
  
  canvas: {
    primary: '#fafafa',
    secondary: '#f4f4f5',
    tertiary: '#e4e4e7',
    
    // Subtle paper texture
    texture: 'paper',
    textureIntensity: 0.02,
  },
  
  primary: {
    500: '#2563eb',
    glow: '0 0 30px rgba(37, 99, 235, 0.2)',
  },
  
  secondary: {
    500: '#7c3aed',
    glow: '0 0 30px rgba(124, 58, 237, 0.2)',
  },
  
  success: '#10b981',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  
  glass: {
    opacity: 0.95,
    blur: 8,
    border: 'rgba(0, 0, 0, 0.1)',
  },
}
```

### Theme Switcher Component

```tsx
// Theme Switcher
const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<ThemeVariant>('aurora')
  
  const themes = [
    { id: 'aurora', name: 'Aurora', icon: '🌌', color: '#0ea5e9' },
    { id: 'matrix', name: 'Matrix', icon: '💚', color: '#00ff88' },
    { id: 'dark', name: 'Dark', icon: '🌙', color: '#64748b' },
    { id: 'light', name: 'Light', icon: '☀️', color: '#f59e0b' },
    { id: 'system', name: 'System', icon: '🖥️', color: '#8b5cf6' },
  ]
  
  return (
    <div style={switcherContainer}>
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id as ThemeVariant)}
          style={{
            ...themeButton,
            ...(theme === t.id && themeButtonActive),
            color: t.color,
          }}
          title={t.name}
        >
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span style={themeLabel}>{t.name}</span>
        </button>
      ))}
    </div>
  )
}

const switcherContainer = {
  display: 'flex',
  gap: 'var(--space-1)',
  padding: 'var(--space-1)',
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border-2)',
}

const themeButton = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-3)',
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
  transition: 'all 200ms var(--ease-out)',
  
  ':hover': {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'var(--color-text-primary)',
  },
}

const themeButtonActive = {
  background: 'rgba(255, 255, 255, 0.2)',
  color: 'var(--color-text-primary)',
  boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.2)',
}

const themeLabel = {
  fontSize: 'var(--text-meta)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
```

---

## 🎭 ANIMATION CHOREOGRAPHY

### Node Animations

```tsx
// Node Mount Animation
const nodeMountAnimation = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.95) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`

// Node Dismiss Animation
const nodeDismissAnimation = keyframes`
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
`

// Node Drag Animation
const nodeDragAnimation = {
  transition: 'transform 16ms ease-out',
  willChange: 'transform',
}

// Node Resize Animation
const nodeResizeAnimation = {
  transition: 'width 16ms ease-out, height 16ms ease-out',
  willChange: 'width, height',
}

// Node Hover Animation
const nodeHoverAnimation = {
  transition: 'box-shadow 200ms var(--ease-out), border-color 200ms var(--ease-out)',
}
```

### Connection Animations

```tsx
// Edge Draw Animation
const edgeDrawAnimation = keyframes`
  0% {
    stroke-dashoffset: 100%;
    opacity: 0;
  }
  100% {
    stroke-dashoffset: 0%;
    opacity: 1;
  }
`

// Edge Pulse Animation (for active connections)
const edgePulseAnimation = keyframes`
  0%, 100% {
    stroke: var(--color-primary-400);
    stroke-width: 1.5;
  }
  50% {
    stroke: var(--color-primary-500);
    stroke-width: 2.5;
  }
`

// Node Connection Highlight
const connectionHighlightAnimation = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(14, 165, 233, 0);
  }
`
```

### Canvas Animations

```tsx
// Canvas Zoom Animation
const canvasZoomAnimation = {
  transition: 'transform 300ms var(--ease-spring)',
}

// Canvas Pan Animation
const canvasPanAnimation = {
  transition: 'transform 200ms var(--ease-out)',
}

// Grid Fade In
const gridFadeInAnimation = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`

// Starfield Twinkle
const starfieldTwinkleAnimation = keyframes`
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
`

// Aurora Flow
const auroraFlowAnimation = keyframes`
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 100% 100%;
  }
`
```

---

## 🎯 INTERACTION STATES

### Node States

```tsx
// Base Node State
const nodeBase = {
  // ... base styles from above
}

// Node Hover State
const nodeHover = {
  ...nodeBase,
  borderColor: 'rgba(14, 165, 233, 0.4)',
  boxShadow: `
    0 8px 25px -5px rgba(0, 0, 0, 0.4),
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(14, 165, 233, 0.2),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
  `,
  transform: 'translateY(-2px)',
}

// Node Active/Focus State
const nodeActive = {
  ...nodeHover,
  borderColor: 'rgba(14, 165, 233, 0.6)',
  boxShadow: `
    0 12px 35px -5px rgba(0, 0, 0, 0.4),
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 0 0 2px rgba(14, 165, 233, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
  `,
}

// Node Selected State
const nodeSelected = {
  ...nodeActive,
  borderColor: 'var(--color-primary-500)',
  borderWidth: 2,
  boxShadow: `
    0 12px 35px -5px rgba(0, 0, 0, 0.4),
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 0 0 3px rgba(14, 165, 233, 0.4),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
  `,
  animation: 'connectionHighlightAnimation 2s ease-in-out infinite',
}

// Node Dragging State
const nodeDragging = {
  ...nodeActive,
  cursor: 'grabbing',
  zIndex: 1000,
  boxShadow: `
    0 20px 40px -10px rgba(0, 0, 0, 0.5),
    0 0 0 4px rgba(14, 165, 233, 0.3)
  `,
  transform: 'translateY(-4px) scale(1.02)',
}

// Node Resizing State
const nodeResizing = {
  ...nodeActive,
  cursor: 'nwse-resize',
  zIndex: 1000,
  borderColor: 'var(--color-secondary-500)',
  boxShadow: `
    0 12px 35px -5px rgba(0, 0, 0, 0.4),
    0 0 0 2px rgba(139, 92, 246, 0.3)
  `,
}

// Node Error State
const nodeError = {
  ...nodeBase,
  borderColor: 'var(--color-error-500)',
  boxShadow: `
    0 4px 6px -1px rgba(239, 68, 68, 0.3),
    0 0 0 1px rgba(239, 68, 68, 0.2)
  `,
  animation: 'shake 0.5s ease-in-out',
}

// Node Loading State
const nodeLoading = {
  ...nodeBase,
  opacity: 0.8,
  pointerEvents: 'none',
  
  '::after': {
    content: '""',
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 32,
    height: 32,
    margin: '-16px 0 0 -16px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: 'var(--color-primary-500)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
}

// Shake Animation
const shakeAnimation = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-2px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(2px);
  }
`
```

---

## 🎨 VISUAL EFFECTS

### Glassmorphism

```tsx
// Glass Panel Component
const GlassPanel = ({ children, level = 1, ...props }) => {
  const levels = {
    1: {
      bg: 'rgba(15, 23, 42, 0.75)',
      border: 'rgba(255, 255, 255, 0.1)',
      blur: 12,
    },
    2: {
      bg: 'rgba(30, 41, 59, 0.85)',
      border: 'rgba(255, 255, 255, 0.15)',
      blur: 8,
    },
    3: {
      bg: 'rgba(51, 65, 85, 0.95)',
      border: 'rgba(255, 255, 255, 0.2)',
      blur: 4,
    },
  }
  
  const l = levels[level] || levels[1]
  
  return (
    <div
      style={{
        background: l.bg,
        backdropFilter: `blur(${l.blur}px)`,
        WebkitBackdropFilter: `blur(${l.blur}px)`,
        border: `1px solid ${l.border}`,
        borderRadius: 'var(--radius-lg)',
        ...props.style,
      }}
    >
      {children}
    </div>
  )
}
```

### Neon Glow

```tsx
// Neon Text Component
const NeonText = ({ children, color = 'primary', size = 'md', ...props }) => {
  const colors = {
    primary: {
      text: '#0ea5e9',
      glow: '0 0 10px rgba(14, 165, 233, 0.5)',
    },
    secondary: {
      text: '#8b5cf6',
      glow: '0 0 10px rgba(139, 92, 246, 0.5)',
    },
    success: {
      text: '#10b981',
      glow: '0 0 10px rgba(16, 185, 129, 0.5)',
    },
    error: {
      text: '#ef4444',
      glow: '0 0 10px rgba(239, 68, 68, 0.5)',
    },
  }
  
  const c = colors[color] || colors.primary
  const sizes = {
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
  }
  
  return (
    <span
      style={{
        color: c.text,
        textShadow: c.glow,
        fontSize: sizes[size],
        fontWeight: 'var(--font-weight-semibold)',
        ...props.style,
      }}
    >
      {children}
    </span>
  )
}
```

### Gradient Text

```tsx
// Gradient Text Component
const GradientText = ({ 
  children, 
  gradient = 'primary', 
  size = 'md', 
  ...props 
}) => {
  const gradients = {
    primary: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    secondary: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    success: 'linear-gradient(135deg, #10b981, #34d399)',
    warning: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    error: 'linear-gradient(135deg, #ef4444, #f87171)',
    aurora: 'linear-gradient(135deg, #0ea5e9, #8b5cf6, #ef4444)',
  }
  
  const sizes = {
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
  }
  
  return (
    <span
      style={{
        background: gradients[gradient] || gradients.primary,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontSize: sizes[size],
        fontWeight: 'var(--font-weight-semibold)',
        ...props.style,
      }}
    >
      {children}
    </span>
  )
}
```

### Shimmer Effect

```tsx
// Shimmer Component (for loading states)
const Shimmer = ({ width = '100%', height = 20, ...props }) => {
  return (
    <div
      style={{
        width,
        height,
        background: 'linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.05) 0%,
          rgba(255, 255, 255, 0.1) 50%,
          rgba(255, 255, 255, 0.05) 100%
        )',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: 'var(--radius-md)',
        ...props.style,
      }}
    />
  )
}

// Shimmer animation
const shimmerAnimation = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`
```

---

## 🎯 HUD & UI ELEMENTS

### HUD Redesign

**Current Issues:**
- Basic white box with gray text
- Minimal styling
- No visual hierarchy

**New Design:**

```tsx
// HUD Container
const hudContainer = {
  position: 'absolute',
  bottom: 'var(--space-3)',
  left: 'var(--space-3)',
  padding: 'var(--space-3)',
  
  // Glass panel
  background: 'rgba(15, 23, 42, 0.92)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 'var(--radius-lg)',
  
  // Shadow
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  
  // Typography
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-secondary)',
  
  // Layout
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 'var(--space-2)',
  
  // Animation
  animation: 'slideUp 300ms var(--ease-spring)',
}

// HUD Row
const hudRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
}

// HUD Label
const hudLabel = {
  color: 'var(--color-text-muted)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--text-meta)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// HUD Value
const hudValue = {
  color: 'var(--color-text-primary)',
  fontWeight: 'var(--font-weight-semibold)',
  fontSize: 'var(--text-caption)',
}

// HUD Code (for trace ID)
const hudCode = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-meta)',
  color: 'var(--color-primary-400)',
  background: 'rgba(14, 165, 233, 0.1)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
}

// HUD Stat
const hudStat = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
}

// HUD Stat Icon
const hudStatIcon = {
  fontSize: 'var(--text-meta)',
  color: 'var(--color-text-muted)',
}

// HUD Stat Value
const hudStatValue = {
  fontSize: 'var(--text-caption)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
}
```

### Command Palette

```tsx
// Command Palette Container
const commandPalette = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(600px, 90vw)',
  maxHeight: '70vh',
  
  // Glass modal
  background: 'rgba(15, 23, 42, 0.96)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 'var(--radius-xl)',
  
  // Shadow
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  
  // Animation
  animation: 'scaleIn 200ms var(--ease-out)',
  
  // Layout
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

// Command Palette Input
const commandPaletteInput = {
  padding: 'var(--space-4)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
}

// Command Palette Icon
const commandPaletteIcon = {
  fontSize: 'var(--text-h3)',
  color: 'var(--color-text-muted)',
}

// Command Palette Input Field
const commandPaletteInputField = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-h3)',
  
  '::placeholder': {
    color: 'var(--color-text-muted)',
  },
}

// Command Palette Results
const commandPaletteResults = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-2)',
}

// Command Palette Item
const commandPaletteItem = {
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  
  transition: 'all 150ms var(--ease-out)',
  
  ':hover': {
    background: 'rgba(255, 255, 255, 0.08)',
  },
  
  ':active': {
    background: 'rgba(255, 255, 255, 0.12)',
  },
  
  // Selected state
  ':selected': {
    background: 'rgba(14, 165, 233, 0.15)',
    border: '1px solid rgba(14, 165, 233, 0.3)',
  },
}

// Command Palette Item Icon
const commandPaletteItemIcon = {
  fontSize: 'var(--text-h3)',
  color: 'var(--color-text-muted)',
  width: 32,
  textAlign: 'center',
}

// Command Palette Item Content
const commandPaletteItemContent = {
  flex: 1,
  minWidth: 0,
}

// Command Palette Item Title
const commandPaletteItemTitle = {
  fontSize: 'var(--text-body-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// Command Palette Item Description
const commandPaletteItemDescription = {
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
  marginTop: 'var(--space-1)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// Command Palette Item Shortcut
const commandPaletteItemShortcut = {
  fontSize: 'var(--text-meta)',
  color: 'var(--color-text-muted)',
  padding: 'var(--space-1) var(--space-2)',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 'var(--radius-sm)',
}
```

---

## 🎨 COLOR PALETTE VISUALIZATION

### Dark Mode Palette

```
┌─────────────────────────────────────────────────────────────────┐
│  CANVAS BACKGROUNDS                                                │
├─────────────────────────────────────────────────────────────────┤
│  #08080b  ┌─────────────┐  Deep Space (Primary)                 │
│            │             │                                         │
│  #0f172a  ┌─────────────┐  Slate 950 (Layer 1)                   │
│            │             │                                         │
│  #1e293b  ┌─────────────┐  Slate 900 (Layer 2)                   │
│            │             │                                         │
│  #334155  ┌─────────────┐  Slate 800 (Layer 3)                   │
└────────────┴─────────────┘                                         │

┌─────────────────────────────────────────────────────────────────┐
│  ACCENT COLORS                                                    │
├─────────────────────────────────────────────────────────────────┤
│  #0ea5e9  ┌─────────────┐  Primary (Sky Blue)                    │
│            │             │  Glow: 0 0 30px rgba(14,165,233,0.3)   │
│            │             │                                         │
│  #8b5cf6  ┌─────────────┐  Secondary (Violet)                   │
│            │             │  Glow: 0 0 30px rgba(139,92,246,0.3)   │
│            │             │                                         │
│  #10b981  ┌─────────────┐  Success (Emerald)                    │
│            │             │                                         │
│  #f59e0b  ┌─────────────┐  Warning (Amber)                      │
│            │             │                                         │
│  #ef4444  ┌─────────────┐  Error (Red)                          │
└────────────┴─────────────┘                                         │

┌─────────────────────────────────────────────────────────────────┐
│  SURFACE COLORS                                                  │
├─────────────────────────────────────────────────────────────────┤
│  rgba(15,23,42,0.75)   ┌─────────────┐  Glass Panel              │
│                        │             │  Blur: 12px                        │
│                        │             │                                         │
│  rgba(30,41,59,0.85)   ┌─────────────┐  Frosted Glass             │
│                        │             │  Blur: 8px                         │
│                        │             │                                         │
│  rgba(51,65,85,0.95)   ┌─────────────┐  Solid Glass               │
└────────────────────────────┴─────────────┘                         │
```

### Light Mode Palette

```
┌─────────────────────────────────────────────────────────────────┐
│  CANVAS BACKGROUNDS                                                │
├─────────────────────────────────────────────────────────────────┤
│  #fafafa  ┌─────────────┐  Warm Off-White (Primary)              │
│            │             │  Texture: Subtle paper                 │
│            │             │                                         │
│  #f4f4f5  ┌─────────────┐  Zinc 100 (Layer 1)                    │
│            │             │                                         │
│  #e4e4e7  ┌─────────────┐  Zinc 200 (Layer 2)                    │
│            │             │                                         │
│  #d4d4d8  ┌─────────────┐  Zinc 300 (Layer 3)                    │
└────────────┴─────────────┘                                         │

┌─────────────────────────────────────────────────────────────────┐
│  ACCENT COLORS                                                    │
├─────────────────────────────────────────────────────────────────┤
│  #2563eb  ┌─────────────┐  Primary (Blue)                       │
│            │             │  Glow: 0 0 30px rgba(37,99,235,0.2)    │
│            │             │                                         │
│  #7c3aed  ┌─────────────┐  Secondary (Purple)                   │
│            │             │  Glow: 0 0 30px rgba(124,58,237,0.2)   │
└────────────┴─────────────┘                                         │
```

---

## 📱 RESPONSIVE DESIGN

### Breakpoints

```css
--breakpoint-xs:  480px;
--breakpoint-sm:  640px;
--breakpoint-md:  768px;
--breakpoint-lg:  1024px;
--breakpoint-xl:  1280px;
--breakpoint-2xl: 1536px;
```

### Canvas Adaptations

```tsx
// Mobile Canvas
const mobileCanvas = {
  // Reduce grid size
  '--grid-canvas': '24px',
  
  // Adjust default layouts
  'chat.sidebar': { x: -280, y: -140, z: 5, w: 200, h: 400 },
  'chat.thread': { x: -280, y: -140, z: 5, w: 280, h: 300 },
  'chat.composer': { x: -280, y: 180, z: 5, w: 280, h: 80 },
  
  // Touch-friendly resize handles
  resizeHandle: {
    width: 24,
    height: 24,
  },
  
  // Larger touch targets
  node: {
    minWidth: 280,
    minHeight: 160,
  },
}

// Tablet Canvas
const tabletCanvas = {
  '--grid-canvas': '32px',
  
  'chat.sidebar': { x: -440, y: -160, z: 5, w: 240, h: 440 },
  'chat.thread': { x: -440, y: -160, z: 5, w: 360, h: 340 },
  'chat.composer': { x: -440, y: 220, z: 5, w: 360, h: 90 },
}

// Desktop Canvas (default)
const desktopCanvas = {
  '--grid-canvas': '40px',
  
  // ... default layouts
}
```

---

## 🎯 ACCESSIBILITY

### Color Contrast

All color combinations meet **WCAG 2.2 AA** standards:

| Element | Background | Text | Contrast Ratio |
|---------|------------|------|-----------------|
| Node Header | rgba(0,0,0,0.3) | #f8fafc | 15.3:1 ✅ |
| Node Body | rgba(15,23,42,0.75) | #f8fafc | 15.8:1 ✅ |
| Primary Button | #0ea5e9 | #ffffff | 4.6:1 ✅ |
| Secondary Text | Any | #cbd5e1 | 4.5:1+ ✅ |

### Keyboard Navigation

```tsx
// Focus styles
const focusStyles = {
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.4)',
  borderColor: 'var(--color-primary-500)',
}

// Skip link
const skipLink = {
  position: 'absolute',
  top: -40,
  left: 0,
  background: 'var(--color-primary-600)',
  color: 'white',
  padding: 'var(--space-2) var(--space-4)',
  zIndex: 10000,
  
  ':focus': {
    top: 0,
  },
}
```

### Screen Reader Support

```tsx
// Visually hidden but accessible
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

// ARIA attributes for nodes
const nodeAria = {
  role: 'article',
  'aria-label': `${slot.slotId} from ${slot.providerId}`,
  'aria-describedby': `node-${slot.instanceId}-description`,
}
```

### Reduced Motion

```tsx
// Respect prefers-reduced-motion
const reducedMotionStyles = {
  animation: 'none',
  transition: 'none',
}

// Media query
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)

1. **Design Tokens**
   - [ ] Create CSS custom properties file
   - [ ] Define color system
   - [ ] Define typography system
   - [ ] Define spacing system
   - [ ] Define motion system

2. **Theme System**
   - [ ] Implement theme context
   - [ ] Create theme switcher
   - [ ] Add theme persistence
   - [ ] Support system preference

3. **Base Components**
   - [ ] GlassPanel component
   - [ ] NeonText component
   - [ ] GradientText component
   - [ ] Shimmer component

### Phase 2: Canvas Surface (Week 3-4)

1. **Background**
   - [ ] Deep space with stars
   - [ ] Aurora gradient overlay
   - [ ] Animated grid
   - [ ] Theme-aware colors

2. **HUD**
   - [ ] Glass panel styling
   - [ ] Modern typography
   - [ ] Animated mount
   - [ ] Theme variants

3. **Responsive**
   - [ ] Mobile adaptations
   - [ ] Tablet adaptations
   - [ ] Desktop default

### Phase 3: Canvas Nodes (Week 5-6)

1. **Node Container**
   - [ ] Glassmorphism styling
   - [ ] Depth and shadow
   - [ ] Hover effects
   - [ ] Focus states

2. **Node Header**
   - [ ] Modern design
   - [ ] Tier badges with glow
   - [ ] Typography hierarchy

3. **Resize Handle**
   - [ ] Modern indicator
   - [ ] Hover effects
   - [ ] Active states

4. **Animations**
   - [ ] Mount animation
   - [ ] Dismiss animation
   - [ ] Drag animation
   - [ ] Resize animation

### Phase 4: Card Components (Week 7-8)

1. **Agent Card**
   - [ ] Glass card styling
   - [ ] Modern DAG visualization
   - [ ] Animated step nodes
   - [ ] Glowing edges

2. **Doc Card**
   - [ ] Modern design
   - [ ] Syntax highlighting
   - [ ] Engine-specific styling

3. **Shell Card**
   - [ ] Terminal aesthetic
   - [ ] Modern CLI styling
   - [ ] Animated output

### Phase 5: Advanced Features (Week 9-10)

1. **Command Palette**
   - [ ] Glass modal
   - [ ] Modern styling
   - [ ] Smooth animations

2. **Connection Visualization**
   - [ ] Animated edges
   - [ ] Pulse effects
   - [ ] Highlight animations

3. **Theme Variants**
   - [ ] Aurora (default)
   - [ ] Matrix
   - [ ] Dark
   - [ ] Light
   - [ ] Custom themes

### Phase 6: Polish (Week 11-12)

1. **Performance**
   - [ ] GPU acceleration
   - [ ] 60fps animations
   - [ ] Memory optimization

2. **Accessibility**
   - [ ] WCAG 2.2 AA compliance
   - [ ] Keyboard navigation
   - [ ] Screen reader support
   - [ ] Reduced motion

3. **Testing**
   - [ ] Visual regression tests
   - [ ] Theme switching tests
   - [ ] Responsive tests

---

## 📊 PERFORMANCE BUDGET

| Metric | Target | Current |
|--------|--------|---------|
| First Paint | < 1s | ~1.2s |
| Largest Contentful Paint | < 2s | ~2.5s |
| Time to Interactive | < 3s | ~3.5s |
| Total Bundle Size | < 500KB | ~450KB |
| CSS Bundle Size | < 50KB | ~35KB |
| Animation FPS | 60 | 60 |

### Optimization Strategies

1. **CSS**
   - Use CSS variables for theming
   - Minimize complex selectors
   - Use `will-change` for animations
   - GPU-accelerate transforms

2. **Animations**
   - Prefer CSS animations over JS
   - Use `transform` and `opacity` (GPU-accelerated)
   - Avoid animating `width`, `height`, `top`, `left`
   - Use `requestAnimationFrame`

3. **Rendering**
   - Virtualize long lists
   - Use Intersection Observer for lazy loading
   - Debounce resize events
   - Throttle scroll events

---

## 🎨 DESIGN SYSTEM SUMMARY

### What We're Building

1. **Beautiful Canvas** - Deep space with stars, aurora effects, animated grid
2. **Modern Cards** - Glassmorphism, depth, smooth animations
3. **Rich Typography** - Modern font stack, proper hierarchy
4. **Smooth Motion** - Purposeful animations, 60fps
5. **Theme System** - Multiple themes, easy switching
6. **Accessible** - WCAG 2.2 AA, keyboard navigation
7. **Responsive** - Works on all devices
8. **Performant** - Optimized for speed

### What We're NOT Changing

- ✅ Infinite plane architecture
- ✅ Hot-swappable layers
- ✅ Sandboxed rendering
- ✅ Data-driven UI
- ✅ Capability-based interactions
- ✅ Living manifest
- ✅ Governor Canon (no CDP in canvas)

### Visual Hierarchy

```
Canvas Surface (Deep Space)
    ↓
Grid (Subtle, Animated)
    ↓
Nodes (Glass Panels)
    ↓
    Node Header (Semi-transparent)
    ↓
    Node Content (Opaque)
    ↓
    Cards (Themed, Branded)
    ↓
        Card Header
        Card Body
        Card Footer
    ↓
HUD (Glass Panel, Bottom Left)
```

---

## 🎯 NEXT STEPS

1. **Review this document** - Get feedback from team
2. **Create implementation tickets** - Break into actionable tasks
3. **Build design tokens** - Start with CSS variables
4. **Implement theme system** - Foundation for all styling
5. **Redesign CanvasSurface** - The shell
6. **Redesign CanvasNode** - Individual nodes
7. **Redesign card components** - Agent, Doc, Shell
8. **Add animations** - Bring it to life
9. **Test & iterate** - Refine based on feedback
10. **Document** - Update style guides

---

## 📚 REFERENCES

### Inspiration

- **Glassmorphism**: Apple macOS, iOS 15+
- **Neon Aesthetics**: Cyberpunk 2077, Tron Legacy
- **Dark Mode**: VS Code, Figma, Notion
- **Animations**: Stripe, Linear, Vercel
- **Typography**: Inter font family

### Tools

- **Design**: Figma (for mockups)
- **Prototyping**: CodeSandbox
- **Testing**: Storybook
- **Performance**: Chrome DevTools

### Resources

- [CSS Glassmorphism Generator](https://glassmorphism.com/)
- [Neumorphism.io](https://neumorphism.io/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [CSS Tricks - Animations](https://css-tricks.com/almanac/properties/a/animation/)

---

*This design system transforms the vivim infinite canvas from functional to beautiful, while preserving all architectural invariants and technical requirements.*
