// seeds/parsers/harvested/generic-format-agnostic.ts
// Generic format-agnostic parser — inline logic_code (DB-driven, sandbox-executed).
// Terminal-of-chain fallback for every provider. Best-effort text extraction across
// SSE / Gemini-array / OpenAI / AI-Studio shapes; never throws.
export const LOGIC_CODE = `
function parse(rawBody) {
  const b = String(rawBody);
  const blocks = [];
  // SSE data: frames
  const lines = b.split('\\n');
  let sawSse = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    sawSse = true;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') continue;
    try {
      const data = JSON.parse(payload);
      const choices = data.choices && data.choices[0];
      const delta = choices && choices.delta && choices.delta.content;
      if (typeof delta === 'string' && delta) { blocks.push({ type: 'text', text: delta }); continue; }
      const parts = choices && choices.message && choices.message.content && choices.message.content.parts;
      if (Array.isArray(parts)) { blocks.push({ type: 'text', text: parts.join('') }); continue; }
      const studio = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (typeof studio === 'string' && studio) { blocks.push({ type: 'text', text: studio }); continue; }
    } catch (_e) { /* not JSON, leave to raw fallback */ }
  }
  // Gemini batchexecute array
  if (!blocks.length && b.indexOf('[[') === 0) {
    try {
      const arr = JSON.parse(b);
      const walk = function (node) {
        if (typeof node === 'string') blocks.push({ type: 'text', text: node });
        else if (Array.isArray(node)) node.forEach(walk);
      };
      walk(arr);
    } catch (_e) { /* leave to raw */ }
  }
  if (!blocks.length) blocks.push({ type: 'text', text: b });
  return blocks;
}
function detectCompletion(rawBody) {
  const b = String(rawBody);
  return b.includes('[DONE]') || b.includes('message_stop') || b.indexOf('[["e"') === 0;
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.includes('choices') || b.includes('candidates') || b.includes('wrb.fr')) return 0.4;
  if (b.includes('data:') || b.includes('[[')) return 0.2;
  return 0.1;
}
module.exports.default = { name: 'generic/001_format_agnostic', version: 1, providerId: 'generic', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
