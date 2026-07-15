// src/engines/harness/binding-status-ladder.ts
// Unit 24.1 - Binding status ladder (cap-store confidence-driven status).
// The binding status climbs/drops on outcome patterns, mirroring cap-store's
// draft -> candidate -> active -> degraded -> failed ladder.

export type BindingStatus = 'draft' | 'candidate' | 'active' | 'degraded' | 'failed'

/** Return the next status after a successful or failed outcome. */
export function nextStatus(current: BindingStatus, ok: boolean): BindingStatus {
  if (ok) {
    // Success lifts the binding (candidate -> active); a healthy active stays active.
    if (current === 'draft' || current === 'candidate' || current === 'failed') return 'active'
    if (current === 'degraded') return 'active'
    return 'active'
  }
  // Failure drops the binding; active/degraded degrade, repeated failure -> failed.
  if (current === 'active' || current === 'candidate') return 'degraded'
  if (current === 'degraded') return 'failed'
  return 'failed'
}

/** Promote a program status to 'promoted' once its binding is active (cap-store promote). */
export function promoteProgram(current: string, bindingStatus: BindingStatus): string {
  if (bindingStatus === 'active') return 'promoted'
  if (current === 'promoted') return 'candidate'
  return current
}

export function isActive(status: BindingStatus): boolean {
  return status === 'active'
}
