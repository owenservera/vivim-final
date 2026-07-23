// devops/index.ts
// CLI entry: `bun run devops <cmd> [args]`
//
//   select            -> print next implementable unit as JSON (or "null")
//   mark <id> <s>    -> transition state: pending|in_progress|done|blocked
//   gate             -> run quality gate, print JSON, exit non-zero on fail
//   report           -> print progress summary
//   truth <sub>      -> truth grounding system (scan|compare|interfaces|full|report)
//   invariants       -> check architectural invariants (check|report)
//   audit-code <s>   -> source-code audit (surface|standard|deep|full) + fix/to-units
//   audit-arch <s>   -> architecture audit (surface|standard|deep|full) + --module/--pass
//   (any unit command accepts --tracker <path> to target a satellite tracker)

import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { runAuditArch } from './audit-arch/index.ts'
import { runAuditCode } from './audit-code/index.ts'
import { audit } from './audit.ts'
import { captureBaseline } from './baseline.ts'
import { formatContextReport, getContext } from './context.ts'
import {
  addReview,
  addStructuredReview,
  formatReviewPrompt,
  formatReviewStatus,
  generateReviewPrompt,
  getReviewStatus,
} from './decision-review.ts'
import {
  approve,
  compareOptions,
  createDecision,
  decide,
  getDecision,
  listDecisions,
  reject,
  renderDecisionMarkdown,
  updateAnalysis,
} from './decision.ts'
import { fmt } from './fmt.ts'
import { runGate } from './gate.ts'
import { gc } from './gc.ts'
import {
  checkGoalInvariants,
  formatGoalAdrAlignment,
  getGoalAdrMappings,
  suggestAlignmentScore,
} from './goals-align.ts'
import { generateProgressSummary, recalculateAllProgress } from './goals-progress.ts'
import { createGoal, getGoal, listGoals, renderGoalsMarkdown, updateGoal } from './goals.ts'
import { readGoalsFile } from './goals.ts'
import { checkInvariants, generateInvariantReport } from './invariants.ts'
import { runLoop } from './loop.ts'
import { markUnit } from './mark.ts'
import { report } from './report.ts'
import { runResearchCommand } from './roadmap.ts'
import {
  assessGoal,
  captureDebug,
  discoverAll,
  discoverBackend,
  discoverCdpProtocol,
  discoverFrontend,
  ensureBrowser,
  engageBrowser,
  generateCatalog,
  installProcessGuard,
  preflight,
  readLoopReport,
  resetIteration,
  runGuard,
  runIterativeLoop,
  runLiveTest,
  runMigrate,
  runOrchestrationCycle,
  scaffoldBackend,
  scaffoldFrontend,
  serverStatus,
  startWatchdog,
  stopServices,
  supervisor,
  testCapability,
  verifyFrontend,
} from './runtime-test/index.ts'
import { selectNext } from './select.ts'
import { runStressTests } from './runtime-test/stress/runner.js'
import { runTruthCommand } from './truth/cli.ts'
import { productionBuildCli } from './production-build.ts'
import {
  startLoop,
  resumeLoop,
  markTaskDone,
  type StartResult,
  type ResumeResult,
} from './agentic/engine.ts'
import { generatePreflightContext } from './agentic/context-probe.ts'
import {
  listFeatures,
  getFeature,
  createFeature,
  updateFeature,
  analyzeFeatureGaps,
  getFeatureStatusSummary,
} from './features.ts'

const [cmd, ...args] = process.argv.slice(2)

// Allow a satellite tracker to be selected via `--tracker <path>` (and an
// optional `--atomic-dir <path>`). This makes docs/atomic-runtime (and future
// trackers) driveable through `devops select|mark|report` without forking the
// CLI. select.ts/mark.ts/report.ts read these env vars.
const tkIdx = process.argv.indexOf('--tracker')
if (tkIdx >= 0 && tkIdx + 1 < process.argv.length) {
  process.env.DEVOPS_TRACKER = process.argv[tkIdx + 1]!
  const adIdx = process.argv.indexOf('--atomic-dir')
  process.env.DEVOPS_ATOMIC_DIR =
    adIdx >= 0 && adIdx + 1 < process.argv.length
      ? process.argv[adIdx + 1]!
      : join(process.env.DEVOPS_TRACKER, '..')
}

