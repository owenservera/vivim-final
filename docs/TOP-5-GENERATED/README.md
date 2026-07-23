# TOP-5-GENERATED - Source Code Concatenation

> **GENERATED**: 2025-01-XX  
> **PURPOSE**: Complete source code concatenation for the top 5 most recently generated documentation files in `docs/` folder.

---

## 📁 FOLDER STRUCTURE

This folder contains **5 concatenated source code markdown files**, each generated from one of the top 5 most recently created documentation files in the `docs/` directory.

```
docs/TOP-5-GENERATED/
├── README.md                          # This file - index and overview
├── 01-SERVER-BOOTSTRAP-SOURCE-CONCATENATED.md    # From docs/server-bootstrap-api-router.md
├── 02-CONVERSATION-MANAGER-SOURCE-CONCATENATED.md # From docs/conversation-manager.md
├── 03-STREAM-PARSER-ENGINE-SOURCE-CONCATENATED.md # From docs/stream-parser-engine.md
├── 04-CHROME-GOVERNOR-CDP-LAYER-SOURCE-CONCATENATED.md # From docs/chrome-governor-cdp-layer.md
└── 05-UNIFIED-CAPABILITY-REGISTRY-SOURCE-CONCATENATED.md # From docs/unified-capability-registry.md
```

---

## 📋 FILE INDEX

### 1. [01-SERVER-BOOTSTRAP-SOURCE-CONCATENATED.md](./01-SERVER-BOOTSTRAP-SOURCE-CONCATENATED.md)

**Source Document**: `docs/server-bootstrap-api-router.md`  
**Purpose**: Complete source code concatenation for Server Bootstrap system

**Includes Source Files**:
- `src/server/index.ts` (complete)
- `src/server/conversation-router.ts` (complete)
- `src/server/capability-router.ts` (complete)
- References: `src/server/websocket.ts`, `src/server/auth-gate.ts`, `src/server/kernel-router.ts`, `src/server/setup-router.ts`

**Key Sections**:
- Document header with original generated content
- Key types and interfaces (ServerContext)
- Full source code for each governing file
- Additional insights and context
- Architecture overview and critical patterns

---

### 2. [02-CONVERSATION-MANAGER-SOURCE-CONCATENATED.md](./02-CONVERSATION-MANAGER-SOURCE-CONCATENATED.md)

**Source Document**: `docs/conversation-manager.md`  
**Purpose**: Complete source code concatenation for Conversation Manager system

**Includes Source Files**:
- `src/engines/conversation-manager.ts` (complete)
- `src/engines/streaming-protocol.ts` (excerpt)
- `src/engines/stream-block-store.ts` (complete)
- `src/engines/content-unit-decomposer.ts` (excerpt)
- `src/engines/provider-selectors.ts` (complete)

**Key Sections**:
- 8-step send pipeline documentation
- Full ConversationManager implementation
- Streaming protocol and block storage
- Provider-specific selectors and patterns
- Additional insights on architecture and invariants

---

### 3. [03-STREAM-PARSER-ENGINE-SOURCE-CONCATENATED.md](./03-STREAM-PARSER-ENGINE-SOURCE-CONCATENATED.md)

**Source Document**: `docs/stream-parser-engine.md`  
**Purpose**: Complete source code concatenation for Stream Parser Engine system

**Includes Source Files**:
- `src/engines/stream-parser.ts` (complete)
- `src/engines/sandbox-runner.ts` (complete)
- `src/schema/streaming.ts` (complete)
- References: `src/engines/stream-align.ts`, `src/engines/protocol-discovery.ts`, `src/engines/parser-repair.ts`

**Key Sections**:
- Complete StreamParserEngine implementation
- Sandbox runner for safe code execution
- ContentPart schema and legacy migration
- Wire format detection heuristics
- DB-driven fallback chain implementation

---

### 4. [04-CHROME-GOVERNOR-CDP-LAYER-SOURCE-CONCATENATED.md](./04-CHROME-GOVERNOR-CDP-LAYER-SOURCE-CONCATENATED.md)

