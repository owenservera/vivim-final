/**
 * seeds/canvas/automations.ts
 * --------------------------------------------------------------------
 * 100 core automations for the default automation workspace.
 * Each automation = a WorkflowDefinition row + a UnifiedCapability.
 *
 * Categories (10 each):
 *   1. Document workflows (summarize, extract, translate, …)
 *   2. Media workflows (transcribe, clip, thumbnail, …)
 *   3. Routing (message → Notion / Slack / Email)
 *   4. Digest (daily / weekly / monthly digests)
 *   5. Research (web search, cite, summarize)
 *   6. Content (blog draft, social post, newsletter)
 *   7. Monitoring (uptime, sentiment, alert)
 *   8. Backup (db, conversations, documents)
 *   9. Agents (invoke agent on event)
 *  10. Maintenance (cleanup, dedupe, archive)
 */

export interface AutomationSeed {
  slug: string;
  name: string;
  description: string;
  trigger: { kind: 'cron' | 'event' | 'webhook' | 'manual' | 'schedule'; spec?: string };
  tags: string[];
  nodes: Array<{ kind: 'trigger' | 'action' | 'condition' | 'transform' | 'wait' | 'hitl' | 'output'; label: string; capabilityId?: string }>;
}

// Helper to generate automations without 100 hand-written entries.
function gen(category: string, count: number, nameFn: (i: number) => { slug: string; name: string; description: string }, trigger: AutomationSeed['trigger'], nodes: AutomationSeed['nodes'], tags: string[]): AutomationSeed[] {
  const out: AutomationSeed[] = [];
  for (let i = 1; i <= count; i++) {
    const m = nameFn(i);
    out.push({
      slug: m.slug,
      name: m.name,
      description: m.description,
      trigger,
      tags: [category, ...tags],
      nodes,
    });
  }
  return out;
}

const SLUGS_ROUTING = ['notion', 'slack', 'email', 'linear', 'github', 'jira', 'asana', 'trello', 'discord', 'telegram'];
const NAMES_ROUTING = ['Notion', 'Slack', 'Email', 'Linear', 'GitHub', 'Jira', 'Asana', 'Trello', 'Discord', 'Telegram'];
const SLUGS_DIGEST = ['daily', 'weekly', 'monthly', 'quarterly', 'hourly', 'morning', 'evening', 'weekend', 'monday', 'friday'];
const SLUGS_RESEARCH = ['topic', 'competitor', 'market', 'trend', 'paper', 'patent', 'news', 'social', 'review', 'influencer'];
const NAMES_RESEARCH = ['Topic', 'Competitor', 'Market', 'Trend', 'Paper', 'Patent', 'News', 'Social', 'Review', 'Influencer'];
const SLUGS_CONTENT = ['blog', 'social', 'newsletter', 'tweet', 'linkedin', 'medium', 'press', 'ebook', 'podcast', 'video-script'];
const NAMES_CONTENT = ['Blog Post', 'Social Update', 'Newsletter', 'Tweet', 'LinkedIn Post', 'Medium Article', 'Press Release', 'eBook Chapter', 'Podcast Script', 'Video Script'];
const SLUGS_MONITOR = ['uptime', 'sentiment', 'mentions', 'keywords', 'competitor-pricing', 'seo-rank', 'stock', 'crypto', 'weather', 'traffic'];
const NAMES_MONITOR = ['Uptime', 'Sentiment', 'Mentions', 'Keywords', 'Competitor Pricing', 'SEO Rank', 'Stock', 'Crypto', 'Weather', 'Traffic'];
const SLUGS_BACKUP = ['db', 'conversations', 'documents', 'media', 'agents', 'automations', 'workspaces', 'annotations', 'memory', 'config'];
const NAMES_BACKUP = ['Database', 'Conversations', 'Documents', 'Media', 'Agents', 'Automations', 'Workspaces', 'Annotations', 'Memory', 'Config'];
const SLUGS_AGENT = ['new-doc', 'new-message', 'new-media', 'workspace-switch', 'tier-upgrade', 'provider-added', 'automation-completed', 'hitl-requested', 'error', 'boot'];
const NAMES_AGENT = ['New Doc', 'New Message', 'New Media', 'Workspace Switch', 'Tier Upgrade', 'Provider Added', 'Automation Completed', 'HITL Requested', 'Error', 'Boot'];
const SLUGS_MAINT = ['cleanup-inactive', 'dedupe-conversations', 'archive-old', 'vacuum-db', 'reindex-search', 'prune-logs', 'rotate-keys', 'compact-memory', 'refresh-seeds', 'verify-invariants'];
const NAMES_MAINT = ['Cleanup Inactive', 'Dedupe Conversations', 'Archive Old', 'Vacuum DB', 'Reindex Search', 'Prune Logs', 'Rotate Keys', 'Compact Memory', 'Refresh Seeds', 'Verify Invariants'];

