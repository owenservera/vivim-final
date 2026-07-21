// devops/llm-testing/adapters/surface-adapter.ts
// Interface that all surface adapters implement.

import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'

export interface SurfaceAdapter {
  readonly name: TestSurface

  init(config: TestConfig, registry?: UnifiedCapabilityRegistry): Promise<void>

  discoverCapabilities(): Promise<TestCase[]>

  execute(test: TestCase): Promise<TestResult>

  cleanup(): Promise<void>
}
