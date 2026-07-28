import { spawn } from "child_process"
import { join } from "path"
import { writeFile } from "node:fs/promises"
import { createServer } from "net"

const ROOT = join(import.meta.dir, "..")
const RUNTIME = join(ROOT, ".runtime")
const FRONTEND = join(ROOT, "frontend")

const backendPort = Number(process.env.CAP_STORE_PORT) || 9420

function portBound(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.on("error", () => resolve(true))
    srv.on("listening", () => { srv.close(); resolve(false) })
    srv.listen(port, "127.0.0.1")
  })
}

async function waitForBind(port: number, timeoutMs = 45000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portBound(port)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

await writeFile(join(RUNTIME, "backend.port"), String(backendPort), "utf8")

const backend = spawn("bun", ["run", "src/cli/index.ts", "serve"], {
  cwd: ROOT,
  detached: true,
  stdio: "inherit",
  env: { ...process.env as Record<string, string>, CAP_STORE_PORT: String(backendPort) },
})
backend.unref()
await writeFile(join(RUNTIME, "backend.pid"), String(backend.pid ?? ""), "utf8")

if (!(await waitForBind(backendPort))) {
  console.error(`Backend did not bind port ${backendPort} within 45s`)
  process.exit(1)
}

const frontend = spawn("bun", ["run", "dev"], {
  cwd: FRONTEND,
  detached: true,
  stdio: "inherit",
  env: { ...process.env as Record<string, string> },
})
frontend.unref()
await writeFile(join(RUNTIME, "frontend.pid"), String(frontend.pid ?? ""), "utf8")

console.log(`\n  Backend:  http://localhost:${backendPort}`)
console.log(`  Frontend: http://localhost:3000\n`)
console.log("  Run `pwsh scripts/stop-all.ps1` to stop.\n")
