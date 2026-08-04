# Task 02 — Wire `/api/setup/*` Next.js routes to existing `setup-router.ts`

**Phase**: B (Make first-run work in dev)
**Depends on**: nothing (independent)
**Effort**: 1–2 hr
**Files touched**:
- `frontend/src/app/api/setup/profiles/route.ts` (new)
- `frontend/src/app/api/setup/launch-visible/route.ts` (new)
- `frontend/src/app/api/setup/verify/route.ts` (new)
- `frontend/src/app/api/setup/complete/route.ts` (new)
- `frontend/src/app/api/setup/kill/route.ts` (new)
- `frontend/src/app/api/setup/workspace/route.ts` (new)

## Context

The frontend (`guided-landing.tsx`, `onboard-flow.tsx`, `WorkspaceSettings.tsx`) calls 6 endpoints under `/api/setup/*`:
- `GET /api/setup/profiles`
- `POST /api/setup/launch-visible`
- `POST /api/setup/verify`
- `POST /api/setup/complete`
- `POST /api/setup/kill`
- `GET/POST /api/setup/workspace`

**None of these routes exist as Next.js route handlers.** Every first-run API call 404s.

The backend already implements the logic in `src/server/setup-router.ts`. The handlers exist; they're just not exposed as Next.js routes.

## Goal

Create 6 Next.js route files that bridge `/api/setup/*` to the existing `setup-router.ts` handlers. Each route file is a thin proxy: parse the Next.js `Request`, call the setup-router handler, return a `NextResponse`.

## Pre-work: verify setup-router exports

Before writing route files, verify how `setup-router.ts` exposes its handlers. Open `src/server/setup-router.ts` and check:

1. Does it export individual handler functions (e.g. `export async function handleLaunchVisible(req: Request): Promise<Response>`)?
2. Or does it register them on a router object (e.g. `setupRouter.post('/launch-visible', handler)`)?
3. Or does it return a single `fetch` handler (e.g. `export function createSetupRouter(): (req: Request) => Promise<Response>`)?

The pattern determines the route file shape:

- **If individual exported functions**: route file imports the function and calls it.
- **If router object with `.handle()` or similar**: route file constructs a `Request` and calls the router's handler.
- **If single `fetch` handler**: route file imports the handler and delegates.

Use `templates/setup-api-route-handlers.ts.template` — it shows the pattern for the "individual exported functions" case (most likely based on the audit). Adjust if the actual export shape differs.

## Spec

### Pattern for each route file

Each route file follows this shape (example for `launch-visible`):

