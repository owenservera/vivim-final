# Provider Logic Lifecycle & Metadata Model

**Date:** 2026-07-11
**Purpose:** Design the complete provider logic lifecycle and metadata management system
**Status:** Design analysis complete

---

## Executive Summary

Each provider webapp has **unique behaviors** across multiple dimensions. The metadata model must capture these unique behaviors in a structured, versioned, and queryable way. The lifecycle spans from discovery through deprecation, with each stage requiring specific metadata.

---

## 1. Provider Behavior Dimensions (XYZ)

Every provider has unique behaviors across these dimensions:

### X-Axis: Transport Layer
| Dimension | Options | Examples |
|-----------|---------|----------|
| **Transport** | `sse`, `batchexecute`, `websocket`, `sse-patch` | Claude= SSE, Gemini= batchexecute |
| **SSE Format** | `openai`, `anthropic`, `gemini`, `generic` | ChatGPT= openai, Claude= anthropic |
| **Content-Type** | `text/event-stream`, `text/plain`, `application/json` | Most= text/event-stream |
| **Terminal Signal** | `"[DONE]"`, `"message_stop"`, `")]\\n"` | OpenAI= [DONE], Claude= message_stop |

### Y-Axis: DOM Interaction Layer
| Dimension | Options | Examples |
|-----------|---------|----------|
| **Composer Type** | `textarea`, `contenteditable`, `prosemirror`, `quill` | ChatGPT= textarea, Claude= prosemirror |
| **Selector Strategy** | `css`, `aria`, `xpath`, `role+name`, `hybrid` | Most= css+aria hybrid |
| **Send Method** | `enter_key`, `button_click`, `both` | Most= both |
| **ContentEditable** | `true`, `false` | ChatGPT= false, Claude= true |

### Z-Axis: Feature Layer
| Dimension | Options | Examples |
|-----------|---------|----------|
| **Extended Thinking** | `true`, `false` | Claude= true, ChatGPT= false |
| **Tool Calls** | `true`, `false` | All support this |
| **File Upload** | `true`, `false` | Most= true |
| **Code Execution** | `true`, `false` | ChatGPT= true, Claude= false |
| **Multi-Account** | `true`, `false` | Most= false |

---

## 2. Provider Logic Lifecycle

### Stage 1: Discovery
**Goal:** Navigate to provider URL, probe DOM, detect capabilities

**Metadata Produced:**
- `DiscoverySession` — URL, status, shape, confidence
- `DetectedCapabilities` — List of capability slugs
- `InteractiveElements` — Selectors, actions, priorities
- `ParserFormat` — Detected stream format

**DB Tables:**
- `provider_discovery_session` (transient, for audit)
- `provider_discovery_result` (persisted for reference)

### Stage 2: Manifest Generation
**Goal:** Create draft manifest from discovery session

**Metadata Produced:**
- `ProviderManifestDraft` — slug, displayName, capabilities, endpoints
- `ParserRecommendation` — Which parser to use
- `SelectorPortfolio` — Initial selector set

**DB Tables:**
- None (manifest is generated, not stored until registration)

### Stage 3: Registration
**Goal:** Store manifest in DB, activate provider

**Metadata Produced:**
- `ProviderDefinition` — Core provider info
- `ProviderEndpoint` — URLs and selectors
- `ProviderParser` — Parser logic (file or inline)
- `ProviderCapability` — Capabilities with recovery strategies
- `ProviderModel` — Available models
- `ProviderConfig` — Key-value configurations
- `ProviderStreamConfig` — Stream transport config

**DB Tables:**
- `provider_definition`
- `provider_endpoint`
- `provider_parser`
- `provider_capability`
- `provider_model`
- `provider_config`
- `provider_stream_config`

### Stage 4: Runtime Loading
**Goal:** Load parser, selectors, capabilities from DB

**Metadata Consumed:**
- `ProviderParser.logicCode` — Inline parser (compiled at runtime)
- `ProviderParser.filePath` — File-based parser (imported)
- `ProviderEndpoint.selectors` — CSS/ARIA selectors
- `ProviderCapability.recoveryStrategies` — What to do on failure
- `ProviderStreamConfig.completionDetectors` — How to detect stream end

