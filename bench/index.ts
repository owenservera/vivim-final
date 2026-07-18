// bench/index.ts
// CLI entry for the performance bench suite (Unit 37.3).
// `bun run bench` — runs scenarios, compares to baseline.json, writes baseline.

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"
import { runBenchmarks, type BenchScenario } from "./runner.ts"

const here = dirname(fileURLToPath(import.meta.url))
const baselinePath = join(here, "baseline.json")

// Lightweight scenarios using mock work (no DB). These establish the perf
// surface; swap in real engine calls once a test DB fixture exists.
const scenarios: BenchScenario[] = [
  {
    name: "capability.execute",
    iterations: 200,
    run: async () => {
      // simulate a capability invocation + JSON round-trip
      JSON.parse(JSON.stringify({ id: "c1", args: { q: "x".repeat(64) } }))
    },
  },
  {
    name: "conversation.send-roundtrip",
    iterations: 100,
    run: async () => {
      await new Promise((r) => setTimeout(r, 0))
    },
  },
  {
    name: "memory.index-throughput",
    iterations: 50,
    run: () => {
      for (let i = 0; i < 5000; i++) {
        const k = `k${i}`
        void `${k}:${i}`.length
      }
    },
  },
  {
    name: "provider.health-poll",
    iterations: 100,
    run: async () => {
      await Promise.resolve()
    },
  },
]

function loadBaseline(): Record<string, number> {
  if (!existsSync(baselinePath)) return {}
  try {
    const raw = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, number>
    return raw
  } catch {
    return {}
  }
}

async function main() {
  const prev = loadBaseline()
  const report = await runBenchmarks(scenarios, { baseline: prev })
  for (const r of report.results) {
    console.log(
      `${r.name.padEnd(28)} p50=${r.p50Ms.toFixed(3)}ms p95=${r.p95Ms.toFixed(3)}ms (n=${r.iterations})`,
    )
  }
  // Establish / refresh baseline on first run (no baseline -> record).
  if (Object.keys(prev).length === 0) {
    const next: Record<string, number> = {}
    for (const r of report.results) next[r.name] = r.p95Ms
    writeFileSync(baselinePath, JSON.stringify(next, null, 2))
    console.log("\nBaseline recorded (first run).")
  }
  if (report.regressions.length > 0) {
    console.error("\nREGRESSIONS:")
    for (const g of report.regressions) console.error(`  - ${g}`)
    process.exit(1)
  }
  console.log("\nNo regressions. OK.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
