# Engines Module

**Purpose:** Core computation engines organized in layers that power the vivim-final knowledge graph system.

## Description
The engines module contains 13 engines organized in conceptual layers:

- **L0-L1:** Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
- **L2-L3:** Capability System (CapabilityResolutionEngine, CapabilityEngine)
- **L4:** Session & State (ConversationManager, StreamBlockStore)
- **Chrome Layer:** ChromeGovernor (CDP proxy, lifecycle, trace, health)
- **Cross-cutting:** CapabilityEventBus, ConfigManager, StreamParserEngine
- **Lifecycle:** RegistrationAuditor, VersionManager, TelemetryAggregator

## Public Interface
- Engine registration and health checks via ProviderRegistrar
- Capability resolution and execution via CapabilityEngine
- Session management via ConversationManager
- Chrome DevTools Protocol integration via ChromeGovernor

## Internal Gotchas
- Engines are interdependent - startup order matters
- ChromeGovernor requires external browser process
- StreamBlockStore is not automatically invalidated - manual flush required

## Owner: VIVIM.inc
## Last Reviewed: 2026-08-15