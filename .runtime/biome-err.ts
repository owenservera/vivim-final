const raw = await Bun.file('.runtime/biome-json.txt').text()
const start = raw.indexOf('{')
const json = JSON.parse(raw.slice(start))
for (const d of json.diagnostics ?? []) {
  if (d.category === 'format') {
    console.log('FORMAT ERROR FILE:', d.location?.path?.file)
  }
}
