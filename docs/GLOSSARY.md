# Glossary

Domain terms and internal shorthand used in the vivim-final project.

## A

- **ADR (Architecture Decision Record)**: A short file documenting a significant architectural decision, including context, decision, consequences, and alternatives. See `docs/decisions/`.

## C

- **Capability**: An atomic CDP method backed by a database row. Capabilities are provider-bound (e.g., `send_message`, `select_model`) and executed via the interpreter.
- **CDP (Chrome DevTools Protocol)**: The protocol used to control Chrome/Chromium browsers for provider interaction and data extraction.
- **ChromeGovernor**: The engine layer managing CDP proxy, lifecycle, trace, and health for browser automation.

## D

- **Dual-DB**: The dual-database architecture separating core application data from archival/cold storage. See `docs/architecture/dual-db.md`.

## E

- **Engine**: One of 13 core computation engines organized in layers (L0-L4) that power the vivim-final system. See `docs/modules/engines.md`.

## K

- **Knowledge Graph**: The provider knowledge graph rebuilt as the core data structure for vivim-final v1.

## O

- **Onboarding**: The 8-phase pipeline for testing and integrating new providers (discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge).

## P

- **Provider**: A chat service or API that vivim-final can interact with (e.g., claude, gemini, chatgpt, deepseek). 16 providers are currently registered.
- **ProviderRegistrar**: The L0-L1 engine responsible for provider registration and health checks.

## S

- **Sidecar**: The Bun runtime backend process (vivim-server.exe) that runs alongside the Tauri desktop frontend.
- **Stream Parser**: Logic for parsing streaming responses from providers, stored inline in the database (`logic_code`, `logic_type=inline`).
- **StreamBlockStore**: The L4 engine for storing and retrieving streaming conversation blocks.

## T

- **Tauri**: The framework used to build the vivim-final desktop application (V2 upgraded, NSIS installer only).
- **UPX**: The executable packer used to compress the desktop sidecar binary (Level 3 recommended: 45.6 MB, 47% ratio).

## V

- **vivim-desktop.exe**: The main Tauri desktop application executable.
- **vivim-server.exe**: The Bun runtime sidecar executable that powers the backend.