**DB Tables:**
- All provider_* tables read
- `provider_health` updated (confidence, latency)

### Stage 5: Monitoring
**Goal:** Track confidence, latency, failures

**Metadata Produced:**
- `ProviderHealth` — Confidence, latency, failure counts
- `SelectorMetrics` — Hit/miss rates per selector
- `ParserMetrics` — Parse success/failure rates

**DB Tables:**
- `provider_health` (updated)
- `provider_capability` (confidence, success/fail counts)

### Stage 6: Healing
**Goal:** Detect drift, re-heal selectors, update parsers

**Metadata Produced:**
- `DriftDetection` — What changed, when, severity
- `HealingAction` — What was fixed, new selectors
- `ParserUpdate` — New parser version

**DB Tables:**
- `provider_parser` (new version)
- `provider_endpoint` (updated selectors)
- `provider_health` (confidence restored)

### Stage 7: Versioning
**Goal:** Version manifests, parsers, configs

**Metadata Produced:**
- `ManifestVersion` — Version number, changelog
- `ParserVersion` — Parser version, hash
- `ConfigVersion` — Config version, superseded_by

**DB Tables:**
- `provider_parser` (version field)
- `provider_stream_config` (version, superseded_by)

### Stage 8: Deprecation
**Goal:** Mark old versions as superseded

**Metadata Produced:**
- `DeprecationRecord` — What was deprecated, why
- `SupersededBy` — New version reference

**DB Tables:**
- `provider_parser` (isActive=0, superseded_by)
- `provider_stream_config` (isActive=0, superseded_by)

---

## 3. Core DB Fields Per Provider

### ProviderDefinition (Core Identity)
```prisma
model ProviderDefinition {
  id               String  @id
  slug             String  @unique           // 'claude', 'chatgpt', 'gemini'
  displayName      String  @map("display_name")
  description      String?
  category         String  @default("ai")    // 'ai', 'search', 'code'
  providerType     String  @default("llm")   // 'llm', 'image', 'embedding'
  isActive         Int     @default(1)
  websiteUrl       String? @map("website_url")
  documentationUrl String? @map("documentation_url")
  authType         String  @default("browser") // 'browser', 'api_key', 'oauth'
  hasMultiAccount  Int     @default(0) @map("has_multi_account")
  profileStrategy  String  @default("per_account") // 'per_account', 'shared'
  fleetConfigJson  String  @default("{}") @map("fleet_config_json")
  capabilitiesJson String  @default("{}") @map("capabilities_json")
  modelsJson       String  @default("[]") @map("models_json")
}
```

### ProviderEndpoint (DOM Interaction)
```prisma
model ProviderEndpoint {
  id           String  @id
  providerId   String  @map("provider_id")
  label        String
  url          String
  endpointType String  @map("endpoint_type")  // 'landing', 'chat', 'login', 'api'
  isDefault    Int     @default(0) @map("is_default")
  
  // Selector Portfolio
  selectorsJson String  @default("{}") @map("selectors_json")
  // {
  //   "composer": { "css": "#prompt-textarea", "aria": "textbox" },
  //   "sendButton": { "css": "[data-testid='send-button']", "aria": "Send" },
  //   "contentArea": { "css": ".markdown", "role": "article" },
  //   "modelSelector": { "css": "select", "aria": "Model" }
  // }
  
  // Interaction Config
  composerType    String  @default("textarea") @map("composer_type")
  // 'textarea' | 'contenteditable' | 'prosemirror' | 'quill'
  
  sendMethod      String  @default("both") @map("send_method")
  // 'enter_key' | 'button_click' | 'both'
  
  contentEditable Int     @default(0) @map("content_editable")
  // 1 = requires Input.insertText, 0 = standard textarea
  
  createdAt     Int     @map("created_at")
  updatedAt     Int     @map("updated_at")
}
```

