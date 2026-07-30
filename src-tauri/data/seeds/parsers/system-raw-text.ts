// seeds/parsers/harvested/system-raw-text.ts
// System last-resort parser — inline logic_code (DB-driven, sandbox-executed).
// Always succeeds: returns the raw body as a single text block. Never throws.
export const LOGIC_CODE = `
function parse(rawBody) {
  const b = String(rawBody);
  return b.length > 0 ? [{ type: 'text', text: b }] : [];
}
function detectCompletion() { return true; }
function getConfidence() { return 0.05; }
module.exports.default = { name: 'system/001_raw_text', version: 1, providerId: 'system', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
