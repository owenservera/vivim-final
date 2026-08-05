/**
 * shared/template.ts
 * --------------------------------------------------------------------
 * #10 Workspace Templates Gallery — pre-configured team setups.
 * One-click create from a template.
 */

export interface WorkspaceTemplate {
  id: string
  slug: string
  name: string
  description: string
  /** Icon (emoji). */
  icon: string
  /** Category for grouping in the gallery. */
  category: 'team' | 'studio' | 'pipeline' | 'support' | 'personal'
  /** Surfaces to seed (subset of chat/docs/media/automation/agents/shell). */
  surfaces: string[]
  /** Automation slugs from the 100 core automations to enable. */
  automationSlugs: string[]
  /** Agent slugs to enable. */
  agentSlugs: string[]
  /** Sample documents to seed (title + mime). */
  sampleDocs: Array<{ title: string; mimeType: string; inlineContent?: string }>
  /** Sample media to seed. */
  sampleMedia: Array<{ title: string; kind: string; sourceUrl: string; mimeType: string }>
  /** Default role for the creator. */
  defaultRole: 'admin' | 'editor'
  /** Whether this is a featured template. */
  featured: boolean
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'tpl:research-team',
    slug: 'research-team',
    name: 'Research Team',
    description: 'Literature review, web research, citation tracking, weekly digests.',
    icon: 'compass',
    category: 'team',
    surfaces: ['chat', 'docs', 'media', 'automation', 'agents'],
    automationSlugs: [
      'daily-digest',
      'research-topic',
      'research-competitor',
      'summarize-new-doc',
      'extract-entities',
    ],
    agentSlugs: ['research-assistant'],
    sampleDocs: [
      {
        title: 'Research Plan Q1',
        mimeType: 'text/markdown',
        inlineContent: '# Q1 Research Plan\n\n## Goals\n- ...\n## Methodology\n- ...',
      },
      { title: 'Literature Review', mimeType: 'text/markdown' },
    ],
    sampleMedia: [],
    defaultRole: 'admin',
    featured: true,
  },
  {
    id: 'tpl:content-studio',
    slug: 'content-studio',
    name: 'Content Studio',
    description: 'Blog drafts, social posts, video editing, transcription, publishing pipeline.',
    icon: '',
    category: 'studio',
    surfaces: ['chat', 'docs', 'media', 'automation', 'agents'],
    automationSlugs: [
      'draft-blog',
      'draft-social',
      'draft-newsletter',
      'transcribe-and-clip-video',
      'extract-thumbnails',
    ],
    agentSlugs: ['content-curator'],
    sampleDocs: [
      { title: 'Editorial Calendar', mimeType: 'text/markdown' },
      { title: 'Brand Voice Guide', mimeType: 'text/markdown' },
    ],
    sampleMedia: [
      {
        title: 'Intro Video',
        kind: 'video',
        sourceUrl: 'https://example.com/intro.mp4',
        mimeType: 'video/mp4',
      },
    ],
    defaultRole: 'editor',
    featured: true,
  },
  {
    id: 'tpl:devops-pipeline',
    slug: 'devops-pipeline',
    name: 'DevOps Pipeline',
    description: 'Monitoring, backups, incident response, audit trail, maintenance automations.',
    icon: '',
    category: 'pipeline',
    surfaces: ['chat', 'automation', 'agents', 'shell'],
    automationSlugs: [
      'monitor-uptime',
      'monitor-sentiment',
      'backup-db',
      'maintenance-cleanup-inactive',
      'maintenance-verify-invariants',
    ],
    agentSlugs: ['inbox-triager'],
    sampleDocs: [{ title: 'Runbook', mimeType: 'text/markdown' }],
    sampleMedia: [],
    defaultRole: 'admin',
    featured: true,
  },
  {
    id: 'tpl:customer-support',
    slug: 'customer-support',
    name: 'Customer Support',
    description: 'Inbox triage, response drafting, sentiment monitoring, HITL approval gates.',
    icon: 'audio',
    category: 'support',
    surfaces: ['chat', 'docs', 'automation', 'agents'],
    automationSlugs: [
      'route-message-to-slack',
      'route-message-to-email',
      'monitor-sentiment',
      'daily-digest',
    ],
    agentSlugs: ['inbox-triager'],
    sampleDocs: [
      { title: 'Knowledge Base', mimeType: 'text/markdown' },
      { title: 'Response Templates', mimeType: 'text/markdown' },
    ],
    sampleMedia: [],
    defaultRole: 'editor',
    featured: false,
  },
  {
    id: 'tpl:personal-workspace',
    slug: 'personal-workspace',
    name: 'Personal Workspace',
    description: 'Lightweight setup for solo use — notes, daily digest, quick captures.',
    icon: '',
    category: 'personal',
    surfaces: ['chat', 'docs', 'automation'],
    automationSlugs: ['daily-digest', 'summarize-new-doc'],
    agentSlugs: [],
    sampleDocs: [
      { title: 'My Notes', mimeType: 'text/markdown', inlineContent: '# My Notes\n\n- ' },
    ],
    sampleMedia: [],
    defaultRole: 'admin',
    featured: false,
  },
  {
    id: 'tpl:knowledge-base',
    slug: 'knowledge-base',
    name: 'Knowledge Base',
    description: 'Document repository with full-text search, indexing, and archival.',
    icon: 'layers',
    category: 'team',
    surfaces: ['docs', 'automation', 'agents'],
    automationSlugs: ['index-doc', 'archive-old-docs', 'compare-docs', 'redact-pii'],
    agentSlugs: ['research-assistant'],
    sampleDocs: [
      { title: 'README', mimeType: 'text/markdown' },
      { title: 'Architecture', mimeType: 'text/markdown' },
      { title: 'API Reference', mimeType: 'text/markdown' },
    ],
    sampleMedia: [],
    defaultRole: 'editor',
    featured: false,
  },
]
