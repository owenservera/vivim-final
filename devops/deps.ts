// devops/deps.ts
// Extract per-unit dependencies from the atomic unit markdown files.
// The tracker records only state; the unit files carry `**Depends:**`.
// Supports multiple refs ("1.4, 2.4") and ranges ("3.1-3.4",
// "10.8-10.10") which expand to contiguous minor numbers in the same phase.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// v1/v2 atomic files use `**Depends:**`; v3 files use `**Depends on:**`.
// Accept both forms so the dependency graph survives the v3 migration.
// v1 keeps `**Depends:** <deps> | **Produces:**` on one line; v3 splits them
// across two lines with no `|`. Use `[\s\S]` (not `.`) so the pattern spans
// newlines, and make the `|` optional.
const DEPENDS_RE = /^\*\*Depends(?: on)?:\*\*\s*([\s\S]*?)\s*(?:\|\s*)?\*\*Produces:/m;
const ID_RE = /(\d+)\.(\d+)/g;
const RANGE_RE = /(\d+)\.(\d+)\s*-\s*(\d+)\.(\d+)/g;

function expandUnitRef(token: string): string[] {
  const range = RANGE_RE.exec(token);
  if (range) {
    const major = Number(range[1]);
    const start = Number(range[2]);
    const end = Number(range[4]);
    if (Number(range[3]) === major && end >= start) {
      const out: string[] = [];
      for (let m = start; m <= end; m++) out.push(`${major}.${m}`);
      return out;
    }
    return [`${range[1]}.${range[2]}`, `${range[3]}.${range[4]}`];
  }
  const m = ID_RE.exec(token);
  return m ? [`${m[1]}.${m[2]}`] : [];
}

export async function loadDeps(atomicDir: string): Promise<Map<string, string[]>> {
  const deps = new Map<string, string[]>();
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(atomicDir, { withFileTypes: true });
  } catch {
    return deps;
  }
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith("phase-")) continue;
    await walk(join(atomicDir, e.name), deps);
  }
  return deps;
}

async function walk(dir: string, deps: Map<string, string[]>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, deps);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      const content = await readFile(full, "utf8");
      const dm = /#\s+Unit\s+(\d+\.\d+)/.exec(content);
      const dep = DEPENDS_RE.exec(content);
      if (!dm || !dep) continue;
      const id = dm[1]!;
      const raw = dep[1] ?? '';
      const refs: string[] = [];
      for (const tok of raw.split(/[,\n|]/)) {
        refs.push(...expandUnitRef(tok));
      }
      deps.set(id, [...new Set(refs)]);
    }
  }
}
