import { execSync } from 'node:child_process'
const out = execSync('bun run devops invariants check', { encoding: 'utf8' })
const jsonMatch = out.match(/\{[\s\S]*\}/)
if (!jsonMatch) { console.log('no json in output'); console.log(out.slice(-3000)); process.exit(0) }
const j = JSON.parse(jsonMatch[0])
console.log('violations total:', j.violations?.length)
for (const v of j.violations ?? []) {
  console.log(`[${v.severity}] ${v.id} (${v.category}) — ${v.message}`)
  console.log(`   file: ${v.file ?? '?'}`)
}