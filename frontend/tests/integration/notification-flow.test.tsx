import { describe, expect, test, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ErrorBanner } from '@/components/canvas/ErrorBanner';
import { Toast } from '@/components/canvas/Toast';
import { useToast } from '@/hooks/useToast';

function NotificationDemo() {
  const { toast, showToast, clearToast } = useToast();
  return (
    <div>
      {toast && <Toast kind={toast.kind} message={toast.msg} onDismiss={clearToast} />}
      <button type="button" onClick={() => showToast('ok', 'Saved!')}>
        Save
      </button>
      <button type="button" onClick={() => showToast('err', 'Failed!')}>
        Fail
      </button>
    </div>
  );
}

describe('Integration: Notification flow (ErrorBanner + Toast + useToast)', () => {
  test('shows toast on save', async () => {
    render(<NotificationDemo />);
    const saveBtn = screen.getByText('Save');
    act(() => { saveBtn.click(); });
    expect(screen.getByText('Saved!')).toBeDefined();
  });

  test('shows error toast on fail', async () => {
    render(<NotificationDemo />);
    const failBtn = screen.getByText('Fail');
    act(() => { failBtn.click(); });
    const toast = screen.getByText('Failed!');
    expect(toast.style.background).toBe('#ef4444');
  });

  test('auto-dismisses toast after timeout', async () => {
    vi.useFakeTimers();
    render(<NotificationDemo />);
    act(() => { screen.getByText('Save').click(); });
    expect(screen.getByText('Saved!')).toBeDefined();

    act(() => { vi.advanceTimersByTime(2500); });
    expect(screen.queryByText('Saved!')).toBeNull();
    vi.useRealTimers();
  });

  test('ErrorBanner renders error message', () => {
    render(<ErrorBanner error="Something broke" />);
    expect(screen.getByText('Something broke')).toBeDefined();
  });

  test('ErrorBanner with empty error renders nothing', () => {
    const { container } = render(<ErrorBanner error="" />);
    expect(container.firstChild).toBeNull();
  });
});
