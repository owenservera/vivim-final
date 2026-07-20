// src/engines/memory/skill-scaffolding.ts
// stripSkillScaffolding - recover the user's real instruction from an expanded
// NLCL / capability prompt, and drop bare skill-invocation wrappers so the
// memory subsystem doesn't persist scaffolding noise (decision D10).
//
// Hermes port: MemoryManager._strip_skill_scaffolding (memory_manager.py).

const SKILL_OPEN = '<skill_scaffolding>'
const SKILL_CLOSE = '</skill_scaffolding>'

/**
 * Returns the recovered user instruction text, or null if the content is a
 * bare skill invocation (nothing but scaffolding) — caller should skip the turn.
 */
export function stripSkillScaffolding(text: string): string | null {
  if (!text.includes(SKILL_OPEN)) {
    return text.trim().length ? text.trim() : null
  }
  // Remove all <skill_scaffolding>...</skill_scaffolding> blocks.
  const cleaned = text
    .split(new RegExp(`${escapeRegex(SKILL_OPEN)}[\\s\\S]*?${escapeRegex(SKILL_CLOSE)}`, 'gi'))
    .join('')
    .trim()
  return cleaned.length ? cleaned : null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