**Source Document**: `docs/chrome-governor-cdp-layer.md`  
**Purpose**: Complete source code concatenation for Chrome Governor and CDP Layer system

**Includes Source Files**:
- `src/engines/chrome-governor.ts` (complete)
- `src/executor/fleet-supervisor.ts` (complete)
- `src/executor/profile-allocator.ts` (complete)
- References: `src/executor/cdp-transport.ts`, `src/executor/launcher.ts`, `src/executor/async-mutex.ts`

**Key Sections**:
- ChromeGovernor public facade
- CDPProxy with HarnessDAG execution
- FleetSupervisor lifecycle management
- ProfileAllocator singleton enforcement
- Circuit breaker and health monitoring

---

### 5. [05-UNIFIED-CAPABILITY-REGISTRY-SOURCE-CONCATENATED.md](./05-UNIFIED-CAPABILITY-REGISTRY-SOURCE-CONCATENATED.md)

**Source Document**: `docs/unified-capability-registry.md`  
**Purpose**: Complete source code concatenation for Unified Capability Registry system

**Includes Source Files**:
- `src/engines/unified-registry.ts` (complete)
- `src/engines/capability-resolution.ts` (complete)
- `src/engines/capability-bootstrap.ts` (excerpt)
- `src/engines/capability-event-bus.ts` (complete)
- References: `src/server/capability-router.ts`, `src/cli/index.ts`, storage contracts

**Key Sections**:
- UnifiedCapabilityRegistry with makeCapability factory
- CapabilityResolutionEngine with tier gating
- Default capability registration (conversation, knowledge, memory)
- CapabilityEventBus typed pub/sub
- Surface export methods (CLI, MCP, UI, Workflow)

---

## 🎯 GENERATION METHODOLOGY

### Source Document Selection
The 5 most recently generated markdown files in `docs/` were identified using:
```powershell
Get-ChildItem -Path docs -Filter *.md | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name
```

Result: `server-bootstrap-api-router.md`, `conversation-manager.md`, `stream-parser-engine.md`, `chrome-governor-cdp-layer.md`, `unified-capability-registry.md`

### Concatenation Process
For each source document:

1. **Header Preservation**: Original generated document content preserved at top
2. **Source File Identification**: All files mentioned in "Governing Source Files" table extracted
3. **Full Source Inclusion**: Complete source code from each governing file included
4. **Additional Context**: Architecture insights, data flow patterns, key invariants added
5. **System Connections**: Relationships to other components documented
6. **Critical Patterns**: Important design decisions and patterns highlighted

### File Structure Template
Each concatenated file follows this structure:

```markdown
# TITLE - FULL SOURCE CONCATENATED

> **GENERATED FROM**: [original doc path]
> **SOURCE FILES**: [list of source files]
> **GENERATION DATE**: [date]
> **PURPOSE**: [description]

---

## 📋 DOCUMENT HEADER (Original Generated Doc)
[Original document content]

---

## 🎯 GOVERNING SOURCE FILES
[Table from original doc]

---

## 🗃️ STORAGE CONTRACTS (if applicable)
[Table from original doc]

---

## 🔧 KEY TYPES AND INTERFACES
[Type definitions from original doc]

---

## 📜 FULL SOURCE CODE CONCATENATION

### FILE 1: [path]
```typescript
[complete source code]
```

### FILE 2: [path]
```typescript
[complete source code]
```

---

## 🔍 ADDITIONAL INSIGHTS AND CONTEXT
[Architecture overview, critical decisions, patterns]

---

## 📊 SYSTEM CONNECTIONS
[Relationships to other components]

---

## 🎯 CRITICAL PATTERNS
[Key invariants and patterns]

---

*File generated from original documentation and source code concatenation.*
```

---

## 🔗 CROSS-REFERENCES

