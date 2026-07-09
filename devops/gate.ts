// devops/gate.ts
// Run the quality gate: typecheck + lint + tests.
// Passes only when all three succeed. Structured result for the loop.

import { spawn } from "node:child_process";

interface GateStep {
  name: string;
  code: number;
  ok: boolean;
  out: string;
}

interface GateResult {
  pass: boolean;
  steps: GateStep[];
  summary: string;
}

function run(cmd: string, args: string[]): Promise<GateStep> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: process.cwd() });
    let out = "";
    const sink = (d: Buffer) => (out += d.toString());
    proc.stdout?.on("data", sink);
    proc.stderr?.on("data", sink);
    proc.on("close", (code) => {
      resolve({ name: args.join(" "), code: code ?? 1, ok: code === 0, out });
    });
  });
}

export async function runGate(): Promise<GateResult> {
  const steps: GateStep[] = [];
  steps.push(await run("bun", ["run", "typecheck"]));
  steps.push(await run("bun", ["run", "lint"]));
  steps.push(await run("bun", ["test"]));
  const pass = steps.every((s) => s.ok);
  const summary = steps
    .map((s) => `${s.ok ? "PASS" : "FAIL"} ${s.name}`)
    .join(" | ");
  return { pass, steps, summary };
}
