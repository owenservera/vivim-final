import { vi } from 'vitest';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
  streaming?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Mock message factory
export function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    role: 'user',
    content: 'Test message',
    timestamp: Date.now(),
    ...overrides,
  };
}

// Mock assistant message
export function createMockAssistantMessage(content: string = 'Test response'): Message {
  return createMockMessage({
    role: 'assistant',
    content,
    provider: 'chatgpt',
    model: 'gpt-4',
  });
}

// Mock streaming message
export function createMockStreamingMessage(): Message {
  return createMockMessage({
    role: 'assistant',
    content: '',
    streaming: true,
    provider: 'chatgpt',
    model: 'gpt-4',
  });
}

// Mock provider option
export function createMockProvider(slug: string = 'chatgpt') {
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    models: [
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model', maxTokens: 8192 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient', maxTokens: 4096 },
    ],
    enabled: true,
  };
}

// Mock WebSocket message
export function createMockWebSocketMessage(type: string = 'text', payload: Record<string, unknown> = {}) {
  return {
    type,
    payload: { text: 'Hello', ...payload },
    conversationId: `conv_${Date.now()}`,
    messageId: `msg_${Date.now()}`,
    timestamp: Date.now(),
  };
}

// Mock fetch response
export function createMockFetchResponse(data: unknown, status: number = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response;
}

// Setup fetch mock for specific endpoint
export function mockFetchEndpoint(endpoint: string, response: unknown, status: number = 200) {
  const mockFetch = vi.fn().mockImplementation((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes(endpoint)) {
      return Promise.resolve(createMockFetchResponse(response, status));
    }
    return Promise.resolve(createMockFetchResponse({ error: 'Not found' }, 404));
  });

  // Add preconnect method to match the full fetch type
  const fetchWithPreconnect = mockFetch as unknown as typeof fetch & { preconnect: () => void };
  fetchWithPreconnect.preconnect = () => {};

  global.fetch = fetchWithPreconnect;
  return mockFetch;
}

// Mock useUnifiedIO hook
export function mockUseUnifiedIO() {
  return {
    fetch: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue({}),
    isLoading: false,
    error: null,
  };
}

// Mock useWebSocket hook
export function mockUseWebSocket() {
  return {
    isConnected: true,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    send: vi.fn(),
    lastMessage: null,
  };
}
