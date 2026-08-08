import { Database } from "bun:sqlite";

const schema = await Bun.file("prisma/schema.prisma").text();
const db = new Database("prisma/dev.db");

// Robust model/field parser:
// - Model blocks: /^model (\w+) \{/ ... /^\}/
// - Field: line /^\s{2}(\w+)\s+(\w[\w\[\]]*)(\??)\s*(.*)$/
//   continuation lines: /^\s{2,}@/ belonging to same field
// - Column name: @map("...") anywhere in field text, else field name
const models = new Map<string, { table: string; fields: Map<string, string>; fieldTypes: Map<string, string> }>();
const blockRe = /^model (\w+) \{([\s\S]*?)^\}/gm;
for (const mm of schema.matchAll(blockRe)) {
  const model = mm[1];
  const body = mm[2];
  const lines = body.split("\n");
  let table = model;
  const fields = new Map<string, string>();
  const fieldTypes = new Map<string, string>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const mapAttr = line.match(/@@map\("([^"]+)"\)/);
    if (mapAttr) { table = mapAttr[1]; i++; continue; }
    const f = line.match(/^\s{2}(\w+)\s+(\w[\w\[\]]*)(\??)(?:\s+(.*))?$/);
    if (f) {
      const fname = f[1];
      const ftype = f[2];
      // gather continuation lines that are @ attributes
      let fieldText = line;
      let j = i + 1;
      while (j < lines.length && /^\s+@/.test(lines[j])) { fieldText += " " + lines[j].trim(); j++; }
      i = j;
      const cm = fieldText.match(/@map\("([^"]+)"\)/);
      fields.set(fname, cm ? cm[1] : fname);
      fieldTypes.set(fname, ftype);
      continue;
    }
    i++;
  }
  models.set(model, { table, fields, fieldTypes });
}

const modelNames = new Set(models.keys());

let missingCount = 0;
const missing: string[] = [];
let checked = 0;
for (const [model, info] of models) {
  const table = info.table;
  let cols: any[];
  try { cols = db.query(`PRAGMA table_info("${table}")`).all() as any[]; }
  catch { missing.push(`${model} (${table}): TABLE MISSING`); missingCount++; continue; }
  const liveCols = new Set(cols.map(c => c.name));
  for (const [fname, col] of info.fields) {
    if (modelNames.has(info.fieldTypes.get(fname)!)) continue; // relation
    checked++;
    if (!liveCols.has(col)) {
      missingCount++;
      missing.push(`${model} (${table}): missing '${col}' (field ${fname})`);
    }
  }
}
console.log(`Checked ${checked} scalar fields across ${models.size} models; ${missingCount} drift findings`);
if (missing.length === 0) console.log("SCHEMA->LIVE: NO DRIFT");
for (const d of missing) console.log("  " + d);

// Reverse: live columns not declared in schema
const extra: string[] = [];
for (const [model, info] of models) {
  const table = info.table;
  const cols = db.query(`PRAGMA table_info("${table}")`).all() as any[];
  const schemaCols = new Set(info.fields.values());
  for (const c of cols) {
    if (!schemaCols.has(c.name)) extra.push(`${table}.${c.name}`);
  }
}
console.log(`\nLIVE->SCHEMA: ${extra.length} extra columns`);
for (const e of extra) console.log("  " + e);

db.close();
