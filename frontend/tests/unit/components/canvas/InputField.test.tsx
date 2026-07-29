import { describe, expect, test } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputField } from '@/components/canvas/InputField';

describe('InputField', () => {
  test('renders an input element', () => {
    render(<InputField placeholder="Enter text" />);
    const el = screen.getByPlaceholderText('Enter text');
    expect(el.tagName).toBe('INPUT');
  });

  test('applies base styles', () => {
    render(<InputField data-testid="input" />);
    const el = screen.getByTestId('input');
    expect(el.style.width).toBe('100%');
    expect(el.style.padding).toBe('6px 10px');
    expect(el.style.borderRadius).toBe('4px');
    expect(el.style.fontSize).toBe('12px');
    expect(el.style.boxSizing).toBe('border-box');
  });

  test('merges custom style with base styles', () => {
    render(<InputField data-testid="input" style={{ marginBottom: 8 }} />);
    const el = screen.getByTestId('input');
    expect(el.style.marginBottom).toBe('8px');
    expect(el.style.width).toBe('100%');
  });

  test('passes input props through', () => {
    render(<InputField type="password" disabled placeholder="密码" />);
    const el = screen.getByPlaceholderText('密码');
    expect(el.getAttribute('type')).toBe('password');
    expect(el.getAttribute('disabled')).not.toBeNull();
  });

  test('handles onChange', () => {
    let value = '';
    render(
      <InputField
        data-testid="input"
        onChange={(e) => { value = e.target.value; }}
      />
    );
    const el = screen.getByTestId('input');
    fireEvent.change(el, { target: { value: 'hello' } });
    expect(value).toBe('hello');
  });
});
