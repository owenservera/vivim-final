// seeds/parsers/harvested/gemini-batchexecute.ts
// Gemini batchexecute streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from capabilit-lab GEMINI-CAPABILITIES-AND-STREAMING.md src/parsers/gemini.ts.
//
// Format: XSSI-prefixed batchexecute envelope of JSON arrays; text delta at
// inner[4][0][1] or fallback inner[3][0][0]; terminal frame starts with "e".
export const LOGIC_CODE = `
function safeJsonParse(s) { try { return JSON.parse(s); } catch (_e) { return s; } }
function decodeEnvelope(raw) {
  const frames = [];
  let text = String(raw);
  if (text.indexOf(")]}'\\n") === 0) text = text.slice(5);
  const lines = text.split('\\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^\\d+$/.test(t)) continue;
    if (t.charAt(0) !== '[') continue;
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) continue;
      let isTerminal = false;
      for (const child of arr) { if (Array.isArray(child) && child[0] === 'e') { isTerminal = true; break; } }
      for (const child of arr) {
        if (Array.isArray(child) && child[0] === 'wrb.fr') {
          frames.push({ rpc: String(child[1] || ''), payload: typeof child[2] === 'string' ? safeJsonParse(child[2]) : child[2], error: child[5] != null ? child[5] : null, isTerminal: isTerminal });
        }
      }
      if (isTerminal && frames.length === 0) frames.push({ rpc: '', payload: null, error: null, isTerminal: true });
    } catch (_e) { /* skip */ }
  }
  return frames;
}
function parseStreamChunk(frame) {
  const payload = frame.payload;
  if (!Array.isArray(payload)) return null;
  const candidate = payload[4] != null ? payload[4] : payload[3];
  const textArr = Array.isArray(candidate) ? candidate[0] : undefined;
  let deltaArr = Array.isArray(textArr) ? (textArr[1] != null ? textArr[1] : textArr[0]) : undefined;
  if (typeof deltaArr === 'undefined' && Array.isArray(textArr)) deltaArr = textArr[0];
  let textDelta = '';
  if (Array.isArray(deltaArr)) textDelta = deltaArr.filter(function (s) { return typeof s === 'string'; }).join('');
  else if (typeof deltaArr === 'string') textDelta = deltaArr;
  return textDelta ? { textDelta: textDelta } : null;
}
function extractGrounding(frame) {
  const payload = frame.payload;
  if (!Array.isArray(payload)) return [];
  const grounding = [];
  for (let i = 0; i < payload.length; i++) {
    const section = payload[i];
    if (!Array.isArray(section)) continue;
    for (const item of section) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const entries = item[1];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (Array.isArray(entry) && entry.length >= 2 && typeof entry[0] === 'string' && entry[0].indexOf('http') === 0) {
          grounding.push({ type: 'link', url: entry[0], title: String(entry[1] || '') });
        } else if (entry && typeof entry === 'object' && entry.url) {
          grounding.push({ type: 'link', url: String(entry.url), title: String(entry.title || entry.name || '') });
        }
      }
    }
  }
  return grounding;
}
function parse(rawBody) {
  const blocks = [];
  const frames = decodeEnvelope(rawBody);
  for (const frame of frames) {
    if (frame.isTerminal) continue;
    if (frame.rpc) {
      const delta = parseStreamChunk(frame);
      if (delta && delta.textDelta) blocks.push({ type: 'text', text: delta.textDelta });
      else {
        const grounding = extractGrounding(frame);
        if (grounding.length > 0) {
          for (const g of grounding) blocks.push({ type: 'meta', key: 'grounding_link', value: g });
        } else {
          blocks.push({ type: 'meta', key: 'gemini_' + frame.rpc, value: frame.payload });
        }
      }
    }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  const b = String(rawBody);
  return b.includes('[["e"') || b.includes('"e"') || b.includes('"isTerminal":true');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.indexOf(')]}\\'') === 0 || b.includes('wrb.fr')) return 1;
  if (b.includes('[[')) return 0.6;
  return 0.2;
}
module.exports.default = { name: 'gemini/001_batchexecute', version: 2, providerId: 'gemini', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
