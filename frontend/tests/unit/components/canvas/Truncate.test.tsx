import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Truncate } from '@/components/canvas/Truncate';

describe('Truncate', () => {
  test('renders children inside a span by default', () => {
    render(<Truncate>Hello world</Truncate>);
    const el = screen.getByText('Hello world');
    expect(el.tagName).toBe('SPAN');
  });

  test('applies truncation styles', () => {
    render(<Truncate>Truncated text</Truncate>);
    const el = screen.getByText('Truncated text');
    expect(el.style.overflow).toBe('hidden');
    expect(el.style.textOverflow).toBe('ellipsis');
    expect(el.style.whiteSpace).toBe('nowrap');
  });

  test('renders as div when as="div"', () => {
    render(<Truncate as="div">Div content</Truncate>);
    const el = screen.getByText('Div content');
    expect(el.tagName).toBe('DIV');
  });

  test('renders as td when as="td"', () => {
    render(<table><tbody><tr><td><Truncate as="td">CellTd</Truncate></td></tr></tbody></table>);
    const el = screen.getByText('CellTd');
    expect(el.tagName).toBe('TD');
  });

  test('merges custom style with base styles', () => {
    render(<Truncate style={{ color: 'red', fontSize: 12 }}>TruncStyled</Truncate>);
    const el = screen.getByText('TruncStyled');
    expect(el.style.color).toBe('red');
    expect(el.style.fontSize).toBe('12px');
    expect(el.style.overflow).toBe('hidden');
  });

  test('passes title attribute', () => {
    render(<Truncate title="Full text">Short</Truncate>);
    const el = screen.getByText('Short');
    expect(el.getAttribute('title')).toBe('Full text');
  });
});
