// scripts/devops/runtime-test/build.ts
// Scaffold/regenerate UI components

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface BuildResult {
  scaffolded: boolean
  componentPath?: string
  handlerPath?: string
  error?: string
}

/**
 * Scaffold frontend component + backend handler for capability
 */
export async function scaffoldBuild(
  port: number,
  capabilitySlug: string,
  _debugReport?: any,
): Promise<BuildResult> {
  try {
    // 1. Create frontend component
    const componentDir = join(process.cwd(), 'web', 'ui', 'src', 'components')
    await mkdir(componentDir, { recursive: true })

    const componentName = capabilitySlug.replace(/^cap:/, '').replace(/_/g, '-')
    const componentPath = join(componentDir, `${componentName}.tsx`)

    // Check if component exists
    let exists = false
    try {
      await readFile(componentPath)
      exists = true
    } catch {
  // [audit] log the error with context here
      // Component doesn't exist, create it
    }

    if (!exists) {
      const componentCode = `// Auto-scaffolded capability component
import { useAui } from '@assistant-ui/react'

export function ${toComponentName(componentName)}() {
  const aui = useAui()
  
  return (
    <div className="${componentName}-capability">
      <h3>${capabilitySlug}</h3>
      {/* TODO: Implement capability UI */}
    </div>
  )
}
`
      await writeFile(componentPath, componentCode)
    }

    // 2. Create backend handler
    const engineDir = join(process.cwd(), 'src', 'engines')
    const handlerPath = join(engineDir, 'capabilities', `${componentName}-handler.ts`)
    await mkdir(join(engineDir, 'capabilities'), { recursive: true })

    const handlerCode = `// Auto-scaffolded capability handler
import type { CapabilitySurface, UnifiedCapability } from '../unified-registry.js'

export const ${componentName}Capability: UnifiedCapability = {
  id: '${capabilitySlug}',
  slug: '${capabilitySlug}',
  name: '${capabilitySlug.replace(/_/g, ' ')}',
  description: 'Auto-scaffolded capability',
  category: 'system',
  surfaces: ['cli', 'ui', 'api'] as CapabilitySurface[],
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  handler: async (input) => {
    return { ok: true, input }
  },
}
`
    await writeFile(handlerPath, handlerCode)

    return {
      scaffolded: true,
      componentPath,
      handlerPath,
    }
  } catch (e) {
    return { scaffolded: false, error: String(e) }
  }
}

function toComponentName(slug: string): string {
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}