// src/cli/commands/onboard-provider.ts
// Single-click onboarding CLI surface.
// Usage: `vivim onboard <origin> --slave <id> [--dry-run]`
//
// SOTA-AUDIT-V2 Tier A — wires the ProviderOnboardingOrchestrator (constructed
// at boot in src/server/onboarding-boot.ts) into the CLI command tree.
//
// The command resolves the orchestrator from the module-level ServiceContainer
// (src/server/service-container.ts), populated when the server boots. If the
// command is run without a server (thin-client mode), it falls back to
// constructing a one-shot orchestrator against the running server's REST API
// (TODO — for now thin-client mode is unsupported; the command requires the
// in-process orchestrator).

import { z } from 'zod'
import type { ProviderOnboardingOrchestrator } from '../../engines/onboarding/provider-onboarding-orchestrator.js'
import { serviceContainer } from '../../server/service-container.js'
import type { CliCommand, CommandRegistry } from '../command-registry.js'

const OnboardArgs = z.object({
  args: z.array(z.string()).min(2).max(2),
  'dry-run': z.string().optional(),
})

interface OnboardResult {
  ok: boolean
  sessionId: string
  providerId: string | null
  taxonomyId: string
  taxonomyMethod: 'matched_existing' | 'auto_generated'
  activatedCapabilityCount: number
}

/**
 * Register the `onboard` CLI command. Called from src/cli/commands/builtins.ts
 * registerBuiltinCommands() — same pattern as `automate` and `moments`.
 */
export function registerOnboardCommand(registry: CommandRegistry): void {
  const cmd: CliCommand = {
    name: 'onboard',
    description:
      'Single-click onboarding: attach an authenticated slave and register a new provider.',
    subsystem: 'backend',
    schema: OnboardArgs,
    examples: [
      'vivim onboard https://chat.openai.com --slave slave-1',
      'vivim onboard https://chat.openai.com --slave slave-1 --dry-run',
    ],
    handler: async (rawArgs: unknown): Promise<{ data: unknown }> => {
      const parsed = OnboardArgs.safeParse(rawArgs)
      if (!parsed.success) {
        return {
          data: {
            ok: false,
            error: 'Invalid args',
            details: parsed.error.message,
          },
        }
      }
      const args = parsed.data
      const [origin, slave] = args.args
      if (!origin || !slave) {
        return {
          data: {
            ok: false,
            error: 'Usage: vivim onboard <origin> --slave <id> [--dry-run]',
          },
        }
      }
      const dryRun = args['dry-run'] !== undefined

      // Resolve the orchestrator from the ServiceContainer. The container is
      // populated by src/server/onboarding-boot.ts at server boot.
      if (!serviceContainer.has('onboardingOrchestrator')) {
        return {
          data: {
            ok: false,
            error: 'Onboarding orchestrator not wired. Start the server first: bun run serve',
          },
        }
      }

      const orchestrator =
        serviceContainer.resolve<ProviderOnboardingOrchestrator>('onboardingOrchestrator')

      const result = await orchestrator.onboard({
        slaveId: slave,
        targetOrigin: origin,
        dryRun,
      })

      if (!result.ok) {
        return {
          data: {
            ok: false,
            error: result.error.code,
            message: result.error.message,
            stage: result.error.stage,
            context: result.error.context,
          },
        }
      }

      const r = result.value
      const out: OnboardResult = {
        ok: true,
        sessionId: r.sessionId,
        providerId: r.providerId,
        taxonomyId: r.taxonomyId,
        taxonomyMethod: r.taxonomyMethod,
        activatedCapabilityCount: r.activatedCapabilityCount,
      }
      return { data: out }
    },
  }

  registry.register(cmd)
}
