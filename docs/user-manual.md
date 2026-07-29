# vivim v3 — User Manual

## 1. Getting started (onboarding)

**Goal:** Install vivim, log in, and send your first message within 10 minutes.

1. Clone the repository and install dependencies with `bun install`.
2. Start both services: `bun run dev` (or `bun run dev:backend` + `bun run dev:frontend` in separate terminals).
4. Open `http://localhost:3000` (or the port shown in your terminal).
5. The **Onboarding Wizard** walks you through:
   - **Welcome** — confirm you're setting up a local-first workspace.
   - **Workspace** — pick a workspace name and data directory.
   - **Model** — choose a default model tier (free or paid).
   - **Provider** — select a provider (ChatGPT, Claude, Gemini, etc.).
   - **Task** — pick an initial task (chat, research, code, etc.).
6. After onboarding, you land in the **Chat** surface. Type a message and press **Send**.

> **Gotcha:** If the frontend shows a red error in the composer, click **Retry**. If the backend isn't reachable, verify `CAP_STORE_PORT` (default `9420`) matches the backend.

## 2. Navigating the workspace

**Goal:** Move between conversations, providers, and tools without losing context.

- **Sidebar** — lists all conversations for the active provider. Click any row to switch.
- **Mobile** — on narrow screens the sidebar becomes a slide-out drawer (tap the hamburger icon).
- **New conversation** — use the **+** button in the sidebar or the global command palette (`Ctrl+K` / `⌘K`).
- **Search** — type in the conversation search bar to filter by title.
- **Surfaces** — use `Ctrl+Tab` / `⌘+Tab` to cycle between Chat, Capabilities, and Dev Console.

> **Gotcha:** The sidebar only shows conversations for the currently selected provider. Switch provider to see other conversations.

## 3. Authoring with canvases

**Goal:** Capture and edit structured blocks of content.

- The **Composer** accepts plain text, code, and rich responses.
- Press **Enter** to send a plain-text message. Use **Shift+Enter** for a newline.
- Responses stream in real time. Each block is self-contained and can be copied individually.
- Use the **Action Bar** on any message block to:
  - Copy text
  - Edit a previous message
  - Regenerate the last response
  - Delete a message

> **Gotcha:** Some providers (e.g. Gemini) use a custom composer that requires clicking the send button instead of pressing Enter.

## 4. Delegating tasks to the agent (HITL, pause/resume)

**Goal:** Run multi-step tasks with human-in-the-loop control.

- Open the **Dev Console** (`Ctrl+`` / `⌘+``) to see live capability events.
- Type natural-language tasks (e.g. "send message to claude", "search knowledge for X").
- The interpreter maps your text to a **capability** and streams the result.
- Long-running tasks show a status indicator. You can cancel or pause where supported.
- Review the **Capability Catalog** surface to browse all available capabilities grouped by provider and slot.

> **Gotcha:** Not every capability supports pause/resume. Check the capability's `requiresUserConfirmation` field before relying on it.

## 5. Curating your memory (verify / reject / edit)

**Goal:** Keep your knowledge graph accurate and trusted.

- Memory entries appear as **Content Blocks** in conversations.
- Use `cap:memory:query` to search past memory.
- Use `cap:memory:assert` to confirm a memory is correct.
- Use `cap:memory:forget` to remove stale or incorrect memories.
- Memory is local-first. Exports live in your data directory.

> **Gotcha:** Memory assertions and forgets are immediate and cannot be undone. Review before confirming.

## 6. Setting up providers (local Ollama / cloud with consent)

**Goal:** Connect a browser-based provider and start messaging.

1. Go to **Provider Setup** (wizard or Settings).
2. Choose a provider:
   - **ChatGPT** — uses `#prompt-textarea` and OpenAI-compatible streaming.
   - **Claude** — uses ProseMirror with Anthropic SSE streaming.
   - **Gemini** — uses Quill-based composer with custom Google RPC streaming.
   - **DeepSeek / Qwen / Grok** — same browser-slave pattern, no stream parser yet.
3. Sign in through the captured browser profile.
4. vivim saves the profile under `chrome-profiles/<provider>/<account>`.
5. Use `bun run devops discover-protocol <url> --hint=<name>` if auto-detection fails.

> **Gotcha:** Profiles are per-provider + per-account. Only one profile per `(provider, account)` pair is allowed. Delete duplicates with `ProfileAllocator` cleanup.

## 7. Backup & restore (.vivim bundle)

**Goal:** Migrate or recover your full workspace state.

- Export a `.vivim` bundle from **Settings → Export**.
- The bundle contains:
  - Conversations
  - Content units
  - Provider profiles and auth cookies
  - Memory and knowledge store
- Restore by importing a `.vivim` bundle in **Settings → Import**.
- Automated backups are scheduled via `cap:schedule:register`.

> **Gotcha:** Restoring a bundle merges with existing data. Duplicate conversations are deduplicated by ID; provider cookies are replaced.

## 8. Syncing across devices (pairing code)

**Goal:** Use the same workspace on multiple machines.

- On the primary machine, open **Settings → Sync** and generate a **pairing code**.
- On the secondary machine, enter the pairing code.
- Both machines must share the same `dataDir` (network drive) or use a compatible cloud sync folder.
- Conflict resolution: last-write-wins for conversations; provider cookies are not synced (re-auth per device).

> **Gotcha:** Do not sync the `chrome-profiles/` directory over iCloud/Dropbox — file locking will corrupt cookies. Only sync `vivim-data/`.

## 9. Troubleshooting (offline mode, consent errors, latency)

**Goal:** Diagnose and recover common issues quickly.

### Offline / backend down
- Verify the backend process is running (`Get-Process -Name bun` or check port `9420`).
- Restart with `bun run dev:backend`.

### Consent / auth errors
- Re-run provider setup: `bun run devops runtime-test setup --provider=<slug> --account=<id>`.
- Delete the stale profile under `chrome-profiles/<provider>/<account>` and re-login.

### Slow or hanging responses
- Check **Health Dashboard** for provider latency.
- Use the Dev Console (`Ctrl+``) to inspect the WS event stream.
- Run `bun run devops runtime-test health` for a full preflight.

### Capability not found
- Run `bun run devops runtime-test preflight` to verify the capability registry.
- Run `bun run devops verify-cross-surface` to check CLI/API/UI parity.

> **Gotcha:** The CLI is a thin client — it needs the backend running. If `cap:llm_test:*` or any capability returns 404, restart the backend so it reloads the registry.
