// devops/index.ts
// CLI entry: `bun run devops <cmd> [args]`
//
//   select            -> print next implementable unit as JSON (or "null")
//   mark <id> <s>    -> transition state: pending|in_progress|done|blocked
//   gate             -> run quality gate, print JSON, exit non-zero on fail
//   report           -> print progress summary
//   truth <sub>      -> truth grounding system (scan|compare|interfaces|full|report)
//   invariants       -> check architectural invariants (check|report)

import { audit } from './audit.ts'
import { fmt } from './fmt.ts'
import { runGate } from './gate.ts'
import { gc } from './gc.ts'
import { markUnit } from './mark.ts'
import { report } from './report.ts'
import { selectNext } from './select.ts'
import { runTruthCommand } from './truth/cli.ts'
import { runResearchCommand } from './roadmap.ts'
import { checkInvariants, generateInvariantReport } from './invariants.ts'
import {
  createDecision,
  getDecision,
  listDecisions,
  decide,
  approve,
  reject,
  renderDecisionMarkdown,
  updateAnalysis,
  compareOptions,
} from './decision.ts'
import { addReview, getReviewStatus, formatReviewStatus, generateReviewPrompt, formatReviewPrompt, addStructuredReview } from './decision-review.ts'
import { getContext, formatContextReport } from './context.ts'
import {
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
  createObjective,
  createKeyResult,
  updateKeyResult,
  renderGoalsMarkdown,
} from './goals.ts'
import { recalculateAllProgress, generateProgressSummary } from './goals-progress.ts'
import { suggestAlignmentScore, getGoalAdrMappings, getAdrGoalMappings, formatGoalAdrAlignment, formatAdrGoalAlignment, checkGoalInvariants } from './goals-align.ts'
import { readGoalsFile } from './goals.ts'

