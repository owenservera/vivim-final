# Storage Contracts

## Contracts Directory Structure
`src/storage/contracts/` contains interfaces that engines depend on. Implementations go in `src/storage/impl/`.

## Core Contracts

| Contract | Interface | Purpose |
|----------|-----------|---------|
| ProviderStore | IProviderStore | Provider CRUD + lookup |
| GovernorStore | IGovernorStore | Chrome slave state |
| ConversationStore | IConversationStore | Conversation persistence |
| StreamBlockStore | IStreamBlockStore | Content block storage |
| CapabilityStore | ICapabilityStore | Capability registration |
| HealthStore | IHealthStore | Health history |
| AutomationStore | IAutomationStore | Scheduled tasks |
| AlertStore | IAlertStore | Alerting state |
| VersionStore | IVersionStore | Schema versions |
| ConfigStore | IConfigStore | Configuration entries |
| TelemetryStore | ITelemetryStore | Metrics storage |
| ContextAssemblyStore | IContextAssemblyStore | Context pipeline state |
| KnowledgeIngestionStore | IIngestionStore | Knowledge ingestion |
| KnowledgeExtractorStore | IExtractorStore | Fact/entity extraction |
| SemanticSearchStore | ISemanticSearchStore | Embedding storage |
| CrossConversationSynthesisStore | ISynthesisStore | Cross-conv synthesis |
| MuxStore | IMuxStore | Provider routing state |
| SituationStore | ISituationStore | Situation detection |
| WorkspaceStore | IWorkspaceStore | Projects/Topics |
| RouterStore | IRouterStore | Request routing |

## Key Methods (per contract)
See `src/storage/contracts/{name}-store.ts` for full TypeScript interfaces.

## Implementation Rule
- Engines: `import { type IProviderStore } from '@/storage/contracts/provider-store.js'`
- Never import from `src/storage/impl/` in engines
- All implementations use Prisma client via `src/storage/prisma.ts`