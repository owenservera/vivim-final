import type { ZLayerId } from '@/shared/z-layer';

export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  ok: boolean;
  messageId: string;
  blocks: Array<Record<string, unknown>>;
  text: string;
  latencyMs: number;
  timing?: Record<string, unknown>;
  error?: string;
}

export interface Capability {
  id: string;
  slug: string;
  name: string;
  description?: string;
  surfaces?: string[];
  category?: string;
  action?: string;
}

export interface Provider {
  id: string;
  name: string;
  slug: string;
  status?: string;
  capabilities?: string[];
}

export interface HealthStatus {
  status: string;
  version?: string;
  uptime?: number;
}

// ── Composer Instance Scope (stateful role context) ──────────────────────

export type ComposerBehavior = 'chat' | 'search' | 'execute' | 'prompt' | 'command' | 'comment';

export interface ComposerInstanceScope {
  workspaceId: string;
  surfaceSlug: string;
  regionSlotId: string;
  activeZLayer: ZLayerId;
  instanceId: string;
  behavior: ComposerBehavior;
}

// ── Composer Add-on model ────────────────────────────────────────────────

export type ComposerAddOnPosition = 'top' | 'bottom' | 'inline';

export interface ComposerAddOn {
  key: string;
  position: ComposerAddOnPosition;
  Component: React.ComponentType<AddOnProps>;
  label: string;
  icon?: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface CapabilityToggle {
  slug: string;
  name: string;
  enabled: boolean;
}

export interface SlashCommand {
  id: string;
  label: string;
  description?: string;
}

export interface MentionTarget {
  id: string;
  label: string;
  type: 'agent' | 'tool' | 'memory' | 'file';
}

export interface Attachment {
  id: string;
  file: File;
  previewUrl?: string;
}

export interface QuotedMessage {
  id: string;
  role: 'user' | 'assistant';
  snippet: string;
}

export interface AddOnProps {
  context: ComposerShellContext;
}

export interface ComposerShellContext {
  scope: ComposerInstanceScope;
  providerId: string | null;
  models: ModelOption[];
  selectedModel: ModelOption | null;
  setModel: (m: ModelOption) => void;
  capabilities: CapabilityToggle[];
  toggleCapability: (slug: string) => void;
  attachments: Attachment[];
  addAttachment: (file: File) => void;
  removeAttachment: (id: string) => void;
  quotedMessage: QuotedMessage | null;
  setQuote: (msg: QuotedMessage | null) => void;
  isStreaming: boolean;
  stopStreaming: () => void;
  enabledAddOns: string[];
  toggleAddOn: (key: string) => void;
}

export interface ComposerUserConfig {
  enabledAddOns: string[];
  showToggleMenu: boolean;
}
