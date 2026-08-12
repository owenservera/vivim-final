// scripts/openapi-gen.ts
// Reflects the v10 capability registry source into the OpenAPI spec (Unit 37.4).
// Extracts capability ids from capability-bootstrap.ts (the registry source of
// truth) and refreshes docs/api/v11-universal-api.yaml + v11-capabilities.json.
//
// Session 2 (2026-08-07): Fixed ENOENT crash by ensuring docs/api/ exists
// before writing. Also bootstraps a minimal spec if the yaml doesn't exist.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const bootstrapPath = join(root, "src/engines/capability-bootstrap.ts")
const specPath = join(root, "docs/api/v11-universal-api.yaml")
const outPath = join(root, "docs/api/v11-capabilities.json")

function extractCapabilityIds(): string[] {
  const src = readFileSync(bootstrapPath, "utf8")
  const ids: string[] = []
  const re = /id:\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) ids.push(m[1] as string)
  return ids
}

/** Minimal OpenAPI 3.1 skeleton written when the spec file doesn't exist yet. */
function bootstrapSpec(capabilityCount: number): string {
  return `# docs/api/v11-universal-api.yaml
# vivim-final universal API surface (v11). Auto-bootstrapped by
# \`bun run docs:openapi\` — extend the paths/schemas below as routes stabilize.
# Re-run \`bun run docs:openapi\` after adding capabilities to refresh the
# x-capability-count and the capability listing comment under info:.

openapi: 3.1.0
info:
  title: vivim-final Universal API
  version: 1.0.0
  description: |
    Local-first AI conversation platform. Every operation is a UnifiedCapability.
    Surfaces call POST /api/interpret -> POST /api/capabilities/{id}/execute.
  x-capability-count: ${capabilityCount}
servers:
  - url: http://localhost:9420
    description: Local backend (default)
paths:
  /api/interpret:
    post:
      summary: Interpret natural language into a capability invocation
      responses:
        '200':
          description: Interpretation result
  /api/capabilities/{id}/execute:
    post:
      summary: Execute a capability by id
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Execution result
  /health:
    get:
      summary: Liveness probe
      responses:
        '200':
          description: Server is alive
  /readyz:
    get:
      summary: Readiness probe
      responses:
        '200':
          description: Server is ready
        '503':
          description: Server is still starting
`
}

function main() {
  const ids = extractCapabilityIds()
  if (ids.length === 0) {
    // [audit] removed: console.error("No capability ids extracted from bootstrap — aborting.")
    process.exit(1)
  }

  // Ensure the output directory exists (session 2 fix — was crashing with ENOENT).
  const docsApiDir = dirname(outPath)
  if (!existsSync(docsApiDir)) {
    mkdirSync(docsApiDir, { recursive: true })
    // [audit] removed: console.log(`Created ${docsApiDir}`)
  }

  // Emit machine-readable capability index.
  writeFileSync(outPath, JSON.stringify({ count: ids.length, ids }, null, 2))

  // Inject capability count into the OpenAPI info block.
  // Bootstrap the spec if it doesn't exist yet (session 2 fix).
  if (!existsSync(specPath)) {
    writeFileSync(specPath, bootstrapSpec(ids.length))
    // [audit] removed: console.log(`Bootstrapped ${specPath} (minimal OpenAPI 3.1 skeleton).`)
  }

  let spec = readFileSync(specPath, "utf8")
  spec = spec.replace(/x-capability-count:.*\n/, "")
  spec = spec.replace(
    /(info:\n)/,
    `$1  x-capability-count: ${ids.length}\n`,
  )
  // keep a header comment listing ids for traceability
  const listing = ids.map((i) => `    # - ${i}`).join("\n")
  if (!spec.includes("# Capability registry source:")) {
    spec = spec.replace(
      /(info:\n)/,
      `$1  # Capability registry source:\n${listing}\n`,
    )
  }
  writeFileSync(specPath, spec)

  // [audit] removed: console.log(`Reflected ${ids.length} capabilities into the v11 OpenAPI spec.`)
  // [audit] removed: console.log(`  - ${outPath}`)
  // [audit] removed: if (existsSync(specPath)) console.log(`  - ${specPath}`)
}

main()
