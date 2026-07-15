// scripts/devops/runtime-test/index.ts
// vivim-runtime — Agentic Development Loop
//
// Main entry point for the runtime-os skill. Orchestrates:
// launch → engage → discover → test → debug → build → repeat

import { preflightCheck } from './preflight.js'
import { startSupervisor, stopSupervisor } from './supervisor.js'
import { engageBrowser } from './engage.js'
import { discoverBackend } from './discover-backend.js'
import { runLiveE2E } from './test.js'
import { checkUiGate } from './ui-gate.js'
import { captureDebug } from './debug.js'
import { scaffoldBuild } from './build.js'
import { resolveBackendPort } from '../../../devops/runtime-test/port.js'

export interface RuntimeContext {
  profile?: string
  maxCycles?: number
  mode?: 'autonomous' | 'mitm'
  verbose?: boolean
  targetCapability?: string
}

export interface LoopReport {
  cyclesCompleted: number
  unitsTouched: string[]
  fixesApplied: number
  finalHealth: {
    backend: boolean
    frontend: boolean
    slaves: number
  }
  stoppedReason?: string
}

/**
 * Bootstrap the server stack (backend + frontend)
 */
async function bootstrap() {
  return startSupervisor({ profile: 'minimal' })
}

/**
 * Full runtime loop — runs until green or budget exhausted
 */
export async function runtime(config: RuntimeContext = {}): Promise<LoopReport> {
  const report: LoopReport = {
    cyclesCompleted: 0,
    unitsTouched: [],
    fixesApplied: 0,
    finalHealth: { backend: false, frontend: false, slaves: 0 },
  }

  // Step 1: Bootstrap stack
  const supervisor = await bootstrap()
  const portInfo = supervisor.getPorts()
  if (config.verbose) console.log(`[runtime] Backend port: ${portInfo.backend}`)

  // Step 2: Pre-flight check
  const pre = await preflightCheck({
    backendPort: portInfo.backend,
    frontendPort: portInfo.frontend,
  })
  if (!pre.ok) {
    report.stoppedReason = `Preflight failed: ${pre.failingCheck}`
    await stopSupervisor(supervisor)
    return report
  }

  // Step 3: Engage browser
  const engageResult = await engageBrowser()
  report.finalHealth.slaves = engageResult.slavesReady

  // Step 4: Main loop
  const maxCycles = config.maxCycles ?? 3
  for (let cycle = 0; cycle < maxCycles; cycle++) {
    report.cyclesCompleted++
    if (config.verbose) console.log(`[runtime] Cycle ${cycle + 1}/${maxCycles}`)

    // Discover backend capabilities
    const backendCaps = await discoverBackend(portInfo.backend)
    if (config.verbose) {
      console.log(`[runtime] Backend capabilities: ${backendCaps.length}`)
    }

    // Run E2E tests
    const testResult = await runLiveE2E(portInfo.backend, portInfo.frontend)

    if (testResult.passed) {
      report.stoppedReason = 'All tests passed'
      break
    }

    // Check UI gate for target capability
    if (config.targetCapability) {
      const uiOk = await checkUiGate(portInfo.frontend)
      if (!uiOk) {
        // Debug on failure
        const debugReport = await captureDebug(portInfo.frontend, config.targetCapability)
        if (config.verbose) {
          console.log(`[runtime] Debug captured: ${debugReport.files.length} files`)
        }

        // Build fix if autonomous
        if (config.mode === 'autonomous') {
          const buildResult = await scaffoldBuild(portInfo.frontend, config.targetCapability, debugReport)
          if (buildResult.scaffolded) {
            report.fixesApplied++
            report.unitsTouched.push(config.targetCapability)
          }
        } else {
          // MITM mode - stop and ask
          report.stoppedReason = `UI gate failed for ${config.targetCapability} - human review needed`
          break
        }
      }
    }
  }

  // Step 5: Shutdown
  await stopSupervisor(supervisor)
  report.finalHealth.backend = true
  report.finalHealth.frontend = true

  return report
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const args = process.argv.slice(2)
    const config: RuntimeContext = {
      maxCycles: 3,
      mode: 'autonomous',
      verbose: args.includes('--verbose'),
    }

    // Parse flags
    const profileIdx = args.indexOf('--profile')
    if (profileIdx !== -1 && args[profileIdx + 1]) {
      config.profile = args[profileIdx + 1]
    }

    const cyclesIdx = args.indexOf('--max-cycles')
    if (cyclesIdx !== -1 && args[cyclesIdx + 1]) {
      config.maxCycles = Number(args[cyclesIdx + 1])
    }

    const modeIdx = args.indexOf('--mode')
    if (modeIdx !== -1 && args[modeIdx + 1]) {
      config.mode = args[modeIdx + 1] as 'autonomous' | 'mitm'
    }

    const subcmd = args[0]

    switch (subcmd) {
      case 'preflight': {
        const r = await preflightCheck({ backendPort: resolveBackendPort(), frontendPort: 5173 })
        console.log(JSON.stringify(r, null, 2))
        break
      }
      case 'runtime':
      case 'bootstrap': {
        const r = await runtime(config)
        console.log(JSON.stringify(r, null, 2))
        break
      }
      case 'engage': {
        const r = await engageBrowser()
        console.log(JSON.stringify(r, null, 2))
        break
      }
      case 'discover-backend': {
        const r = await discoverBackend(resolveBackendPort())
        console.log(JSON.stringify(r, null, 2))
        break
      }
      case '--help':
      default:
        console.log(`vivim-runtime — Agentic Development Loop

Commands:
  runtime            Full autonomous loop (launch→engage→discover→test→debug→build→repeat)
  preflight          Check health (DB + server)
  bootstrap          Full server bootstrap with engines
  engage             Launch browser slave
  discover-backend   List backend capabilities
  test               Live E2E harness
  ui-gate            Check UI readiness
  debug              Capture screenshot + console
  build              Scaffold/regenerate UI

Options:
  --profile <name>     Server profile (default: minimal)
  --max-cycles <n>     Max loop cycles (default: 3)
  --mode <autonomous|mitm>  Autonomy mode (default: autonomous)
  --verbose            Verbose output
  --help               Show this help
`)
    }
  })().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
}