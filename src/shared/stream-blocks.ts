// src/shared/stream-blocks.ts
// Shared stream block types for frontend rendering (PRD-C6).
// Re-exports from canonical schema — this file exists only for import compat with web/ui.

export type { MessageData } from '../schema/message.js'
export type {
  CodePart,
  ContentBlock,
  ContentPart,
  CustomPart,
  ErrorPart,
  FilePart,
  MetaPart,
  ReasoningPart,
  SourcePart,
  StepStartPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from '../schema/streaming.js'
