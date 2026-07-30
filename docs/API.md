<![CDATA[<div align="center">

# Vivim API Reference

**Complete REST API and WebSocket documentation**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [REST API](#rest-api)
- [WebSocket](#websocket)
- [Server-Sent Events](#server-sent-events)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

---

## Overview

Vivim provides a comprehensive API for interacting with the platform:

- **REST API** — CRUD operations for conversations, messages, and providers
- **WebSocket** — Real-time streaming of messages and blocks
- **SSE** — Event notifications for system events

---

## Authentication

### API Keys

Vivim uses API keys for provider authentication. These are stored locally and managed by the user.

```bash
# Configure via environment variable
OPENAI_API_KEY=sk-...

# Or via Settings UI
Settings → Providers → ChatGPT → API Key
```

### Vivim API (Optional)

If you enable API authentication:

```bash
# Generate API key
bun run devops api-key generate

# Use in requests
curl -H "Authorization: Bearer vivim_api_key_here" http://localhost:9420/api/...
```

---

## Base URL

```
http://localhost:9420
```

All API endpoints are relative to this base URL.

---

## REST API

### Conversations

#### List Conversations

```http
GET /api/conversations
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Maximum conversations to return |
| `offset` | number | 0 | Offset for pagination |
| `provider` | string | - | Filter by provider |

**Response:**

```json
{
  "conversations": [
    {
      "id": "conv_123",
      "title": "Chat about AI",
      "providerId": "claude",
      "createdAt": "2026-07-30T12:00:00Z",
      "updatedAt": "2026-07-30T12:05:00Z",
      "messageCount": 10
    }
  ],
  "total": 100,
  "hasMore": true
}
```

#### Create Conversation

```http
POST /api/conversations
```

**Request Body:**

```json
{
  "title": "New Conversation",
  "providerId": "claude",
  "metadata": {
    "model": "claude-3-5-sonnet-20241022"
  }
}
```

**Response:**

```json
{
  "id": "conv_456",
  "title": "New Conversation",
  "providerId": "claude",
  "createdAt": "2026-07-30T12:00:00Z",
  "updatedAt": "2026-07-30T12:00:00Z"
}
```

#### Get Conversation

```http
GET /api/conversations/:id
```

**Response:**

```json
{
  "id": "conv_123",
  "title": "Chat about AI",
  "providerId": "claude",
  "messages": [
    {
      "id": "msg_789",
      "role": "user",
      "content": "What is AI?",
      "createdAt": "2026-07-30T12:00:00Z"
    },
    {
      "id": "msg_790",
      "role": "assistant",
      "content": "AI stands for Artificial Intelligence...",
      "createdAt": "2026-07-30T12:00:05Z"
    }
  ]
}
```

#### Delete Conversation

```http
DELETE /api/conversations/:id
```

**Response:**

```json
{
  "success": true
}
```

### Messages

#### Send Message

```http
POST /api/conversations/:id/send
```

**Request Body:**

```json
{
  "content": "Hello, Claude!",
  "stream": true
}
```

**Response (Streaming):**

The response is streamed via WebSocket or SSE. See [Streaming](#streaming) section.

**Response (Non-streaming):**

```json
{
  "id": "msg_791",
  "role": "user",
  "content": "Hello, Claude!",
  "createdAt": "2026-07-30T12:00:00Z"
}
```

#### List Messages

```http
GET /api/conversations/:id/messages
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Maximum messages to return |
| `offset` | number | 0 | Offset for pagination |

**Response:**

```json
{
  "messages": [
    {
      "id": "msg_789",
      "role": "user",
      "content": "What is AI?",
      "createdAt": "2026-07-30T12:00:00Z",
      "blocks": []
    }
  ],
  "total": 50,
  "hasMore": true
}
```

### Providers

#### List Providers

```http
GET /api/providers
```

**Response:**

```json
{
  "providers": [
    {
      "id": "prov_001",
      "slug": "claude",
      "name": "Claude",
      "status": "active",
      "models": [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229"
      ],
      "capabilities": ["send_message", "select_model"]
    }
  ]
}
```

#### Get Provider

```http
GET /api/providers/:slug
```

**Response:**

```json
{
  "id": "prov_001",
  "slug": "claude",
  "name": "Claude",
  "status": "active",
  "config": {
    "apiKey": "sk-ant-...",
    "model": "claude-3-5-sonnet-20241022"
  },
  "health": {
    "latency": 150,
    "lastCheck": "2026-07-30T12:00:00Z",
    "uptime": 99.9
  }
}
```

#### Update Provider

```http
PATCH /api/providers/:slug
```

**Request Body:**

```json
{
  "config": {
    "model": "claude-3-opus-20240229"
  }
}
```

### Capabilities

#### List Capabilities

```http
GET /api/capabilities
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `surface` | string | - | Filter by surface (cli, api, mcp, ui) |

**Response:**

```json
{
  "capabilities": [
    {
      "id": "cap:chat:send_message",
      "slug": "send_message",
      "name": "Send Message",
      "description": "Send a message to a provider",
      "surfaces": ["cli", "api", "mcp", "ui"],
      "inputSchema": {
        "type": "object",
        "properties": {
          "content": { "type": "string" },
          "provider": { "type": "string" }
        }
      }
    }
  ]
}
```

#### Execute Capability

```http
POST /api/capabilities/:id/execute
```

**Request Body:**

```json
{
  "input": {
    "content": "Hello, Claude!",
    "provider": "claude"
  }
}
```

**Response:**

```json
{
  "executionId": "exec_123",
  "status": "completed",
  "result": {
    "messageId": "msg_791",
    "content": "Hello! How can I help you today?"
  }
}
```

#### Natural Language Interpretation

```http
POST /api/interpret
```

**Request Body:**

```json
{
  "nl": "Send a message to Claude asking about quantum computing",
  "context": {
    "conversationId": "conv_123"
  }
}
```

**Response:**

```json
{
  "capabilityId": "cap:chat:send_message",
  "confidence": 0.95,
  "resolvedInput": {
    "content": "Tell me about quantum computing",
    "provider": "claude"
  },
  "execution": {
    "id": "exec_456",
    "status": "completed"
  }
}
```

---

## WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://localhost:9420/ws');

ws.onopen = () => {
  console.log('Connected to Vivim');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Subscribe to Conversation

```json
{
  "type": "subscribe",
  "conversationId": "conv_123"
}
```

### Unsubscribe from Conversation

```json
{
  "type": "unsubscribe",
  "conversationId": "conv_123"
}
```

### Message Events

```json
{
  "type": "message.new",
  "conversationId": "conv_123",
  "message": {
    "id": "msg_791",
    "role": "assistant",
    "content": "",
    "createdAt": "2026-07-30T12:00:00Z"
  }
}
```

### Block Events

```json
{
  "type": "block.new",
  "conversationId": "conv_123",
  "messageId": "msg_791",
  "block": {
    "id": "blk_001",
    "type": "text",
    "content": "Hello!",
    "metadata": {
      "confidence": 0.98
    }
  }
}
```

### Stream Completion

```json
{
  "type": "stream.complete",
  "conversationId": "conv_123",
  "messageId": "msg_791",
  "stats": {
    "totalBlocks": 15,
    "duration": 2500,
    "tokens": 150
  }
}
```

---

## Server-Sent Events

### Connection

```javascript
const eventSource = new EventSource('http://localhost:9420/api/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `message.new` | New message created | `{ conversationId, message }` |
| `block.new` | New block added | `{ conversationId, messageId, block }` |
| `provider.status` | Provider status changed | `{ provider, status, latency }` |
| `capability.run` | Capability executing | `{ capabilityId, input, status }` |
| `system.health` | System health update | `{ cpu, memory, uptime }` |

### Event Format

```
event: message.new
data: {"conversationId":"conv_123","message":{"id":"msg_791"}}

event: block.new
data: {"conversationId":"conv_123","block":{"type":"text","content":"Hello"}}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'invalid-provider' not found",
    "details": {
      "provider": "invalid-provider"
    }
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `429` | Rate Limited |
| `500` | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| `PROVIDER_NOT_FOUND` | Provider does not exist |
| `PROVIDER_OFFLINE` | Provider is not responding |
| `INVALID_API_KEY` | API key is invalid |
| `CONVERSATION_NOT_FOUND` | Conversation does not exist |
| `CAPABILITY_NOT_FOUND` | Capability does not exist |
| `CAPABILITY_EXECUTION_FAILED` | Capability execution failed |
| `RATE_LIMITED` | Rate limit exceeded |

---

## Rate Limits

### Provider Rate Limits

Each provider has its own rate limits:

| Provider | Requests/min | Tokens/min |
|----------|--------------|------------|
| ChatGPT | 60 | 150,000 |
| Claude | 60 | 100,000 |
| Gemini | 60 | 120,000 |

### Vivim Rate Limits

Vivim applies its own rate limits:

| Endpoint | Limit |
|----------|-------|
| `/api/conversations` | 100 req/min |
| `/api/messages` | 300 req/min |
| `/api/capabilities` | 60 req/min |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1690732800
```

---

## SDKs

### JavaScript/TypeScript

```typescript
import { VivimClient } from '@vivim/sdk';

const client = new VivimClient('http://localhost:9420');

// List conversations
const conversations = await client.conversations.list();

// Send message
const message = await client.conversations.sendMessage('conv_123', {
  content: 'Hello!',
  provider: 'claude'
});

// Stream response
for await (const block of client.conversations.stream('conv_123')) {
  console.log(block.content);
}
```

### Python

```python
from vivim import VivimClient

client = VivimClient('http://localhost:9420')

# List conversations
conversations = client.conversations.list()

# Send message
message = client.conversations.send_message('conv_123', content='Hello!')
```

### CLI

```bash
# List conversations
bun run devops runtime-test test --nl="list conversations"

# Send message
bun run devops runtime-test test --nl="send message to claude"

# Execute capability
bun run devops runtime-test test --nl="execute capability send_message"
```

---

## Examples

### Complete Chat Flow

```javascript
// 1. Create conversation
const conv = await fetch('/api/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Chat',
    providerId: 'claude'
  })
}).then(r => r.json());

// 2. Send message
await fetch(`/api/conversations/${conv.id}/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Hello, Claude!',
    stream: true
  })
});

// 3. Listen for streaming response
const ws = new WebSocket('ws://localhost:9420/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    conversationId: conv.id
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'block.new') {
    console.log(data.block.content);
  }
};
```

### Capability Execution

```javascript
// Execute capability via natural language
const result = await fetch('/api/interpret', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nl: 'Switch to Gemini and ask about the weather'
  })
}).then(r => r.json());

console.log(result.capabilityId); // "cap:chat:send_message"
console.log(result.confidence);   // 0.92
```

---

<div align="center">

**[Back to README](../README.md)** • **[User Guide](USER-GUIDE.md)** • **[Architecture](ARCHITECTURE.md)**

</div>
]]>