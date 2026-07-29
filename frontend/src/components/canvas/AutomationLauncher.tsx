'use client';

/**
 * components/canvas/AutomationLauncher.tsx
 * --------------------------------------------------------------------
 * Browser automation launcher — list recipes, run automations.
 * Uses useIO() for /api/automate/*. CSS variables only.
 */

import { useEffect, useState, useCallback } from 'react';
import { useIO } from './UnifiedIOProvider';
import { PanelShell } from './PanelShell';
import { ErrorBanner } from './ErrorBanner';
import { Toast } from './Toast';
import { SectionLabel } from './SectionLabel';
import { Button } from './Button';
import { TextArea } from './TextArea';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { useToast } from '@/hooks/useToast';

interface Recipe {
  id: string;
  name: string;
  description?: string;
}

interface AutomationRole {
  id: string;
  name: string;
}

export function AutomationLauncher() {
  const io = useIO();
  const { loading, error, run } = useAsyncOperation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [roles, setRoles] = useState<AutomationRole[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [intent, setIntent] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [rRes, rlRes] = await Promise.all([
        io.get<{ recipes: Recipe[] }>('/api/automate/recipes'),
        io.get<{ roles: AutomationRole[] }>('/api/automate/roles'),
      ]);
      if (rRes.ok) setRecipes(rRes.data?.recipes ?? []);
      if (rlRes.ok) setRoles(rlRes.data?.roles ?? []);
    } catch { /* silent */ }
  }, [io]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRun = useCallback(async () => {
    if (!selectedRole || !intent.trim()) return;
    setResult(null);
    const res = await run(() => io.post<{ status: string; output?: string; durationMs?: number }>('/api/automate/run', {
      role: selectedRole,
      recipeId: selectedRecipe || undefined,
      intent: intent.trim(),
    }));
    if (res?.ok) {
      const r = res.data;
      setResult(`Status: ${r?.status}\nDuration: ${r?.durationMs ?? '?'}ms\n\n${r?.output ?? 'No output'}`);
      showToast('ok', 'Automation completed');
    }
  }, [selectedRole, selectedRecipe, intent, io, run, showToast]);

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Automation Launcher</h2>

      {toast && <Toast kind={toast.kind} message={toast.msg} />}

      {/* Role select */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
        <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} style={selectStyle}>
          <option value="">Select role…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Recipe select */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Recipe (optional)</div>
        <select value={selectedRecipe} onChange={(e) => setSelectedRecipe(e.target.value)} style={selectStyle}>
          <option value="">No recipe</option>
          {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Intent */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Intent</div>
        <TextArea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What should the automation do?"
          rows={3}
        />
      </div>

      <Button onClick={handleRun} disabled={!selectedRole || !intent.trim() || loading} style={{ marginBottom: 12 }}>
        {loading ? 'Running…' : 'Run Automation'}
      </Button>

      <ErrorBanner error={error} />

      {result && (
        <div style={{ padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
          {result}
        </div>
      )}

      {/* Recipe list */}
      <SectionLabel style={{ marginTop: 16, marginBottom: 4 }}>Available Recipes</SectionLabel>
      {recipes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No recipes available</div>}
      {recipes.map((r) => (
        <div key={r.id} style={{ padding: '6px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          {r.description && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{r.description}</span>}
        </div>
      ))}
    </PanelShell>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '4px 8px', border: '1px solid var(--border)',
  background: 'var(--bg-elevated)', color: 'var(--text)', borderRadius: 4,
  fontSize: 11, fontFamily: 'inherit', boxSizing: 'border-box',
};
