// scripts/devops/runtime-test/discover-backend.ts
// Discover backend capabilities from live server

export interface BackendCapability {
  id: string
  slug: string
  name: string
  category: string
  surfaces: string[]
}

/**
 * Discover backend capabilities live from server
 */
export async function discoverBackend(port: number): Promise<BackendCapability[]> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/capabilities`)
    if (!r.ok) {
      console.error(`[discover-backend] Failed: ${r.status}`)
      return []
    }
    
    const caps = await r.json()
    if (Array.isArray(caps)) {
      return caps.map((c: any) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        category: c.category,
        surfaces: c.surfaces ?? [],
      }))
    }
    return []
  } catch (e) {
    console.error('[discover-backend] Error:', e)
    return []
  }
}