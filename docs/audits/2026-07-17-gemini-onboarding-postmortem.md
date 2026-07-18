# Post-Mortem & System Audit: Gemini Onboarding Session (geminie-test.md)

**Session:** ses_08ea5d29cffeGwkCtaWj9Y2Mnf
**Date:** 2026-07-17
**Verdict:** The agent eventually succeeded in discovering the gemini account, but only after
repeated human corrections. 5 systemic gaps were confirmed. This report captures findings +
remediation plan.

---

## 0. What Actually Happened (timeline of failures)

1. Agent launched stack, scaffolded a spec, asked 4 interview questions (deliverable / parse scope /
   media / mode). User answered: **Provider onboarding (PRD-12)**.
2. User interrupted: *"first - do you have a logged in gemini chrome slave you can use for this?"*
   → Agent ran `devops agentic preflight` but only grepped for `gemini` text, found nothing in the
   DB account list (all `loginState: unknown`), and concluded **"No Gemini account exists in the DB,
   and there is no logged-in Gemini Chrome slave."** — WRONG.
3. User corrected: *"you should know the setup process - you launch a chrome to the provider website
   i login and you identify the account and register it."*
4. Agent then queried `GET /api/setup/profiles` → found `gemini/owservera` profile **on disk with
   cookies** but `dbLinked: false`. It RESTORED it, launched a visible Chrome, VERIFIED it was
   `loggedIn: true` (cookie_check on gemini.google.com/app), and COMPLETED registration. This whole
   detour cost ~15 tool calls that the agent should have done autonomously in step 2.
5. Agent tried `discover-protocol` (not a `runtime-test` subcommand) → usage error. Then
   `onboard discover` → *"requires --url and a live Chrome (cdp)"* even though it had just engaged the
   slave. Root cause: the `onboard` CLI handler **never injects a CDP client** into `opts.cdp`
   (confirmed in `devops/index.ts` `onboard` case + `devops/onboard-controller.ts` `dispatchMode`/
   `modeDiscover`). Agent patched this live (added context-probe CDP resolver into the onboard handler).
6. Agent ran top-level `bun run devops discover-protocol` (correct path) → got real protocol data
   (`.ql-editor` Quill, `.enable-lr26-markdown-styling` response container).
7. User corrected again: agent's CDP resolver attached to a **blank tab** because it picked the first
   page target / created `about:blank`. Fix: attach to the tab whose URL matches the provider.

---

## 1. GAP 1 — Agent should know WHICH gemini + WHERE the slave lives WITHOUT human help

**Evidence:** lines 1228-1412. The DB `preflight` showed `loginState: unknown` for all accounts, so
the agent assumed no gemini existed. But the **profile is the source of truth**, not the DB row.

**Root cause:** The agent was not instructed (and no skill automated) the canonical "find-or-adopt"
sequence:
- `GET /api/setup/profiles` (lists on-disk Chrome profiles w/ `hasCookies` + `dbLinked`)
- If `hasCookies && !dbLinked` → `POST /api/setup/restore` (re-links on-disk profiles)
- `POST /api/setup/launch-visible` (spawn visible Chrome on the existing profile)
- `POST /api/setup/verify` (cookie-based auth check)
- `POST /api/setup/complete` (finalize DB row)

**The `devops-fullstack` skill even documents this exact flow** ("Protocol Discovery", "Preflight:
Always Know the Current State" → `bun run devops agentic preflight`) but the preflight output is a raw
dump of DB accounts only — it does NOT surface on-disk profiles with cookies, nor a clear
"gemini: 1 profile on disk (cookies present), not yet DB-linked → run restore" recommendation.

**Fix (code, not just docs):**
- Extend `context-probe.ts` / `generatePreflightContext()` to include `onDiskProfiles` (from
  `GET /api/setup/profiles`) and a `suggestedAction` like: `"gemini: profile 'owservera' has cookies
  but is not DB-linked. Run: POST /api/setup/restore then launch-visible + verify + complete."`
- Add a single composite command `bun run devops agentic adopt --provider=gemini` that performs the
  restore→launch→verify→complete sequence in one bounded call. This is the "you launch chrome, I log
  in, you register" flow the user described.
- Make the `agentic preflight` output lead with a **providers-ready** summary (which providers have a
  live/cookie-valid slave) instead of only raw DB `loginState: unknown` rows.

---

## 2. GAP 2 — Agent should have used EXISTING tools to test provider capability STATUS

**Evidence:** The agent never, at any point, ran `bun run devops runtime-test test --nl="..."` or
`test-cap` to check whether gemini already resolved as a capability. It went straight to discovery +
seed authoring.

**Root cause:** No skill step says "before onboarding, probe the NL resolver to see if the capability
already exists / partially resolves." (The skill's Phase 4 says probe NL *after* discover — wrong
order for a re-onboard of an already-seeded provider.)

