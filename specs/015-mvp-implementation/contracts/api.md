# API Contracts: MVP Implementation

**Date:** 2026-07-17

## Conversation API

### GET /api/conversations
```json
// Response
{
  "conversations": [
    {
      "id": "01HXY...",
      "title": "New Conversation",
      "providerId": "chatgpt",
      "updatedAt": "2026-07-17T20:00:00Z",
      "messageCount": 12
    }
  ],
  "total": 42
}
```

### POST /api/conversations
```json
// Request
{
  "title": "My Chat",
  "providerId": "chatgpt"
}

// Response
{
  "id": "01HXY...",
  "title": "My Chat",
  "providerId": "chatgpt",
  "createdAt": "2026-07-17T20:00:00Z"
}
```

### GET /api/conversations/:id
```json
// Response
{
  "id": "01HXY...",
  "title": "My Chat",
  "providerId": "chatgpt",
  "messages": [
    {
      "id": "01HXZ...",
      "role": "user",
      "content": "Hello, how are you?",
      "createdAt": "2026-07-17T20:00:00Z"
    },
    {
      "id": "01HX...",
      "role": "assistant",
      "content": "I'm doing well! How can I help?",
      "createdAt": "2026-07-17T20:00:01Z"
    }
  ],
  "createdAt": "2026-07-17T20:00:00Z"
}
```

### POST /api/conversations/:id/send
```json
// Request
{
  "content": "What is TypeScript?",
  "providerId": "chatgpt"
}

// Response
{
  "messageId": "01HX...",
  "status": "streaming",
  "streamUrl": "/api/conversations/:id/stream-blocks?messageId=01HX..."
}
```

### GET /api/conversations/:id/stream-blocks
Returns ContentBlock[] as newline-delimited JSON (NDJSON) for streaming.

```json
// Response (stream)
{"kind":"thinking","content":"Let me think about this...","index":0}
{"kind":"text","content":"TypeScript is a typed superset of JavaScript...","index":1}
{"kind":"code","content":"const x: number = 42;","language":"typescript","index":2}
{"kind":"meta","key":"totalTokens","value":156,"index":3}
```

### POST /api/conversations/search
```json
// Request
{
  "query": "typescript configuration",
  "limit": 10
}

// Response
{
  "results": [
    {
      "id": "01HXY...",
      "title": "TypeScript Setup",
      "snippet": "...configure tsconfig.json with strict mode...",
      "score": 0.85,
      "createdAt": "2026-07-17T20:00:00Z"
    }
  ]
}
```

## Account API

### GET /api/accounts
```json
// Response
{
  "accounts": [
    {
      "id": "01HXY...",
      "providerId": "chatgpt",
      "accountSlug": "user@gmail.com",
      "loginState": "authenticated",
      "debugPort": 9222,
      "lastLoginAt": "2026-07-17T19:00:00Z"
    }
  ]
}
```

## Canvas API

### GET /api/canvas/manifest
```json
// Response
{
  "layers": [
    {
      "id": "layer-chatgpt",
      "providerId": "chatgpt",
      "providerName": "ChatGPT",
      "defaultVisible": true
    }
  ]
}
```

### GET /api/canvas/layout
```json
// Response
{
  "mirrors": [
    {
      "layerId": "layer-chatgpt",
      "x": 0,
      "y": 0,
      "width": 400,
      "height": 600,
      "visible": true,
      "locked": false,
      "zIndex": 1
    }
  ]
}
```

### POST /api/canvas/layout
```json
// Request
{
  "mirrors": [
    {
      "layerId": "layer-chatgpt",
      "x": 100,
      "y": 50,
      "width": 500,
      "height": 700
    }
  ]
}

// Response
{
  "saved": true,
  "mirrorCount": 1
}
```

## Settings API

### GET /api/settings
```json
// Response
{
  "settings": {
    "theme": "dark",
    "defaultProvider": "chatgpt",
    "fontSize": 14,
    "streamingEnabled": true
  }
}
```

### POST /api/settings
```json
// Request
{
  "key": "theme",
  "value": "light"
}

// Response
{
  "saved": true,
  "key": "theme",
  "value": "light"
}
```

## Provider Driver API

### POST /api/provider/send-message
```json
// Request
{
  "providerId": "chatgpt",
  "slaveId": "01HXY...",
  "content": "What is TypeScript?",
  "conversationId": "01HXY..."
}

// Response
{
  "status": "accepted",
  "messageId": "01HX...",
  "streamStarted": true
}
```

### POST /api/provider/cancel-stream
```json
// Request
{
  "providerId": "chatgpt",
  "slaveId": "01HXY...",
  "conversationId": "01HXY..."
}

// Response
{
  "status": "cancelled",
  "partialContent": "I was thinking about..."
}
```
