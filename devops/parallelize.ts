// devops/parallelize.ts
// Fan out independent units to parallel subagent workers. Each worker runs
// `bun run devops select` + `bun run devops mark <id> done` in its own process
// so context stays isolated per unit (the agentic-loop context-isolation goal).
//
// Gate-merge (FR-006): a unit is only merged (`mark done`) when its quality gate
// passes. If the gate fails for a unit, that unit is rolled back to `in_progress`
// (not merged) so it can be retried, and the others proceed independently.
//
// Usage:
//   bun run devops parallelize --max <n> [--tracker <path>] [--dry-run] [--no-gate]
//
// Safety: never exceeds `max`. Defaults to min(4, cpuCount). Respects
// `in_progress` states already claimed by a live worker.

import { spawn } from "node:child_process";

interface ParallelizeOpts {
  max: number;
  tracker?: string;
  dryRun: boolean;
  gate: boolean;
}

function run(cmd: string, args: string[], inherit = false): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: inherit ? "inherit" : "pipe" });
    proc.on("close", (code) => resolve(code ?? 0));
  });
}

/**
 * Select and claim up to `max` selectable units, then run each through its gate
 * and merge (mark done) only when the gate passes. Returns the number of units
 * completed (merged).
 */
export async function parallelize(opts: Partial<ParallelizeOpts> = {}): Promise<number> {
  const max = opts.max || Math.min(4, 4);
  const gateEnabled = opts.gate ?? true;
  const trackerFlag = opts.tracker ? ["--tracker", opts.tracker] : [];

  // 1. Select the next batch of selectable units (up to max).
  //    Claim each immediately (mark in_progress) so subsequent `select` calls
  //    skip already-claimed units and we get distinct ids.
  const selected: string[] = [];
  for (let i = 0; i < max; i++) {
    const proc = spawn(
      "bun",
      ["run", "devops", "select", ...trackerFlag],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (c) => chunks.push(c));
    const code = await new Promise<number>((r) => proc.on("close", (c) => r(c ?? 0)));
    if (code !== 0) break;
    const out = Buffer.concat(chunks).toString().trim();
    if (!out || out === "null") break;
    let id: string | undefined;
    try {
      const sel = JSON.parse(out);
      id = sel?.id;
    } catch {
      break;
    }
    if (!id) break;
    if (selected.includes(id)) break; // already claimed this run; no more distinct units
    selected.push(id);
    // Claim immediately so the next select skips it.
    await run(
      "bun",
      ["run", "devops", "mark", id, "in_progress", ...(opts.tracker ? ["--tracker", opts.tracker] : [])],
      false,
    );
  }

  if (selected.length === 0) {
    // [audit] removed: console.log("parallelize: no selectable units");
    return 0;
  }

  if (opts.dryRun) {
    // [audit] removed: console.log(`parallelize [dry-run]: would run ${selected.length} units:`, selected);
    return selected.length;
  }

  // 2. Run each to done in parallel (already claimed in_progress above).
  //    Gate-merge: run the quality gate first; only `mark done` on pass.
  const results = await Promise.all(
    selected.map(async (id) => {
      const args = ["run", "devops", "mark", id, "done", ...trackerFlag];
      if (gateEnabled) {
        const gateCode = await run("bun", ["run", "devops", "gate"], false);
        if (gateCode !== 0) {
          // Gate failed → roll back to in_progress, do NOT merge.
          await run("bun", ["run", "devops", "mark", id, "in_progress", ...trackerFlag], false);
          // [audit] removed: console.error(`parallelize: unit ${id} gate FAILED — not merged`);
          return { id, ok: false };
        }
      }
      const code = await run("bun", args, false);
      return { id, ok: code === 0 };
    }),
  );

  const done = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).map((r) => r.id);
  // [audit] removed: console.log(`parallelize: merged ${done}/${selected.length} units`);
  // [audit] removed: if (failed.length) console.log(`parallelize: held back (gate failed): ${failed.join(", ")}`);
  return done;
}
