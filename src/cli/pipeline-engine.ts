// src/cli/pipeline-engine.ts
// CLI pipeline engine — chains commands like Unix pipes

import type { CommandRegistry } from './command-registry.js'
import { OutputFormatter } from './output-formatter.js'

export interface PipelineStep {
  command: string
  args: string[]
}

export class PipelineEngine {
  private registry: CommandRegistry
  private formatter: OutputFormatter

  constructor(registry: CommandRegistry) {
    this.registry = registry
    this.formatter = new OutputFormatter()
  }

  async execute(pipeline: PipelineStep[]): Promise<unknown> {
    let input: unknown = null

    for (const step of pipeline) {
      const cmd = this.registry.find(step.command)
      if (!cmd) throw new Error(`Unknown command: ${step.command}`)
      const result = await cmd.handler({ args: step.args, input })
      input = result.data
    }

    return input
  }

  parsePipeline(commandStr: string): PipelineStep[] {
    return commandStr.split('|').map((part) => {
      const tokens = part.trim().split(/\s+/)
      const command = tokens[0]
      if (!command) throw new Error('Empty pipeline step')
      const args = tokens.slice(1)
      return { command, args }
    })
  }
}
