import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/canvas/EmptyState';

describe('EmptyState', () => {
  test('renders text content', () => {
    render(<EmptyState>No items yet</EmptyState>);
    expect(screen.getByText('No items yet')).toBeDefined();
  });

  test('applies muted text color', () => {
    render(<EmptyState>Empty</EmptyState>);
    const el = screen.getByText('Empty');
    expect(el.style.color).toBe('var(--muted-foreground)');
  });

  test('applies default font size', () => {
    render(<EmptyState>Small text</EmptyState>);
    const el = screen.getByText('Small text');
    expect(el.style.fontSize).toBe('11px');
  });

  test('accepts custom style', () => {
    render(<EmptyState style={{ padding: 16, fontSize: 14 }}>Padded</EmptyState>);
    const el = screen.getByText('Padded');
    expect(el.style.padding).toBe('16px');
    expect(el.style.fontSize).toBe('14px');
  });
});
