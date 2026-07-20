// ─── Interpretation Engine ──────────────────────────────────────────
// Progressive disclosure from L0 (none) to L3 (full).

import { getShade } from './colors.js'
import type {
  CommandContext,
  CommandIntent,
  DisclosureLevel,
  InterpretationState,
} from './types.js'

/**
 * Command descriptions for interpretation display.
 */
const COMMAND_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  '/health': { label: 'Health Check', description: 'Checking system health status' },
  '/switch': { label: 'Switch Provider', description: 'Switching to a different AI provider' },
  '/new': { label: 'New Conversation', description: 'Creating a new conversation' },
  '/list': { label: 'List Conversations', description: 'Listing all conversations' },
  '/search': { label: 'Search', description: 'Searching conversations' },
  '/send': { label: 'Send Message', description: 'Sending a message to the active provider' },
  '/draft': { label: 'Draft Message', description: 'Drafting a message without sending' },
  '/save': { label: 'Save Conversation', description: 'Saving the current conversation' },
  '/review': { label: 'Review Response', description: 'Reviewing the last response' },
  '/recall': { label: 'Recall Message', description: 'Recalling a previous message' },
  '/tag': { label: 'Tag Conversation', description: 'Tagging the current conversation' },
  '/export': { label: 'Export Data', description: 'Exporting conversation data' },
  '/open': { label: 'Open File', description: 'Opening a file or URL' },
  '/screenshot': { label: 'Screenshot', description: 'Taking a screenshot' },
  '/providers': { label: 'List Providers', description: 'Listing available providers' },
  '/fleet': { label: 'Fleet Status', description: 'Showing provider fleet status' },
  '/help': { label: 'Help', description: 'Showing available commands' },
  '/clear': { label: 'Clear Conversation', description: 'Clearing the current conversation' },
  '/focus': { label: 'Focus Topic', description: 'Focusing on a specific topic' },
  '/copy': { label: 'Copy Response', description: 'Copying the last response' },
  '/undo': { label: 'Undo', description: 'Undoing the last action' },
  '/automate': { label: 'Automate', description: 'Creating an automation workflow' },
  '/moments': { label: 'Moments', description: 'Viewing saved moments' },
  '/opencode': { label: 'Open Code', description: 'Opening the coding environment' },
  '/session': { label: 'Session', description: 'Managing the current session' },
  '/newsletter': { label: 'Newsletter', description: 'Creating or managing newsletters' },
  '/schedule': { label: 'Schedule', description: 'Scheduling a task' },
  '/background': { label: 'Background Task', description: 'Running a task in the background' },
  '/theme': { label: 'Theme', description: 'Changing the UI theme' },
  '/layout': { label: 'Layout', description: 'Changing the UI layout' },
  '!health': { label: 'System Health', description: 'Checking system health' },
  '!fleet': { label: 'Fleet Status', description: 'Showing provider fleet status' },
  '!providers': { label: 'Provider List', description: 'Listing all providers' },
  '!caps': { label: 'Capabilities', description: 'Listing all capabilities' },
  '!version': { label: 'Version', description: 'Showing system version' },
  '!workspace': { label: 'Workspace', description: 'Showing workspace info' },
  '!deploy': { label: 'Deploy', description: 'Deploying the application' },
  '!audit': { label: 'Audit', description: 'Running code audit' },
  '!gate': { label: 'Quality Gate', description: 'Running quality gate' },
  '!converge': { label: 'Convergence', description: 'Running convergence check' },
  '!invariants': { label: 'Invariants', description: 'Checking system invariants' },
  '@claude': { label: 'Claude', description: 'Sending message to Claude' },
  '@chatgpt': { label: 'ChatGPT', description: 'Sending message to ChatGPT' },
  '@gemini': { label: 'Gemini', description: 'Sending message to Gemini' },
  '@deepseek': { label: 'DeepSeek', description: 'Sending message to DeepSeek' },
  '@qwen': { label: 'Qwen', description: 'Sending message to Qwen' },
  '@grok': { label: 'Grok', description: 'Sending message to Grok' },
  '?help': { label: 'Help', description: 'Showing help and available commands' },
  '?providers': { label: 'Providers', description: 'Listing available providers' },
  '?tags': { label: 'Tags', description: 'Listing available tags' },
  '?recent': { label: 'Recent', description: 'Showing recent commands' },
  '?search': { label: 'Search', description: 'Searching for commands' },
}

/**
 * InterpretationEngine renders progressive disclosure states for commands.
 */
export class InterpretationEngine {
  private dismissed = false

  /**
   * Render an interpretation state for a command intent.
   */
  render(intent: CommandIntent, level: DisclosureLevel, _ctx: CommandContext): InterpretationState {
    if (this.dismissed) {
      return {
        level: 'L0',
        label: '',
        color: undefined,
        dismissed: true,
      }
    }

    const info = COMMAND_DESCRIPTIONS[intent.commandId] ?? {
      label: intent.commandId,
      description: intent.matchedPattern,
    }

    const color = getShade(intent.commandId.startsWith('/') ? 'system' : 'provider', 'light')

    switch (level) {
      case 'L0':
        return {
          level: 'L0',
          label: '',
          color: undefined,
          dismissed: false,
        }

      case 'L1':
        return {
          level: 'L1',
          label: info.label,
          color,
          dismissed: false,
        }

      case 'L2':
        return {
          level: 'L2',
          label: info.label,
          preview: info.description,
          color,
          dismissed: false,
        }

      case 'L3':
        return {
          level: 'L3',
          label: info.label,
          preview: info.description,
          details: `Command: ${intent.commandId} | Confidence: ${Math.round(intent.confidence * 100)}% | Pattern: "${intent.matchedPattern}"`,
          color,
          dismissed: false,
        }
    }
  }

  /**
   * Expand an interpretation state to the next level.
   */
  expand(state: InterpretationState): InterpretationState {
    const nextLevel: Record<DisclosureLevel, DisclosureLevel> = {
      L0: 'L1',
      L1: 'L2',
      L2: 'L3',
      L3: 'L3',
    }
    // We need to reconstruct the intent from the state
    // For simplicity, we'll just return L3
    return {
      ...state,
      level: nextLevel[state.level],
      details: state.level === 'L2' ? 'Full details available' : state.details,
    }
  }

  /**
   * Dismiss the interpretation.
   */
  dismiss(): void {
    this.dismissed = true
  }

  /**
   * Reset dismissal state.
   */
  reset(): void {
    this.dismissed = false
  }
}
