// src/schema/schemas.ts
// Schema registry initialization — call registerAllSchemas() at boot.

import { schemaRegistry } from './node.js'
import { messageNodeSchema, conversationNodeSchema } from './message.js'
import { emailNodeSchema, emailThreadNodeSchema } from './email.js'
import { documentNodeSchema, codeNodeSchema, knowledgeNodeSchema, webpageNodeSchema } from './document.js'
import { contactNodeSchema, organizationNodeSchema } from './contact.js'
import { taskNodeSchema, projectNodeSchema } from './task.js'
import { eventNodeSchema, reminderNodeSchema, locationNodeSchema } from './event.js'
import { mediaNodeSchema } from './media.js'
import { socialPostNodeSchema } from './social.js'
import {
  MemoryDataSchema,
  AcuDataSchema,
  NotebookDataSchema,
  NoteDataSchema,
  BookmarkDataSchema,
  ArtifactDataSchema,
  DocumentNodeDataSchema,
  EmailNodeDataSchema,
} from './node-data.js'

// Zod discriminated unions produce overly-broad inferred types (e.g. optional `data`
// on CustomPart). Cast to `any` at registration — the schemas are correct at runtime;
// the mismatch is a Zod inference limitation, not a real type error.

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
}