```ts
// frontend/src/app/api/setup/launch-visible/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { handleLaunchVisible } from '@/../../src/server/setup-router';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await handleLaunchVisible(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

### Route-by-route spec

| Route | Method | Request body / query | Response shape | setup-router function |
|-------|--------|----------------------|----------------|----------------------|
| `/api/setup/profiles` | GET | — | `{ ok: true, profiles: Array<{ providerId: string; accountSlug: string; profileDir: string; loginState?: string }> }` | `handleListProfiles()` |
| `/api/setup/launch-visible` | POST | `{ providerId: string; accountSlug: string; workspace: string }` | `{ ok: true; debugPort: number; pid: number }` | `handleLaunchVisible(body)` |
| `/api/setup/verify` | POST | `{ port: number; providerId: string }` | `{ ok: true; loggedIn: boolean; url?: string; cookieCount?: number }` | `handleVerify(body)` |
| `/api/setup/complete` | POST | `{ providerId: string; accountSlug: string; profileDir: string; debugPort: number }` | `{ ok: true; accountId: string }` | `handleComplete(body)` |
| `/api/setup/kill` | POST | `{ port?: number; pid?: number }` | `{ ok: true }` | `handleKill(body)` |
| `/api/setup/workspace` | GET / POST | GET: — / POST: `{ workspace: string }` | GET: `{ ok: true; workspace: string }` / POST: `{ ok: true }` | `handleGetWorkspace()` / `handleSetWorkspace(body)` |

**Important**: the exact function names in `setup-router.ts` may differ. Open the file and map the actual exports to the routes. The shape above is the contract the frontend expects — verify by reading the `fetch` calls in `guided-landing.tsx` (lines ~280–340) and `WorkspaceSettings.tsx`.

### If `setup-router.ts` doesn't export `handleKill`

The audit found `setup-router.ts` exposes launch-visible, verify, complete, restore, profiles, workspace — but **not kill**. If `handleKill` doesn't exist, implement it in `setup-router.ts`:

```ts
export async function handleKill(body: { port?: number; pid?: number }): Promise<{ ok: true }> {
  // Use the existing Chrome process killer from chrome-governor or fleet-supervisor
  // Look for an existing killChromeByPort() or similar utility
  // If none exists, use process.kill(pid) on Unix or taskkill on Windows
  // ...
}
```

Look in `src/engines/chrome-governor.ts`, `src/engines/fleet-supervisor.ts`, and `scripts/dev.ts` (which has `killOnPort` for Windows) for existing kill utilities to reuse.

## Acceptance criteria

- [ ] All 6 route files exist under `frontend/src/app/api/setup/`.
- [ ] Each route file imports from `src/server/setup-router.ts` (or a sibling module if the handlers live elsewhere).
- [ ] `curl http://localhost:3000/api/setup/profiles` returns `{ ok: true, profiles: [...] }` (may be empty array on fresh DB — that's fine).
- [ ] `curl -X POST http://localhost:3000/api/setup/launch-visible -H 'Content-Type: application/json' -d '{"providerId":"chatgpt","accountSlug":"default","workspace":"chrome-profiles"}'` returns `{ ok: true, debugPort: <port>, pid: <pid> }` and visibly launches Chrome.
- [ ] `curl -X POST http://localhost:3000/api/setup/verify -H 'Content-Type: application/json' -d '{"port":<port>,"providerId":"chatgpt"}'` returns `{ ok: true, loggedIn: false, url: "..." }` (or `loggedIn: true` after login).
- [ ] `curl -X POST http://localhost:3000/api/setup/kill -H 'Content-Type: application/json' -d '{"port":<port>}'` returns `{ ok: true }` and the Chrome process is gone.
- [ ] GuidedLanding first-run flow works end-to-end (manual test in browser).

## Verification

```bash
cd /home/z/my-project/vivim-final
bun run dev  # if not already running

# In another terminal:
curl -s http://localhost:3000/api/setup/profiles | jq
curl -s -X POST http://localhost:3000/api/setup/launch-visible \
  -H 'Content-Type: application/json' \
  -d '{"providerId":"chatgpt","accountSlug":"default","workspace":"chrome-profiles"}' | jq
# Note the debugPort from the response, then:
curl -s -X POST http://localhost:3000/api/setup/verify \
  -H 'Content-Type: application/json' \
  -d '{"port":<debugPort>,"providerId":"chatgpt"}' | jq
# Log in to ChatGPT in the Chrome window, then re-run verify — should return loggedIn: true
curl -s -X POST http://localhost:3000/api/setup/complete \
  -H 'Content-Type: application/json' \
  -d '{"providerId":"chatgpt","accountSlug":"default","profileDir":"<from-launch>","debugPort":<port>}' | jq
curl -s -X POST http://localhost:3000/api/setup/kill \
  -H 'Content-Type: application/json' \
  -d '{"port":<port>}' | jq
```

## Notes

- This task is independent of Task 01 (shared types) — the route files don't import from `shared/onboarding`. They can be done in parallel.
- Don't add Zod validation in the route files — `setup-router.ts` should already validate its inputs. The route file is a thin proxy. If `setup-router.ts` doesn't validate, add validation there, not in the route.
- The frontend expects `{ ok: true, ... }` or `{ ok: false, error: string }` shapes. Make sure errors are returned in this shape, not as bare strings.
