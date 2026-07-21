// devops/llm-testing/index.ts
// Barrel exports for LLM-as-Human production testing system.

export { KnowledgeStore } from './knowledge-store.js'
export { PatternAnalyzer } from './pattern-analyzer.js'
export { PriorityEngine } from './priority-engine.js'
export { SessionWriter } from './session-writer.js'
export { TestOrchestrator } from './test-orchestrator.js'
export { SystemBrief } from './system-brief.js'
export type {
  SystemConcept,
  SystemSnapshot,
  AtomicTestPlan,
  AtomicTestItem,
} from './system-brief.js'
export type {
  TestSurface,
  TestMode,
  TestStatus,
  TestCase,
  TestResult,
  Pattern,
  PatternFailure,
  ProviderKnowledge,
  SurfaceCoverage,
  ErrorEntry,
  PriorityEntry,
  SessionTrace,
  SessionSummary,
  TestConfig,
  KnowledgeDelta,
} from './types.js'

export type {
  SurfaceAdapter,
} from './adapters/surface-adapter.js'

export {
  CliAdapter,
  ApiAdapter,
  UiAdapter,
  McpAdapter,
  WorkflowAdapter,
  ProviderAdapter,
} from './adapters/index.js'

export type {
  PlaywrightBridge,
  ChromeToolBridge,
} from './adapters/index.js'
