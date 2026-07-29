import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from '@/components/canvas/StatusDot';
import { SectionLabel } from '@/components/canvas/SectionLabel';
import { Truncate } from '@/components/canvas/Truncate';
import { EmptyState } from '@/components/canvas/EmptyState';

interface StatusItem {
  name: string;
  status: 'ok' | 'warn' | 'err';
  detail: string;
}

function StatusPanel({ items }: { items: StatusItem[] }) {
  const colorMap = { ok: '#22c55e', warn: '#f59e0b', err: '#ef4444' };
  return (
    <div>
      <SectionLabel>Services</SectionLabel>
      {items.length === 0 ? (
        <EmptyState>No services</EmptyState>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot color={colorMap[item.status]} />
              <Truncate title={item.detail}>{item.name}</Truncate>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

describe('Integration: StatusPanel (StatusDot + SectionLabel + Truncate + EmptyState)', () => {
  test('renders section label', () => {
    render(<StatusPanel items={[]} />);
    expect(screen.getByText('Services')).toBeDefined();
  });

  test('shows empty state when no items', () => {
    render(<StatusPanel items={[]} />);
    expect(screen.getByText('No services')).toBeDefined();
  });

  test('renders status dots with correct colors', () => {
    const items: StatusItem[] = [
      { name: 'API', status: 'ok', detail: 'healthy' },
      { name: 'DB', status: 'err', detail: 'down' },
    ];
    render(<StatusPanel items={items} />);
    expect(screen.getByText('API')).toBeDefined();
    expect(screen.getByText('DB')).toBeDefined();
  });

  test('truncates long names', () => {
    const items: StatusItem[] = [
      { name: 'A very long service name that should be truncated', status: 'ok', detail: 'ok' },
    ];
    render(<StatusPanel items={items} />);
    const el = screen.getByText('A very long service name that should be truncated');
    expect(el.style.overflow).toBe('hidden');
    expect(el.style.textOverflow).toBe('ellipsis');
  });

  test('renders multiple items', () => {
    const items: StatusItem[] = [
      { name: 'Auth', status: 'ok', detail: '200' },
      { name: 'Cache', status: 'warn', detail: 'slow' },
      { name: 'Queue', status: 'err', detail: 'full' },
    ];
    render(<StatusPanel items={items} />);
    expect(screen.getByText('Auth')).toBeDefined();
    expect(screen.getByText('Cache')).toBeDefined();
    expect(screen.getByText('Queue')).toBeDefined();
  });
});
