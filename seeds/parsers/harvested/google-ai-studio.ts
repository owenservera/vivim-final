// seeds/parsers/harvested/google-ai-studio.ts
// Google AI Studio streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from capabilit-lab GEMINI-CAPABILITIES-AND-STREAMING.md extractGoogleAIStudioBlock.
//
// Format: data.candidates[0].content.parts[0].text
export const LOGIC_CODE = `
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
      const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (text !== undefined && text !== null) blocks.push({ type: 'text', text: String(text) });
    } catch (_e) { /* skip */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes('[DONE]') || String(rawBody).includes('"finishReason"');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (!b.includes('data:')) return 0;
  if (b.includes('candidates') && b.includes('parts')) return 1;
  if (b.includes('[DONE]')) return 0.7;
  return 0.3;
}
module.exports.default = { name: 'gemini/002_ai_studio', version: 2, providerId: 'gemini', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
