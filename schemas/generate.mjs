#!/usr/bin/env node

/**
 * JSON Schema → TypeScript Codegen
 * ================================
 * Reads all *.schema.json files from this directory and emits a single
 * generated.ts file containing one TypeScript interface per schema.
 *
 * Usage:  node schemas/generate.mjs
 *
 * Auto-generated — do not hand-edit generated.ts.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'src', 'schema', 'generated.ts');

// ─── Type Mapping ───────────────────────────────────────────────────────

/** Map a JSON Schema type string + optional items to a TypeScript type string. */
function jsonSchemaToTs(prop, required, indent = '  ') {
  const optional = required ? '' : '?';
  const propName = prop.key;

  if (prop.enum) {
    const members = prop.enum.map((v) => JSON.stringify(v)).join(' | ');
    return `${indent}${propName}${optional}: ${members};`;
  }

  if (!prop.type && prop.anyOf) {
    // Union type from anyOf
    const unionParts = prop.anyOf.map((sub) => resolveType(sub)).join(' | ');
    return `${indent}${propName}${optional}: ${unionParts};`;
  }

  const tsType = resolveType(prop);
  return `${indent}${propName}${optional}: ${tsType};`;
}

/** Resolve a sub-schema node to a TypeScript type expression. */
function resolveType(node) {
  if (!node) return 'unknown';

  // Handle enum at node level
  if (node.enum) {
    return node.enum.map((v) => JSON.stringify(v)).join(' | ');
  }

  const type = node.type;

  if (Array.isArray(type)) {
    // e.g. ["string", "null"]
    return type.map((t) => primitiveToTs(t)).join(' | ');
  }

  if (type === 'array') {
    if (node.items) {
      const itemType = resolveType(node.items);
      return `Array<${itemType}>`;
    }
    return 'unknown[]';
  }

  if (type === 'object') {
    if (node.properties && Object.keys(node.properties).length > 0) {
      return inlineObject(node);
    }
    if (node.additionalProperties) {
      const valueType = resolveType(node.additionalProperties);
      return `Record<string, ${valueType}>`;
    }
    return 'Record<string, unknown>';
  }

  return primitiveToTs(type);
}

/** Map a primitive JSON Schema type to a TypeScript type. */
function primitiveToTs(type) {
  switch (type) {
    case 'string':   return 'string';
    case 'number':   return 'number';
    case 'integer':  return 'number';
    case 'boolean':  return 'boolean';
    case 'null':     return 'null';
    default:         return 'unknown';
  }
}

/** Generate an inline object type literal from a schema node. */
function inlineObject(node) {
  const required = new Set(node.required || []);
  const lines = Object.entries(node.properties || {}).map(
    ([key, subSchema]) => {
      const opt = required.has(key) ? '' : '?';
      const tsType = resolveType(subSchema);
      return `    ${key}${opt}: ${tsType};`;
    },
  );
  return `{
${lines.join('\n')}
  }`;
}

/** Generate a full interface from a top-level schema object. */
function generateInterface(schema) {
  const title = schema.title || 'UnnamedSchema';
  const description = schema.description ? `
/** ${schema.description} */
` : '';
  const required = new Set(schema.required || []);
  const properties = schema.properties || {};

  const lines = Object.entries(properties).map(([key, sub]) =>
    jsonSchemaToTs({ key, ...sub }, required.has(key)),
  );

  return `${description}export interface ${title} {
${lines.join('\n')}
}`;
}

// ─── Main ───────────────────────────────────────────────────────────────

function main() {
  const schemaDir = __dirname;
  const files = readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json'));

  if (files.length === 0) {
    console.log('No *.schema.json files found in', schemaDir);
    process.exit(0);
  }

  const interfaces = [];

  for (const file of files.sort()) {
    const filePath = join(schemaDir, file);
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const schema = JSON.parse(raw);
      const iface = generateInterface(schema);
      interfaces.push(iface);
      console.log(`  ✓ ${file} → ${schema.title || 'unnamed'}`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  const header = `/**
 * Auto-generated TypeScript interfaces from JSON Schema definitions.
 *
 * DO NOT EDIT — regenerate with: node schemas/generate.mjs
 *
 * Generated at: ${new Date().toISOString()}
 * Source schemas: ${files.join(', ')}
 */

`;

  const output = header + interfaces.join('\n\n') + '\n';
  writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`\nWrote ${interfaces.length} interface(s) to ${OUTPUT_PATH}`);
}

main();
