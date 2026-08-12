// devops/roadmap.ts
// CLI entry: `bun run devops roadmap [subcmd] [args]`
//
//   (no args)        -> full research cycle (scan + discover + report)
//   --unit <id>      -> research single unit
//   --domain <name>  -> research domain
//   --discover       -> run discovery only
//   --interview <id> -> start interview for discovered unit
//   --merge          -> merge enriched data into tracker
//   --merge-unit <id> -> merge specific new unit

import { runResearch, researchUnit, researchDomain } from './roadmap/research.ts'
import { runDiscovery } from './roadmap/discover.ts'
import { runInterview } from './roadmap/interview.ts'
import { runMergeGate, mergeUnit } from './roadmap/merge-gate.ts'
import { generateReport } from './roadmap/report.ts'

const args = process.argv.slice(2)

export async function runResearchCommand(commandArgs?: string[]): Promise<void> {
  const cmdArgs = commandArgs ?? args

  // --unit <id>: research single unit
  const unitId = cmdArgs.find(a => a.startsWith('--unit='))?.split('=')[1]
    ?? (cmdArgs.indexOf('--unit') !== -1 ? cmdArgs[cmdArgs.indexOf('--unit') + 1] : undefined)
  if (unitId) {
    const result = await researchUnit(unitId)
    // [audit] removed: console.log(JSON.stringify(result, null, 2))
    return
  }

  // --domain <name>: research domain
  const domain = cmdArgs.find(a => a.startsWith('--domain='))?.split('=')[1]
    ?? (cmdArgs.indexOf('--domain') !== -1 ? cmdArgs[cmdArgs.indexOf('--domain') + 1] : undefined)
  if (domain) {
    const result = await researchDomain(domain)
    // [audit] removed: console.log(JSON.stringify(result, null, 2))
    return
  }

  // --discover: discovery only
  if (cmdArgs.includes('--discover')) {
    const discovered = await runDiscovery()
    // [audit] removed: console.log(`Discovered ${discovered.length} candidate units`)
    for (const d of discovered) {
      // [audit] removed: console.log(`  ${d.gapId}: ${d.summary} → suggested: ${d.suggestedUnit}`)
    }
    return
  }

  // --interview <id>: start interview
  const interviewGapId = cmdArgs.find(a => a.startsWith('--interview='))?.split('=')[1]
    ?? (cmdArgs.indexOf('--interview') !== -1 ? cmdArgs[cmdArgs.indexOf('--interview') + 1] : undefined)
  if (interviewGapId) {
    await runInterview(interviewGapId)
    return
  }

  // --merge: merge enriched data into tracker
  if (cmdArgs.includes('--merge')) {
    await runMergeGate()
    return
  }

  // --merge-unit <id>: merge specific new unit
  const mergeUnitId = cmdArgs.find(a => a.startsWith('--merge-unit='))?.split('=')[1]
    ?? (cmdArgs.indexOf('--merge-unit') !== -1 ? cmdArgs[cmdArgs.indexOf('--merge-unit') + 1] : undefined)
  if (mergeUnitId) {
    await mergeUnit(mergeUnitId)
    return
  }

  // Default: full research cycle
  // [audit] removed: console.log('=== DevOps Roadmap — Full Research Cycle ===\n')

  // Step 1: Research
  // [audit] removed: console.log('Step 1: Running research engine...')
  const researchResults = await runResearch()
  // [audit] removed: console.log(`Researched ${researchResults.length} units`)

  // Step 2: Discovery
  // [audit] removed: console.log('\nStep 2: Running discovery engine...')
  const discovered = await runDiscovery()
  // [audit] removed: console.log(`Discovered ${discovered.length} candidate units`)

  // Step 3: Generate reports
  // [audit] removed: console.log('\nStep 3: Generating reports...')
  await generateReport(researchResults, discovered)
  // [audit] removed: console.log('Reports written to docs/roadmap/')

  // Summary
  // [audit] removed: console.log('\n=== Summary ===')
  // [audit] removed: console.log(`Units researched: ${researchResults.length}`)
  // [audit] removed: console.log(`Candidates discovered: ${discovered.length}`)
  // [audit] removed: console.log('Reports: docs/roadmap/RESEARCH-REPORT.md, DISCOVERED-UNITS.md, DOMAIN-HEALTH.md')
}

// Only run main() when executed directly, not when imported
const isMainModule = process.argv[1]?.endsWith('roadmap.ts') || process.argv[1]?.endsWith('roadmap/index.ts')
if (isMainModule) {
  runResearchCommand().catch((e) => {
    // [audit] removed: console.error('Roadmap error:', e)
    process.exit(1)
  })
}