export const AUTOMATION_SEEDS: AutomationSeed[] = [
  // 1. Document workflows (10)
  { slug: 'summarize-new-doc', name: 'Summarize New Document', description: 'When a new doc is added, generate a 3-paragraph summary.', trigger: { kind: 'event', spec: 'document:opened' }, tags: ['document'], nodes: [
    { kind: 'trigger', label: 'New doc opened', capabilityId: 'cap:document:open' },
    { kind: 'action', label: 'Summarize', capabilityId: 'cap:document:summarize' },
    { kind: 'output', label: 'Save summary' },
  ]},
  { slug: 'extract-entities', name: 'Extract Entities', description: 'Extract people, places, dates from new documents.', trigger: { kind: 'event', spec: 'document:opened' }, tags: ['document'], nodes: [
    { kind: 'trigger', label: 'New doc' },
    { kind: 'action', label: 'NER extract', capabilityId: 'cap:document:extract_entities' },
    { kind: 'output', label: 'Save entities' },
  ]},
  { slug: 'translate-doc', name: 'Translate Document', description: 'Translate documents to English on import.', trigger: { kind: 'manual' }, tags: ['document'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Translate', capabilityId: 'cap:document:translate' },
    { kind: 'output', label: 'Save translation' },
  ]},
  { slug: 'ocr-pdf', name: 'OCR PDF Scans', description: 'Run OCR on image-only PDFs.', trigger: { kind: 'event', spec: 'document:opened' }, tags: ['document', 'ocr'], nodes: [
    { kind: 'trigger', label: 'PDF opened' },
    { kind: 'condition', label: 'Is image-only?' },
    { kind: 'action', label: 'OCR', capabilityId: 'cap:document:ocr' },
    { kind: 'output', label: 'Save text' },
  ]},
  { slug: 'redact-pii', name: 'Redact PII', description: 'Redact personally-identifiable information before sharing.', trigger: { kind: 'manual' }, tags: ['document', 'privacy'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Detect PII', capabilityId: 'cap:document:detect_pii' },
    { kind: 'action', label: 'Redact', capabilityId: 'cap:document:redact' },
    { kind: 'output', label: 'Save redacted' },
  ]},
  { slug: 'doc-to-slides', name: 'Document to Slides', description: 'Convert a markdown doc into a slide deck.', trigger: { kind: 'manual' }, tags: ['document', 'slides'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Generate slides', capabilityId: 'cap:document:to_slides' },
    { kind: 'output', label: 'Save deck' },
  ]},
  { slug: 'doc-to-audio', name: 'Document to Audio', description: 'Read a document aloud as an audio clip.', trigger: { kind: 'manual' }, tags: ['document', 'tts'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'TTS', capabilityId: 'cap:tts:synthesize' },
    { kind: 'output', label: 'Save audio' },
  ]},
  { slug: 'index-doc', name: 'Index Document for Search', description: 'Add new docs to the full-text search index.', trigger: { kind: 'event', spec: 'document:opened' }, tags: ['document', 'search'], nodes: [
    { kind: 'trigger', label: 'New doc' },
    { kind: 'action', label: 'Index', capabilityId: 'cap:document:index' },
    { kind: 'output', label: 'Done' },
  ]},
  { slug: 'compare-docs', name: 'Compare Two Documents', description: 'Diff two documents and produce a change report.', trigger: { kind: 'manual' }, tags: ['document', 'diff'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Diff', capabilityId: 'cap:document:diff' },
    { kind: 'output', label: 'Save report' },
  ]},
  { slug: 'archive-old-docs', name: 'Archive Old Documents', description: 'Move docs untouched for 90 days to the archive workspace.', trigger: { kind: 'cron', spec: '0 2 * * *' }, tags: ['document', 'maintenance'], nodes: [
    { kind: 'trigger', label: 'Daily 2am' },
    { kind: 'action', label: 'Find stale docs', capabilityId: 'cap:document:list' },
    { kind: 'action', label: 'Move to archive', capabilityId: 'cap:workspace:route' },
    { kind: 'output', label: 'Done' },
  ]},

  // 2. Media workflows (10)
  { slug: 'transcribe-and-clip-video', name: 'Transcribe + Clip Video', description: 'Transcribe video audio, then clip highlights by keyword.', trigger: { kind: 'manual' }, tags: ['media', 'video'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Transcribe', capabilityId: 'cap:media:transcribe' },
    { kind: 'action', label: 'Find highlights', capabilityId: 'cap:media:find_clips' },
    { kind: 'action', label: 'Clip', capabilityId: 'cap:media:clip' },
    { kind: 'output', label: 'Save clips' },
  ]},
  { slug: 'extract-thumbnails', name: 'Extract Thumbnails', description: 'Extract one thumbnail per second from uploaded videos.', trigger: { kind: 'event', spec: 'media:opened' }, tags: ['media', 'video'], nodes: [
    { kind: 'trigger', label: 'New video' },
    { kind: 'action', label: 'Extract frames', capabilityId: 'cap:media:extract_frame' },
    { kind: 'output', label: 'Save thumbnails' },
  ]},
  { slug: 'audio-to-text', name: 'Audio to Text', description: 'Transcribe audio clips to text.', trigger: { kind: 'event', spec: 'media:opened' }, tags: ['media', 'audio'], nodes: [
    { kind: 'trigger', label: 'New audio' },
    { kind: 'action', label: 'Transcribe', capabilityId: 'cap:media:transcribe' },
    { kind: 'output', label: 'Save transcript' },
  ]},
  { slug: 'generate-subtitles', name: 'Generate Subtitles', description: 'Generate SRT subtitles from video audio.', trigger: { kind: 'manual' }, tags: ['media', 'video', 'subtitles'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Transcribe' },
    { kind: 'action', label: 'Format SRT', capabilityId: 'cap:media:to_srt' },
    { kind: 'output', label: 'Save SRT' },
  ]},
  { slug: 'compress-video', name: 'Compress Video', description: 'Re-encode large videos to H.264 720p.', trigger: { kind: 'manual' }, tags: ['media', 'video', 'compress'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Re-encode', capabilityId: 'cap:media:transcode' },
    { kind: 'output', label: 'Save compressed' },
  ]},
  { slug: 'extract-audio', name: 'Extract Audio Track', description: 'Extract the audio track from a video.', trigger: { kind: 'manual' }, tags: ['media', 'audio'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Demux audio', capabilityId: 'cap:media:extract_audio' },
    { kind: 'output', label: 'Save audio' },
  ]},
  { slug: 'splice-clips', name: 'Splice Clips', description: 'Concatenate selected clips into a highlight reel.', trigger: { kind: 'manual' }, tags: ['media', 'video'], nodes: [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Splice', capabilityId: 'cap:media:splice' },
    { kind: 'output', label: 'Save reel' },
  ]},
  { slug: 'detect-scenes', name: 'Detect Scene Boundaries', description: 'Scene-detect a video for navigation.', trigger: { kind: 'event', spec: 'media:opened' }, tags: ['media', 'video'], nodes: [
    { kind: 'trigger', label: 'New video' },
    { kind: 'action', label: 'Scene detect', capabilityId: 'cap:media:scene_detect' },
    { kind: 'output', label: 'Save scenes' },
  ]},
  { slug: 'watermark-video', name: 'Watermark Video', description: 'Burn a watermark into uploaded videos.', trigger: { kind: 'event', spec: 'media:opened' }, tags: ['media', 'video'], nodes: [
    { kind: 'trigger', label: 'New video' },
    { kind: 'action', label: 'Burn watermark', capabilityId: 'cap:media:watermark' },
    { kind: 'output', label: 'Save watermarked' },
  ]},
  { slug: 'normalize-audio', name: 'Normalize Audio', description: 'Loudness-normalize audio clips to -16 LUFS.', trigger: { kind: 'event', spec: 'media:opened' }, tags: ['media', 'audio'], nodes: [
    { kind: 'trigger', label: 'New audio' },
    { kind: 'action', label: 'Normalize', capabilityId: 'cap:media:normalize' },
    { kind: 'output', label: 'Save normalized' },
  ]},

  // 3. Routing (10)
  ...gen('routing', 10, (i) => {
    const s = SLUGS_ROUTING[i - 1]!;
    const n = NAMES_ROUTING[i - 1]!;
    return { slug: `route-message-to-${s}`, name: `Route Message to ${n}`, description: `Forward incoming messages to ${n}.` };
  }, { kind: 'event', spec: 'message:received' }, [
    { kind: 'trigger', label: 'Message received' },
    { kind: 'action', label: 'Route', capabilityId: 'cap:route:forward' },
    { kind: 'output', label: 'Confirm' },
  ], ['routing']),

  // 4. Digest (10)
  ...gen('digest', 10, (i) => {
    const p = SLUGS_DIGEST[i - 1]!;
    return { slug: `${p}-digest`, name: `${p.charAt(0).toUpperCase() + p.slice(1)} Digest`, description: `Compile a ${p} digest of activity across workspaces.` };
  }, { kind: 'cron', spec: '0 9 * * *' }, [
    { kind: 'trigger', label: 'Scheduled' },
    { kind: 'action', label: 'Gather activity', capabilityId: 'cap:workspace:activity' },
    { kind: 'action', label: 'Summarize', capabilityId: 'cap:document:summarize' },
    { kind: 'output', label: 'Send digest' },
  ], ['digest']),

  // 5. Research (10)
  ...gen('research', 10, (i) => {
    const s = SLUGS_RESEARCH[i - 1]!;
    const n = NAMES_RESEARCH[i - 1]!;
    return { slug: `research-${s}`, name: `Research ${n}`, description: `Run a research sweep on a ${s}.` };
  }, { kind: 'manual' }, [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Web search', capabilityId: 'cap:web:search' },
    { kind: 'action', label: 'Cite sources', capabilityId: 'cap:web:cite' },
    { kind: 'action', label: 'Synthesize', capabilityId: 'cap:document:summarize' },
    { kind: 'output', label: 'Save report' },
  ], ['research']),

  // 6. Content (10)
  ...gen('content', 10, (i) => {
    const s = SLUGS_CONTENT[i - 1]!;
    const n = NAMES_CONTENT[i - 1]!;
    return { slug: `draft-${s}`, name: `Draft ${n}`, description: `Draft a ${s} from a brief.` };
  }, { kind: 'manual' }, [
    { kind: 'trigger', label: 'Manual run' },
    { kind: 'action', label: 'Draft', capabilityId: 'cap:content:draft' },
    { kind: 'hitl', label: 'Review draft' },
    { kind: 'output', label: 'Publish' },
  ], ['content']),

  // 7. Monitoring (10)
  ...gen('monitor', 10, (i) => {
    const s = SLUGS_MONITOR[i - 1]!;
    const n = NAMES_MONITOR[i - 1]!;
    return { slug: `monitor-${s}`, name: `Monitor ${n}`, description: `Monitor ${s} and alert on threshold.` };
  }, { kind: 'cron', spec: '*/15 * * * *' }, [
    { kind: 'trigger', label: 'Every 15 min' },
    { kind: 'action', label: 'Check', capabilityId: 'cap:monitor:check' },
    { kind: 'condition', label: 'Threshold?' },
    { kind: 'action', label: 'Alert', capabilityId: 'cap:notify:alert' },
    { kind: 'output', label: 'Log' },
  ], ['monitor']),

  // 8. Backup (10)
  ...gen('backup', 10, (i) => {
    const s = SLUGS_BACKUP[i - 1]!;
    const n = NAMES_BACKUP[i - 1]!;
    return { slug: `backup-${s}`, name: `Backup ${n}`, description: `Nightly backup of ${s} to ./backups/` };
  }, { kind: 'cron', spec: '0 3 * * *' }, [
    { kind: 'trigger', label: 'Nightly 3am' },
    { kind: 'action', label: 'Snapshot', capabilityId: 'cap:backup:snapshot' },
    { kind: 'output', label: 'Verify' },
  ], ['backup']),

  // 9. Agents (10)
  ...gen('agent-event', 10, (i) => {
    const s = SLUGS_AGENT[i - 1]!;
    const n = NAMES_AGENT[i - 1]!;
    return { slug: `invoke-agent-on-${s}`, name: `Invoke Agent on ${n}`, description: `Invoke a configured agent when ${s.replace(/-/g, ' ')} occurs.` };
  }, { kind: 'event', spec: 'system:event' }, [
    { kind: 'trigger', label: 'System event' },
    { kind: 'action', label: 'Invoke agent', capabilityId: 'cap:agent:invoke' },
    { kind: 'output', label: 'Log' },
  ], ['agent']),

  // 10. Maintenance (10)
  ...gen('maintenance', 10, (i) => {
    const s = SLUGS_MAINT[i - 1]!;
    const n = NAMES_MAINT[i - 1]!;
    return { slug: `maintenance-${s}`, name: `Maintenance: ${n}`, description: `${n}.` };
  }, { kind: 'cron', spec: '0 4 * * 0' }, [
    { kind: 'trigger', label: 'Weekly Sun 4am' },
    { kind: 'action', label: 'Run', capabilityId: 'cap:maintenance:run' },
    { kind: 'output', label: 'Report' },
  ], ['maintenance']),
];

export const AUTOMATION_COUNT = AUTOMATION_SEEDS.length;
