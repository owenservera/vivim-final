# VIVIM AI Gateway — `src/ai/`

The canonical protocol boundary for AI execution in vivim. Local-first LLM runtimes (OpenCode, Ollama, llama.cpp) and optional OpenAI-compatible cloud APIs.

**Status:** Landed (Round 2, P0–P3 in one pass). Behind `AI_GATEWAY_ENABLED` config flag (default: off).

## Architecture

See `docs/dev-code-impl/AI-gtewwaay/ARCHITECTURE.md` for the frozen contract specification.

```
src/ai/
  core/           # Frozen contract: types, errors, invariants
  execution/      # Execution lifecycle: types, manager contract, in-memory impl, internal interface
  protocol/       # Provider adapters: contract + simulator + OpenCode native + OpenAI-compatible generic
    openai-compatible/  # THE generic adapter module (one class, manifest-driven)
  routing/        # Router contract + default router + strategies
  policy/         # Policy evaluator/enforcer contract + default impls
  registry/       # Provider/model registry contract + in-memory impls
  runtime/        # Resource manager + TS-layer supervisor (no Rust)
  tools/          # Tool orchestrator contract (4-stage pipeline)
  plugins/        # Plugin manager contract (trust/certify layer)
  events/         # Event bus contract + in-memory impl
  gateway/        # IVIVIMGateway contract + concrete VivimAIGateway
  manifests/      # Provider manifests (JSON) — OpenCode, Ollama
  index.ts        # Public barrel
  factory.ts      # createGateway() — wires sensible defaults
  README.md       # This file
```

## Public API

Vivim Core imports ONLY from `src/ai/index.ts` (per ARCHITECTURE.md invariant 1).

```typescript
import {
  type IVIVIMGateway,
  type AIRequest, type AIEvent, type AIError,
  createRequestId, createEventId,
  VivimAIError, AI_ERRORS, isVivimAIError,
  createGateway,
} from '../ai/index.js';
```

## Quick start

```typescript
import { createGateway } from './ai/factory.js';

const { gateway, providerRegistry, modelRegistry } = createGateway();

// Register a provider
await providerRegistry.register({
  id: 'simulator' as never,
  // ... manifest fields
});
await providerRegistry.setState('simulator' as never, 'active');

// Execute a request
const request = {
  requestId: createRequestId(),
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
};

for await (const event of gateway.execute(request)) {
  if (event.type === 'output.text.delta') {
    process.stdout.write(event.text);
  }
}
```

## Adapters

| Adapter | File | Protocol | Use case |
|---|---|---|---|
| `SimulatorAdapter` | `protocol/simulator-adapter.ts` | In-process | Testing without a GPU |
| `OpenCodeAdapter` | `protocol/opencode-adapter.ts` | OpenCode session-based (native) | Wraps existing `OpenCodeClient` |
| `OpenAICompatibleAdapter` | `protocol/openai-compatible/adapter.ts` | OpenAI `/v1/chat/completions` | Generic — Ollama `/v1`, LM Studio, vLLM, OpenRouter, OpenAI API, etc. |

Adding a new OpenAI-compatible provider = adding a JSON manifest to `manifests/`, zero code change.

## Boundaries (non-negotiable)

- **NO CDP.** The AI Gateway never touches Chrome.
- **NO browser.** The AI Gateway never touches the harness.
- **One public entry point:** `src/ai/index.ts`.
- **One provider execution contract:** `IProviderAdapter` (`protocol/adapter.ts`).
- **TS-only.** No Rust/Tauri supervisor — `TSRuntimeSupervisor` handles all process spawning via existing TS-layer supervisors.

## Configuration

- `AI_GATEWAY_ENABLED` (default: `false`) — Master switch. When `false`, the gateway is not booted and `cap:ai:execute` returns `{ ok: false, error: 'AI Gateway not enabled' }`.
- `OPENCODE_SERVE_ENABLED` — Enables the OpenCode serve supervisor (existing).
- `OPENCODE_SERVE_PORT` — Port for OpenCode serve.
- `OPENCODE_SERVER_PASSWORD` — Password for OpenCode serve.

## See also

- `docs/dev-code-impl/AI-gtewwaay/ARCHITECTURE.md` — Frozen contract specification
- `docs/dev-code-impl/AI-gtewwaay/CONVERGENCE-PLAN.md` — Convergence with existing engines (C1–C5)
- `docs/IMPLEMENTATION_STRATEGY.md` — Full 10-round implementation strategy
- `docs/DESIGN-OPENAI-COMPATIBLE-ADAPTER.md` — OpenAI-compatible adapter module design
