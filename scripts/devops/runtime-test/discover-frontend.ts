// scripts/devops/runtime-test/discover-frontend.ts
// Discover frontend capabilities via CDP

import { ChromeGovernor } from '../../src/engines/chrome-governor.js'

export interface FrontendDiscovery {
  capabilities: Array<{
    slug: string
    component: string
  }>
  gaps: Array<{
    slug: string
    reason: string
  }>
}

/**
 * Discover frontend capabilities via CDP
 */
export async function discoverFrontend(port: number): Promise<FrontendDiscovery> {
  // Get backend capabilities first
  const backendCaps = await discoverBackend(port)
  
  const gaps: FrontendDiscovery['gaps'] = []
  const capabilities: FrontendDiscovery['capabilities'] = []

  for (const cap of backendCaps) {
    // Check if frontend component exists for this slug
    const expectedComponent = cap.slug.replace(/^cap:/, '').replace(/_/g, '-')
    
    // For now, just check if slug has ui surface
    const hasUiSurface = Array.isArray(cap.surfaces) && cap.surfaces.includes('ui')
    if (hasUiSurface) {
      // TODO: Check actual frontend component existence via CDP
      capabilities.push({
        slug: cap.slug,
        component: expectedComponent,
      })
      
      // Add placeholder gap
      gaps.push({
        slug: cap.slug,
        reason: 'Frontend component check via CDP not implemented',
      })
    }
  }

  return { capabilities, gaps }
}

async function discoverBackend(port: number): Promise<Array<{ slug: string; surfaces: string[] }>> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/capabilities`)
    if (!r.ok) return []
    const caps = await r.json()
    return Array.isArray(caps) ? caps : []
  } catch {
    return []
  }
}