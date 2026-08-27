# Vivim Alpha — Release Plan (Friends & Family Stealth Test)

> **Ground truth:** every claim below was verified against real code on 2026-08-26.
> No aspirational docs were trusted. Sources cited as `file:line` where load-bearing.

---

## 1. What This Is

**Vivim** is a local-first AI conversation platform: a Windows desktop app (Tauri v2 shell)
with an embedded Bun backend ("sidecar"), a SQLite knowledge store, and a canvas-first UI.
Your friends install one `.exe` installer. Everything runs on their machine — loopback only,
no cloud dependency, no account required.

**Alpha goal:** validate the *core loop* (install → first message → daily return) with 5–10
trusted testers, and harvest structured feedback through a designed onboarding journey —
not ad-hoc Discord complaints.

## 2. Audience & Trust Model

| Aspect | Decision |
|---|---|
| Who | Close friends, hand-picked, mixed technical skill |
| NDA | Trust-based; no legal paper. One line in welcome message: "private build, please don't share the installer or screenshots publicly" |
| Size | Start 5, expand to 10 after first weekly retro |
| Platforms | **Windows 10/11 x64 only** (NSIS is the only bundle target — `src-tauri/tauri.conf.json:33`) |

## 3. Distribution

- **Artifact:** `Vivim_1.0.0_x64-setup.exe` (NSIS, `installMode: currentUser` → no admin rights needed)
- **Channel:** private link (Drive/Dropbox) + SHA-256 hash posted alongside
- **Updates:** none automatic — Tauri updater plugin was *removed* in the V2 upgrade
  (`tauri.conf.json` has no updater config). Updates = "download new installer, run it."
  Say this explicitly in onboarding; testers must expect manual updates.
- **Uninstall:** standard Windows Apps list (NSIS `QuietUninstallString` verified working via devops toolkit)

## 4. First Boot Reality (what testers will actually see)

1. Installer runs silently-ish → app launches with window **hidden** (`visible:false`, tauri.conf.json:21)
2. Rust shell spawns sidecar `vivim-server.exe` on `127.0.0.1:9421` (loopback only — `src/desktop/sidecar-entry.ts:9`)
3. Sidecar resolves DB to `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite`; **first boot seeds from embedded DB snapshot** (`sidecar-entry.ts:99`)
4. Backend `/readyz` flips ready → window reveals
5. Frontend calls `checkNeedsSetup()` → auto-opens **GuidedLanding** for first-run users (`frontend/src/app/page.tsx:109-119`)

Zero-config requirement: storage defaults to embedded SQLite, auth token empty (localhost open),
no API keys needed for Chrome-login providers. A non-technical friend can install cold.

## 5. Scope Contract for Alpha

**In scope (expected to work):**
- Install/launch/uninstall cycle
- Canvas UI: 3 layers (chat/build/admin), unified entry, command palette, panels, themes
- Conversation create/send/stream/delete over WebSocket
- ~39 real capabilities across conversation/knowledge/memory/admin/system/storage/opencode domains
- Help system widget (Search / Chat / Tours / Actions)
- Provider chat for **claude + gemini + deepseek** *if* tester connects their own logged-in Chrome profile

**Out of scope (say so up front):**
- ChatGPT/Qwen/Grok providers (parser unvalidated / missing)
- Cloud AI without keys (AI Gateway ships disabled, simulator-only)
- P2P sync between friends' machines (libp2p bundled but experimental)
- Auto-update, macOS/Linux, mobile

## 6. Status Board (honest, code-derived)

Full inventory with per-feature evidence lives in [03-FEATURE-INVENTORY.md](03-FEATURE-INVENTORY.md).
Summary:

```
WORKING        ██████████████████████░░░░░░░  core loop + desktop shell + capability engine
CONDITIONAL    ██████████████░░░░░░░░░░░░░░░  provider CDP chat, opencode agent, automation
EXPERIMENTAL   ████████░░░░░░░░░░░░░░░░░░░░░  P2P/sync/tunnel, autonomous execution, canvas engine
KNOWN-BROKEN   ███░░░░░░░░░░░░░░░░░░░░░░░░░░  sandbox quickjs migration, ChatGPT parser, 3.5k stub caps
```

Known-issue highlights to publish to testers:
- Sandbox hardening (QuickJS) mid-migration — legacy VM still default path
- Of ~3,587 registered capabilities, ~3,509 are catalog specs returning graceful
  `not_implemented` (they're discoverable but not executable — by design, taxonomy-first architecture)
- 87 open static-analysis findings (3 critical secrets *declined* by owner — none shipped in binary;
  28 medium quality issues) — tracked, not alpha-blocking

## 7. Release Checklist (pre-flight)

- [ ] Run full desktop-loop gate: `bun run devops desktop-loop run --version <x.y.z>`
      (Build → Install → Launch+Render → Capture → Report — all green)
- [ ] Fresh-VM smoke: install on a clean Windows VM, verify GuidedLanding appears,
      send one conversation message, restart app, verify persistence
- [ ] Verify embedded DB snapshot bootstraps on truly-first boot (delete `%LOCALAPPDATA%\vivim` first)
- [ ] Publish SHA-256 + version + known-issues link to test group
- [ ] Open feedback intake (see onboarding doc §6)

## 8. Rollout Cadence

| Wave | When | Who | Focus |
|---|---|---|---|
| W0 | Day 0 | You | Full gate green, fresh-VM proof |
| W1 | Day 1–3 | 2 most technical friends | Break the install path early |
| W2 | Day 4–7 | Remaining 3–8 | Onboarding journey + discovery sessions |
| Retro | Day 7 | All | Structured retro (template in onboarding doc §7) |
| W3 | Day 8+ | +expansion | Deeper surfaces (providers, agents, canvas building) |

## 9. Success Metrics (keep it human)

1. **Activation:** % who send a first message unaided within 15 min of install
2. **Aha moment:** each tester names ≥1 thing that surprised them positively (retro Q1)
3. **Return rate:** % active on day 3 and day 7
4. **Feedback quality:** ≥5 reproducible bug reports (steps included), not vibes
5. **Onboarding integrity:** where did people get stuck? (mapped against journey stages)