### ProviderParser (Stream Parsing)
```prisma
model ProviderParser {
  id               String  @id
  providerId       String  @map("provider_id")
  parserName       String  @map("parser_name")
  parserVersion    Int     @default(1) @map("parser_version")
  
  // Logic Storage
  parserLogicType  String  @default("file") @map("parser_logic_type")
  // 'file' | 'inline' | 'composed'
  
  parserFilePath   String? @map("parser_file_path")
  // e.g., 'claude/001_streaming_sse.ts'
  
  parserLogicCode  String? @map("parser_logic_code")
  // Inline TypeScript/JavaScript for DB-driven loading
  
  parserHash       String? @map("parser_hash")
  // Content hash for cache invalidation
  
  isActive         Int     @default(1) @map("is_active")
  fallbackParserId String? @map("fallback_parser_id")
  
  createdAt        Int     @map("created_at")
  updatedAt        Int     @map("updated_at")
}
```

### ProviderStreamConfig (Stream Transport)
```prisma
model ProviderStreamConfig {
  id                       String  @id
  providerId               String  @map("provider_id")
  
  // Transport
  streamTransport          String  @map("stream_transport")
  // 'sse' | 'batchexecute' | 'websocket' | 'sse-patch'
  
  sseFormat                String? @map("sse_format")
  // 'openai' | 'anthropic' | 'gemini' | 'generic'
  
  contentType              String? @map("content_type")
  // 'text/event-stream' | 'text/plain' | 'application/json'
  
  // Terminal Signals
  streamTerminalJson       String  @default("[]") @map("stream_terminal_json")
  // [
  //   { "type": "data-value", "value": "[DONE]" },
  //   { "type": "event-type", "value": "message_stop" },
  //   { "type": "data-suffix", "value": ")]\\n" }
  // ]
  
  // Completion Detectors
  completionDetectorsJson  String  @default("[]") @map("completion_detectors_json")
  // [
  //   { "type": "event-type", "pattern": "message_stop" },
  //   { "type": "data-value", "pattern": "[DONE]" },
  //   { "type": "finish-reason", "pattern": "stop" }
  // ]
  
  // Delta Extraction
  deltaPathJson            String? @map("delta_path_json")
  // "choices[0].delta.content" for OpenAI
  // "delta.text" for Anthropic
  
  // Harness
  harnessJs                String? @map("harness_js")
  // Custom JS to execute in page context
  
  // Versioning
  isActive                 Int     @default(1) @map("is_active")
  version                  Int     @default(1)
  supersededById           String? @map("superseded_by")
  
  createdAt                Int     @map("created_at")
  updatedAt                Int     @map("updated_at")
}
```

### ProviderCapability (Capabilities + Recovery)
```prisma
model ProviderCapability {
  id                         String  @id
  providerId                 String  @map("provider_id")
  globalCapabilityId         String  @map("global_capability_id")
  
  // Recovery Strategies
  recoveryStrategiesJson     String  @default("[]") @map("recovery_strategies_json")
  // [
  //   { "type": "retry_selector", "config": { "maxAttempts": 3 } },
  //   { "type": "retry_with_fallback", "config": { "fallbackSelector": "..." } },
  //   { "type": "navigate_home", "config": { "url": "/new" } },
  //   { "type": "restart_chrome", "config": {} },
  //   { "type": "mark_broken", "config": { "reason": "..." } }
  // ]
  
  // UI Overrides
  uiComponentOverride        String? @map("ui_component_override")
  uiLabelOverride            String? @map("ui_label_override")
  uiIconOverride             String? @map("ui_icon_override")
  uiPositionOverride         String? @map("ui_position_override")
  uiOrderOverride            Int?    @map("ui_order_override")
  uiGroupOverride            String? @map("ui_group_override")
  uiPriorityOverride         String? @map("ui_priority_override")
  interactionModeOverride    String? @map("interaction_mode_override")
  uiStatesOverrideJson       String? @map("ui_states_override_json")
  uiVisibilityRuleOverride   String? @map("ui_visibility_rule_override")
  existentialRuleOverride    String? @map("existential_rule_override")
  uiInputSchemaOverride      String? @map("ui_input_schema_override")
  mutationEffectsOverrideJson String? @map("mutation_effects_override_json")
  recoveryBehaviorOverride   String? @map("recovery_behavior_override")
  statePersistenceOverride   String? @map("state_persistence_override")
  dataFlowOverride           String? @map("data_flow_override")
  minPlanTierOverride        String? @map("min_plan_tier_override")
  dependsOnOverrideJson      String? @map("depends_on_override_json")
  
  // Metrics
  confidence                 Float   @default(1.0)
  successCount               Int     @default(0) @map("success_count")
  failCount                  Int     @default(0) @map("fail_count")
  consecutiveFailures        Int     @default(0) @map("consecutive_failures")
  avgLatencyMs               Float   @default(0) @map("avg_latency_ms")
  p95LatencyMs               Float   @default(0) @map("p95_latency_ms")
  lastUsedAt                 Int?    @map("last_used_at")
  
  // Selector Metrics
  selectorHitCount           Int     @default(0) @map("selector_hit_count")
  selectorMissCount          Int     @default(0) @map("selector_miss_count")
  selectorLastMissAt         Int?    @map("selector_last_miss_at")
  selectorLastError          String? @map("selector_last_error")
  
  createdAt                  Int     @map("created_at")
  updatedAt                  Int     @map("updated_at")
}
```

