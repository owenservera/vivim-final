// src/schema/api-types.ts
// Frontend re-export of the backend's canonical API types.
//
// The backend (mini-services/backend/src/schema/api-types.ts) is the single
// source of truth for all HTTP response shapes shared between frontend and
// backend. This file re-exports them under the frontend's `@/schema/api-types`
// path alias so frontend code can import them without crossing package
// boundaries in import paths.
//
// Type-only re-export — no runtime code is emitted, so there is no build-time
// coupling between the two packages.

export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  CapabilityDetail,
  CapabilityExecuteResponse,
  CapabilityListResponse,
  InterpretBody,
  InterpretSuccessResponse,
  InterpretConfirmationResponse,
  InterpretClarificationResponse,
  InterpretErrorResponse,
  InterpretResponse,
  ConversationDetail,
  ConversationMessageDetail,
  SendMessageResponse,
  SendMessageErrorResponse,
  SendMessageResponseUnion,
} from '@backend/schema/api-types'