**Fix:**
- In `devops-fullstack` Phase 3/4, add an explicit **"capability status probe"** that runs
  `test --nl="send message to gemini"` and `test-cap --slug=gemini_send` (if exists) BEFORE discovery,
  to establish current state. Output should classify: `already-registered` / `partial` (seed present,
  no live slave) / `absent`.
- Add `bun run devops runtime-test status --provider=gemini` that prints a one-screen capability
  status (seed present? parser confidence? live slave? selectors valid?).

---

## 3. GAP 3 — If in doubt, use CODE we actually have, not custom harness scripts

**Evidence:** The agent invented workarounds (writing `.runtime/discover-gemini.json` via
`Out-File`, fighting PowerShell truncation) instead of using the existing `discover-protocol`
top-level command. It also initially guessed `runtime-test discover-protocol` (which doesn't exist)
before finding the top-level one.

**Root cause:** The command taxonomy is split across `bun run devops <top-level>` and
`bun run devops runtime-test <sub>` and the two are NOT consistent:
- `discover-protocol` exists ONLY as top-level (`bun run devops discover-protocol`).
- `onboard ...` exists ONLY under `runtime-test`.
- The skill text lists `discover-protocol` under `runtime-test` (WRONG) and omits that `onboard` needs
  CDP injection that the CLI doesn't provide.

**Fix:**
- Make `discover-protocol` available under BOTH `bun run devops discover-protocol` AND
  `bun run devops runtime-test discover-protocol` (alias).
- Fix the `devops-fullstack` skill text (lines 180, 256) to match reality: `discover-protocol` is a
  top-level command; `onboard` lives under `runtime-test` and requires the agent to either use
  top-level `discover-protocol` OR pass an engaged slave.
- Add a `bun run devops discover --provider=gemini` convenience that auto-picks the live slave and
  runs protocol discovery — so the agent never hand-rolls discovery.

---

## 4. GAP 4 — DB → CLI → Agent pipeline is OBFUSCATED

**Evidence:** Three different "views" of the same truth gave contradictory signals:
- `devops agentic preflight` → DB accounts all `loginState: unknown` (looks empty).
- `GET /api/setup/profiles` → `gemini/owservera` has cookies, `dbLinked: false` (the real truth).
- Live Chrome at :9282 → `loggedIn: true` via cookie check.
The agent trusted the first (most pessimistic, least accurate) view and asked the human.

**Root cause:** No single authority. DB `loginState` is unreliable (stale — see CDP gotcha #6 in the
skill). The CLI surfaces 3 inconsistent sources with no reconciliation.

**Fix:**
- Create a single `bun run devops agentic state --provider=gemini` command that reconciles ALL three
  sources (DB row + on-disk profile + live Chrome cookie check) into one canonical verdict:
  `{ provider, onDiskProfile, hasCookies, dbLinked, liveSlave, verifiedLoggedIn, recommendedAction }`.
- Stop emitting raw `loginState: unknown` as the headline. The headline must be the reconciled verdict.
- Add a `fleet` command set (`POST /api/fleet/start`) awareness to preflight so adopted/spawned slaves
  are shown with their `profileDir` + `debugPort` + auth status in one table.

---

## 5. GAP 5 — Audit the entire devops / skills / speckit system

The session exposed that the devops CLI + skills are **inconsistent and under-wired**. Full audit
findings:

### 5a. Onboard CLI is half-wired (CONFIRMED BUG)
`devops/index.ts` `onboard` case builds `opts` with NO `cdp` field. `onboard-controller.ts`
`dispatchMode`/`modeDiscover` require `opts.cdp`. Therefore `onboard discover|test-selectors|
test-frontend` ALWAYS fail with "requires live Chrome" when called from CLI. The agent patched this
by injecting a context-probe CDP resolver — but that patch has a bug (attaches to blank/first tab, not
the provider-matching tab — user caught it at line 3829).

**Action:** Keep the agent's CDP-injection fix but correct target selection to prefer the tab whose
URL includes the provider/hint (the fix was applied at line 3844). Add a regression test in
`tests/unit/devops/onboard-cdp-injection.test.ts` asserting `opts.cdp` is populated when a live slave
exists.

### 5b. Skill ↔ CLI drift
`devops-fullstack` skill documents commands that don't exist as written (`discover-protocol` under
`runtime-test`; `setup --provider= --account=` requiring an email even though the agent should
"launch chrome, you login, I register" without pre-known email). Skills must be generated/verified
from the actual CLI dispatch, not hand-maintained.

