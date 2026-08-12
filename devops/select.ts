// devops/select.ts
// Pick the next implementable unit.
//
// Selection rules:
//  1. A unit is selectable only if its state is pending or in_progress
//     (resume interrupted work first).
//  2. Its phase is "open": phase N opens only when every unit of all
//     smaller-indexed *product* phases is `done`. This enforces the
//     master-plan rule that SOTA phases 7-10 stay blocked until phase 6
//     is complete.
//  3. Every dependency listed in the unit's atomic file is `done`.
// Returns the first selectable unit in phase/id order (in_progress first).
//
// Tooling phases (phase >= TOOLING_PHASE_MIN) are cross-cutting tracks —
// e.g. the Frontend Sandbox gating harness (Phase 90). They are exempt
// from the sequential product-phase gate in BOTH directions: their own
// units are always selectable regardless of product-phase state, and
// they never block a product phase from opening.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseUnits, type Unit } from "./tracker.ts";
import { loadDeps } from "./deps.ts";

// Tracker path is overridable so satellite trackers (e.g. docs/atomic-runtime)
// are selectable: `bun run devops select --tracker <path>`.
// Resolved lazily (not at module load) so `--tracker` / DEVOPS_TRACKER set in
// index.ts main() (after ESM imports hoist) takes effect.
export function getTracker(): string {
  return process.env.DEVOPS_TRACKER ?? join(process.cwd(), "docs/atomic-v3-fork-canon/01-tracker.md");
}
export function getAtomicDir(): string {
  return process.env.DEVOPS_ATOMIC_DIR ?? join(process.cwd(), "docs/atomic-v3-fork-canon");
}

// Phases at or above this number are cross-cutting tooling tracks, exempt
// from the sequential product-phase gate.
export const TOOLING_PHASE_MIN = 90;

// The canonical tracker is docs/atomic-v3-fork-canon/01-tracker.md (127 units).
// Deprecated: docs/atomic-v3/, docs/atomic-v4/, docs/atomic-v5/.
export const PLAN_PAUSED = false;

export interface Selection {
  id: string;
  name: string;
  phase: number;
  phaseName: string;
  file?: string;
  deps: string[];
  resume: boolean;
}

function phaseIsOpen(units: Unit[], target: number, done: Set<string>): boolean {
  // Tooling phases are cross-cutting: always open.
  if (target >= TOOLING_PHASE_MIN) return true;
  for (const u of units) {
    // Tooling-phase units never block product phases from opening.
    if (u.phase >= TOOLING_PHASE_MIN) continue;
    if (u.phase < target && u.state !== "done" && u.state !== "blocked") return false;
  }
  return true;
}

export function selectFrom(
  units: Unit[],
  deps: Map<string, string[]>,
): Selection | null {
  const done = new Set(
    units.filter((u) => u.state === "done").map((u) => u.id),
  );

  const candidates = units.filter((u) => {
    if (u.state !== "pending" && u.state !== "in_progress") return false;
    if (!phaseIsOpen(units, u.phase, done)) return false;
    const d = deps.get(u.id) ?? [];
    return d.every((dep) => done.has(dep));
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const ar = a.state === "in_progress" ? 0 : 1;
    const br = b.state === "in_progress" ? 0 : 1;
    if (ar !== br) return ar - br;
    if (a.phase !== b.phase) return a.phase - b.phase;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  const chosen = candidates[0]!;
  return {
    id: chosen.id,
    name: chosen.name,
    phase: chosen.phase,
    phaseName: chosen.phaseName,
    file: chosen.file,
    deps: deps.get(chosen.id) ?? [],
    resume: chosen.state === "in_progress",
  };
}

export async function selectNext(): Promise<Selection | null> {
  if (PLAN_PAUSED) {
    // [audit] removed: console.error(
      "[devops] plan PAUSED — atomic-v3-fork-canon is mid-flight. " +
        "Selection halted. Resume by setting PLAN_PAUSED=false in devops/select.ts.",
    );
    return null;
  }
  const content = await readFile(getTracker(), "utf8");
  const units = parseUnits(content.split("\n"));
  const deps = await loadDeps(getAtomicDir());
  return selectFrom(units, deps);
}
