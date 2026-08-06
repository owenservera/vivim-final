# VIVIM Review — Out-of-Scope Register (alpha focus)

> **Default-in, flag-out.** Nothing is out of scope here unless you add it.
> Everything not listed below is **alpha-in-scope** and gates the alpha release.
> Findings in a listed area are **documented + tracked but never gate alpha and
> get no implementation time now** — they remain valid placeholders.
>
> The review system **reads this file**. `triage.ts` matches every finding
> against the **Match column** below (deterministic regex). A finding that
> matches an area's patterns is classified **future** (tracked only); everything
> else stays **alpha**. Anything ambiguous fails toward alpha — see
> `CONSTITUTION.md §12`.

## How to flag an area as out of scope

Append a row to the table below with: the **area name** (stable slug), a short
**description** of its boundaries, **why/boundary** (what is deferred, what is
still alpha), the **date**, and a **Match** pattern. Removing the row re-flags the
area back to alpha.

**Match column format:** a `/regex/` tested (case-insensitive) against each
finding's `location + issue + recommendation`. Findings matching any pattern in
the row are classified under that area. Patterns may be plain substrings too (a
quoted literal, no slashes). If the regex needs alternation, use
`/(auth-gate|AUTH_TOKEN|timingSafeEqual)/`.

## Out-of-scope areas (alpha)

| Area | Description / boundaries | Why (deferred part) | Match | Flagged |
|------|--------------------------|---------------------|-------|---------|
| `remote-capability-sync` | Remote capability / catalog sync between VIVIM instances over the network. The **local** capability registry is alpha-in-scope; only the **remote sync path** is out. | P2P/network transport is a placeholder, not needed for alpha launch. | `/(capability[ -]?sync)\|(remote.{0,20}capab)\|(sync.{0,20}(catalog\|capab))/` | 2026-08-06 |
| `tunnel` | Remote VIVIM tunnel (libp2p P2P stack, remote `vivim-server` reachability). Local `127.0.0.1` serving stays alpha; only the **remote/tunnel path** is out. | libp2p full mesh + approval chain are placeholders, not needed for alpha. | `/(libp2p)\|(tunnel)\|(remote vivim-server)/` | 2026-08-06 |
| `auth-token` | API authentication (`CAP_STORE_AUTH_TOKEN` / `VIVIM_TUNNEL_TOKEN`: auth-gate, fail-closed, constant-time compare, route-gate audit, setup-route protection). Local-first localhost serving stays alpha; only auth is deferred. | Auth is a placeholder for future remote/multi-user use; localhost-only is acceptable for alpha as long as nothing **breaks alpha**. | `/(auth.?gate)\|(AUTH_TOKEN)\|(timingSafeEqual)\|(constant.?time)\|(fail.?open)\|(unauthenticated)\|(auth.?fail)\|(bootstrap token)\|(fail-closed)/` | 2026-08-06 |

## Convention notes

- A flagged area being **present but inert** (a placeholder) is NOT a finding to
  act on — it is expected. Findings in flagged areas get one line: "placeholder
  for future — see SCOPE.md".
- `triage.ts` is the single classifier. Any finding that matches **no** Match
  pattern is **alpha-in-scope** (fail toward launch).
- A finding can match only one area; first matching row in table order wins
  (auth before tunnel before sync).
- **Ambiguity rule:** if the Match column is empty or a regex is malformed, the
  whole row is IGNORED and anything touching it is treated alpha — a broken
  scope row must never silently defer a finding.
- Re-flag to alpha: remove the row (or delete its Match pattern).