**Action:** Add a CI check (`bun run devops audit-code standard` already exists) that greps skill
`runtime-test` command references against the real `devops/index.ts` + `runtime-test/index.ts` dispatch
tables and fails on unknown commands.

### 5c. SpecKit integration is decorative
The session scaffolded `specs/016-gemini-webapp-tooling/spec.md` + `plan.md` but NEVER ran
`bun run devops speckit sync`, `gate`, or `converge`. The spec was dead weight. The skill says "use
devops-fullstack for implementation only, after tasks are created" but the agent never created tasks
or synced.

**Action:** The `onboard run` should auto-create the spec dir + call `speckit sync` + record phases in
the onboard ledger as spec tasks. Make spec+tasks a FIRST-CLASS, enforced step of onboarding, not
optional prose.

### 5d. PowerShell truncation / JSON leakage
The agent lost discovery output to `Select-Object -First 80` truncation and to the `$ bun run`
stderr banner leaking into stdout JSON files. This is a tooling hygiene issue.

**Action:** All `devops` CLI commands should write structured JSON to stdout only (route banners to
stderr already, but the `[db] pragmas configured` line leaks) and support `--json` to suppress human
banners. Provide `bun run devops discover-protocol ... --out=.runtime/x.json` to persist cleanly.

---

## Remediation Priority (do in this order)

| # | Fix | Where | Effort |
|---|-----|-------|--------|
| P0 | `agentic adopt --provider=gemini` composite (restore→launch→verify→complete) | `devops/agentic/` + `index.ts` | M |
| P0 | Reconciled `agentic state --provider=X` (DB+disk+live) single verdict | `context-probe.ts` | M |
| P0 | Onboard CLI injects CDP w/ correct provider-tab selection (fix + test) | `devops/index.ts`, `onboard-controller.ts` | S |
| P1 | `discover-protocol` alias under `runtime-test` + `discover --provider=` | `runtime-test/index.ts` | S |
| P1 | `agentic preflight` leads with providers-ready, not raw unknown rows | `context-probe.ts` | S |
| P1 | Capability status probe before discovery (already-registered/partial/absent) | `devops-fullstack` skill + `runtime-test status` | M |
| P2 | Skill↔CLI drift CI check (unknown commands fail) | `audit-code` or new script | M |
| P2 | SpecKit tasks auto-created + synced as part of onboard | `onboard-controller.ts` | M |
| P2 | `--json` / `--out=` clean output mode for all devops commands | `devops/index.ts` | M |

---

## Core Lesson (the one that matters most)

The agent has access to EVERYTHING it needs (on-disk profiles, restore/launch/verify/complete API,
top-level `discover-protocol`, live CDP). It failed because:
1. The **preflight view was pessimistic and un-reconciled** → it trusted "no gemini" and asked a human.
2. The **onboard CLI was un-wired** (no CDP injection) → it couldn't use its own tools.
3. The **skills drifted from the CLI** → it guessed wrong commands.

Fix the tooling (P0 items) and the agent will be autonomous on this class of task. Do NOT add more
docs the agent won't read — fix the CLI surface so the *default* command path is the correct one.
