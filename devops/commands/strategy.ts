// devops/commands/strategy.ts
// Command handler for strategy, ADR decisions, feature gaps, and roadmap commands.

import { runResearchCommand } from '../roadmap.ts'
import {
  addReview,
  formatReviewPrompt,
  formatReviewStatus,
  generateReviewPrompt,
  getReviewStatus,
} from '../decision-review.ts'
import {
  compareOptions,
  createDecision,
  getDecision,
  listDecisions,
  renderDecisionMarkdown,
} from '../decision.ts'
import {
  analyzeFeatureGaps,
  createFeature,
  getFeature,
  getFeatureStatusSummary,
  listFeatures,
  updateFeature,
} from '../features.ts'
import {
  checkGoalInvariants,
  formatGoalAdrAlignment,
  getGoalAdrMappings,
} from '../goals-align.ts'
import { createGoal, getGoal, listGoals, renderGoalsMarkdown, updateGoal } from '../goals.ts'
import { generateProgressSummary, recalculateAllProgress } from '../goals-progress.ts'

export async function handle(args: string[]): Promise<void> {
  const [cmd, ...rest] = args

  if (cmd === 'roadmap' || cmd === 'research') {
    await runResearchCommand(rest)
    return
  }

  if (cmd === 'goals') {
    const subcmd = rest[0] ?? 'list'
    if (subcmd === 'list') {
      const goals = await listGoals()
      // [audit] removed: console.log(renderGoalsMarkdown(goals))
    } else if (subcmd === 'align') {
      const mappings = await getGoalAdrMappings()
      // [audit] removed: console.log(formatGoalAdrAlignment(mappings))
    } else if (subcmd === 'progress') {
      const summary = await generateProgressSummary()
      // [audit] removed: console.log(JSON.stringify(summary, null, 2))
    } else {
      // [audit] removed: console.error('usage: devops goals <list|align|progress>')
      process.exit(1)
    }
    return
  }

  if (cmd === 'features') {
    const subcmd = rest[0] ?? 'list'
    if (subcmd === 'list') {
      const feats = await listFeatures()
      // [audit] removed: console.log(JSON.stringify(feats, null, 2))
    } else if (subcmd === 'gaps') {
      const gaps = await analyzeFeatureGaps()
      // [audit] removed: console.log(JSON.stringify(gaps, null, 2))
    } else {
      // [audit] removed: console.error('usage: devops features <list|gaps>')
      process.exit(1)
    }
    return
  }

  if (cmd === 'decision') {
    const subcmd = rest[0] ?? 'list'
    const subArgs = rest.slice(1)

    switch (subcmd) {
      case 'create': {
        const title =
          subArgs.find((a) => a.startsWith('--title='))?.split('=')[1] ??
          subArgs[subArgs.indexOf('--title') + 1]
        const author =
          subArgs.find((a) => a.startsWith('--author='))?.split('=')[1] ??
          subArgs[subArgs.indexOf('--author') + 1]
        if (!title) {
          // [audit] removed: console.error('usage: devops decision create --title "..." [--author "..."]')
          process.exit(1)
        }
        const record = await createDecision({
          title,
          author: author ?? 'user',
          problemStatement: '[To be filled]',
          context: '[To be filled]',
          options: [],
        })
        // [audit] removed: console.log(`Created ${record.id}: ${record.title}`)
        // [audit] removed: console.log(`File: docs/decisions/${record.id}.md`)
        break
      }
      case 'show': {
        const id = subArgs[0]
        if (!id) {
          // [audit] removed: console.error('usage: devops decision show <id>')
          process.exit(1)
        }
        const record = await getDecision(id)
        if (!record) {
          // [audit] removed: console.error(`Decision ${id} not found`)
          process.exit(1)
        }
        // [audit] removed: console.log(renderDecisionMarkdown(record))
        break
      }
      case 'compare': {
        const id = subArgs[0]
        if (!id) {
          // [audit] removed: console.error('usage: devops decision compare <id>')
          process.exit(1)
        }
        const record = await getDecision(id)
        if (!record) {
          // [audit] removed: console.error(`Decision ${id} not found`)
          process.exit(1)
        }
        // [audit] removed: console.log(`Option Comparison for ${record.id}: ${record.title}\n`)
        // [audit] removed: console.log(compareOptions(record))
        break
      }
      case 'list': {
        const decisions = await listDecisions()
        if (decisions.length === 0) {
          // [audit] removed: console.log('No decisions found.')
          break
        }
        // [audit] removed: console.log('Architecture Decision Records:\n')
        for (const d of decisions) {
          const status = getReviewStatus(d)
          // [audit] removed: console.log(`${d.id}: ${d.title}`)
          // [audit] removed: console.log(`  Status: ${d.status}`)
          // [audit] removed: console.log(
            `  Reviews: ${status.totalRounds} (AI: ${status.hasAiReview ? 'Yes' : 'No'}, Human: ${status.hasHumanReview ? 'Yes' : 'No'})`,
          )
          // [audit] removed: console.log(`  Can decide: ${status.canDecide ? 'Yes' : 'No'}\n`)
        }
        break
      }
      default: {
        // [audit] removed: console.error('usage: devops decision <create|show|compare|list|review|prompt>')
        process.exit(1)
      }
    }
  }
}
