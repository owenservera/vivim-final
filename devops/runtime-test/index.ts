// devops/runtime-test/index.ts
// Unit 6.4 — Per-unit spec index

export { supervisor, Supervisor } from './supervisor.js'
export { preflight, type PreflightResult } from './preflight.js'
export { engageBrowser, type EngageResult } from './engage.js'
export { discoverBackend, discoverFrontend, discoverAll } from './discover.js'
export { discoverCdpProtocol, type DiscoverCdpResult } from './discover-cdp.js'
export { runLiveTest, type TestSpec } from './test-harness.js'
export { captureDebug, type DebugCapture } from './debug-capture.js'
export { scaffoldFrontend } from './build-frontend.js'
export { scaffoldBackend, type ScaffoldBackendOptions } from './build-backend.js'
export { scaffoldCapability, type CodegenResult } from './capability-codegen.js'
export { runOrchestrationCycle, verifyFrontend } from './orchestration.js'
export { stopServices, type StopResult } from './stop.js'
export { serverStatus, type StatusResult } from './status.js'
export { profileStatus, type ProfileHealthEntry } from './status.js'
export { testCapability, type TestCapResult } from './test-cap.js'
export { saveLoopReport, readLoopReport } from './report.js'
export {
  generateCatalog,
  readCatalog,
  matchGoalToCapability,
  type CatalogCap,
} from './cap-catalog.js'
export { runMigrate, type MigrateResult } from './migrate.js'
export { ensureBrowser, type BrowserStatus } from './ensure-browser.js'
export { startWatchdog } from './watchdog.js'
export { installProcessGuard } from './process-guard.js'
export { discoverProtocol, type DiscoverProtocolResult } from './discover-protocol.js'
export { providerStatus, type ProviderStatusResult } from './provider-status.js'
export { assessGoal, type GoalAssessment } from './goal-gate.js'
export { runGuard, type GuardResult } from './guard.js'
export {
  runIterativeLoop,
  resetIteration,
  type IterationResult,
} from './iterate.js'
export {
  loadLoopState,
  saveLoopState,
  initLoopState,
  clearLoopState,
  type LoopState,
  type StepRecord,
  type StepChecks,
} from './loop-state.js'
