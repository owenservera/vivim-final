# API Module

**Purpose:** HTTP API layer exposing vivim-final capabilities over REST.

## Description
Provides REST endpoints for:
- Capability execution and interpretation
- Provider management and health checks
- Conversation and session management
- System observability and health

## Public Interface
- OpenAPI spec at `/api/openapi.json`
- Main endpoint groups: `/api/capabilities`, `/api/conversations`, `/api/providers`
- Health check endpoints: `/readyz`, `/health`

## Internal Gotchas
- Some endpoints block indefinitely waiting for CDP browser (attach required)
- Always use `AbortController` + timeout for client-side requests
- API format differs from wire format for some providers (e.g., chatgpt)

## Owner: VIVIM.inc
## Last Reviewed: 2026-08-15