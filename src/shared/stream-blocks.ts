// src/shared/stream-blocks.ts
// Shared stream block types for frontend rendering (PRD-C6).
// Re-exports from canonical schema — this file exists only for import compat with web/ui.

export type {
  ContentBlock,
  ContentPart,
  TextPart,
  ReasoningPart,
  CodePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  SourcePart,
  CustomPart,
  ErrorPart,
  MetaPart,
  StepStartPart,
} from '../schema/streaming.js'

export type { MessageData } from '../schema/message.js'
