// seeds/parsers/harvested/claude-streaming-sse.ts
// Claude SSE streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from seeds/parsers/claude-streaming-sse.ts (canonical Claude format).
//
// Format:
//   data: {"type":"content_block_start",...}
//   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
//   data: {"type":"message_stop"}
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
      const json = JSON.parse(payload);
      if (json.type === 'content_block_start' && json.content_block) {
        const cb = json.content_block;
        if (cb.type === 'thinking') blocks.push({ type: 'reasoning', text: '' });
        else if (cb.type === 'tool_use') blocks.push({ type: 'tool-call', toolCallId: 'tc_' + blocks.length, toolName: String(cb.name || ''), input: cb.input || {} });
        else if (cb.type === 'image' || cb.type === 'image_url') blocks.push({ type: 'file', mediaType: cb.source && cb.source.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', url: String((cb.source && cb.source.url) || cb.url || ''), filename: String(cb.alt || '') });
        else if (cb.type === 'text') blocks.push({ type: 'text', text: String(cb.text || '') });
      }
      if (json.type === 'content_block_delta' && json.delta) {
        const delta = json.delta;
        if (typeof delta.text === 'string') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'text') last.text += delta.text;
          else blocks.push({ type: 'text', text: delta.text });
        } else if (typeof delta.thinking === 'string') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'reasoning') last.text += delta.thinking;
          else blocks.push({ type: 'reasoning', text: delta.thinking });
        } else if (typeof delta.signature === 'string') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'reasoning') last.signature = delta.signature;
          else blocks.push({ type: 'meta', key: 'thinking_signature', value: delta.signature });
        }
      }
      if (json.type === 'content_block_stop' && json.index !== undefined) {
        const last = blocks[blocks.length - 1];
        if (last && last.type === 'text' && last.text.indexOf('<antArtifact') !== -1) {
          const match = last.text.match(/<antArtifact[^>]*identifier="([^"]*)"[^>]*type="([^"]*)"[^>]*title="([^"]*)"[^>]*>\\n?([\\s\\S]*?)\\n?<\\/antArtifact>/);
          if (match) {
            blocks.pop();
            blocks.push({ type: 'file', url: 'artifact://' + match[1], mediaType: match[2], filename: match[3], text: match[4] });
          }
        }
      }
      if (json.type === 'message_start' && json.message) blocks.push({ type: 'meta', key: 'message_id', value: json.message.id });
      if (json.type === 'message_stop' || json.type === 'error') {
        const last = blocks[blocks.length - 1];
        if (last && last.type !== 'meta') blocks.push({ type: 'meta', key: 'stopped', value: json.type });
      }
    } catch (_e) { /* skip unparseable lines */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes('message_stop') || String(rawBody).includes('[DONE]');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  const hasData = b.includes('data:');
  const hasContent = b.includes('content_block_delta') || b.includes('content_block_start');
  if (!hasData) return 0;
  if (!hasContent) return b.includes('message_stop') ? 0.7 : 0.3;
  return 1;
}
module.exports.default = { name: 'claude/001_streaming_sse', version: 2, providerId: 'claude', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
