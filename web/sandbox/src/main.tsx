import { createRoot } from 'react-dom/client'
import { SandboxApp } from './app/sandbox-app.tsx'
import { autoPopulateActions } from '@ui/actions/auto-populate.js'
import { CapabilityRegistry } from '@ui/registry/index.js'
import { ActionButton } from './features/action-button.js'
import './index.css'

// Promote bespoke renderers under the backend-declared `ui.component` slugs so
// FRONTEND = BACKEND resolves to a real component (not just the generic
// fallback). Backend caps with `ui: { component: 'action-button' }` render here.
CapabilityRegistry.register('action-button', {
  slug: 'action-button',
  component: ActionButton,
  bestPracticeNote: 'Bespoke renderer for action-style capabilities; executes via the universal route.',
})

// Unit 24.9 — fetch the unified capability registry and auto-register every
// `ui`-surface capability as an Action before the app mounts.
void autoPopulateActions().finally(() => {
  createRoot(document.getElementById('root')!).render(<SandboxApp />)
})