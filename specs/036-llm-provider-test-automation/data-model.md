# Data Model: LLM-Driven Provider Testing

## Entities

### ProviderTestReport
```typescript
interface ProviderTestReport {
  providerId: string        // "gemini" | "chatgpt" | "claude"
  slug: string             // "gemini" | "chatgpt" | "claude"
  phases: PhaseResult[]
  overall: 'pass' | 'fail' | 'partial'
  startedAt: number
  completedAt: number
  durationMs: number
}
```

### PhaseResult
```typescript
interface PhaseResult {
  phase: 'discover' | 'infer' | 'test-selectors' | 'test-parse' | 'test-cap' | 'test-frontend' | 'verify' | 'converge'
  pass: boolean
  error?: string
  outputJson: string       // raw phase output
  durationMs: number
}
```

### SlotAuditEntry
```typescript
interface SlotAuditEntry {
  slotId: string         // e.g. "chat.composer"
  hasDefault: boolean
  defaultComponent: string
  providerOverrides: string[]
  capabilityOverrides: string[]
  resolutionStatus: 'resolved' | 'fallback' | 'gap'
}
```

### VisualCheckpoint
```typescript
interface VisualCheckpoint {
  momentId: string       // e.g. "wizard-step-1", "streaming-gemini-t1"
  screenshotPath: string // relative path in tests/fixtures/screenshots/
  provider: string
  description: string
  llmAssertion: string   // LLM-written assertion about what this should show
  pass: boolean
  consoleErrors: string[]
}
```

### WizardStep
```typescript
interface WizardStep {
  step: number
  name: string           // "provider-selection" | "profile-creation" | "account-auth"
  url: string
  slotResolution: { slotId: string, resolvedComponent: string }[]
  screenshot: string
  consoleErrors: string[]
}
```
