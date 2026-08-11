/**
 * @module engines/dcb-profile
 *
 * TypeScript port of the Rust DCB profile system.
 * Defines which context layers are active per DCB profile.
 *
 * Profiles:
 *   seed          → Identity + Prefs + Query (minimal, first-chat)
 *   reunion       → + Topic + Entity + JIT
 *   convergence   → + JIT + History
 *   continuum     → + Project + Decisions + Conversation + History
 *   handoff       → + Entity + Project + Decisions + Conversation + History (no Prefs)
 *   probe         → + Topic + Entity + JIT
 *   deep_research → + Topic + Entity + Project + JIT + History
 *   decision_brief→ + Entity + Project + Decisions (no JIT/History)
 */

import type { LayerType } from './cortex-budget.js';

export type DcbProfile =
  | 'seed'
  | 'reunion'
  | 'convergence'
  | 'continuum'
  | 'handoff'
  | 'probe'
  | 'deep_research'
  | 'decision_brief';

/** Static profile → layers activation matrix. */
const PROFILE_LAYERS: Record<DcbProfile, LayerType[]> = {
  seed: ['L0Identity', 'L1GlobalPrefs', 'L7UserQuery'],
  reunion: ['L0Identity', 'L1GlobalPrefs', 'L2Topic', 'L3Entity', 'L5JitContext', 'L7UserQuery'],
  convergence: ['L0Identity', 'L1GlobalPrefs', 'L2Topic', 'L3Entity', 'L5JitContext', 'L6RecentHistory', 'L7UserQuery'],
  continuum: [
    'L0Identity', 'L1GlobalPrefs', 'L2Topic', 'L3Entity',
    'LpProjectState', 'LdDecisions', 'L4Conversation',
    'L6RecentHistory', 'L7UserQuery',
  ],
  handoff: [
    'L0Identity', 'L3Entity', 'LpProjectState', 'LdDecisions',
    'L4Conversation', 'L6RecentHistory', 'L7UserQuery',
  ],
  probe: ['L0Identity', 'L1GlobalPrefs', 'L2Topic', 'L3Entity', 'L5JitContext', 'L7UserQuery'],
  deep_research: [
    'L0Identity', 'L1GlobalPrefs', 'L2Topic', 'L3Entity',
    'LpProjectState', 'L5JitContext', 'L6RecentHistory', 'L7UserQuery',
  ],
  decision_brief: [
    'L0Identity', 'L1GlobalPrefs', 'L3Entity',
    'LpProjectState', 'LdDecisions', 'L7UserQuery',
  ],
};

/**
 * Get the active layers for a given DCB profile.
 */
export function activeLayers(profile: DcbProfile): LayerType[] {
  return PROFILE_LAYERS[profile] ?? [];
}

/**
 * Map a profile to a budget depth mode.
 */
export function profileToDepth(profile: DcbProfile): 'Standard' | 'Deep' | 'Compact' {
  switch (profile) {
    case 'deep_research':
    case 'convergence':
      return 'Deep';
    case 'seed':
      return 'Compact';
    default:
      return 'Standard';
  }
}

/** All valid profile names. */
export const DCB_PROFILES: DcbProfile[] = [
  'seed', 'reunion', 'convergence', 'continuum',
  'handoff', 'probe', 'deep_research', 'decision_brief',
];
