// devops/tracker.ts
// Deterministic parse/serialize of docs/atomic-v3-fork-canon/01-tracker.md.
// The tracker is the single source of truth for implementation progress.
// This module ONLY rewrites state markers, the header stats, and the
// "Last Updated" line. It never alters section order, headings, or prose
// so it stays compatible with concurrent human edits to the same file.

export type UnitState = "pending" | "in_progress" | "done" | "blocked";

const MARKER: Record<UnitState, string> = {
  pending: " ",
  in_progress: "~",
  done: "x",
  blocked: "!",
};

const STATE_BY_MARKER: Record<string, UnitState> = {
  " ": "pending",
  "~": "in_progress",
  x: "done",
  "!": "blocked",
};

export interface Unit {
  id: string;
  name: string;
  phase: number;
  phaseName: string;
  file?: string;
  state: UnitState;
  lineIndex: number;
}

export interface Stats {
  total: number;
  done: number;
  blocked: number;
  pending: number;
}

// Separator between id and name is inconsistent across the tracker:
// some lines use an em-dash ("2.1 — Name"), others a hyphen
// ("1.1 - Name"). Accept both so the authoritative "done" state parses.
// Phase 2+ lines carry an optional origin tag after the id, e.g.
// "2.1 (v5:0.0) — Name"; the (...) group is non-capturing and dropped.
const UNIT_RE =
  /^(\s*)-\s+\[([ x~!])\]\s+(\d+\.\d+)\s*(?:\([^)]*\))?\s+(?:—|-)\s+(.+?)(?:\s+→\s+`(.+?)`)?\s*$/;
// Phase headers vary: "## Phase 1: Skeleton ✓" (done, no count) or
// "## Phase 2: Provider Knowledge Graph (12 units)". Capture number + name;
// tolerate an optional trailing "✓" and/or "(N units)" suffix.
const PHASE_RE = /^##\s+Phase\s+(\d+):\s+(.+)$/;
const HEADER_RE =
  /^\*\*Total units:\*\*\s*(\d+)\s*\|\s*\*\*Done:\*\*\s*(\d+)\s*\|\s*\*\*Blocked:\*\*\s*(\d+)\s*\|\s*\*\*Pending:\*\*\s*(\d+)/;
const UPDATED_RE = /^##\s+Last Updated/;

export function parseUnits(lines: string[]): Unit[] {
  const units: Unit[] = [];
  let phase = 0;
  let phaseName = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const ph = PHASE_RE.exec(line);
    if (ph) {
      phase = Number(ph[1]!);
      phaseName = (ph[2] ?? '')
        .replace(/\s*✓$/, "")
        .replace(/\s*\(\d+\s+units\)$/, "")
        .trim();
      continue;
    }
    const u = UNIT_RE.exec(line);
    if (u && phase > 0) {
      units.push({
        id: u[3]!,
        name: (u[4] ?? '').trim(),
        phase,
        phaseName,
        file: u[5],
        state: STATE_BY_MARKER[u[2] ?? ''] ?? "pending",
        lineIndex: i,
      });
    }
  }
  return units;
}

export function computeStats(units: Unit[]): Stats {
  let done = 0;
  let blocked = 0;
  let pending = 0;
  for (const u of units) {
    if (u.state === "done") done++;
    else if (u.state === "blocked") blocked++;
    else pending++;
  }
  return { total: units.length, done, blocked, pending };
}

export function updateState(
  lines: string[],
  id: string,
  state: UnitState,
): string[] {
  const idx = lines.findIndex((l) => {
    const m = UNIT_RE.exec(l);
    return m !== null && m[3] === id;
  });
  if (idx === -1) {
    throw new Error(`Unit ${id} not found in tracker`);
  }
  const marker = MARKER[state];
  const out = lines.slice();
  out[idx] = lines[idx]!.replace(/\[([ x~!])\]/, `[${marker}]`);
  return out;
}

export function updateHeader(lines: string[], stats: Stats): string[] {
  const out = lines.slice();
  for (let i = 0; i < out.length; i++) {
    if (HEADER_RE.test(out[i]!)) {
      out[i] =
        `**Total units:** ${stats.total} | **Done:** ${stats.done} | ` +
        `**Blocked:** ${stats.blocked} | **Pending:** ${stats.pending}`;
    }
    if (UPDATED_RE.test(out[i]!)) {
      out[i + 2] = new Date().toISOString().slice(0, 10);
    }
  }
  return out;
}
