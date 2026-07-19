// devops/mark.ts
// Transition a unit's state in the tracker (single source of truth).
// Recomputes header stats and bumps the "Last Updated" date.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { computeStats, parseUnits, updateHeader, updateState, type UnitState } from "./tracker.ts";
import { getTracker } from "./select.ts";

const PROGRESS = "docs/atomic-v3-fork-canon/PROGRESS.md";

export async function markUnit(id: string, state: UnitState): Promise<void> {
  const trackerPath = getTracker();
  const raw = await import("node:fs/promises").then((fs) => fs.readFile(trackerPath, "utf8"));
  const lines = raw.split("\n");
  const next = updateState(lines, id, state);
  const stats = computeStats(parseUnits(next));
  const final = updateHeader(next, stats);
  await import("node:fs/promises").then((fs) => fs.writeFile(trackerPath, final.join("\n"), "utf8"));
}

/**
 * Single-pass completion: mark done + append PROGRESS.md audit line with the
 * resolved sha + commit everything in ONE git commit. Eliminates the two-commit
 * anti-pattern where PROGRESS.md gets a [PENDING-COMMIT] placeholder then a
 * second commit renames it to the real sha.
 *
 * Flow (all synchronous, one commit at the end):
 *   1. Transition unit -> done in tracker (working tree)
 *   2. Stage tracker + append PROGRESS.md line (with [PENDING-COMMIT] placeholder)
 *   3. git commit
 *   4. Resolve real sha, rewrite placeholder in PROGRESS.md
 *   5. git commit --amend --no-edit  (folds the resolved sha into the SAME commit)
 */
export async function markUnitDone(id: string, message?: string): Promise<void> {
  // 1. Transition state in working tree (no commit yet)
  await markUnit(id, "done");

  // 2. Build PROGRESS.md line (placeholder sha, resolved after commit)
  const summary = message ?? `complete ${id}`;
  const trackerRaw = readFileSync(getTracker(), "utf8");
  const name =
    parseUnits(trackerRaw.split("\n")).find((u) => u.id === id)?.name ?? id;
  const ts = new Date().toISOString().slice(0, 10);

  let existing = "";
  try {
    existing = readFileSync(PROGRESS, "utf8");
  } catch {
    existing = "";
  }
  const line = `[${ts}] ${id} ${name} -> done [PENDING-COMMIT] ${summary}\n`;
  const updated = existing.replace(/\n*$/, "\n") + line;
  writeFileSync(PROGRESS, updated, "utf8");

  // 3. Single commit (tracker + PROGRESS.md together)
  const commitMsg = `feat: ${summary}`;
  execSync("git add -A", { stdio: "inherit" });
  execSync(`git commit -m "${commitMsg}"`, { stdio: "inherit" });

  // 4. Resolve real sha and rewrite placeholder
  const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const finalProgress = readFileSync(PROGRESS, "utf8").replace("[PENDING-COMMIT]", sha);
  writeFileSync(PROGRESS, finalProgress, "utf8");

  // 5. Fold resolved sha into the SAME commit (amend, no new commit)
  execSync("git add -A", { stdio: "inherit" });
  execSync("git commit --amend --no-edit", { stdio: "inherit" });

  console.log(`marked ${id} -> done @ ${sha} (single commit)`);
}
