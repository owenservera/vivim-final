// src/engines/capability-taxonomy.ts
// Unit 5.4 — Capability taxonomy v2 — formal catalog of AI-site actions

import type { CapabilitySurface } from './unified-registry.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapabilityTaxonomyEntry {
  id: string
  slug: string
  name: string
  category: 'conversation' | 'model' | 'tools' | 'context' | 'export' | 'media' | 'navigation'
  intentPatterns: string[]
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  uiContract: Record<string, unknown>
  surfaces: CapabilitySurface[]
  baseShape?: string
}

// ── Taxonomy Catalog (~60 entries) ─────────────────────────────────────────────

export const CAPABILITY_TAXONOMY_V2: CapabilityTaxonomyEntry[] = [
  // Conversation
  {
    id: 'cap:conversation:send_message',
    slug: 'send_message',
    name: 'Send Message',
    category: 'conversation',
    intentPatterns: ['send a message', 'reply', 'ask the model', 'chat with', 'tell the assistant'],
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
    outputSchema: { type: 'object' },
    uiContract: { control: 'composer', placeholder: 'Type a message...', hotkey: 'Enter' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:conversation:read_response',
    slug: 'read_response',
    name: 'Read Response',
    category: 'conversation',
    intentPatterns: ['read response', 'show reply', 'display answer'],
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object' },
    uiContract: { control: 'message-display' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:conversation:edit_message',
    slug: 'edit_message',
    name: 'Edit Message',
    category: 'conversation',
    intentPatterns: ['edit message', 'modify message', 'change my message'],
    inputSchema: {
      type: 'object',
      properties: { messageId: { type: 'string' }, newContent: { type: 'string' } },
      required: ['messageId', 'newContent'],
    },
    outputSchema: { type: 'object' },
    uiContract: { control: 'message-editor' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:conversation:regenerate_response',
    slug: 'regenerate_response',
    name: 'Regenerate Response',
    category: 'conversation',
    intentPatterns: ['regenerate', 'try again', 'new answer'],
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object' },
    uiContract: { control: 'action-button' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:conversation:new_chat',
    slug: 'new_chat',
    name: 'New Chat',
    category: 'conversation',
    intentPatterns: ['new chat', 'start conversation', 'create chat'],
    inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
    outputSchema: { type: 'object' },
    uiContract: { control: 'fab-button' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },

  // Model
  {
    id: 'cap:model:select_model',
    slug: 'select_model',
    name: 'Select Model',
    category: 'model',
    intentPatterns: ['use gpt-4', 'switch to claude', 'select model', 'change model'],
    inputSchema: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'] },
    outputSchema: { type: 'object' },
    uiContract: { control: 'dropdown' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:model:toggle_web_search',
    slug: 'toggle_web_search',
    name: 'Toggle Web Search',
    category: 'model',
    intentPatterns: ['enable web search', 'turn on browsing', 'disable search'],
    inputSchema: {
      type: 'object',
      properties: { enabled: { type: 'boolean' } },
      required: ['enabled'],
    },
    outputSchema: { type: 'object' },
    uiContract: { control: 'toggle-switch' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:model:toggle_extended_thinking',
    slug: 'toggle_extended_thinking',
    name: 'Toggle Extended Thinking',
    category: 'model',
    intentPatterns: ['enable thinking', 'show reasoning', 'toggle thinking mode'],
    inputSchema: {
      type: 'object',
      properties: { enabled: { type: 'boolean' } },
      required: ['enabled'],
    },
    outputSchema: { type: 'object' },
    uiContract: { control: 'toggle-switch' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },

  // Tools
  {
    id: 'cap:tools:run_code',
    slug: 'run_code',
    name: 'Run Code',
    category: 'tools',
    intentPatterns: ['execute this code', 'run the snippet', 'run python', 'execute script'],
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string' }, lang: { type: 'string' } },
      required: ['code'],
    },
    outputSchema: { type: 'object', properties: { output: { type: 'string' } } },
    uiContract: { control: 'code-runner' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:tools:upload_file',
    slug: 'upload_file',
    name: 'Upload File',
    category: 'tools',
    intentPatterns: ['upload file', 'attach file', 'add attachment'],
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    outputSchema: { type: 'object' },
    uiContract: { control: 'file-upload' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:tools:deep_research',
    slug: 'deep_research',
    name: 'Deep Research',
    category: 'tools',
    intentPatterns: ['research this', 'deep dive', 'investigate topic'],
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    outputSchema: { type: 'object' },
    uiContract: { control: 'action-button' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },

  // Context / Memory
  {
    id: 'cap:context:clear_context',
    slug: 'clear_context',
    name: 'Clear Context',
    category: 'context',
    intentPatterns: ['clear context', 'reset conversation', 'start fresh'],
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object' },
    uiContract: { control: 'action-button', confirm: true },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:context:memory_recall',
    slug: 'memory_recall',
    name: 'Memory Recall',
    category: 'context',
    intentPatterns: ['recall memory', 'remember when', 'what did I say about'],
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    outputSchema: { type: 'object' },
    uiContract: { control: 'search-input' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:context:memory_store',
    slug: 'memory_store',
    name: 'Memory Store',
    category: 'context',
    intentPatterns: ['remember this', 'store memory', 'save to memory'],
    inputSchema: {
      type: 'object',
      properties: { content: { type: 'string' }, tags: { type: 'array' } },
      required: ['content'],
    },
    outputSchema: { type: 'object' },
    uiContract: { control: 'text-input' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },

  // Export
  {
    id: 'cap:export:export_conversation',
    slug: 'export_conversation',
    name: 'Export Conversation',
    category: 'export',
    intentPatterns: ['export chat', 'save conversation', 'download transcript'],
    inputSchema: {
      type: 'object',
      properties: { format: { type: 'string', enum: ['json', 'markdown', 'text'] } },
    },
    outputSchema: { type: 'object' },
    uiContract: { control: 'action-button' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },

  // Media
  {
    id: 'cap:media:image_generate',
    slug: 'image_generate',
    name: 'Image Generate',
    category: 'media',
    intentPatterns: ['generate image', 'create picture', 'draw this'],
    inputSchema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
    outputSchema: { type: 'object', properties: { url: { type: 'string' } } },
    uiContract: { control: 'text-input' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },

  // Navigation & Chat Management
  {
    id: 'cap:navigation:delete_chat',
    slug: 'delete_chat',
    name: 'Delete Chat',
    category: 'navigation',
    intentPatterns: ['delete chat', 'remove conversation', 'delete this chat'],
    inputSchema: { type: 'object', properties: { chatId: { type: 'string' } } },
    outputSchema: { type: 'object' },
    uiContract: { control: 'action-button', confirm: true },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:navigation:rename_chat',
    slug: 'rename_chat',
    name: 'Rename Chat',
    category: 'navigation',
    intentPatterns: ['rename chat', 'change title', 'rename conversation'],
    inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    outputSchema: { type: 'object' },
    uiContract: { control: 'text-input' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:navigation:list_conversations',
    slug: 'list_conversations',
    name: 'List Conversations',
    category: 'navigation',
    intentPatterns: ['list chats', 'show conversations', 'list all threads'],
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object' },
    uiContract: { control: 'list-view' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:navigation:search_messages',
    slug: 'search_messages',
    name: 'Search Messages',
    category: 'navigation',
    intentPatterns: ['search messages', 'find conversation', 'search chat history'],
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    outputSchema: { type: 'object' },
    uiContract: { control: 'search-input' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
  {
    id: 'cap:navigation:create_new_chat',
    slug: 'create_new_chat',
    name: 'Create New Chat',
    category: 'navigation',
    intentPatterns: ['create new chat', 'start fresh conversation', 'new thread'],
    inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
    outputSchema: { type: 'object' },
    uiContract: { control: 'fab-button' },
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
  },
]
