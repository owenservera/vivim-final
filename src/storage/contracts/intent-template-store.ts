// src/storage/contracts/intent-template-store.ts
// Unit 3.1 — IntentTemplateStore contract (Store Contract, not impl).
//
// Owns the intent_template catalog so the IntentDecomposer engine never depends on a
// concrete storage impl. Types are self-contained (no engine imports) to honour the
// Store Contract layering.

import type { IntentTemplate } from '../../engines/intent-decomposer.js'

export interface IntentTemplateStore {
  listTemplates(): Promise<IntentTemplate[]>
  getTemplate(id: string): Promise<IntentTemplate | null>
  upsertTemplate(tpl: IntentTemplate): Promise<IntentTemplate>
}
