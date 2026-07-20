/**
 * scripts/dev-all.ts — Launch backend + frontend concurrently.
 * Usage: bun run dev:all
 *
 * Backend:  http://localhost:9420 (vivim-final)
 * Frontend: http://localhost:3000 (canvas v9)
 */
import { spawn } from "child_process"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const CANVAS_V9 = join(ROOT, "dev-poc", "canvas", "v9")

const BLUE = "\x1b[34m"
const GREEN = "\x1b[32m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

function label(color: string, name: string) {
  return `${color}[${name}]${RESET} `
}

function launch(name: string, color: string, cmd: string, args: string[], cwd: string) {
  const proc = spawn(cmd, args, { cwd, stdio: "pipe", shell: true })

  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean)
    for (const line of lines) {
      console.log(label(color, name) + DIM + line + RESET)
    }
  })

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean)
    for (const line of lines) {
      console.log(label(color, name) + DIM + line + RESET)
    }
  })

  proc.on("close", (code) => {
    console.log(label(color, name) + `exited with code ${code}`)
  })

  return proc
}

console.log("")
console.log(`${BLUE}⚡ Starting vivim-final dev stack...${RESET}`)
console.log(`${DIM}  Backend:  http://localhost:9420${RESET}`)
console.log(`${DIM}  Frontend: http://localhost:3000${RESET}`)
console.log("")

const backend = launch("backend", BLUE, "bun", ["run", "src/cli/index.ts", "serve"], ROOT)
const frontend = launch("frontend", GREEN, "bun", ["run", "dev"], CANVAS_V9)

function cleanup() {
  console.log("\n" + `${BLUE}Shutting down...${RESET}`)
  backend.kill("SIGTERM")
  frontend.kill("SIGTERM")
  process.exit(0)
}

process.on("SIGINT", cleanup)
process.on("SIGTERM", cleanup)

// Keep alive
await new Promise(() => {})
