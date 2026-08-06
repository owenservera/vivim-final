import { readFileSync } from 'node:fs'
const md = readFileSync('docs/review-system/SCOPE.md', 'utf8')
const areas = []
for (const raw of md.split(/\r?\n/)) {
  const line = raw.trim()
  if (!line.startsWith('|')) continue
  const cells = line.split('|').map((c) => c.trim())
  if (cells.length < 5) continue
  const areaRaw = cells[1]
  if (!areaRaw) continue
  const m = areaRaw.match(/`([^`]+)`/)
  const area = (m ? m[1] : areaRaw).trim()
  if (!/^[a-z0-9][a-z0-9-]*$/.test(area)) continue
  const matchCell = cells[4] ?? ''
  const match = []
  for (const tok of matchCell.matchAll(/`([^`]+)`/g)) {
    const pattern = tok[1].replace(/\\\|/g, '|')
    try { match.push({ src: pattern.replace(/^\/|\/$/g, ''), re: new RegExp(pattern.replace(/^\/|\/$/g, ''), 'i') }) } catch (e) { match.push({ err: String(e) }) }
  }
  areas.push({ area, cellsLen: cells.length, matchCell, match })
}
console.log(JSON.stringify(areas, null, 2))