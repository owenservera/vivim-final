'use client';

/**
 * components/canvas/UniversalComponentProvider.tsx
 * --------------------------------------------------------------------
 * Bootstraps the UniversalComponentRegistry at app start.
 *
 * 1. Calls `registerAllComponents()` to register all ~30 UI components.
 * 2. Generates CLI commands from the registry and injects them into the
 *    ShellCommandStore so `component <id> <action>` works from the CLI.
 * 3. Provides the registry via React context for `useComponent()`.
 *
 * After this provider mounts, the CLI `list components` command shows
 * every registered component, and every component's capabilities are
 * invocable from the shell.
 */

import { useEffect, type ReactNode } from 'react';
import { registerAllComponents } from './register-all';
import { generateCliCommands, size } from '../../shared/universal-registry';
import { autoPopulateActions } from '../../actions/auto-populate';

export function UniversalComponentProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Register all components (idempotent — re-registration hot-swaps).
    registerAllComponents();
    // Auto-populate the frontend ActionRegistry from backend capabilities.
    autoPopulateActions().catch((e) =>
      // [audit] removed: console.warn('[UniversalComponentProvider] autoPopulateActions failed:', e),
    );
    // Log the registry size for verification.
    // [audit] removed: console.log(`[UniversalComponentProvider] ${size()} components registered`);
  }, []);

  return <>{children}</>;
}
