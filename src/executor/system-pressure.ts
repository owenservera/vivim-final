// src/executor/system-pressure.ts
// Cheap, dependency-free host-pressure read for the pre-spawn gate.
// Uses only Node's `os` so the local-first model stays dependency-free (SOTA:
// browserless uses systeminformation, but Node os is sufficient for v1).

import * as os from 'node:os'

export interface SystemPressure {
  cpuPct: number // 0-100, normalized loadavg against core count
  memPct: number // 0-100, used memory share
}

/**
 * Read current host pressure. cpuPct normalizes os.loadavg()[0] against the
 * logical core count; memPct is (total - free) / total. Both clamp to [0, 100].
 */
export function readSystemPressure(): SystemPressure {
  const cores = Math.max(1, os.cpus().length)
  const load = os.loadavg()[0] ?? 0
  const cpuPct = Math.min(100, Math.max(0, (load / cores) * 100))

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = Math.max(0, totalMem - freeMem)
  const memPct = totalMem > 0 ? Math.min(100, Math.max(0, (usedMem / totalMem) * 100)) : 0

  return { cpuPct, memPct }
}
