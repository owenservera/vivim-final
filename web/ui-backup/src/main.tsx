import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { registerDefaults, loadPersisted, exposeRuntime } from './ui/index.js'
import './index.css'

// Baseline the hot-swappable capability-global UI (docs/prd-hot-swappable-ui.md):
// register generic defaults, re-apply any persisted dev hot-swaps, and expose
// window.__vivim.ui for live runtime swaps.
registerDefaults()
loadPersisted()
exposeRuntime()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
