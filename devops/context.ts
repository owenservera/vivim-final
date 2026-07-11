// devops/context.ts
// Detect active context: plans, session objectives, current focus units.
// Returns structured context for agent decision-making.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseUnits } from "./tracker.ts";
import { loadDeps } from "./deps.ts";
import { selectFrom, TRACKER, ATOMIC_DIR, TOOLING_PHASE_MIN } from "./select.ts";

export interface ActivePlan {
  file: string;
  title: string;
  timestamp: string;
  mtime: number;
}

export interface SessionObjectives {
  file: string;
  title?: string;
  objectives?: string[];
}

export interface CurrentFocus {
  id?: string;
  name?: string;
  phase?: number;
  phaseName?: string;
  file?: string;
  resume?: boolean;
}

export interface Context {
  activePlan?: ActivePlan;
  sessionObjectives?: SessionObjectives;
  currentFocus?: CurrentFocus;
  hasContext: boolean;
}

const PLANS_DIR = join(process.cwd(), ".kilo/plans");
const SESSION_FILE = join(process.cwd(), "docs/session/current.md");

function parsePlanTitle(content: string): string {
  const lines = content.split("\n");
  const h1 = lines.find((l) => l.startsWith("# "));
  if (h1) return h1.slice(2).trim();
  return "Untitled plan";
}

async function getMostRecentPlan(): Promise<ActivePlan | undefined> {
  try {
    const files = await readdir(PLANS_DIR);
    const planFiles = files
      .filter((f) => f.endsWith(".md") && !f.includes("template"))
      .map((f) => join(PLANS_DIR, f));

    if (planFiles.length === 0) return undefined;

    const stats = await Promise.all(
      planFiles.map(async (f) => {
        const stat = await Bun.stat(f);
        return { file: f, mtime: stat.mtime.getTime() };
      }),
    );

    stats.sort((a, b) => b.mtime - a.mtime);
    const mostRecent = stats[0];
    if (!mostRecent) return undefined;

    const content = await readFile(mostRecent.file, "utf8");
    const mtimeDate = new Date(mostRecent.mtime);

    return {
      file: mostRecent.file,
      title: parsePlanTitle(content),
      timestamp: mtimeDate.toISOString().slice(0, 10),
      mtime: mostRecent.mtime,
    };
  } catch {
    return undefined;
  }
}

async function getSessionObjectives(): Promise<SessionObjectives | undefined> {
  try {
    const content = await readFile(SESSION_FILE, "utf8");
    const lines = content.split("\n");
    const titleLine = lines.find((l) => l.startsWith("## "));
    const objectives = lines
      .filter((l) => l.startsWith("- [") || l.startsWith("- [~"))
      .map((l) => l.replace(/^-\s*\[([ x~!])\]\s*/, "").trim());

    return {
      file: SESSION_FILE,
      title: titleLine?.slice(3).trim(),
      objectives: objectives.length > 0 ? objectives : undefined,
    };
  } catch {
    return undefined;
  }
}

async function getCurrentFocus(): Promise<CurrentFocus | undefined> {
  try {
    const content = await readFile(TRACKER, "utf8");
    const units = parseUnits(content.split("\n"));
    const deps = await loadDeps(ATOMIC_DIR);
    const selection = selectFrom(units, deps);

    if (!selection) return undefined;

    return {
      id: selection.id,
      name: selection.name,
      phase: selection.phase,
      phaseName: selection.phaseName,
      file: selection.file,
      resume: selection.resume,
    };
  } catch {
    return undefined;
  }
}

export async function getContext(): Promise<Context> {
  const [activePlan, sessionObjectives, currentFocus] = await Promise.all([
    getMostRecentPlan(),
    getSessionObjectives(),
    getCurrentFocus(),
  ]);

  const hasContext = !!(activePlan || sessionObjectives || currentFocus);

  return {
    activePlan,
    sessionObjectives,
    currentFocus,
    hasContext,
  };
}

export async function formatContextReport(ctx: Context): Promise<string> {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("                      DEVOPS CONTEXT");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");

  if (ctx.activePlan) {
    lines.push(`Active Plan: ${ctx.activePlan.title}`);
    lines.push(`  File: ${ctx.activePlan.file}`);
    lines.push(`  Modified: ${ctx.activePlan.timestamp}`);
    lines.push("");
  }

  if (ctx.sessionObjectives) {
    lines.push("Session Objectives:");
    if (ctx.sessionObjectives.title) {
      lines.push(`  ${ctx.sessionObjectives.title}`);
    }
    if (ctx.sessionObjectives.objectives && ctx.sessionObjectives.objectives.length > 0) {
      for (const obj of ctx.sessionObjectives.objectives.slice(0, 5)) {
        lines.push(`  - ${obj}`);
      }
    }
    lines.push("");
  }

  if (ctx.currentFocus) {
    const resumeNote = ctx.currentFocus.resume ? " (resume)" : "";
    lines.push(`Current Focus Unit${resumeNote}:`);
    lines.push(`  ID: ${ctx.currentFocus.id}`);
    lines.push(`  Name: ${ctx.currentFocus.name}`);
    lines.push(`  Phase: ${ctx.currentFocus.phase} (${ctx.currentFocus.phaseName})`);
    if (ctx.currentFocus.file) {
      lines.push(`  Source: ${ctx.currentFocus.file}`);
    }
    lines.push("");
  }

  if (!ctx.hasContext) {
    lines.push("No active context detected.");
    lines.push("Atomic loop is ready to proceed.");
  }

  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}