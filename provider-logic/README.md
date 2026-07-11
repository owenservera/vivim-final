# Provider-Specific Logic Extraction

This folder contains extracted provider-specific logic from vivim-final, organized by provider for easy reference and reuse.

## Structure

```
provider-logic/
├── README.md                    # This file
├── providers/                   # Provider manifest configurations
│   ├── chatgpt.json
│   ├── claude.json
│   ├── deepseek.json
│   ├── gemini.json
│   ├── qwen.json
│   ├── studio-ai.json
│   └── z-ai.json
├── parsers/                     # Provider-specific parsers
│   ├── chatgpt/
│   │   └── 001_openai_sse.ts
│   ├── claude/
│   │   └── 001_streaming_sse.ts
│   ├── gemini/
│   │   └── 001_batchexecute.ts
│   ├── generic/
│   │   ├── 001_sse_frames.ts
│   │   └── 002_openai_delta.ts
│   └── system/
│       └── 001_fallback.ts
├── schemas/                     # TypeScript interfaces and types
│   ├── provider.ts
│   ├── provider-manifest.ts
│   └── provider-store.ts
└── engines/                     # Provider-related engine logic
    ├── provider-registrar.ts
    ├── provider-health.ts
    ├── provider-discovery.ts
    └── provider-mux.ts
```

## Provider Summary

| Provider | Auth Type | Multi-Account | Parser Type | Key Features |
|----------|-----------|---------------|-------------|--------------|
| ChatGPT | Browser | Yes | OpenAI SSE | GPT-4o, o3, o4-mini models |
| Claude | Browser | Yes | Claude SSE | Sonnet 4, Opus 4, Haiku 4 |
| DeepSeek | Browser | No | Generic SSE | DeepSeek Chat, Reasoner |
| Gemini | Browser | Yes | BatchExecute | Gemini 2.5 Pro/Flash |
| Qwen | Browser | No | Generic SSE | Qwen Max, Plus, Turbo |
| Studio AI | Browser | No | BatchExecute | Gemini preview models |
| Z AI | API | No | OpenAI Delta | API-based provider |

## Key Configuration Patterns

### Authentication
- **Browser-based**: All providers except Z AI use browser automation
- **API-based**: Z AI uses direct API access with API keys

### Parser Strategies
- **OpenAI SSE**: Standard Server-Sent Events with delta streaming
- **Claude SSE**: Custom SSE with content blocks and thinking support
- **BatchExecute**: Google's nested JSON array format
- **Generic SSE**: Fallback for unknown SSE providers

### Capability Overrides
Each provider can override global capabilities with:
- UI component types (text_input, dropdown_selector, etc.)
- Labels and icons
- Recovery strategies (retry_selector, navigate_home, etc.)
- Priority levels (primary, secondary)

## Usage

1. **Provider Registration**: Use manifests in `providers/` to register new providers
2. **Parser Selection**: Choose appropriate parser based on provider's streaming format
3. **Capability Configuration**: Override global capabilities with provider-specific settings
4. **Health Monitoring**: Use provider health signals for reliability tracking

## Dependencies

- Prisma ORM for database operations
- Zod for schema validation
- TypeScript interfaces from `schemas/`
- Engine classes from `engines/`