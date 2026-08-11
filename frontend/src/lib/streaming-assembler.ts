/**
 * Streaming Semantic Assembler
 *
 * Real-time syntactic self-healing and AST reconciliation for live streams.
 * Harvested from edge-pwa. Provider-agnostic.
 *
 * Ingests streaming chunks and produces self-healed ASTs
 * by detecting and closing unclosed markdown structures.
 */
import { compileMessageToAST, type ASTNode } from './ast-compiler.js'

/**
 * Streaming assembler that ingests partial chunks and produces
 * self-healed ASTs on each chunk.
 */
export class StreamingSemanticAssembler {
  private buffer = ''
  private lastAssembledAST: ASTNode[] = []

  /**
	 * Append an incoming chunk and return the self-healed AST.
	 */
  public ingestChunk(chunk: string): ASTNode[] {
    this.buffer += chunk
    const healedContent = this.repairSyntax(this.buffer)
    this.lastAssembledAST = compileMessageToAST(healedContent)
    return this.lastAssembledAST
  }

  /** Reset the buffer. */
  public reset(): void {
    this.buffer = ''
    this.lastAssembledAST = []
  }

  /** Get the raw buffer. */
  public getRawBuffer(): string {
    return this.buffer
  }

  /**
	 * Detects unclosed structures and injects closing tokens.
	 * Handles: thinking tags, code blocks, bold, italic, backticks.
	 */
  private repairSyntax(text: string): string {
    let repaired = text

    // 1. Repair unclosed thinking tags
    const thinkOpen = /<(think|thinking)[^>]*>/i
    const thinkClose = /<\/?(think|thinking)>/i
    const hasOpenThink = thinkOpen.test(text)
    const hasCloseThink = thinkClose.test(text)

    if (hasOpenThink && !hasCloseThink) {
      const match = text.match(thinkOpen)
      if (match) {
        const tag = match[1].toLowerCase()
        repaired += `</${tag}>`
      }
    }

    // 2. Repair unclosed code blocks (odd count of ```)
    const codeBlockCount = (text.match(/```/g) || []).length
    if (codeBlockCount % 2 !== 0) {
      repaired += '\n```'
    }

    // 3. Repair unclosed bold (**)
    const boldCount = (text.match(/\*\*/g) || []).length
    if (boldCount % 2 !== 0) {
      repaired += '**'
    }

    // 4. Repair unclosed italic (*), ignoring bullet markers
    const cleanItalicText = text.replace(/^\s*\*\s+/gm, '')
    const italicCount = (cleanItalicText.match(/\*/g) || []).length
    if (italicCount % 2 !== 0) {
      repaired += '*'
    }

    // 5. Repair unclosed backticks
    const tickCount = (text.match(/`/g) || []).length
    const cleanTickCount = tickCount - codeBlockCount * 3
    if (cleanTickCount % 2 !== 0) {
      repaired += '`'
    }

    return repaired
  }
}
