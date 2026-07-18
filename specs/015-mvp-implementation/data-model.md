# Data Model: MVP Implementation

**Date:** 2026-07-17

## Existing Tables (Prisma Schema)

These tables already exist and support the MVP:

### Conversation
- `id` (ULID)
- `providerId` (string)
- `title` (string)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Message
- `id` (ULID)
- `conversationId` (FK → Conversation)
- `role` (enum: user | assistant | system)
- `content` (string — raw text)
- `createdAt` (DateTime)

### StreamBlock (ContentBlock persistence)
- `id` (ULID)
- `conversationId` (FK → Conversation)
- `messageId` (FK → Message)
- `index` (int)
- `kind` (string — text | code | image | tool_use | thinking | error | citation | artifact | meta)
- `content` (string — serialized block content)
- `metadata` (JSON — optional block-specific data)
- `createdAt` (DateTime)

### ProviderAccount
- `id` (ULID)
- `providerId` (string)
- `accountSlug` (string)
- `profilePath` (string — Chrome profile path)
- `debugPort` (int | null)
- `loginState` (enum: authenticated | expired | disconnected)
- `lastLoginAt` (DateTime | null)
- `createdAt` (DateTime)

### ProviderEndpoint
- `id` (ULID)
- `providerId` (string)
- `url` (string)
- `selectorsJson` (JSON — composer, send button, capture selectors)
- `streamPatterns` (JSON — URL patterns for network capture)

### ParserModule (DB-stored parsers)
- `id` (ULID)
- `providerId` (string)
- `name` (string — e.g., "chatgpt/001_openai_sse")
- `version` (int)
- `logicCode` (string — inline JS parser code)
- `parserHash` (string — for caching)

## New/Modified Tables

### CanvasMirror (NEW — for canvas persistence)
```
model CanvasMirror {
  id          String   @id @default(uuid())
  layerId     String
  x           Float
  y           Float
  width       Float
  height      Float
  visible     Boolean  @default(true)
  locked      Boolean  @default(false)
  zIndex      Int      @default(0)
  updatedAt   DateTime @updatedAt
  
  @@unique([layerId])
}
```

### Settings (NEW — for settings persistence)
```
model Settings {
  id      String @id @default(uuid())
  key     String @unique
  value   String
  updatedAt DateTime @updatedAt
}
```

## ContentBlock Schema (TypeScript)

Already exists at `src/schema/streaming.ts`:

```typescript
export type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number }
```

## API Endpoints (Existing)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/conversations` | GET | List all conversations |
| `/api/conversations` | POST | Create new conversation |
| `/api/conversations/:id` | GET | Get conversation with messages |
| `/api/conversations/:id/stream-blocks` | GET | Get ContentBlock[] for conversation |
| `/api/conversations/search` | POST | FTS5 search across conversations |
| `/api/accounts` | GET | List provider accounts with live state |
| `/api/canvas/manifest` | GET | Canvas layer manifest |
| `/api/canvas/layout` | GET/POST | Canvas layout (to be added) |
| `/api/settings` | GET/POST | Settings CRUD (to be added) |
