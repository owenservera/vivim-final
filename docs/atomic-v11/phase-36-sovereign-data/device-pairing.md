# Unit 36.4 — Device Pairing UX

**Fork ID:** 10.8 (v3: 9.8) | **Status:** `[~]` | **Class:** C

> **Audit (2026-07-13):** `src/engines/sync.ts` already implements the pairing **engine**: `pair(deviceId, name)` issues a 6-digit `pairingCode`, `confirmPair(deviceId, code)` authorizes; covered by `tests/unit/engines/sync.test.ts` ("pair creates pending peer with valid 6-digit pairing code"). The spec's remaining work is the **workspace UX surface** (settings view, code entry, device list, revoke) — not yet present in `web/`. Marked `[~]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.8-device-pairing.md`
**Depends on:** multi-device sync (10.3 done), backup (36.3)

## Context
Multi-device sync (10.3) has the transport; this adds the user-facing pairing flow: scan/code to link a new device and authorize it.

## Current State
- `src/engines/*` sync logic present; no pairing UI/flow.
- `web/ui/` primitives exist.

## Requirements
- Pairing handshake: generate a short-lived code on device A; enter on device B; mutual key exchange.
- Authorization surface lists paired devices + revoke.
- Wire into the workspace settings surface.

## Acceptance Criteria
1. Two devices pair via a time-limited code.
2. Paired device appears in the device list; revoke removes it.
3. Sync resumes after pairing.
4. `bun run devops gate` passes (root + `web/`).

## Tests
`tests/integration/device-pairing.test.ts` — A issues code → B pairs → both in list; revoke → removed.
`web/.../device-pairing.test.tsx` — renders code entry + device list.

## DevOps
```powershell
bun run devops gate
```
