import { describe, expect, test, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from '@/components/canvas/Toast';

describe('Toast', () => {
  test('renders message', () => {
    render(<Toast kind="ok" message="Saved successfully" />);
    expect(screen.getByText('Saved successfully')).toBeDefined();
  });

  test('applies ok styling', () => {
    render(<Toast kind="ok" message="OK" />);
    const el = screen.getByText('OK');
    expect(el.style.background).toBe('#10b981');
    expect(el.style.color).toBe('#fff');
  });

  test('applies err styling', () => {
    render(<Toast kind="err" message="Failed" />);
    const el = screen.getByText('Failed');
    expect(el.style.background).toBe('#ef4444');
  });

  test('auto-dismisses after specified time', () => {
    vi.useFakeTimers();
    render(<Toast kind="ok" message="Temporary" autoDismiss={1000} />);
    expect(screen.getByText('Temporary')).toBeDefined();

    act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.queryByText('Temporary')).toBeNull();
    vi.useRealTimers();
  });

  test('does not auto-dismiss when autoDismiss is 0', () => {
    vi.useFakeTimers();
    render(<Toast kind="ok" message="Persistent" autoDismiss={0} />);
    expect(screen.getByText('Persistent')).toBeDefined();

    act(() => { vi.advanceTimersByTime(5000); });

    expect(screen.getByText('Persistent')).toBeDefined();
    vi.useRealTimers();
  });

  test('calls onDismiss when auto-dismissed', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast kind="ok" message="Callback" autoDismiss={500} onDismiss={onDismiss} />);

    act(() => { vi.advanceTimersByTime(500); });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test('merges custom style', () => {
    const { container } = render(<Toast kind="ok" message="ToastStyled" style={{ top: 100 }} />);
    const toastDiv = container.querySelector('[style*="position: fixed"]') as HTMLElement;
    expect(toastDiv.style.top).toBe('100px');
  });
});
