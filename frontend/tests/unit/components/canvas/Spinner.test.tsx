import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '@/components/canvas/Spinner';

describe('Spinner', () => {
  test('renders a div with spin animation', () => {
    const { container } = render(<Spinner />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.animation).toBe('spin 0.8s linear infinite');
    expect(el.style.borderRadius).toBe('50%');
  });

  test('uses default size 16', () => {
    const { container } = render(<Spinner />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('16px');
    expect(el.style.height).toBe('16px');
  });

  test('accepts custom size', () => {
    const { container } = render(<Spinner size={24} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('24px');
    expect(el.style.height).toBe('24px');
  });

  test('is flex-shrink 0', () => {
    const { container } = render(<Spinner />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.flexShrink).toBe('0');
  });

  test('merges custom style', () => {
    const { container } = render(<Spinner style={{ marginTop: 8 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.marginTop).toBe('8px');
    expect(el.style.borderRadius).toBe('50%');
  });
});
