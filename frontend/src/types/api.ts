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
