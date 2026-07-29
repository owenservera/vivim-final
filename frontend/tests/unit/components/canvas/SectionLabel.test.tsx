import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionLabel } from '@/components/canvas/SectionLabel';

describe('SectionLabel', () => {
  test('renders children text', () => {
    render(<SectionLabel>Tasks</SectionLabel>);
    expect(screen.getByText('Tasks')).toBeDefined();
  });

  test('applies uppercase styling', () => {
    render(<SectionLabel>Header</SectionLabel>);
    const el = screen.getByText('Header');
    expect(el.style.textTransform).toBe('uppercase');
    expect(el.style.fontWeight).toBe('600');
    expect(el.style.letterSpacing).toBe('0.05em');
  });

  test('uses muted color by default', () => {
    render(<SectionLabel>Muted</SectionLabel>);
    const el = screen.getByText('Muted');
    expect(el.style.color).toBe('var(--text-muted)');
  });

  test('uses text color when muted=false', () => {
    render(<SectionLabel muted={false}>Not muted</SectionLabel>);
    const el = screen.getByText('Not muted');
    expect(el.style.color).toBe('var(--text)');
  });

  test('merges custom style', () => {
    render(<SectionLabel style={{ marginBottom: 8, fontSize: 10 }}>Custom</SectionLabel>);
    const el = screen.getByText('Custom');
    expect(el.style.marginBottom).toBe('8px');
    expect(el.style.fontSize).toBe('10px');
    expect(el.style.textTransform).toBe('uppercase');
  });
});
