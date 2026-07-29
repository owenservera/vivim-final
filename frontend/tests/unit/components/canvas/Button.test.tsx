import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/canvas/Button';

describe('Button', () => {
  test('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  test('renders as a button element', () => {
    render(<Button>Test</Button>);
    const el = screen.getByText('Test');
    expect(el.tagName).toBe('BUTTON');
  });

  test('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const el = screen.getByText('Primary');
    expect(el.style.background).toBe('var(--accent)');
    expect(el.style.color).toBe('var(--accent-fg)');
  });

  test('applies secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const el = screen.getByText('Secondary');
    expect(el.style.background).toBe('var(--bg-elevated)');
    expect(el.style.color).toBe('var(--text)');
  });

  test('applies danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const el = screen.getByText('Danger');
    expect(el.style.background).toBe('transparent');
    expect(el.style.color).toBe('#ef4444');
  });

  test('applies ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const el = screen.getByText('Ghost');
    expect(el.style.color).toBe('var(--text-muted)');
  });

  test('can be disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const el = screen.getByText('Disabled') as HTMLButtonElement;
    expect(el.disabled).toBe(true);
  });

  test('handles onClick', () => {
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Click</Button>);
    screen.getByText('Click').click();
    expect(clicked).toBe(true);
  });
});