| File | Related Components | Key Dependencies |
|------|-------------------|------------------|
| 01-Server Bootstrap | ConversationManager, ChromeGovernor, StreamParserEngine | Bun.serve, WebSocket, CORS |
| 02-Conversation Manager | ChromeGovernor, StreamParserEngine, CapabilityResolutionEngine | CDP, HarnessDAG, ContextAssembly |
| 03-Stream Parser Engine | SandboxRunner, ContentPartSchema | DB parsers, fallback chain |
| 04-Chrome Governor | FleetSupervisor, ProfileAllocator, CDPProxy | CDP Transport, AsyncMutex |
| 05-Unified Registry | CapabilityResolutionEngine, CapabilityEventBus | DB snapshot, program resolver |

---

## 📊 STATISTICS

| File | Source Files | Lines of Code (approx) | Key Classes | Interfaces |
|------|--------------|------------------------|-------------|------------|
| 01-Server Bootstrap | 7 | ~800 | ServerContext, createServer, createServerWithEngines | 1 |
| 02-Conversation Manager | 6 | ~1200 | ConversationManager, StreamingProtocol, StreamBlockStore | 8 |
| 03-Stream Parser Engine | 6 | ~900 | StreamParserEngine, SandboxRunner, ContentPartSchema | 12 |
| 04-Chrome Governor | 6 | ~1500 | ChromeGovernor, CDPProxy, FleetSupervisor, ProfileAllocator | 15 |
| 05-Unified Registry | 10 | ~1100 | UnifiedCapabilityRegistry, CapabilityResolutionEngine, CapabilityEventBus | 8 |

**Total**: ~5,500 lines of concatenated source code across 35+ source files

---

## 💡 USAGE NOTES

### For Developers
- Use these files to understand the complete implementation of each system
- Source code is **read-only** - do not edit these files directly
- Always refer to the original source files in `src/` for the canonical implementation
- These concatenated files are for **reference and understanding** only

### For Documentation
- Each file serves as a **living document** that combines documentation with implementation
- Use for onboarding new team members to specific systems
- Reference when debugging or extending existing functionality
- Cross-reference between systems to understand integration points

### For AI Agents
- These files provide **complete context** for understanding each system
- Use the "Additional Insights" sections for architectural understanding
- Reference the "System Connections" sections to understand dependencies
- The "Critical Patterns" sections highlight important invariants to maintain

---

## 🔄 MAINTENANCE

### Regeneration
To regenerate these files:
1. Identify the 5 most recent `.md` files in `docs/`
2. For each file, extract all source files mentioned in its "Governing Source Files" table
3. Concatenate the source code with the structure shown above
4. Add insights, context, and cross-references

### Update Frequency
- **Manual**: Regenerate when major changes occur to governing source files
- **Automated**: Consider adding a script to regenerate on demand
- **Version Control**: These files should be committed to git for history tracking

---

## 📝 CHANGELOG

| Date | Change | Files Affected |
|------|--------|----------------|
| 2025-01-XX | Initial generation | All 5 files |

---

## 🎓 LEARNING PATH

For developers new to the codebase, study these files in order:

1. **Start Here**: [01-SERVER-BOOTSTRAP-SOURCE-CONCATENATED.md](./01-SERVER-BOOTSTRAP-SOURCE-CONCATENATED.md) - Understand the entry point and overall architecture

2. **Core Flow**: [02-CONVERSATION-MANAGER-SOURCE-CONCATENATED.md](./02-CONVERSATION-MANAGER-SOURCE-CONCATENATED.md) - Learn the message processing pipeline

3. **Parsing**: [03-STREAM-PARSER-ENGINE-SOURCE-CONCATENATED.md](./03-STREAM-PARSER-ENGINE-SOURCE-CONCATENATED.md) - Understand how provider responses are parsed

4. **Chrome Integration**: [04-CHROME-GOVERNOR-CDP-LAYER-SOURCE-CONCATENATED.md](./04-CHROME-GOVERNOR-CDP-LAYER-SOURCE-CONCATENATED.md) - Learn the browser automation layer

5. **Capabilities**: [05-UNIFIED-CAPABILITY-REGISTRY-SOURCE-CONCATENATED.md](./05-UNIFIED-CAPABILITY-REGISTRY-SOURCE-CONCATENATED.md) - Understand the capability system

---

*This folder and its contents were generated by concatenating the original documentation with the complete source code from all governing files mentioned in each document.*
