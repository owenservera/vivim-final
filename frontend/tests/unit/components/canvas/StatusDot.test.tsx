import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from '@/components/canvas/StatusDot';

describe('StatusDot', () => {
  test('renders a div element', () => {
    const { container } = render(<StatusDot color="#10b981" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.tagName).toBe('DIV');
  });

  test('applies correct size and color', () => {
    const { container } = render(<StatusDot color="#ef4444" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.style.width).toBe('8px');
    expect(dot.style.height).toBe('8px');
    expect(dot.style.borderRadius).toBe('50%');
    expect(dot.style.background).toBe('#ef4444');
  });

  test('uses custom size', () => {
    const { container } = render(<StatusDot color="#3b82f6" size={12} />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.style.width).toBe('12px');
    expect(dot.style.height).toBe('12px');
  });

  test('is flex-shrink 0', () => {
    const { container } = render(<StatusDot color="#10b981" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.style.flexShrink).toBe('0');
  });

  test('merges custom style', () => {
    const { container } = render(<StatusDot color="#10b981" style={{ marginLeft: 4 }} />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.style.marginLeft).toBe('4px');
    expect(dot.style.borderRadius).toBe('50%');
  });
});
