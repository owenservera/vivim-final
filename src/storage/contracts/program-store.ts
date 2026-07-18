// src/storage/contracts/program-store.ts
// Unit 22.2 - Program store contract (Store Contract, not impl).
// Owns the binding<->program link so we never mutate CapabilityBindingRow's
// Prisma-backed shape. Engines depend on this contract only. Types are kept
// self-contained here (no engine imports) to honour the Store Contract layering.

import type { CapabilityProgramRow } from './capability-store.js'

export type ProgramStatus = 'draft' | 'candidate' | 'promoted' | 'failed'

/** Composer element strategy; mirrors engines/composer-typing ComposerType. */
export type ComposerType = 'textarea' | 'contenteditable' | 'quill' | 'codemirror'

export type RecipeStep =
  | {
      kind: 'type_text'
      selector?: string
      text: string
      composerType?: ComposerType
      outputKey?: string
    }
  | { kind: 'submit'; sendSelector?: string; outputKey?: string }
  | { kind: 'click'; selector: string; outputKey?: string }
  | { kind: 'wait'; timeoutMs: number; outputKey?: string }
  | { kind: 'navigate'; url: string; outputKey?: string }
  | { kind: 'capture'; pattern?: string; timeoutMs?: number; outputKey?: string }
  | { kind: 'evaluate'; expression: string; outputKey?: string }
  // ── Extended browser-automation vocabulary (100+ capability backbone) ──
  | { kind: 'scroll'; x?: number; y?: number; selector?: string; outputKey?: string }
  | { kind: 'hover'; selector: string; outputKey?: string }
  | { kind: 'select'; selector: string; value?: string; label?: string; outputKey?: string }
  | { kind: 'press'; key: string; outputKey?: string }
  | { kind: 'tab_open'; url?: string; outputKey?: string }
  | { kind: 'tab_close'; targetId?: string; outputKey?: string }
  | { kind: 'tab_switch'; targetId: string; outputKey?: string }
  | { kind: 'observe'; what: 'dom' | 'a11y' | 'network' | 'console' | 'screenshot'; outputKey?: string }
  | { kind: 'upload'; selector: string; files: string[]; outputKey?: string }
  | { kind: 'extract_markdown'; outputKey?: string }
  | { kind: 'wait_selector'; selector: string; timeoutMs?: number; outputKey?: string }
  | { kind: 'wait_text'; text: string; timeoutMs?: number; outputKey?: string }
  | { kind: 'screenshot'; region?: { x: number; y: number; w: number; h: number }; outputKey?: string }
  | { kind: 'assert'; condition: string; outputKey?: string }
  | { kind: 'branch_if'; condition: string; then: RecipeStep[]; outputKey?: string }
  | { kind: 'loop_while'; condition: string; body: RecipeStep[]; max?: number; outputKey?: string }
  | { kind: 'parallel'; branches: RecipeStep[][]; outputKey?: string }
  | { kind: 'human_gate'; prompt?: string; outputKey?: string }
  | { kind: 'mock_request'; urlPattern: string; body: string; status?: number; outputKey?: string }
  | { kind: 'cookie_set'; name: string; value: string; path?: string; outputKey?: string }

export interface RecipeBranch {
  when: { outputKey: string; equals?: string; truthy?: boolean }
  steps: RecipeStep[]
}

export interface Recipe {
  id: string
  providerId: string
  capabilitySlug: string
  version: number
  description?: string
  steps: RecipeStep[]
  branches?: RecipeBranch[]
  timeoutMs?: number
  tags?: string[]
}

export interface ProgramUpsert {
  bindingId: string
  version: number
  status: ProgramStatus
  recipe: Recipe
}

export interface ProgramStore {
  upsertProgram(input: ProgramUpsert): Promise<CapabilityProgramRow>
  getProgramById(programId: string): Promise<CapabilityProgramRow | null>
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>
  getBestProgram(bindingId: string): Promise<CapabilityProgramRow | null>
  setBestProgram(bindingId: string, programId: string): Promise<void>
  getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null>
}
