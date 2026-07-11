import { createRoot } from 'react-dom/client'
import { SandboxApp } from './app/sandbox-app.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <SandboxApp />
)