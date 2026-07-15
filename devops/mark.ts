// devops/mark.ts
// Transition a unit's state in the tracker (single source of truth).
// Recomputes header stats and bumps the "Last Updated" date.

import { readFile, writeFile } from "node:fs/promises";
import { computeStats, parseUnits, updateHeader, updateState, type UnitState } from "./tracker.ts";
import { getTracker } from "./select.ts";

export async function markUnit(id: string, state: UnitState): Promise<void> {
  const trackerPath = getTracker();
  const raw = await readFile(trackerPath, "utf8");
  const lines = raw.split("\n");
  const next = updateState(lines, id, state);
  const stats = computeStats(parseUnits(next));
  const final = updateHeader(next, stats);
  await writeFile(trackerPath, final.join("\n"), "utf8");
}
