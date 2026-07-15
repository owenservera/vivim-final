// scripts/openapi-gen.ts
// Reflects the v10 capability registry source into the OpenAPI spec (Unit 37.4).
// Extracts capability ids from capability-bootstrap.ts (the registry source of
// truth) and refreshes docs/api/v11-universal-api.yaml + v11-capabilities.json.

import { readFileSync, writeFileSync, existsSync } from "node:fs"
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

function main() {
  const ids = extractCapabilityIds()
  if (ids.length === 0) {
    console.error("No capability ids extracted from bootstrap — aborting.")
    process.exit(1)
  }

  // Emit machine-readable capability index.
  writeFileSync(outPath, JSON.stringify({ count: ids.length, ids }, null, 2))

  // Inject capability count into the OpenAPI info block.
  if (existsSync(specPath)) {
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
  }

  console.log(`Reflected ${ids.length} capabilities into the v11 OpenAPI spec.`)
  console.log(`  - ${outPath}`)
  if (existsSync(specPath)) console.log(`  - ${specPath}`)
}

main()
