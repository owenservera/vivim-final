# Open Questions — VIVIM Roadmap Design

**Status:** RESOLVED (Architecture) — Business decisions pending
**Date:** 2026-07-10

---

## Resolved (Architecture)

All technical decisions have been made. See `ROADMAP.md` for full details.

| # | Question | Answer | Source |
|---|----------|--------|--------|
| 1 | CDP Transport | Raw WebSocket | Port `BunCdpClient` against vivim-final source |
| 2 | Chrome process mgmt | Profile isolation per provider+account | Port `launcher.ts` against vivim-final source |
| 3 | Chrome binary detection | Auto-detect + config override | Port `detectChromePath()` against vivim-final source |
| 4 | Port allocation | Scan for available | Port `findAvailablePort()` against vivim-final source |
| 5 | Streaming protocol | WebSocket | Bidirectional — server pushes chunks |
| 6 | API style | Hybrid (REST + dispatch) | Matches cap-store pattern |
| 7 | Selector strategy | Hybrid (already designed) | Static + recovery + drift detection |
| 8 | MVP scope | MVP-D: Remux + agent mode | Full value prop from day one |
| 9 | Build order | Full backend first | CLI-testable, UI component registry |
| 10 | Frontend approach | Build new | Learn from vivim-app-og, don't port |

---

## Pending (Business — User Decision)

| # | Question | Options |
|---|----------|---------|
| 11 | Pricing | Free tier? Pro tier? Enterprise? |
| 12 | Distribution | Direct download? App store? Both? |
| 13 | Provider agreements | Do we need agreements with Anthropic/OpenAI/Google? |

---

## Design History

### Round 1: Architecture (2026-07-10)
- CDP Transport: Raw WebSocket (port against vivim-final source)
- Chrome profile isolation: Per provider+account combo
- Selector strategy: Hybrid (static + recovery + drift detection)

### Round 2: Product (2026-07-10)
- Frontend: Build new (learn chrome slave mechanism from vivim-app-og)
- API style: Hybrid (REST for CRUD + dispatch for actions)
- Streaming: WebSocket (bidirectional)

### Round 3: Implementation (2026-07-10)
- MVP scope: MVP-D (remux + agent mode)
- Critical path: Chrome automation layer first

### Round 4: Technical (2026-07-10)
- Chrome binary: Auto-detect per OS + config override
- Port allocation: Scan for available ports
- Build order: Full backend first, CLI-testable
