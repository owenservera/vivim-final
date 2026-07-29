import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InputField } from '@/components/canvas/InputField';
import { Button } from '@/components/canvas/Button';
import { Spinner } from '@/components/canvas/Spinner';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';

function SubmitForm({ onSubmit }: { onSubmit: (v: string) => Promise<void> }) {
  const { loading, error, run } = useAsyncOperation();
  const [value, setValue] = useState('');

  return (
    <div>
      <InputField
        data-testid="field"
        placeholder="Enter goal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        onClick={() => run(() => onSubmit(value))}
        disabled={loading || !value.trim()}
      >
        {loading ? 'Submitting…' : 'Submit'}
      </Button>
      {loading && <Spinner size={14} />}
      {error && <div role="alert">{error}</div>}
    </div>
  );
}

import { useState } from 'react';

describe('Integration: Form (InputField + Button + useAsyncOperation)', () => {
  test('renders input and submit button', () => {
    render(<SubmitForm onSubmit={async () => {}} />);
    expect(screen.getByPlaceholderText('Enter goal')).toBeDefined();
    expect(screen.getByText('Submit')).toBeDefined();
  });

  test('disables button when input is empty', () => {
    render(<SubmitForm onSubmit={async () => {}} />);
    const btn = screen.getByText('Submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test('enables button when input has value', () => {
    render(<SubmitForm onSubmit={async () => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Enter goal'), { target: { value: 'test goal' } });
    const btn = screen.getByText('Submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test('shows spinner during async operation', async () => {
    let resolve!: () => void;
    const slowSubmit = () => new Promise<void>((r) => { resolve = r; });
    render(<SubmitForm onSubmit={slowSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Enter goal'), { target: { value: 'task' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Submitting…')).toBeDefined();
    });
    expect(screen.getByText('Submitting…').closest('button')?.disabled).toBe(true);

    resolve();
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeDefined();
    });
  });

  test('shows error on failure', async () => {
    const failSubmit = async () => { throw new Error('Network timeout'); };
    render(<SubmitForm onSubmit={failSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Enter goal'), { target: { value: 'fail' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByRole('alert').textContent).toContain('Network timeout');
  });
});
