// devops/report.ts
// Summarize tracker progress: totals, per-phase counts, blocked list.

import { readFile } from "node:fs/promises";
import { computeStats, parseUnits } from "./tracker.ts";
import { TRACKER } from "./select.ts";

export async function report(): Promise<string> {
  const content = await readFile(TRACKER, "utf8");
  const units = parseUnits(content.split("\n"));
  const stats = computeStats(units);

  const byPhase = new Map<number, { name: string; done: number; total: number }>();
  for (const u of units) {
    const p = byPhase.get(u.phase) ?? { name: u.phaseName, done: 0, total: 0 };
    p.total++;
    if (u.state === "done") p.done++;
    byPhase.set(u.phase, p);
  }

  const lines: string[] = [];
  lines.push(`done: ${stats.done}/${stats.total} | blocked: ${stats.blocked} | pending: ${stats.pending}`);
  for (const [phase, p] of [...byPhase.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`  Phase ${phase} (${p.name}): ${p.done}/${p.total}`);
  }
  const blocked = units.filter((u) => u.state === "blocked");
  if (blocked.length > 0) {
    lines.push("Blocked:");
    for (const b of blocked) lines.push(`  [!] ${b.id} ${b.name}`);
  }
  return lines.join("\n");
}
