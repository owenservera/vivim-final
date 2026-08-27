# 08 — GUIDED TOUR SPEC
### Generates: docs/tour-manifest.json + a minimal in-app tour engine

A tour is a sequenced walk where each step points at **either** a doc section **or** a live piece of UI (or both) — this is what turns the wiki from "reference you look up" into "thing that teaches you the app by walking you through it."

---

## 1. `docs/tour-manifest.json` schema

```json
{
  "tours": [
    {
      "id": "getting-started",
      "title": "Getting Started",
      "audience": "end-user",
      "entry_points": ["first-run", "help-menu"],
      "steps": [
        {
          "id": "step-create-project",
          "title": "Create your first project",
          "narrative": "Short, second-person, tour-paced text — can diverge from the wiki's prose since pacing needs differ. Do not just copy a doc paragraph verbatim; write for a live walkthrough.",
          "doc_ref": { "docId": "feature-list", "sectionId": "project-management" },
          "ui_target": { "route": "/dashboard", "selector": "[data-tour='create-project-button']" },
          "action_hint": "click"
        }
      ]
    }
  ]
}
```

Rules:
- `doc_ref` and `ui_target` are each optional individually, but **every step must have at least one**. A step with neither is not a tour step, it's an orphaned idea — reject it.
- `doc_ref.sectionId` must resolve against `docs-manifest.json` — validate this at generation time, not at runtime in front of a user.
- `ui_target.selector` must reference a `data-tour="..."` attribute (see §2), never a fragile CSS selector like a nth-child chain or a class name that a future style refactor would break.
- Generate at least these tours if the underlying features exist: `getting-started` (first-run, core happy path end to end), and one tour per major subsystem identified in discovery (e.g. `power-user-shortcuts`, `data-export-import`). Skip a tour category honestly if the app genuinely doesn't have enough surface for it yet — don't pad.

## 2. Instrumenting the app for `ui_target`

Tour steps that spotlight real UI need a stable hook. This means **touching the app's actual component source**, not just writing docs — call this out explicitly when reporting progress, since it's a different risk class than adding a Markdown file.

- Add `data-tour="<stable-id>"` attributes to the specific interactive elements each tour step needs to point at. These IDs live in the same stable-ID discipline as `06` — mint once, never reuse for a different element, never repurpose an existing one for something new.
- This is strictly additive: an extra HTML attribute, never a behavior change. Do not refactor components while adding these — a single unrelated diff makes the change hard to review and easy to revert if wrong.
- Keep a flat registry comment or small constants file (e.g. `lib/tour-targets.ts`) exporting the known `data-tour` IDs, so future tour steps and future component edits both reference the same list instead of magic strings scattered across the codebase.

## 3. Minimal tour engine requirements

- **Spotlight/overlay component**: dims the rest of the UI, highlights the element at `ui_target.selector` (or centers a card referencing `doc_ref` if there's no UI target for that step), shows the step's `narrative`, with Next/Back/Skip/End controls.
- **Cross-route steps**: if consecutive steps have different `ui_target.route` values, the engine navigates the app to that route before rendering the spotlight — don't require the user to manually navigate mid-tour.
- **Resilience**: if a `ui_target.selector` isn't found in the DOM (element not mounted, conditionally rendered, feature flag off), fall back gracefully to showing just the `doc_ref` content instead of silently breaking the tour or throwing.
- **Resumability**: persist current tour + step id (in-memory/local app state is fine — no need for this to survive an app restart unless the app already has a general "remember where I was" pattern from discovery) so accidental dismissal doesn't force a restart from step one.
- **Exit anytime**: a visible, always-available "End tour" control — never trap the user in a modal flow they can't escape.

## 4. Entry points
- `first-run`: if the app has any existing onboarding/first-run detection (check discovery), hook the `getting-started` tour there. If no such mechanism exists, do not invent a whole onboarding system just for this — instead default to §4's `help-menu` entry point and note the gap in `docs/OPEN-QUESTIONS.md`.
- `help-menu`: a "Take a tour" affordance inside the docs viewer itself (e.g. on `/docs`, a card per available tour) — this entry point should always exist regardless of what else is available, since it requires no new app-wide onboarding infrastructure.

## 5. Validation before declaring Phase H complete
- [ ] Every `doc_ref` in every tour resolves to a real, existing manifest entry.
- [ ] Every `ui_target.selector` corresponds to a `data-tour` attribute actually present in the component source (grep to confirm, don't assume).
- [ ] At least one tour is reachable from inside the running app with zero additional configuration.
- [ ] No tour step's `narrative` is a verbatim copy-paste of its linked doc section — tour pacing and reference-doc depth are different writing jobs; if they end up identical, the narrative wasn't actually written for the tour.
