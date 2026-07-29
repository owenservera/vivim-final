import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBanner } from '@/components/canvas/ErrorBanner';

describe('ErrorBanner', () => {
  test('renders error message', () => {
    render(<ErrorBanner error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  test('returns null when error is null', () => {
    const { container } = render(<ErrorBanner error={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('applies error styling', () => {
    render(<ErrorBanner error="Error" />);
    const el = screen.getByText('Error');
    expect(el.style.color).toBe('#ef4444');
    expect(el.style.borderRadius).toBe('6px');
  });

  test('merges custom style', () => {
    render(<ErrorBanner error="Styled" style={{ padding: 16 }} />);
    const el = screen.getByText('Styled');
    expect(el.style.padding).toBe('16px');
  });
});
