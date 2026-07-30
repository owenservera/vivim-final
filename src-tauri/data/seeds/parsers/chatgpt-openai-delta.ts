// seeds/parsers/harvested/chatgpt-openai-delta.ts
// ChatGPT / OpenAI streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from capabilit-lab GEMINI-CAPABILITIES-AND-STREAMING.md extractOpenAIBlock.
//
// Handles: OpenAI delta (choices[].delta.content), ChatGPT patch (o:'patch', v:[]),
// and ChatGPT parts (o:'add', v.message.content.parts[] | message.content.parts[]).
export const LOGIC_CODE = `
function extractOpenAIBlock(data) {
  const api = data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
  if (api !== undefined && api !== null) return { type: 'text', text: String(api) };
  if (data.o === 'patch' && Array.isArray(data.v)) {
    const parts = [];
    for (const patch of data.v) {
      if (patch && typeof patch === 'object' && typeof patch.p === 'string' && typeof patch.v === 'string') {
        if (patch.p.indexOf('/message/content/parts/') === 0 && (patch.o === 'append' || patch.o === 'add' || patch.o === 'replace')) parts.push(patch.v);
      }
    }
    if (parts.length > 0) return { type: 'text', text: parts.join('') };
  }
  if (data.o === 'add' && data.v && data.v.message && data.v.message.content && data.v.message.content.parts) {
    return fromParts(data.v.message.content.parts);
  }
  const cp = data.message && data.message.content && data.message.content.parts;
  if (Array.isArray(cp)) return fromParts(cp);
  return null;
}
function fromParts(parts) {
  const blocks = [];
  for (const p of parts) {
    if (typeof p === 'string') blocks.push({ type: 'text', text: p });
    else if (p && typeof p === 'object' && 'asset_pointer' in p) blocks.push({ type: 'file', url: String(p.asset_pointer), mediaType: 'image/png', filename: '' });
  }
  if (blocks.length === 0) return null;
  return blocks.length === 1 ? blocks[0] : blocks[0];
}
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split('\\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const data = JSON.parse(payload);
      const block = extractOpenAIBlock(data);
      if (block) {
        if (Array.isArray(block)) blocks.push.apply(blocks, block);
        else blocks.push(block);
      }
    } catch (_e) { /* skip */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes('[DONE]') || String(rawBody).includes('"finish_reason"');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (!b.includes('data:')) return 0;
  if (b.includes('choices') && b.includes('delta')) return 1;
  if (b.includes('[DONE]')) return 0.7;
  return 0.3;
}
module.exports.default = { name: 'chatgpt/001_openai_delta', version: 1, providerId: 'chatgpt', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