### ProviderModel (Models)
```prisma
model ProviderModel {
  id                 String  @id
  providerId         String  @map("provider_id")
  modelSlug          String  @map("model_slug")
  displayName        String  @map("display_name")
  isActive           Int     @default(1) @map("is_active")
  isDefault          Int     @default(0) @map("is_default")
  capabilitiesJson   String  @default("[]") @map("capabilities_json")
  contextWindow      Int?    @map("context_window")
  maxOutputTokens    Int?    @map("max_output_tokens")
  supportsStreaming  Int     @default(0) @map("supports_streaming")
  supportsVision     Int     @default(0) @map("supports_vision")
  supportsThinking   Int     @default(0) @map("supports_thinking")
  supportsTools      Int     @default(0) @map("supports_tools")
  pricingInputPer1m  Float?  @map("pricing_input_per_1m")
  pricingOutputPer1m Float?  @map("pricing_output_per_1m")
  createdAt          Int     @map("created_at")
  updatedAt          Int     @map("updated_at")
}
```

### ProviderConfig (Key-Value Config)
```prisma
model ProviderConfig {
  id          String @id
  providerId  String @map("provider_id")
  configKey   String @map("config_key")
  configValue String @map("config_value")
  configType  String @default("string") @map("config_type")
  isSecret    Int    @default(0) @map("is_secret")
  createdAt   Int    @map("created_at")
  updatedAt   Int    @map("updated_at")
}
```

---

## 4. Unique Behaviors Per Provider

### Claude
| Dimension | Value | Notes |
|-----------|-------|-------|
| Transport | SSE | Standard SSE |
| SSE Format | Anthropic | Custom delta format |
| Composer | ProseMirror | Requires `Input.insertText` |
| ContentEditable | Yes | Must use CDP Input domain |
| Extended Thinking | Yes | `thinking_delta` blocks |
| Terminal Signal | `message_stop` | Event type |
| Selectors | Hybrid | CSS + ARIA role+name |

### ChatGPT
| Dimension | Value | Notes |
|-----------|-------|-------|
| Transport | SSE | Standard SSE |
| SSE Format | OpenAI | Standard delta format |
| Composer | Textarea | Standard `<textarea>` |
| ContentEditable | No | Standard input |
| Extended Thinking | No | — |
| Terminal Signal | `[DONE]` | Data value |
| Selectors | CSS | `data-testid` attributes |

### Gemini
| Dimension | Value | Notes |
|-----------|-------|-------|
| Transport | batchexecute | Google RPC over POST |
| SSE Format | N/A | Not SSE |
| Composer | Quill | `.ql-editor` contenteditable |
| ContentEditable | Yes | Quill editor |
| Extended Thinking | Yes | When enabled |
| Terminal Signal | `)]\\n` | Data suffix |
| Selectors | CSS | Class-based selectors |

