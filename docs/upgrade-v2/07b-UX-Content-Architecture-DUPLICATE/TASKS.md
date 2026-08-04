# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [UX7-T01] Decide fate of the 4 empty view stubs and either delete or build them  (_effort: M_)

- **Acceptance**: Either 0 stub files remain OR each stub is now a real routed page with content.

#### [UX7-T02] Promote nav anchor links to real routes (/about-us, /experts, etc.)  (_effort: M_)

- **Acceptance**: Visiting /about-us directly renders the About page; back button works between sections.

#### [UX7-T03] Remove the Google+ link from the footer  (_effort: S_)

- **Acceptance**: grep 'plus.google.com' app/views/ returns 0 matches.

#### [UX7-T04] Add /privacy and /terms pages with real legal content  (_effort: M_)

- **Acceptance**: Footer links to /privacy and /terms; both pages render with the site layout.

#### [UX7-T05] Add /case-studies index with at least 3 written case studies  (_effort: L_)

- **Acceptance**: /case-studies lists 3 cards; each links to a written case study page.

#### [UX7-T06] Move 404/422/500 rendering into the app with branded layout  (_effort: M_)

- **Acceptance**: Visiting /nonexistent shows the Vivim nav + a 'Page not found' message, not the Rails default.

#### [UX7-T07] Fix the </br> tag inside the footer address  (_effort: S_)

- **Acceptance**: W3C HTML validator returns 0 errors on /#contact.

#### [UX7-T08] Convert nav uppercase TEXT to natural case + CSS text-transform  (_effort: S_)

- **Acceptance**: View source shows 'About us' not 'ABOUT US'; visual style unchanged.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
