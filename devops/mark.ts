// devops/mark.ts
// Transition a unit's state in the tracker (single source of truth).
// Recomputes header stats and bumps the "Last Updated" date.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { computeStats, parseUnits, updateHeader, updateState, type UnitState } from "./tracker.ts";
import { getTracker } from "./select.ts";

// PROGRESS.md lives next to the tracker (canonical or satellite), so a
// --tracker override writes its audit trail to the right place.
function getProgressPath(): string {
  return join(dirname(getTracker()), "PROGRESS.md");
}

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
    existing = readFileSync(getProgressPath(), "utf8");
  } catch {
    existing = "";
  }
  const line = `[${ts}] ${id} ${name} -> done [PENDING-COMMIT] ${summary}\n`;
  const updated = existing.replace(/\n*$/, "\n") + line;
  writeFileSync(getProgressPath(), updated, "utf8");

  // 3. Single commit (tracker + PROGRESS.md together)
  const commitMsg = `feat: ${summary}`;
  execSync("git add -A", { stdio: "inherit" });
  execSync(`git commit -m "${commitMsg}"`, { stdio: "inherit" });

  // 4. Resolve real sha and rewrite placeholder
  const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const finalProgress = readFileSync(getProgressPath(), "utf8").replace("[PENDING-COMMIT]", sha);
  writeFileSync(getProgressPath(), finalProgress, "utf8");

  // 5. Fold resolved sha into the SAME commit (amend, no new commit)
  execSync("git add -A", { stdio: "inherit" });
  execSync("git commit --amend --no-edit", { stdio: "inherit" });

  console.log(`marked ${id} -> done @ ${sha} (single commit)`);
}

/**
 * Loop-safe variant of `markUnitDone` for the autonomous devops loop (and any
 * caller that marks many units in sequence). Unlike `markUnitDone`, it NEVER
 * uses `git commit --amend`: amending HEAD in a multi-unit loop is unsafe
 * because it rewrites the previous unit's commit and breaks history when the
 * working tree is clean (the `git commit` before the amend throws, leaving the
 * loop stuck). Instead it predicts the next commit sha with `git commit-tree`
 * so the resolved sha lands in PROGRESS.md within exactly ONE real commit.
 */
export async function markUnitDoneLoop(id: string, message?: string): Promise<void> {
  // 1. Transition state in working tree.
  await markUnit(id, "done");

  // 2. Stage tracker + state so we can predict the commit tree/sha.
  execSync("git add -A", { stdio: "inherit" });

  // 3. Predict the commit sha WITHOUT creating a ref-y commit yet, so we can
  //    embed it in PROGRESS.md before the single real commit lands.
  const tree0 = execSync("git write-tree", { encoding: "utf8" }).trim();
  const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const summary = message ?? `complete ${id}`;
  const commitMsg = `feat: ${summary}`;
  const predictedSha = execSync(
    `git commit-tree ${tree0} -p ${head} -m "${commitMsg}"`,
    { encoding: "utf8" },
  ).trim();

  // 4. Build PROGRESS.md line with the REAL (predicted) sha.
  const trackerRaw = readFileSync(getTracker(), "utf8");
  const name =
    parseUnits(trackerRaw.split("\n")).find((u) => u.id === id)?.name ?? id;
  const ts = new Date().toISOString().slice(0, 10);

  let existing = "";
  try {
    existing = readFileSync(getProgressPath(), "utf8");
  } catch {
    existing = "";
  }
  const line = `[${ts}] ${id} ${name} -> done [${predictedSha}] ${summary}\n`;
  const updated = existing.replace(/\n*$/, "\n") + line;
  writeFileSync(getProgressPath(), updated, "utf8");

  // 5. Re-stage PROGRESS.md, re-predict the final tree, and make HEAD point to
  //    exactly one new commit carrying the correct sha. No amend.
  execSync("git add -A", { stdio: "inherit" });
  const tree1 = execSync("git write-tree", { encoding: "utf8" }).trim();
  const finalSha = execSync(
    `git commit-tree ${tree1} -p ${head} -m "${commitMsg}"`,
    { encoding: "utf8" },
  ).trim();
  execSync(`git reset --soft ${finalSha}`, { stdio: "inherit" });

  console.log(`marked ${id} -> done @ ${finalSha} (loop-safe single commit)`);
}