const [cmd, ...args] = process.argv.slice(2)

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
      const includeIntegration = args.includes('--include-integration') || args.includes('--full')
      gateResult = await runGate(strict, includeIntegration)
      console.log(JSON.stringify(gateResult, null, 2))
      break
    }
    case 'fmt': {
      fmt()
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
    case 'report': {
      console.log(await report())
      break
    }
    case 'truth': {
      await runTruthCommand(args)
      break
    }
    case 'roadmap': {
      await runResearchCommand(args)
      break
    }
    case 'invariants': {
      const subcmd = args[0] ?? 'check'
      if (subcmd === 'check') {
        const unitId = args.includes('--unit') ? args[args.indexOf('--unit') + 1] : undefined
        const category = args.includes('--category') ? args[args.indexOf('--category') + 1] as 'A' | 'B' | 'C' | 'D' : undefined
        const result = await checkInvariants(unitId, category)
        console.log(JSON.stringify(result, null, 2))
        process.exit(result.pass ? 0 : 1)
      } else if (subcmd === 'report') {
        console.log(await generateInvariantReport())
      } else {
        console.error('usage: devops invariants <check|report> [--unit <id>] [--category <A|B|C|D>]')
        process.exit(1)
      }
      break
    }
    case 'decision': {
      const subcmd = args[0] ?? 'list'
      const rest = args.slice(1)

      switch (subcmd) {
        case 'create': {
          const title = rest.find(a => a.startsWith('--title='))?.split('=')[1]
            ?? rest[rest.indexOf('--title') + 1]
          const author = rest.find(a => a.startsWith('--author='))?.split('=')[1]
            ?? rest[rest.indexOf('--author') + 1]
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
            console.log(`  Reviews: ${status.totalRounds} (AI: ${status.hasAiReview ? 'Yes' : 'No'}, Human: ${status.hasHumanReview ? 'Yes' : 'No'})`)
            console.log(`  Can decide: ${status.canDecide ? 'Yes' : 'No'}`)
            console.log('')
          }
          break
        }
        case 'review': {
          const id = rest[0]
          const reviewer = rest.find(a => a.startsWith('--reviewer='))?.split('=')[1]
            ?? rest[rest.indexOf('--reviewer') + 1]
          const feedback = rest.find(a => a.startsWith('--feedback='))?.split('=')[1]
            ?? rest[rest.indexOf('--feedback') + 1]
          const changes = rest.find(a => a.startsWith('--changes='))?.split('=')[1]
            ?? rest[rest.indexOf('--changes') + 1]
          if (!id || !reviewer || !feedback) {
            console.error('usage: devops decision review <id> --reviewer "..." --feedback "..." [--changes "..."]')
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
          const reviewer = rest.find(a => a.startsWith('--reviewer='))?.split('=')[1]
            ?? rest[rest.indexOf('--reviewer') + 1]
          const pref = rest.find(a => a.startsWith('--preference='))?.split('=')[1]
            ?? rest[rest.indexOf('--preference') + 1]
          const feas = rest.find(a => a.startsWith('--feasibility='))?.split('=')[1]
            ?? rest[rest.indexOf('--feasibility') + 1]
          const concerns = rest.find(a => a.startsWith('--concerns='))?.split('=')[1]
            ?? rest[rest.indexOf('--concerns') + 1]
          const risk = rest.find(a => a.startsWith('--risk='))?.split('=')[1]
            ?? rest[rest.indexOf('--risk') + 1]
          if (!id || !reviewer || !pref) {
            console.error('usage: devops decision prompt-review <id> --reviewer "..." --preference "A: Name" --feasibility "..." [--concerns "..."] --risk "low|medium|high"')
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
          const { record: updated, round } = await addStructuredReview(id, prompt, answers, reviewer, type)
          console.log(`Added structured review round ${round} to ${updated.id}`)
          console.log(formatReviewStatus(updated))
          break
        }
        case 'decide': {
          const id = rest[0]
          const option = rest.find(a => a.startsWith('--option='))?.split('=')[1]
            ?? rest[rest.indexOf('--option') + 1]
          const rationale = rest.find(a => a.startsWith('--rationale='))?.split('=')[1]
            ?? rest[rest.indexOf('--rationale') + 1]
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
          const analysis = rest.find(a => a.startsWith('--analysis='))?.split('=')[1]
            ?? rest[rest.indexOf('--analysis') + 1]
          const consequences = rest.find(a => a.startsWith('--consequences='))?.split('=')[1]
            ?? rest[rest.indexOf('--consequences') + 1]
          if (!id || !analysis) {
            console.error('usage: devops decision analyze <id> --analysis "..." --consequences "..."')
            process.exit(1)
          }
          const record = await updateAnalysis(id, analysis, consequences ?? '')
          console.log(`Updated analysis for ${record.id}`)
          console.log(`Status: ${record.status}`)
          break
        }
        default:
          console.error('usage: devops decision <create|show|compare|list|review|prompt|prompt-review|decide|approve|reject|analyze> [args]')
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
             console.log('  bun run devops goals create --title "Goal Name" --description "What success looks like"')
             break
           }
           const summary = generateProgressSummary(goals)
           console.log('GOALS SUMMARY')
           console.log('═══════════════════════════════════════════════════════════════')
           console.log(`Overall Completion: ${summary.overallCompletion}%`)
           console.log(`Goals: ${summary.achievedGoals}/${summary.totalGoals} achieved`)
           console.log(`Objectives: ${summary.achievedObjectives}/${summary.totalObjectives} achieved`)
           console.log(`Key Results: ${summary.achievedKeyResults}/${summary.totalKeyResults} achieved`)
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
          const title = rest.find(a => a.startsWith('--title='))?.split('=')[1]
            ?? rest[rest.indexOf('--title') + 1]
          const description = rest.find(a => a.startsWith('--description='))?.split('=')[1]
            ?? rest[rest.indexOf('--description') + 1]
          const owner = rest.find(a => a.startsWith('--owner='))?.split('=')[1]
            ?? rest[rest.indexOf('--owner') + 1]
          const timeframe = rest.find(a => a.startsWith('--timeframe='))?.split('=')[1]
            ?? rest[rest.indexOf('--timeframe') + 1]
          if (!title) {
            console.error('usage: devops goals create --title "..." [--description "..."] [--owner "..."] [--timeframe "..."]')
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
          console.log(`File: docs/goals/GOALS.md`)
          break
        }
        case 'update': {
          const id = rest[0]
          if (!id) {
            console.error('usage: devops goals update <id> [--status ...] [--title "..."] [--owner "..."]')
            process.exit(1)
          }
          const status = rest.find(a => a.startsWith('--status='))?.split('=')[1]
            ?? rest[rest.indexOf('--status') + 1]
          const title = rest.find(a => a.startsWith('--title='))?.split('=')[1]
            ?? rest[rest.indexOf('--title') + 1]
          const owner = rest.find(a => a.startsWith('--owner='))?.split('=')[1]
            ?? rest[rest.indexOf('--owner') + 1]
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
          console.log(`Objectives: ${summary.achievedObjectives}/${summary.totalObjectives} achieved`)
          console.log(`Key Results: ${summary.achievedKeyResults}/${summary.totalKeyResults} achieved`)
          break
        }
        case 'align': {
          const goalId = rest[0]
          if (!goalId) {
            console.error('usage: devops goals align <goal-id>')
            process.exit(1)
          }
          const mappings = await getGoalAdrMappings()
          const mapping = mappings.find(m => m.goalId === goalId)
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
              console.log(`  ${score.goalId} (${score.goalTitle}): ${score.score}/5 — ${score.reason}`)
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
          const summary = generateProgressSummary(goals)
          const invariantResult = await checkGoalInvariants()

          console.log('═══════════════════════════════════════════════════════════════')
          console.log('                    GOAL HEALTH DASHBOARD')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')

          for (const goal of goals) {
            const statusIcon = goal.completion >= 100 ? '✓' : goal.completion > 0 ? '~' : '·'
            console.log(`Goal ${goal.id}: ${goal.title}`)
            console.log(`  Status: ${goal.status.replace('_', ' ').toUpperCase()} | Completion: ${goal.completion}% | Owner: ${goal.owner}`)
            for (const obj of goal.objectives) {
              console.log(`  ├── ${obj.id}: ${obj.title} (${obj.completion}%)`)
              for (const kr of obj.keyResults) {
                const krProgress = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0
                const krIcon = kr.status === 'achieved' ? '✓' : kr.status === 'in_progress' ? '~' : '·'
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
         console.error('usage: devops goals <list|show|create|update|progress|align|score|report|dashboard> [args]')
         process.exit(1)
       }
       break
     }
      case 'context': {
        const ctx = await getContext();
        console.log(await formatContextReport(ctx));
        break;
      }
      default: {
       console.error('usage: bun run devops <select|mark|gate|fmt|audit|gc|report|truth|roadmap|invariants|decision|goals|context>')
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
