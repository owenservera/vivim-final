// src/schema/schemas.ts
// Schema registry initialization — call registerAllSchemas() at boot.

import { AGENTIC_NODE_TYPES, agenticDataSchemas } from './agentic.js'
import { contactNodeSchema, organizationNodeSchema } from './contact.js'
import {
  codeNodeSchema,
  documentNodeSchema,
  knowledgeNodeSchema,
  webpageNodeSchema,
} from './document.js'
import { emailNodeSchema, emailThreadNodeSchema } from './email.js'
import { eventNodeSchema, locationNodeSchema, reminderNodeSchema } from './event.js'
import { mediaNodeSchema } from './media.js'
import { conversationNodeSchema, messageNodeSchema } from './message.js'
import {
  AcuDataSchema,
  ArtifactDataSchema,
  BookmarkDataSchema,
  DocumentNodeDataSchema,
  EmailNodeDataSchema,
  MemoryDataSchema,
  NoteDataSchema,
  NotebookDataSchema,
} from './node-data.js'
import { schemaRegistry } from './node.js'
import { socialPostNodeSchema } from './social.js'
import { projectNodeSchema, taskNodeSchema } from './task.js'

// Zod discriminated unions produce overly-broad inferred types (e.g. optional `data`
// on CustomPart). Cast to `any` at registration — the schemas are correct at runtime;
// the mismatch is a Zod inference limitation, not a real type error.
/* eslint-disable @typescript-eslint/no-explicit-any -- Zod schema type inference limitation */

export function registerAllSchemas(): void {
  schemaRegistry.register(messageNodeSchema as any)
  schemaRegistry.register(conversationNodeSchema as any)
  schemaRegistry.register(emailNodeSchema as any)
  schemaRegistry.register(emailThreadNodeSchema as any)
  schemaRegistry.register(documentNodeSchema as any)
  schemaRegistry.register(codeNodeSchema as any)
  schemaRegistry.register(knowledgeNodeSchema as any)
  schemaRegistry.register(webpageNodeSchema as any)
  schemaRegistry.register(contactNodeSchema as any)
  schemaRegistry.register(organizationNodeSchema as any)
  schemaRegistry.register(taskNodeSchema as any)
  schemaRegistry.register(projectNodeSchema as any)
  schemaRegistry.register(eventNodeSchema as any)
  schemaRegistry.register(reminderNodeSchema as any)
  schemaRegistry.register(locationNodeSchema as any)
  schemaRegistry.register(mediaNodeSchema as any)
  schemaRegistry.register(socialPostNodeSchema as any)

  // ── Node-layer v2 data shapes (adopted from vivim-app-og reference) ──
  schemaRegistry.register({
    type: 'cap-store.memory',
    version: 1,
    schema: MemoryDataSchema,
    indexContent: (d: any) => [d.content, d.summary, d.category].filter(Boolean).join('\n'),
    embeddingText: (d: any) => d.content,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.acu',
    version: 1,
    schema: AcuDataSchema,
    indexContent: (d: any) => d.content,
    embeddingText: (d: any) => d.content,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.notebook',
    version: 1,
    schema: NotebookDataSchema,
    indexContent: (d: any) => d.name,
    embeddingText: (d: any) => d.name,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.note',
    version: 1,
    schema: NoteDataSchema,
    indexContent: (d: any) => [d.title, d.body].join('\n'),
    embeddingText: (d: any) => d.body,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.bookmark',
    version: 1,
    schema: BookmarkDataSchema,
    indexContent: (d: any) => [d.title, d.description, d.url].filter(Boolean).join('\n'),
    embeddingText: (d: any) => d.title,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.artifact',
    version: 1,
    schema: ArtifactDataSchema,
    indexContent: (d: any) => [d.title, d.artifactType].join('\n'),
    embeddingText: (d: any) => d.title,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.document',
    version: 1,
    schema: DocumentNodeDataSchema,
    indexContent: (d: any) => [d.title, d.body].join('\n'),
    embeddingText: (d: any) => d.body,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.email',
    version: 1,
    schema: EmailNodeDataSchema,
    indexContent: (d: any) => [d.subject, d.body, d.from].join('\n'),
    embeddingText: (d: any) => [d.subject, d.body].join('\n'),
  } as any)

  // ── Agentic backbone (SOTA agentic system — cap-store.* sub-types) ──
  // All agentic node types are validated by their Zod schemas in agentic.ts.
  for (const type of AGENTIC_NODE_TYPES) {
    const schema = agenticDataSchemas[type]
    schemaRegistry.register({
      type,
      version: 1,
      schema,
      indexContent: (d: any) => {
        if (d.handle) return [d.handle, d.displayName].filter(Boolean).join('\n')
        if (d.name) return String(d.name)
        if (d.title) return [d.title, d.description].filter(Boolean).join('\n')
        if (d.topic) return [d.topic, d.claim].filter(Boolean).join('\n')
        return JSON.stringify(d)
      },
      embeddingText: (d: any) => {
        if (d.displayName) return d.displayName
        if (d.title) return d.title
        if (d.topic) return [d.topic, d.claim].filter(Boolean).join('\n')
        if (d.description) return d.description
        return String(d.name ?? '')
      },
    } as any)
  }
}
