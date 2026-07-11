// tests/integration/helpers/mock-chrome-launcher.ts
// Fake Chrome binary launcher - spawns a mock server instead of real Chrome

export interface MockLaunchResult {
  stdout: string
  stderr: string
  exitCode: number
}