### DeepSeek
| Dimension | Value | Notes |
|-----------|-------|-------|
| Transport | SSE | Standard SSE |
| SSE Format | OpenAI | Reuses OpenAI format |
| Composer | Textarea | Standard `<textarea>` |
| ContentEditable | No | Standard input |
| Extended Thinking | No | — |
| Terminal Signal | `[DONE]` | Data value |
| Selectors | CSS | Standard selectors |

---

## 5. Metadata Management Strategy

### Versioning Strategy
- **ProviderDefinition** — Version via `updatedAt` (single version)
- **ProviderParser** — Explicit `parserVersion` field
- **ProviderStreamConfig** — Explicit `version` + `supersededById`
- **ProviderCapability** — Version via `updatedAt` (single version)

### Cache Invalidation Strategy
- **Parser** — Hash-based (`parserHash`) for inline/file parsers
- **StreamConfig** — Version-based for stream config
- **Selectors** — Confidence-based (drift detection)

### Audit Trail Strategy
- **TraceEntry** — All CDP calls logged
- **ProviderHealth** — Confidence, latency, failures tracked
- **SelectorMetrics** — Hit/miss rates per selector

### Healing Strategy
- **SelectorHealer** — 5 strategies for selector recovery
- **DriftDetector** — Monitors confidence drops
- **ParserUpdater** — Version bumps on parser changes

---

## 6. Query Patterns

### Runtime Loading
```sql
-- Load active parser for provider
SELECT * FROM provider_parser 
WHERE provider_id = ? AND is_active = 1 
ORDER BY parser_version DESC LIMIT 1;

-- Load active stream config
SELECT * FROM provider_stream_config 
WHERE provider_id = ? AND is_active = 1 
ORDER BY version DESC LIMIT 1;

-- Load selectors for endpoint
SELECT selectors_json FROM provider_endpoint 
WHERE provider_id = ? AND is_default = 1;
```

### Monitoring
```sql
-- Get provider health
SELECT * FROM provider_health WHERE provider_id = ?;

-- Get selector hit rates
SELECT selector_hit_count, selector_miss_count 
FROM provider_capability WHERE provider_id = ?;

-- Get parser success rate
SELECT success_count, fail_count 
FROM provider_parser WHERE provider_id = ?;
```

### Healing
```sql
-- Find providers with low confidence
SELECT provider_id, confidence FROM provider_capability 
WHERE confidence < 0.8;

-- Find selectors with high miss rate
SELECT provider_id, selector_last_error 
FROM provider_capability WHERE selector_miss_count > 10;
```

---

## 7. Implementation Priority

### Phase 1: Core Tables (Done)
- ✅ `ProviderParser` with `parserLogicCode`
- ✅ `ProviderStreamConfig`

### Phase 2: Selector Management
- [ ] Add `selectorsJson` to `ProviderEndpoint`
- [ ] Add `composerType` and `sendMethod` to `ProviderEndpoint`

### Phase 3: Recovery Strategies
- [ ] Add `recoveryStrategiesJson` to `ProviderCapability`

### Phase 4: Metrics
- [ ] Add `ProviderHealth` table
- [ ] Add `SelectorMetrics` tracking

### Phase 5: Versioning
- [ ] Add `version` and `supersededById` to all versioned tables
- [ ] Implement version chain queries

### Phase 6: Audit Trail
- [ ] Add `ProviderAuditLog` table
- [ ] Implement audit trail queries

---

## 8. Summary

The provider logic lifecycle has 8 stages, each producing specific metadata. The core DB fields capture unique behaviors across 3 dimensions (XYZ):

1. **Transport Layer** — How streaming works
2. **DOM Interaction Layer** — How to find and interact with elements
3. **Feature Layer** — What capabilities are supported

The metadata model is designed for:
- **Runtime Loading** — Fast queries for parser/selector loading
- **Monitoring** — Confidence, latency, failure tracking
- **Healing** — Drift detection and selector recovery
- **Versioning** — Explicit version chains with rollback
- **Audit Trail** — Complete history of changes
