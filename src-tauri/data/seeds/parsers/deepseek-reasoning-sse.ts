// seeds/parsers/harvested/deepseek-reasoning-sse.ts
// DeepSeek R1 streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Handles DeepSeek SSE format with reasoning_content / text deltas and <think> tags.

export const LOGIC_CODE = `
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split('\\n');
  let currentReasoning = '';
  let currentText = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const data = JSON.parse(payload);
      const delta = data.choices && data.choices[0] && data.choices[0].delta;
      if (!delta) continue;

      if (delta.reasoning_content) {
        currentReasoning += delta.reasoning_content;
      }
      if (delta.content) {
        currentText += delta.content;
      }
    } catch (_e) { /* ignore non-json lines */ }
  }

  // Handle inline <think> tags if present in plain text
  if (!currentReasoning && currentText.includes('<think>')) {
    const thinkMatch = currentText.match(/<think>([\\s\\S]*?)(?:<\\/think>|$)/);
    if (thinkMatch && thinkMatch[1]) {
      currentReasoning = thinkMatch[1];
      currentText = currentText.replace(/<think>[\\s\\S]*?(?:<\\/think>|$)/, '');
    }
  }

  if (currentReasoning) {
    blocks.push({ type: 'reasoning', text: currentReasoning });
  }
  if (currentText) {
    blocks.push({ type: 'text', text: currentText });
  }

  if (blocks.length === 0 && rawBody.length > 0) {
    blocks.push({ type: 'text', text: rawBody });
  }
  return blocks;
}

function detectCompletion(rawBody) {
  return String(rawBody).includes('[DONE]') || String(rawBody).includes('"finish_reason":"stop"');
}

function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.includes('reasoning_content') || b.includes('<think>')) return 0.95;
  if (b.includes('data:') && b.includes('choices')) return 0.85;
  return 0.2;
}

exports.default = {
  name: 'deepseek/001_reasoning_sse',
  version: 1,
  providerId: 'deepseek',
  parse: parse,
  detectCompletion: detectCompletion,
  getConfidence: getConfidence
};
`