async function main() {
  let gateResult: Awaited<ReturnType<typeof runGate>> | undefined

  switch (cmd) {
    case 'select': {
      const sel = await selectNext()
      console.log(sel ? JSON.stringify(sel, null, 2) : 'null')
      break
    }
    case 'mark': {
      const [id, state] = args
      if (!id || !state) {
        console.error('usage: devops mark <id> <pending|in_progress|done|blocked>')
        process.exit(1)
      }
      await markUnit(id, state as 'pending' | 'in_progress' | 'done' | 'blocked')
      console.log(`marked ${id} -> ${state}`)
      break
    }
    case 'gate': {
      const strict = args.includes('--strict')
      const full = args.includes('--full')
      const includeIntegration = args.includes('--include-integration') || full
      if (args.includes('--capture-baseline')) {
        const baseline = await captureBaseline()
        console.log(JSON.stringify(baseline, null, 2))
        process.exit(0)
      }
      gateResult = await runGate(strict, includeIntegration, full ? 'full' : 'regression')
      console.log(JSON.stringify(gateResult, null, 2))
      break
    }
    case 'toolkit': {
      const { runToolkit } = await import('./toolkit/index.js')
      const code = await runToolkit(args)
      process.exit(code)
      break
    }
    case 'fmt': {
      const { fmt } = await import('./fmt.ts')
      await fmt()
      break
    }
    case 'run': {
      // Autonomous closure loop: gate + mark + (optional) commit every
      // selectable unit against the captured baseline, no human in the loop.
      const maxUnits = args.find((a) => a.startsWith('--max-units='))
        ? Number(args.find((a) => a.startsWith('--max-units='))!.split('=')[1])
        : undefined
      const result = await runLoop({
        maxUnits,
        commit: args.includes('--commit'),
        strict: args.includes('--strict'),
      })
      console.log(
        JSON.stringify(
          {
            processed: result.processed,
            done: result.done,
            blocked: result.blocked,
            allComplete: result.allComplete,
          },
          null,
          2,
        ),
      )
      if (!result.allComplete) process.exit(1)
      break
    }
    case 'audit': {
      const [id, ...rest] = args
      if (!id) {
        console.error('usage: devops audit <id> "<gate summary / notes>"')
        process.exit(1)
      }
      await audit(id, rest.join(' '))
      break
    }
    case 'gc': {
      gc(args.includes('--force'))
      break
    }
    case 'profiles': {
      // Profile dedupe / cleanup operator command (specs/033-profile-cleanup).
      // `devops profiles cleanup [--force] [--provider=<slug>] [--account=<email>]
      //   [--reconcile-db] [--json]` — defaults to dry-run (never mutates).
      const { runProfileCleanup } = await import('./profile-cleanup.js')
      const code = await runProfileCleanup(args)
      process.exit(code)
      break
    }
    case 'report': {
      console.log(await report())
      break
    }
    case 'truth': {
      await runTruthCommand(args)
      break
    }
    case 'roadmap':
    case 'research': {
      await runResearchCommand(args)
      break
    }
    case 'invariants': {
      const subcmd = args[0] ?? 'check'
      if (subcmd === 'check') {
        const unitId = args.includes('--unit') ? args[args.indexOf('--unit') + 1] : undefined
      const category = args.includes('--category')
        ? (args[args.indexOf('--category') + 1] as 'A' | 'B' | 'C' | 'D' | 'E')
        : undefined
        const result = await checkInvariants(unitId, category)
        console.log(JSON.stringify(result, null, 2))
        process.exit(result.pass ? 0 : 1)
      } else if (subcmd === 'report') {
        console.log(await generateInvariantReport())
      } else {
        console.error(
          'usage: devops invariants <check|report> [--unit <id>] [--category <A|B|C|D>]',
        )
        process.exit(1)
      }
      break
    }
    case 'decision': {
      const subcmd = args[0] ?? 'list'
      const rest = args.slice(1)

      switch (subcmd) {
        case 'create': {
          const title =
            rest.find((a) => a.startsWith('--title='))?.split('=')[1] ??
            rest[rest.indexOf('--title') + 1]
          const author =
            rest.find((a) => a.startsWith('--author='))?.split('=')[1] ??
            rest[rest.indexOf('--author') + 1]
          if (!title) {
            console.error('usage: devops decision create --title "..." [--author "..."]')
            process.exit(1)
          }
          const record = await createDecision({
            title,
            author: author ?? 'user',
            problemStatement: '[To be filled]',
            context: '[To be filled]',
            options: [],
          })
          console.log(`Created ${record.id}: ${record.title}`)
          console.log(`Status: ${record.status}`)
          console.log(`File: docs/decisions/${record.id}.md`)
          break
        }
        case 'show': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops decision show <id>')
            process.exit(1)
          }
          const record = await getDecision(id)
          if (!record) {
            console.error(`Decision ${id} not found`)
            process.exit(1)
          }
          console.log(renderDecisionMarkdown(record))
          break
        }
        case 'compare': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops decision compare <id>')
            process.exit(1)
          }
          const record = await getDecision(id)
          if (!record) {
            console.error(`Decision ${id} not found`)
            process.exit(1)
          }
          console.log(`Option Comparison for ${record.id}: ${record.title}`)
          console.log('')
          console.log(compareOptions(record))
          break
        }
        case 'list': {
          const decisions = await listDecisions()
          if (decisions.length === 0) {
            console.log('No decisions found.')
            break
          }
          console.log('Architecture Decision Records:')
          console.log('')
          for (const d of decisions) {
            const status = getReviewStatus(d)
            console.log(`${d.id}: ${d.title}`)
            console.log(`  Status: ${d.status}`)
            console.log(
              `  Reviews: ${status.totalRounds} (AI: ${status.hasAiReview ? 'Yes' : 'No'}, Human: ${status.hasHumanReview ? 'Yes' : 'No'})`,
            )
            console.log(`  Can decide: ${status.canDecide ? 'Yes' : 'No'}`)
            console.log('')
          }
          break
        }
        case 'review': {
          const id = rest[0]
          const reviewer =
            rest.find((a) => a.startsWith('--reviewer='))?.split('=')[1] ??
            rest[rest.indexOf('--reviewer') + 1]
          const feedback =
            rest.find((a) => a.startsWith('--feedback='))?.split('=')[1] ??
            rest[rest.indexOf('--feedback') + 1]
          const changes =
            rest.find((a) => a.startsWith('--changes='))?.split('=')[1] ??
            rest[rest.indexOf('--changes') + 1]
          if (!id || !reviewer || !feedback) {
            console.error(
              'usage: devops decision review <id> --reviewer "..." --feedback "..." [--changes "..."]',
            )
            process.exit(1)
          }
          const type = reviewer.toLowerCase().includes('ai') ? 'ai' : 'human'
          const { record, round } = await addReview(id, {
            reviewer,
            type,
            feedback,
            changesMade: changes ?? '',
          })
          console.log(`Added review round ${round} to ${record.id}`)
          console.log(formatReviewStatus(record))
          break
        }
        case 'prompt': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops decision prompt <id>')
            process.exit(1)
          }
          const record = await getDecision(id)
          if (!record) {
            console.error(`Decision ${id} not found`)
            process.exit(1)
          }
          const prompt = generateReviewPrompt(record)
          console.log(formatReviewPrompt(prompt))
          break
        }
        case 'prompt-review': {
          const id = rest[0]
          const reviewer =
            rest.find((a) => a.startsWith('--reviewer='))?.split('=')[1] ??
            rest[rest.indexOf('--reviewer') + 1]
          const pref =
            rest.find((a) => a.startsWith('--preference='))?.split('=')[1] ??
            rest[rest.indexOf('--preference') + 1]
          const feas =
            rest.find((a) => a.startsWith('--feasibility='))?.split('=')[1] ??
            rest[rest.indexOf('--feasibility') + 1]
          const concerns =
            rest.find((a) => a.startsWith('--concerns='))?.split('=')[1] ??
            rest[rest.indexOf('--concerns') + 1]
          const risk =
            rest.find((a) => a.startsWith('--risk='))?.split('=')[1] ??
            rest[rest.indexOf('--risk') + 1]
          if (!id || !reviewer || !pref) {
            console.error(
              'usage: devops decision prompt-review <id> --reviewer "..." --preference "A: Name" --feasibility "..." [--concerns "..."] --risk "low|medium|high"',
            )
            process.exit(1)
          }
          const record = await getDecision(id)
          if (!record) {
            console.error(`Decision ${id} not found`)
            process.exit(1)
          }
          const prompt = generateReviewPrompt(record)
          const answers = [
            { questionId: 'preference', value: pref },
            { questionId: 'feasibility', value: feas ?? '3' },
            { questionId: 'concerns', value: concerns ?? '' },
            { questionId: 'risk', value: risk ?? 'medium' },
          ]
          const type = reviewer.toLowerCase().includes('ai') ? 'ai' : 'human'
          const { record: updated, round } = await addStructuredReview(
            id,
            prompt,
            answers,
            reviewer,
            type,
          )
          console.log(`Added structured review round ${round} to ${updated.id}`)
          console.log(formatReviewStatus(updated))
          break
        }
        case 'decide': {
          const id = rest[0]
          const option =
            rest.find((a) => a.startsWith('--option='))?.split('=')[1] ??
            rest[rest.indexOf('--option') + 1]
          const rationale =
            rest.find((a) => a.startsWith('--rationale='))?.split('=')[1] ??
            rest[rest.indexOf('--rationale') + 1]
          if (!id || !option) {
            console.error('usage: devops decision decide <id> --option "A" --rationale "..."')
            process.exit(1)
          }
          const record = await decide(id, option, rationale ?? '')
          console.log(`Decided ${record.id}: Option ${option}`)
          console.log(`Status: ${record.status}`)
          break
        }
        case 'approve': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops decision approve <id>')
            process.exit(1)
          }
          const record = await approve(id)
          console.log(`Approved ${record.id}`)
          console.log(`Status: ${record.status}`)
          break
        }
        case 'reject': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops decision reject <id>')
            process.exit(1)
          }
          const record = await reject(id)
          console.log(`Rejected ${record.id}`)
          console.log(`Status: ${record.status}`)
          break
        }
        case 'analyze': {
          const id = rest[0]
          const analysis =
            rest.find((a) => a.startsWith('--analysis='))?.split('=')[1] ??
            rest[rest.indexOf('--analysis') + 1]
          const consequences =
            rest.find((a) => a.startsWith('--consequences='))?.split('=')[1] ??
            rest[rest.indexOf('--consequences') + 1]
          if (!id || !analysis) {
            console.error(
              'usage: devops decision analyze <id> --analysis "..." --consequences "..."',
            )
            process.exit(1)
          }
          const record = await updateAnalysis(id, analysis, consequences ?? '')
          console.log(`Updated analysis for ${record.id}`)
          console.log(`Status: ${record.status}`)
          break
        }
        default:
          console.error(
            'usage: devops decision <create|show|compare|list|review|prompt|prompt-review|decide|approve|reject|analyze> [args]',
          )
          process.exit(1)
      }
      break
    }
    case 'goals': {
      const subcmd = args[0] ?? 'list'
      const rest = args.slice(1)

      switch (subcmd) {
        case 'list': {
          const goals = await listGoals()
          if (goals.length === 0) {
            console.log('No goals defined.')
            console.log('')
            console.log('Create your first goal:')
            console.log(
              '  bun run devops goals create --title "Goal Name" --description "What success looks like"',
            )
            break
          }
          const summary = generateProgressSummary(goals)
          console.log('GOALS SUMMARY')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log(`Overall Completion: ${summary.overallCompletion}%`)
          console.log(`Goals: ${summary.achievedGoals}/${summary.totalGoals} achieved`)
          console.log(
            `Objectives: ${summary.achievedObjectives}/${summary.totalObjectives} achieved`,
          )
          console.log(
            `Key Results: ${summary.achievedKeyResults}/${summary.totalKeyResults} achieved`,
          )
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          for (const goal of goals) {
            const statusIcon = goal.completion >= 100 ? '✓' : goal.completion > 0 ? '~' : '·'
            console.log(`${goal.id}: ${goal.title} [${goal.completion}%] ${statusIcon}`)
            console.log(`  Owner: ${goal.owner} | Timeframe: ${goal.timeframe || 'TBD'}`)
          }
          break
        }
        case 'show': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops goals show <id>')
            process.exit(1)
          }
          const goal = await getGoal(id)
          if (!goal) {
            console.error(`Goal ${id} not found`)
            process.exit(1)
          }
          console.log(renderGoalsMarkdown([goal]))
          break
        }
        case 'create': {
          const title =
            rest.find((a) => a.startsWith('--title='))?.split('=')[1] ??
            rest[rest.indexOf('--title') + 1]
          const description =
            rest.find((a) => a.startsWith('--description='))?.split('=')[1] ??
            rest[rest.indexOf('--description') + 1]
          const owner =
            rest.find((a) => a.startsWith('--owner='))?.split('=')[1] ??
            rest[rest.indexOf('--owner') + 1]
          const timeframe =
            rest.find((a) => a.startsWith('--timeframe='))?.split('=')[1] ??
            rest[rest.indexOf('--timeframe') + 1]
          if (!title) {
            console.error(
              'usage: devops goals create --title "..." [--description "..."] [--owner "..."] [--timeframe "..."]',
            )
            process.exit(1)
          }
          const goal = await createGoal({
            title,
            description: description ?? '',
            owner,
            timeframe,
          })
          console.log(`Created ${goal.id}: ${goal.title}`)
          console.log(`Status: ${goal.status}`)
          console.log('File: docs/goals/GOALS.md')
          break
        }
        case 'update': {
          const id = rest[0]
          if (!id) {
            console.error(
              'usage: devops goals update <id> [--status ...] [--title "..."] [--owner "..."]',
            )
            process.exit(1)
          }
          const status =
            rest.find((a) => a.startsWith('--status='))?.split('=')[1] ??
            rest[rest.indexOf('--status') + 1]
          const title =
            rest.find((a) => a.startsWith('--title='))?.split('=')[1] ??
            rest[rest.indexOf('--title') + 1]
          const owner =
            rest.find((a) => a.startsWith('--owner='))?.split('=')[1] ??
            rest[rest.indexOf('--owner') + 1]
          const updates: Record<string, string> = {}
          if (status) updates.status = status
          if (title) updates.title = title
          if (owner) updates.owner = owner
          const goal = await updateGoal(id, updates)
          console.log(`Updated ${goal.id}: ${goal.title}`)
          console.log(`Status: ${goal.status}`)
          break
        }
        case 'progress': {
          const goals = await recalculateAllProgress()
          const summary = generateProgressSummary(goals)
          console.log('Progress recalculated from atomic tracker.')
          console.log('')
          console.log(`Overall Completion: ${summary.overallCompletion}%`)
          console.log(`Goals: ${summary.achievedGoals}/${summary.totalGoals} achieved`)
          console.log(
            `Objectives: ${summary.achievedObjectives}/${summary.totalObjectives} achieved`,
          )
          console.log(
            `Key Results: ${summary.achievedKeyResults}/${summary.totalKeyResults} achieved`,
          )
          break
        }
        case 'align': {
          const goalId = rest[0]
          if (!goalId) {
            console.error('usage: devops goals align <goal-id>')
            process.exit(1)
          }
          const mappings = await getGoalAdrMappings()
          const mapping = mappings.find((m) => m.goalId === goalId)
          if (!mapping) {
            console.error(`Goal ${goalId} not found`)
            process.exit(1)
          }
          console.log(formatGoalAdrAlignment(goalId, mapping))
          break
        }
        case 'score': {
          const adrId = rest[0]
          if (!adrId) {
            console.error('usage: devops goals score <adr-id>')
            process.exit(1)
          }
          const { getDecision } = await import('./decision.ts')
          const decision = await getDecision(adrId)
          if (!decision) {
            console.error(`ADR ${adrId} not found`)
            process.exit(1)
          }
          const goals = await readGoalsFile()
          console.log(`Goal Alignment Scores for ${decision.id}: ${decision.title}`)
          console.log('')
          for (const option of decision.options) {
            const scores = suggestAlignmentScore(option, goals)
            console.log(`Option ${option.id}: ${option.name}`)
            for (const score of scores) {
              console.log(
                `  ${score.goalId} (${score.goalTitle}): ${score.score}/5 — ${score.reason}`,
              )
            }
            console.log('')
          }
          break
        }
        case 'report': {
          const goals = await listGoals()
          if (goals.length === 0) {
            console.log('No goals defined.')
            break
          }
          console.log(renderGoalsMarkdown(goals))
          break
        }
        case 'dashboard': {
          const goals = await listGoals()
          const _summary = generateProgressSummary(goals)
          const invariantResult = await checkGoalInvariants()

          console.log('═══════════════════════════════════════════════════════════════')
          console.log('                    GOAL HEALTH DASHBOARD')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')

          for (const goal of goals) {
            const _statusIcon = goal.completion >= 100 ? '✓' : goal.completion > 0 ? '~' : '·'
            console.log(`Goal ${goal.id}: ${goal.title}`)
            console.log(
              `  Status: ${goal.status.replace('_', ' ').toUpperCase()} | Completion: ${goal.completion}% | Owner: ${goal.owner}`,
            )
            for (const obj of goal.objectives) {
              console.log(`  ├── ${obj.id}: ${obj.title} (${obj.completion}%)`)
              for (const kr of obj.keyResults) {
                const krProgress = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0
                const krIcon =
                  kr.status === 'achieved' ? '✓' : kr.status === 'in_progress' ? '~' : '·'
                console.log(`  │   ├── ${kr.id}: ${kr.title} (${krProgress}%) ${krIcon}`)
              }
            }
            console.log('')
          }

          console.log('═══════════════════════════════════════════════════════════════')
          console.log('                    INVARIANT COMPLIANCE')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log(`Category E (Goals): ${invariantResult.pass ? '✓ PASS' : '⚠ VIOLATIONS'}`)
          for (const v of invariantResult.violations) {
            console.log(`  ✗ ${v}`)
          }
          for (const w of invariantResult.warnings) {
            console.log(`  ⚠ ${w}`)
          }
          console.log('═══════════════════════════════════════════════════════════════')
          break
        }
        default:
          console.error(
            'usage: devops goals <list|show|create|update|progress|align|score|report|dashboard> [args]',
          )
          process.exit(1)
      }
      break
    }
    case 'runtime-test': {
      const subcmd = args[0] ?? 'loop'
      const rest = args.slice(1)

      // Context-interception safety: always reap servers on interrupt/exit so the
      // loop can never leave an orphan backend/Chrome behind.
      installProcessGuard()

      switch (subcmd) {
        case 'bootstrap': {
          const backendOnly = rest.includes('--backend-only')
          await supervisor.start({ backendOnly })
          console.log(JSON.stringify({ ok: true, step: 'bootstrap' }))
          break
        }
        case 'preflight': {
          const result = await preflight()
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'engage': {
          const providerId =
            args.find((a) => a.startsWith('--provider='))?.split('=')[1] ??
            rest[rest.indexOf('--provider') + 1] ??
            'claude'
          const accountId =
            args.find((a) => a.startsWith('--account='))?.split('=')[1] ??
            rest[rest.indexOf('--account') + 1] ??
            'claude_owservera@gmail.com'
          const url =
            args.find((a) => a.startsWith('--url='))?.split('=')[1] ??
            rest[rest.indexOf('--url') + 1] ??
            'http://127.0.0.1:5173'
          const navigate = !args.includes('--no-navigate')
          const result = await engageBrowser({ providerId, accountId, url, navigate })
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'discover-backend': {
          const result = await discoverBackend()
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'discover-frontend': {
          const result = await discoverFrontend()
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'test-cap':
          // Deterministic capability execution by slug (+ optional --input=JSON).
          {
            const slug = rest.find((a) => !a.startsWith('--')) ?? ''
            const inputArg = rest.find((a) => a.startsWith('--input='))
            const input = inputArg ? inputArg.slice('--input='.length) : '{}'
            if (!slug) {
              console.log(JSON.stringify({ ok: false, error: 'usage: test-cap <slug> [--input=JSON]' }))
              process.exit(1)
            }
            const result = await testCapability(slug, input)
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          }
          break

        case 'discover-cdp':
          {
            const portArg = rest.find((a) => a.startsWith('--port='))
            const port = portArg ? Number.parseInt(portArg.slice('--port='.length), 10) : 9222
            const result = await discoverCdpProtocol(port)
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          }
          break

        case 'stop':
          // Tear down all vivim services (canonical PS1 stopper). Single correct teardown.
          {
            const result = stopServices()
            console.log(JSON.stringify(result, null, 2))
            console.log(result.ok ? 'services stopped' : 'stop reported issues (see detail)')
            process.exit(result.ok ? 0 : 1)
          }
          break

        case 'status':
          {
            // Check if --provider is given → use provider-specific status
            const providerFlag = rest.find((a) => a.startsWith('--provider='))
            const providerSlug = providerFlag ? providerFlag.split('=')[1] : rest[rest.indexOf('--provider') + 1]
            if (providerSlug) {
              const { providerStatus } = await import('./runtime-test/provider-status.js')
              const ps = await providerStatus(providerSlug)
              console.log(JSON.stringify(ps, null, 2))
              process.exit(ps.ok ? 0 : 1)
            } else {
              const status = await serverStatus()
              console.log(JSON.stringify(status, null, 2))
              process.exit(status.ok ? 0 : 1)
            }
          }
          break

        case 'report':
          // Recall the last persisted loop report (survives the child-process loop).
          {
            const r = readLoopReport()
            console.log(JSON.stringify(r, null, 2))
            process.exit(r.found ? 0 : 1)
          }
          break

        case 'catalog-gen':
          // Regenerate the static capability catalog from source (offline planning).
          {
            const result = generateCatalog()
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          }
          break

        case 'migrate':
          // Non-interactive Prisma migration (no stdin prompt; hard timeout).
          {
            const nameArg = rest.find((a) => a.startsWith('--name='))
            const name = nameArg ? nameArg.slice('--name='.length) : ''
            const timeoutArg = rest.find((a) => a.startsWith('--timeout='))
            const timeout = timeoutArg ? Number.parseInt(timeoutArg.slice('--timeout='.length), 10) : 120_000
            if (!name) {
              console.log(JSON.stringify({ ok: false, error: 'usage: migrate --name=<x> [--timeout=ms]' }))
              process.exit(1)
            }
            const result = await runMigrate(name, timeout)
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          }
          break

        case 'ensure-browser':
          // Deterministic browser-availability precheck (adopted / spawned / none).
          {
            const status = await ensureBrowser()
            console.log(JSON.stringify(status, null, 2))
            process.exit(status.ok ? 0 : 1)
          }
          break

        case 'watchdog':
          // Agent-death reaper: poll parent pid, run stop on death (detached bg script).
          {
            const pidArg = rest.find((a) => a.startsWith('--pid='))
            const pid = pidArg ? Number.parseInt(pidArg.slice('--pid='.length), 10) : process.ppid
            if (!pid) {
              console.log(JSON.stringify({ ok: false, error: 'no parent pid to watch' }))
              process.exit(1)
            }
            console.log(JSON.stringify({ ok: true, watching: pid }))
            startWatchdog(pid)
            // Keep the process alive as a monitor; unref'd so it won't block on its own.
            break
          }

        case 'guard':
          // Lefthook guard: fail if servers running or migration pending.
          {
            const result = runGuard()
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          }
          break

        case 'test': {
          const nl =
            rest.find((a) => a.startsWith('--nl='))?.split('=')[1] ?? rest[rest.indexOf('--nl') + 1]
          if (!nl) {
            console.error('usage: devops runtime-test test --nl "user message"')
            process.exit(1)
          }
          const result = await runLiveTest({ description: nl, steps: [{ nl }] })
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'debug': {
          const result = await captureDebug()
          console.log(JSON.stringify({ ok: result.ok, error: result.error }))
          break
        }
        case 'build': {
          const target = rest[0] ?? 'frontend'
          if (target === 'frontend') {
            const result = await scaffoldFrontend()
            console.log(JSON.stringify(result, null, 2))
          } else {
            // backend --cap=<slug> emits a makeCapability skeleton via codegen (Unit 1.3)
            const capArg = rest.find((a) => a.startsWith('--cap='))
            const result = await scaffoldBackend(capArg ? { cap: capArg.slice('--cap='.length) } : undefined)
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          }
          break
        }
        case 'loop': {
          // Iterative improve->test->debug loop (ledger-driven). The LLM implements
          // each proposed step; the loop coordinates + evaluates + keeps it on-task.
          //   --objective="..."  start a fresh ledger and propose step 1
          //   --resume            evaluate the last step, record it, propose the next
          //   --reset             clear the ledger
          if (rest.includes('--reset')) {
            resetIteration()
            console.log(JSON.stringify({ ok: true, reset: true }))
            process.exit(0)
          }
          const objFlag = rest.find((a) => a.startsWith('--objective='))
          const objIdx = rest.indexOf('--objective')
          const stripQuotes = (s: string) => s.replace(/^["']|["']$/g, '')
          const objective = objFlag
            ? stripQuotes(objFlag.split('=').slice(1).join('='))
            : objIdx >= 0 && objIdx + 1 < rest.length
              ? stripQuotes(rest[objIdx + 1])
              : undefined
          if (objective || rest.includes('--resume')) {
            try {
              const result = await runIterativeLoop({
                objective,
                resume: rest.includes('--resume'),
                force: rest.includes('--force'),
              })
              console.log(JSON.stringify(result, null, 2))
              process.exit(result.ok ? 0 : 1)
            } finally {
              await stopServices()
            }
          }

          // Original single-pass orchestration cycle (back-compat).
          let maxCycles = 5
          const mcFlag = rest.find((a) => a.startsWith('--max-cycles='))
          if (mcFlag) {
            maxCycles = Number(mcFlag.split('=').slice(1).join('='))
          } else {
            const mcIdx = rest.indexOf('--max-cycles')
            if (mcIdx >= 0 && mcIdx + 1 < rest.length) {
              maxCycles = Number(rest[mcIdx + 1])
            }
          }
          if (!Number.isFinite(maxCycles) || maxCycles < 1) maxCycles = 5
          const mode = rest.includes('--mitm') ? 'mitm' : 'autonomous'
          const goalFlag = rest.find((a) => a.startsWith('--goal='))
          const goalIdx = rest.indexOf('--goal')
          const goal = goalFlag
            ? stripQuotes(goalFlag.split('=').slice(1).join('='))
            : goalIdx >= 0 && goalIdx + 1 < rest.length
              ? stripQuotes(rest[goalIdx + 1])
              : undefined
          // Goal-resolution gate (Unit 1.5): a vague goal that maps to no capability
          // must HALT and ask — never build the wrong thing. The agent remains the runtime.
          if (goal && !rest.includes('--force')) {
            const assessment = await assessGoal(goal, { probe: true })
            if (assessment.needsClarification) {
              console.log(
                JSON.stringify(
                  {
                    ok: false,
                    needsClarification: true,
                    reason: assessment.reason,
                    hint: 'narrow the goal to a capability, or pass --force to build unconditionally',
                  },
                  null,
                  2,
                ),
              )
              process.exit(1)
            }
          }
          try {
            const result = await runOrchestrationCycle({ maxCycles, mode, goal })
            console.log(JSON.stringify(result, null, 2))
            process.exit(result.ok ? 0 : 1)
          } finally {
            // Always tear down servers spawned by the loop (anti-orphan).
            await stopServices()
          }
          break
        }
        case 'setup': {
          // Explicit provider setup: launches Chrome for user login
          // Usage: bun run devops runtime-test setup --provider=claude --account=user@gmail.com
          const providerFlag = rest.find((a) => a.startsWith('--provider='))
          const provider = providerFlag
            ? providerFlag.split('=')[1]
            : rest[rest.indexOf('--provider') + 1]
          const accountFlag = rest.find((a) => a.startsWith('--account='))
          const account = accountFlag
            ? accountFlag.split('=')[1]
            : rest[rest.indexOf('--account') + 1]
          if (!provider || !account) {
            console.error(
              'usage: bun run devops runtime-test setup --provider=<slug> --account=<email>',
            )
            process.exit(1)
          }
          // Dynamic import to avoid loading DB modules for other subcommands
          const { ChromeSetupWizard } = await import('../src/engines/chrome-setup-wizard.js')
          const { ProfileAllocator } = await import('../src/executor/profile-allocator.js')
          const { CapStoreDb } = await import('../src/storage/db.js')
          const db = new CapStoreDb()
          const allocator = new ProfileAllocator()
          const wizard = new ChromeSetupWizard(db, allocator)
          // Look up provider by slug
          const prov = await db.prisma.providerDefinition.findFirst({
            where: { slug: provider },
          })
          if (!prov) {
            console.error(
              `Provider not found: ${provider}. Seed first: bun run devops seeds providers`,
            )
            process.exit(1)
          }
          console.log(`[setup] Starting wizard for ${provider}/${account}...`)
          const result = await wizard.runSetup(prov.id, provider, account, {
            visible: true,
            onProgress: (msg) => console.log(msg),
          })
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'health': {
          // Quick health check — DB + server reachability (no browser).
          const result = await preflight()
          const parts = result.checks.map((c) => `${c.name}:${c.passed ? 'OK' : 'FAIL'}`)
          console.log(JSON.stringify({ ok: result.ok, checks: parts }, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'discover': {
          // List backend capabilities + frontend + schema table count.
          // --offline reads the static catalog (no server required).
          const offline = rest.includes('--offline')
          const result = await discoverAll(offline ? { offline: true } : undefined)
          console.log(
            JSON.stringify(
              {
                ok: result.ok,
                offline: result.offline ?? false,
                backendCapabilities: result.backendCapabilities,
                frontendUrl: result.frontendUrl,
                schemaTables: result.schemaTables,
                error: result.error,
              },
              null,
              2,
            ),
          )
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'selectors': {
          // Validate provider selectors via the dedicated unit test.
          const sel = Bun.spawn(['bun', 'test', 'tests/unit/engines/chat/selectors.test.ts'], {
            stdout: 'inherit',
            stderr: 'inherit',
          })
          const code = await sel.exitCode
          process.exit(code === 0 ? 0 : 1)
          break
        }
        case 'verify': {
          // Visual verification via the adopted Chrome slave — writes a render
          // proof to .runtime/screenshots/ and reports the path.
          const url =
            rest.find((a) => a.startsWith('--url='))?.split('=')[1] ??
            rest[rest.indexOf('--url') + 1] ??
            'http://localhost:5173'
          const result = await verifyFrontend(url, 0)
          console.log(
            JSON.stringify(
              { ok: result.ok, path: result.path, error: result.error },
              null,
              2,
            ),
          )
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'verify-pipeline': {
          // Full pipeline verification: bootstrap → preflight → discover → verify.
          await supervisor.start({ backendOnly: false })
          const health = await preflight()
          const discover = await discoverAll()
          const verify = await verifyFrontend('http://localhost:5173', 0)
          const report = {
            ok: health.ok && discover.ok,
            preflight: health.checks.map((c) => `${c.name}:${c.passed ? 'OK' : 'FAIL'}`),
            discover: {
              backendCapabilities: discover.backendCapabilities.length,
              schemaTables: discover.schemaTables,
              frontendUrl: discover.frontendUrl,
            },
            verify: { ok: verify.ok, path: verify.path, error: verify.error },
          }
          console.log(JSON.stringify(report, null, 2))
          process.exit(report.ok ? 0 : 1)
          break
        }
        case 'onboard': {
          // Provider onboarding pipeline dispatcher (8-phase).
          //   devops runtime-test onboard <mode> --provider=<slug> [--url=...]
          //     mode ∈ discover|infer|test-selectors|test-parse|test-cap|
          //           test-frontend|verify|converge  (single phase)
          //   devops runtime-test onboard run --provider=<slug> [--goal=...] [--from=<phase>] [--resume]
          //     runs the full phase chain via the ledger.
          const mode = rest[0] ?? 'run'
          const providerFlag = rest.find((a) => a.startsWith('--provider='))
          const provider = providerFlag
            ? providerFlag.split('=')[1]
            : rest[rest.indexOf('--provider') + 1]
          const urlFlag = rest.find((a) => a.startsWith('--url='))
          const url = urlFlag ? urlFlag.split('=')[1] : rest[rest.indexOf('--url') + 1]
          const goalFlag = rest.find((a) => a.startsWith('--goal='))
          const goal = goalFlag ? goalFlag.split('=')[1] : rest[rest.indexOf('--goal') + 1]
          const fromFlag = rest.find((a) => a.startsWith('--from='))
          const from = fromFlag ? (fromFlag.split('=')[1] as never) : undefined
          const resume = rest.includes('--resume')

          const { runOnboard, dispatchMode } = await import('./onboard-controller.ts')

          if (mode === 'run') {
            if (!provider) {
              console.error('usage: devops runtime-test onboard run --provider=<slug> [--goal=...]')
              process.exit(1)
            }
            const report = await runOnboard({ provider, url, goal, from, resume })
            console.log(JSON.stringify(report, null, 2))
            process.exit(report.ok ? 0 : 1)
          }

          // Single-phase dispatch.
          const PHASES = ['discover', 'infer', 'test-selectors', 'test-parse', 'test-cap', 'test-frontend', 'verify', 'converge']
          if (!PHASES.includes(mode)) {
            console.error(
              `unknown onboard mode '${mode}'. Valid: ${PHASES.join(' | ')} | run`,
            )
            process.exit(1)
          }
          if (!provider) {
            console.error(`usage: devops runtime-test onboard ${mode} --provider=<slug> [--url=...]`)
            process.exit(1)
          }
          const result = await dispatchMode(mode as never, { provider, url })
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        default: {
          console.error(
            'usage: bun run devops runtime-test <bootstrap|preflight|engage|discover|discover-backend|discover-frontend|discover-cdp|health|selectors|verify|verify-pipeline|test|test-cap|debug|build|loop|setup|status|stop|report|catalog-gen|migrate|ensure-browser|watchdog|guard|onboard> [--max-cycles=N] [--mitm] [--offline] [--goal="user goal"] [--force] [--provider=<slug> --account=<email>] [--slug=<cap> --input=JSON] [--port=9222] [--cap=<slug>] [--name=<mig> --timeout=ms] [--pid=<n>] [--url=...] [--from=<phase>] [--resume]',
          )
          process.exit(1)
        }
      }
      break
    }
    case 'production-build': {
      // Professional production-build pipeline: precheck -> gate -> cleanup ->
      // converge (SpecKit SDD) -> build -> docs -> verify -> report.
      //   [<phase>] [--target=tauri] [--dry-run] [--out=<path>] [--allow-dirty] [--strict-verify]
      const code = await productionBuildCli(args)
      process.exit(code)
      break
    }
    case 'verify-cross-surface': {
      // Unit 19.4 / cross-surface parity gate + 14.3 in-process verifyCrossSurface.
      // Forwards args: [--live] [--base=<url>]
      const proc = Bun.spawn(['bun', 'run', 'scripts/verify-cross-surface.ts', ...args], {
        stdout: 'inherit',
        stderr: 'inherit',
      })
      await proc.exited
      process.exit(proc.exitCode === 0 ? 0 : 1)
      break
    }
    case 'llm-test': {
      // Phase 14 / Spec 032 — thin devops entry point for the LLM-as-Human
      // production testing system. Delegates to cap:llm_test:* capabilities
      // via the universal execute route so it never drifts from the registry.
      const subcmd = args[0] ?? 'run'
      const rest = args.slice(1)

      const CAP_MAP: Record<string, string> = {
        run: 'cap:llm_test:run',
        report: 'cap:llm_test:report',
        status: 'cap:llm_test:status',
        patterns: 'cap:llm_test:patterns',
        providers: 'cap:llm_test:providers',
        brief: 'cap:llm_test:brief',
        plan: 'cap:llm_test:plan',
        parity: 'cap:llm_test:parity',
      }

      const capId = CAP_MAP[subcmd]
      if (!capId) {
        console.error(
          'usage: devops llm-test <run|report|status|patterns|providers|brief|plan|parity> [--input=JSON]',
        )
        process.exit(1)
      }

      let input: unknown = {}
      const inputArg = rest.find((a) => a.startsWith('--input='))
      if (inputArg) {
        try {
          input = JSON.parse(inputArg.slice('--input='.length))
        } catch {
          input = { raw: inputArg.slice('--input='.length) }
        }
      } else if (subcmd === 'run') {
        const mode = rest.find((a) => a.startsWith('--mode='))?.slice('--mode='.length) ?? 'smoke'
        const surfaces = rest
          .filter((a) => a.startsWith('--surface='))
          .map((a) => a.slice('--surface='.length))
        const providers = rest
          .find((a) => a.startsWith('--providers='))
          ?.slice('--providers='.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        input = { mode, surfaces, providers }
      } else if (subcmd === 'report') {
        const sessionId = rest.find((a) => !a.startsWith('--')) ?? rest[rest.length - 1]
        input = { sessionId: String(sessionId ?? '') }
      } else if (subcmd === 'parity') {
        const category = rest.find((a) => a.startsWith('--category='))?.slice('--category='.length)
        const tag = rest.find((a) => a.startsWith('--tag='))?.slice('--tag='.length)
        input = { ...(category ? { category } : {}), ...(tag ? { tag } : {}) }
      }

      const result = await testCapability(capId, input)
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
      break
    }
    case 'audit-code': {
      await runAuditCode(args)
      break
    }
    case 'audit-arch': {
      await runAuditArch(args)
      break
    }
    case 'context': {
      const ctx = await getContext()
      console.log(await formatContextReport(ctx))
      break
    }
    case 'automate': {
      const automatePath = join(process.cwd(), 'src', 'cli', 'commands', 'automate.ts')
      const proc = spawn('bun', ['run', automatePath, ...args], { stdio: 'inherit' })
      proc.on('close', (code) => process.exit(code ?? 0))
      break
    }
    case 'agentic': {
      const subcmd = args[0] ?? 'preflight'
      const rest = args.slice(1)

      switch (subcmd) {
        case 'preflight': {
          // Full preflight: restore candidates, untested capabilities, gaps,
          // suggested action. Pure read — emits structured JSON.
          const snapshot = await generatePreflightContext()
          console.log(JSON.stringify(snapshot, null, 2))
          process.exit(0)
          break
        }
        case 'adopt': {
          // Restore a cookie-bearing on-disk profile → launch → verify → complete.
          const providerFlag = rest.find((a) => a.startsWith('--provider='))
          const provider = providerFlag ? providerFlag.split('=')[1] : rest[rest.indexOf('--provider') + 1]
          if (!provider) {
            console.error('usage: devops agentic adopt --provider=<slug> [--account=<email>]')
            process.exit(1)
            break
          }
          const accountFlag = rest.find((a) => a.startsWith('--account='))
          const account = accountFlag ? accountFlag.split('=')[1] : rest[rest.indexOf('--account') + 1]
          // Delegate to the runtime-test setup wizard (same code path as
          // `runtime-test setup`), which restores-or-launches + registers.
          const { ChromeSetupWizard } = await import('../src/engines/chrome-setup-wizard.js')
          const { ProfileAllocator } = await import('../src/executor/profile-allocator.js')
          const { CapStoreDb } = await import('../src/storage/db.js')
          const db = new CapStoreDb()
          const allocator = new ProfileAllocator()
          const wizard = new ChromeSetupWizard(db, allocator)
          const prov = await db.prisma.providerDefinition.findFirst({ where: { slug: provider } })
          if (!prov) {
            console.error(`Provider not found: ${provider}. Seed first: bun run devops seeds providers`)
            process.exit(1)
            break
          }
          const result = await wizard.runSetup(prov.id, provider, account ?? `${provider}_owservera@gmail.com`, {
            visible: true,
            onProgress: (msg) => console.log(msg),
          })
          console.log(JSON.stringify(result, null, 2))
          process.exit(result.ok ? 0 : 1)
          break
        }
        case 'start': {
          const objective = rest.find((a) => a.startsWith('--objective='))?.split('=')[1]
            ?? rest[rest.indexOf('--objective') + 1]
            ?? 'Implement the next selectable atomic unit'
          const result: StartResult = await startLoop(objective)
          console.log(JSON.stringify(result, null, 2))
          process.exit(0)
          break
        }
        case 'resume': {
          const result: ResumeResult = await resumeLoop()
          console.log(JSON.stringify(result, null, 2))
          process.exit(0)
          break
        }
        case 'done': {
          const taskId = rest[0]
          const status = (rest.find((a) => a.startsWith('--status='))?.split('=')[1]
            ?? rest[rest.indexOf('--status') + 1]) as 'done' | 'failed' | 'blocked' | undefined
          if (!taskId) {
            console.error('usage: devops agentic done <taskId> [--status=done|failed|blocked]')
            process.exit(1)
            break
          }
          const res = markTaskDone(taskId, status ?? 'done')
          console.log(JSON.stringify(res, null, 2))
          process.exit(0)
          break
        }
        case 'status':
        case 'probe': {
          // status/probe both surface the current agentic loop context snapshot.
          const { generateStateSnapshot } = await import('./agentic/probe.js')
          const snap = await generateStateSnapshot()
          console.log(JSON.stringify(snap, null, 2))
          process.exit(0)
          break
        }
        case 'reset': {
          const { rmSync } = await import('node:fs')
          // A reset clears the active agentic handoff so the next `start`
          // begins fresh. Best-effort — ignore if nothing to remove.
          const dir = join(process.cwd(), '.runtime/agentic')
          try {
            rmSync(dir, { recursive: true, force: true })
          } catch { /* best-effort */ }
          console.log(JSON.stringify({ ok: true, reset: true, clearedDir: dir }))
          process.exit(0)
          break
        }
        default:
          console.error(
            'usage: devops agentic <preflight|adopt|start|resume|done|status|probe|reset> [args]',
          )
          process.exit(1)
      }
      break
    }
    case 'features': {
      const subcmd = args[0] ?? 'list'
      const rest = args.slice(1)

      switch (subcmd) {
        case 'list': {
          const features = await listFeatures()
          if (features.length === 0) {
            console.log('No features registered.')
            console.log('')
            console.log('Create your first feature:')
            console.log('  bun run devops features create --id=<id> --name="..." --phase=<n> --skill=<slug>')
            break
          }
          console.log('FEATURE REGISTRY')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log(`Total: ${features.length} features`)
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          for (const f of features) {
            const statusIcon = f.status === 'done' ? '✓' : f.status === 'in_progress' ? '~' : '·'
            console.log(`${f.id}: ${f.name} [${f.status}] ${statusIcon}`)
            console.log(`  Phase: ${f.phase} | Skill: ${f.owningSkill} | Coverage: ${f.coverage}% | Verified: ${f.lastVerified}`)
          }
          break
        }
        case 'show': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops features show <id>')
            process.exit(1)
          }
          const feature = await getFeature(id)
          if (!feature) {
            console.error(`Feature ${id} not found`)
            process.exit(1)
          }
          console.log(`Feature: ${feature.id}`)
          console.log(`  Name: ${feature.name}`)
          console.log(`  Phase: ${feature.phase}`)
          console.log(`  Status: ${feature.status}`)
          console.log(`  Owning Skill: ${feature.owningSkill}`)
          console.log(`  Engines: ${feature.engines.join(', ') || 'none'}`)
          console.log(`  Spec Ref: ${feature.specRef || 'none'}`)
          console.log(`  Coverage: ${feature.coverage}%`)
          console.log(`  Invariants: ${feature.invariants.join(', ') || 'none'}`)
          console.log(`  Last Verified: ${feature.lastVerified}`)
          if (feature.notes) console.log(`  Notes: ${feature.notes}`)
          break
        }
        case 'create': {
          const id = rest.find(a => a.startsWith('--id='))?.split('=')[1]
            ?? rest[rest.indexOf('--id') + 1]
          const name = rest.find(a => a.startsWith('--name='))?.split('=')[1]
            ?? rest[rest.indexOf('--name') + 1]
          const phase = rest.find(a => a.startsWith('--phase='))?.split('=')[1]
            ?? rest[rest.indexOf('--phase') + 1]
          const skill = rest.find(a => a.startsWith('--skill='))?.split('=')[1]
            ?? rest[rest.indexOf('--skill') + 1]
          if (!id || !name || !phase || !skill) {
            console.error('usage: devops features create --id=<id> --name="..." --phase=<n> --skill=<slug> [--engines=a.ts,b.ts] [--spec=<path>] [--coverage=<n>] [--notes="..."]')
            process.exit(1)
          }
          const enginesArg = rest.find(a => a.startsWith('--engines='))?.split('=')[1]
          const specArg = rest.find(a => a.startsWith('--spec='))?.split('=')[1]
          const coverageArg = rest.find(a => a.startsWith('--coverage='))?.split('=')[1]
          const notesArg = rest.find(a => a.startsWith('--notes='))?.split('=')[1]
          const record = await createFeature({
            id,
            name,
            phase: Number(phase),
            owningSkill: skill,
            engines: enginesArg ? enginesArg.split(',') : [],
            specRef: specArg ?? '',
            coverage: coverageArg ? Number(coverageArg) : 0,
            notes: notesArg ?? '',
          })
          console.log(`Created feature ${record.id}: ${record.name}`)
          console.log(`  Phase: ${record.phase} | Status: ${record.status} | Skill: ${record.owningSkill}`)
          break
        }
        case 'update': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops features update <id> [--status=X] [--name="..."] [--phase=N] [--skill=X] [--coverage=N] [--verified=YYYY-MM-DD]')
            process.exit(1)
          }
          const status = rest.find(a => a.startsWith('--status='))?.split('=')[1]
          const name = rest.find(a => a.startsWith('--name='))?.split('=')[1]
          const phase = rest.find(a => a.startsWith('--phase='))?.split('=')[1]
          const skill = rest.find(a => a.startsWith('--skill='))?.split('=')[1]
          const coverage = rest.find(a => a.startsWith('--coverage='))?.split('=')[1]
          const verified = rest.find(a => a.startsWith('--verified='))?.split('=')[1]
          const updates: Record<string, unknown> = {}
          if (status) updates.status = status
          if (name) updates.name = name
          if (phase) updates.phase = Number(phase)
          if (skill) updates.owningSkill = skill
          if (coverage) updates.coverage = Number(coverage)
          if (verified) updates.lastVerified = verified
          if (Object.keys(updates).length === 0) {
            console.error('No updates specified. Use --status, --name, --phase, --skill, --coverage, --verified')
            process.exit(1)
          }
          const record = await updateFeature(id, updates as any)
          console.log(`Updated ${record.id}: ${record.name}`)
          console.log(`  Status: ${record.status} | Phase: ${record.phase} | Skill: ${record.owningSkill}`)
          break
        }
        case 'status': {
          const summary = await getFeatureStatusSummary()
          console.log('FEATURE STATUS SUMMARY')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log(`Total features: ${summary.total}`)
          console.log('')
          console.log('By Status:')
          for (const [status, count] of Object.entries(summary.byStatus)) {
            if (count > 0) console.log(`  ${status}: ${count}`)
          }
          console.log('')
          console.log('By Phase:')
          for (const [phase, count] of Object.entries(summary.byPhase).sort(([a], [b]) => Number(a) - Number(b))) {
            console.log(`  Phase ${phase}: ${count}`)
          }
          console.log('═══════════════════════════════════════════════════════════════')
          break
        }
        case 'gaps': {
          const idFlag = rest.find(a => a.startsWith('--id='))?.split('=')[1]
          const gaps = await analyzeFeatureGaps(idFlag)
          if (gaps.length === 0) {
            console.log('No gaps found. All features are healthy.')
            break
          }
          console.log('FEATURE GAPS')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log(`Found ${gaps.length} gap(s):`)
          console.log('')
          for (const gap of gaps) {
            const icon = gap.severity === 'block' ? '✗' : '⚠'
            console.log(`${icon} [${gap.type}] ${gap.featureId}: ${gap.message}`)
          }
          console.log('═══════════════════════════════════════════════════════════════')
          break
        }
        default: {
          console.error(
            'usage: devops features <list|show|create|update|status|gaps> [args]',
          )
          process.exit(1)
        }
      }
      break
    }
    case 'stress-test': {
      const scenarioIdArg = args.find((a) => a.startsWith('--scenario='))
      const scenarioId = scenarioIdArg ? Number.parseInt(scenarioIdArg.split('=')[1], 10) : undefined
      const result = await runStressTests(scenarioId)
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
      break
    }
    case 'code-index': {
      // Local-first, offline source-code indexer for LLM / vibe coding.
      //   bun run devops code-index <index|search|stats|watch|mcp|clear> [path] [--db=...] [--k=N] [--token-budget=N] [--json]
      const { mainCli } = await import('./code-index.ts')
      await mainCli(args)
      break
    }
    default: {
      console.error(
        'usage: bun run devops <select|mark|gate|run|fmt|audit|gc|report|truth|roadmap|invariants|audit-code|audit-arch|decision|goals|context|automate|runtime-test|production-build|verify-cross-surface|llm-test|stress-test|features|code-index> [--tracker <path>]',
      )
      process.exit(1)
    }
  }

  if (gateResult) {
    process.exit(gateResult.pass ? 0 : 1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
