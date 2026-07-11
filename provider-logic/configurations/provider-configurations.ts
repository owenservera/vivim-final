// provider-logic/configurations/provider-configurations.ts
// Provider-specific configuration patterns and constants

export interface ProviderConfiguration {
  slug: string
  displayName: string
  authType: 'browser' | 'api' | 'hybrid'
  hasMultiAccount: boolean
  profileStrategy: string
  portRange: [number, number]
  extraArgs: string[]
  capabilities: string[]
  endpoints: {
    type: string
    url: string
    selectors?: Record<string, string>
  }[]
  models: {
    slug: string
    displayName: string
    contextWindow: number
    maxOutputTokens: number
    supportsStreaming: boolean
    supportsVision?: boolean
    supportsThinking?: boolean
    supportsTools?: boolean
  }[]
}

// ChatGPT Configuration
export const CHATGPT_CONFIG: ProviderConfiguration = {
  slug: 'chatgpt',
  displayName: 'ChatGPT',
  authType: 'browser',
  hasMultiAccount: true,
  profileStrategy: 'per_account',
  portRange: [9252, 9280],
  extraArgs: ['--no-first-run'],
  capabilities: [
    'select_model',
    'send_message',
    'edit_message',
    'regenerate_response',
    'upload_file',
    'create_new_chat',
    'navigate_chat',
    'delete_chat',
    'rename_chat',
    'browse_with_bing',
  ],
  endpoints: [
    {
      type: 'landing',
      url: 'https://chatgpt.com',
    },
    {
      type: 'chat',
      url: 'https://chatgpt.com',
      selectors: {
        composer: '#prompt-textarea',
        send_button: "[data-testid='send-button']",
      },
    },
    {
      type: 'login',
      url: 'https://chatgpt.com/auth/login',
      selectors: {
        email_input: "input[name='email']",
        continue_button: "button[type='submit']",
      },
    },
  ],
  models: [
    {
      slug: 'gpt-4o',
      displayName: 'GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
    },
    {
      slug: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
    },
    {
      slug: 'o3',
      displayName: 'o3',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
    {
      slug: 'o4-mini',
      displayName: 'o4-mini',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
  ],
}

// Claude Configuration
export const CLAUDE_CONFIG: ProviderConfiguration = {
  slug: 'claude',
  displayName: 'Claude',
  authType: 'browser',
  hasMultiAccount: true,
  profileStrategy: 'per_account',
  portRange: [9222, 9250],
  extraArgs: ['--disable-features=Translate', '--no-first-run'],
  capabilities: [
    'select_model',
    'send_message',
    'edit_message',
    'regenerate_response',
    'toggle_extended_thinking',
    'upload_file',
    'create_new_chat',
    'navigate_chat',
    'delete_chat',
    'rename_chat',
    'deep_research',
  ],
  endpoints: [
    {
      type: 'landing',
      url: 'https://claude.ai',
    },
    {
      type: 'chat',
      url: 'https://claude.ai/chat',
      selectors: {
        composer: '[contenteditable]',
        send_button: "[aria-label='Send Message']",
      },
    },
    {
      type: 'login',
      url: 'https://claude.ai/login',
      selectors: {
        email_input: "input[type='email']",
        continue_button: "button[type='submit']",
      },
    },
  ],
  models: [
    {
      slug: 'claude-sonnet-4-20250514',
      displayName: 'Sonnet 4',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
    {
      slug: 'claude-opus-4-20250514',
      displayName: 'Opus 4',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
    {
      slug: 'claude-haiku-4-20250514',
      displayName: 'Haiku 4',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
    },
  ],
}

// DeepSeek Configuration
export const DEEPSEEK_CONFIG: ProviderConfiguration = {
  slug: 'deepseek',
  displayName: 'DeepSeek',
  authType: 'browser',
  hasMultiAccount: false,
  profileStrategy: 'per_account',
  portRange: [9312, 9340],
  extraArgs: [],
  capabilities: [
    'send_message',
    'edit_message',
    'regenerate_response',
    'create_new_chat',
    'navigate_chat',
    'delete_chat',
    'rename_chat',
  ],
  endpoints: [
    {
      type: 'landing',
      url: 'https://chat.deepseek.com',
    },
    {
      type: 'chat',
      url: 'https://chat.deepseek.com',
      selectors: {
        composer: 'textarea',
        send_button: "button[aria-label='Send']",
      },
    },
    {
      type: 'login',
      url: 'https://chat.deepseek.com/sign_in',
      selectors: {
        email_input: "input[type='email']",
        continue_button: "button[type='submit']",
      },
    },
  ],
  models: [
    {
      slug: 'deepseek-chat',
      displayName: 'DeepSeek Chat (V3)',
      contextWindow: 65536,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
    },
    {
      slug: 'deepseek-reasoner',
      displayName: 'DeepSeek Reasoner (R1)',
      contextWindow: 65536,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsThinking: true,
    },
  ],
}

// Gemini Configuration
export const GEMINI_CONFIG: ProviderConfiguration = {
  slug: 'gemini',
  displayName: 'Gemini',
  authType: 'browser',
  hasMultiAccount: true,
  profileStrategy: 'per_account',
  portRange: [9282, 9310],
  extraArgs: ['--no-first-run'],
  capabilities: [
    'select_model',
    'send_message',
    'edit_message',
    'regenerate_response',
    'upload_file',
    'create_new_chat',
    'navigate_chat',
    'delete_chat',
    'rename_chat',
  ],
  endpoints: [
    {
      type: 'landing',
      url: 'https://gemini.google.com',
    },
    {
      type: 'chat',
      url: 'https://gemini.google.com/app',
      selectors: {
        composer: '.ql-editor',
        send_button: "button[aria-label='Send message']",
      },
    },
    {
      type: 'login',
      url: 'https://accounts.google.com',
    },
  ],
  models: [
    {
      slug: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
    {
      slug: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
    {
      slug: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
    },
  ],
}

// Qwen Configuration
export const QWEN_CONFIG: ProviderConfiguration = {
  slug: 'qwen',
  displayName: 'Qwen',
  authType: 'browser',
  hasMultiAccount: false,
  profileStrategy: 'per_account',
  portRange: [9372, 9400],
  extraArgs: [],
  capabilities: ['send_message', 'select_model', 'create_new_chat', 'navigate_chat'],
  endpoints: [
    {
      type: 'landing',
      url: 'https://tongyi.aliyun.com',
    },
    {
      type: 'chat',
      url: 'https://tongyi.aliyun.com/qianwen',
      selectors: {
        composer: 'textarea',
        send_button: "button[aria-label='Send']",
      },
    },
  ],
  models: [
    {
      slug: 'qwen-max',
      displayName: 'Qwen Max',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
    },
    {
      slug: 'qwen-plus',
      displayName: 'Qwen Plus',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
    },
    {
      slug: 'qwen-turbo',
      displayName: 'Qwen Turbo',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportsStreaming: true,
    },
  ],
}

// Studio AI Configuration
export const STUDIO_AI_CONFIG: ProviderConfiguration = {
  slug: 'studio-ai',
  displayName: 'Studio AI',
  authType: 'browser',
  hasMultiAccount: false,
  profileStrategy: 'per_account',
  portRange: [9342, 9370],
  extraArgs: [],
  capabilities: ['send_message', 'select_model', 'create_new_chat', 'navigate_chat'],
  endpoints: [
    {
      type: 'landing',
      url: 'https://aistudio.google.com',
    },
    {
      type: 'chat',
      url: 'https://aistudio.google.com/prompts/new_chat',
      selectors: {
        composer: 'rich-textarea',
        send_button: "button[aria-label='Send message']",
      },
    },
  ],
  models: [
    {
      slug: 'gemini-2.5-pro-preview',
      displayName: 'Gemini 2.5 Pro Preview',
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      supportsStreaming: true,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true,
    },
    {
      slug: 'gemini-2.5-flash-preview',
      displayName: 'Gemini 2.5 Flash Preview',
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
    },
  ],
}

// Z AI Configuration
export const Z_AI_CONFIG: ProviderConfiguration = {
  slug: 'z-ai',
  displayName: 'Z AI',
  authType: 'api',
  hasMultiAccount: false,
  profileStrategy: 'shared',
  portRange: [0, 0], // API-based, no Chrome ports needed
  extraArgs: [],
  capabilities: ['send_message', 'select_model'],
  endpoints: [
    {
      type: 'api',
      url: 'https://api.z.ai/v1',
    },
  ],
  models: [
    {
      slug: 'z-ai-default',
      displayName: 'Z AI Default',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
    },
  ],
}

// Provider configurations map
export const PROVIDER_CONFIGURATIONS: Record<string, ProviderConfiguration> = {
  chatgpt: CHATGPT_CONFIG,
  claude: CLAUDE_CONFIG,
  deepseek: DEEPSEEK_CONFIG,
  gemini: GEMINI_CONFIG,
  qwen: QWEN_CONFIG,
  'studio-ai': STUDIO_AI_CONFIG,
  'z-ai': Z_AI_CONFIG,
}

// Provider-specific recovery strategies
export interface RecoveryStrategy {
  type: string
  config?: Record<string, unknown>
}

export const PROVIDER_RECOVERY_STRATEGIES: Record<string, RecoveryStrategy[]> = {
  chatgpt: [
    { type: 'retry_selector' },
    { type: 'retry_with_fallback', config: { fallback_selector: 'textarea' } },
    { type: 'navigate_home' },
  ],
  claude: [
    { type: 'retry_selector' },
    { type: 'retry_with_fallback', config: { fallback_selector: 'textarea' } },
    { type: 'navigate_home' },
  ],
  deepseek: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
  gemini: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
  qwen: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
  'studio-ai': [{ type: 'retry_selector' }, { type: 'navigate_home' }],
  'z-ai': [{ type: 'retry_selector' }],
}

// Provider-specific capability overrides
export interface CapabilityOverride {
  globalCapabilityId: string
  uiComponentOverride: string
  uiLabelOverride: string
  uiIconOverride?: string
  uiPositionOverride: string
  uiPriorityOverride: string
  minPlanTierOverride?: string
}

export const PROVIDER_CAPABILITY_OVERRIDES: Record<string, CapabilityOverride[]> = {
  chatgpt: [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to ChatGPT',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
    {
      globalCapabilityId: 'select_model',
      uiComponentOverride: 'dropdown_selector',
      uiLabelOverride: 'Select GPT Model',
      uiIconOverride: 'cpu',
      uiPositionOverride: 'header',
      uiPriorityOverride: 'primary',
    },
  ],
  claude: [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to Claude',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
    {
      globalCapabilityId: 'select_model',
      uiComponentOverride: 'dropdown_selector',
      uiLabelOverride: 'Select Claude Model',
      uiIconOverride: 'cpu',
      uiPositionOverride: 'header',
      uiPriorityOverride: 'primary',
    },
    {
      globalCapabilityId: 'toggle_extended_thinking',
      uiComponentOverride: 'toggle_switch',
      uiLabelOverride: 'Extended Thinking',
      uiPositionOverride: 'header',
      uiPriorityOverride: 'secondary',
    },
    {
      globalCapabilityId: 'deep_research',
      uiComponentOverride: 'action_button',
      uiLabelOverride: 'Deep Research',
      uiIconOverride: 'flask',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'secondary',
      minPlanTierOverride: 'pro',
    },
  ],
  deepseek: [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to DeepSeek',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
  ],
  gemini: [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to Gemini',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
    {
      globalCapabilityId: 'select_model',
      uiComponentOverride: 'dropdown_selector',
      uiLabelOverride: 'Select Gemini Model',
      uiIconOverride: 'cpu',
      uiPositionOverride: 'header',
      uiPriorityOverride: 'primary',
    },
  ],
  qwen: [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to Qwen',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
    {
      globalCapabilityId: 'select_model',
      uiComponentOverride: 'dropdown_selector',
      uiLabelOverride: 'Select Qwen Model',
      uiIconOverride: 'cpu',
      uiPositionOverride: 'header',
      uiPriorityOverride: 'primary',
    },
  ],
  'studio-ai': [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to Studio AI',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
    {
      globalCapabilityId: 'select_model',
      uiComponentOverride: 'dropdown_selector',
      uiLabelOverride: 'Select Model',
      uiIconOverride: 'cpu',
      uiPositionOverride: 'header',
      uiPriorityOverride: 'primary',
    },
  ],
  'z-ai': [
    {
      globalCapabilityId: 'send_message',
      uiComponentOverride: 'text_input',
      uiLabelOverride: 'Send to Z AI',
      uiIconOverride: 'arrow-up-circle',
      uiPositionOverride: 'composer',
      uiPriorityOverride: 'primary',
    },
  ],
}