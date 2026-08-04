# UX: Content Architecture & Navigation Features

> Upgrade package for **vivim** v0.1.0
> Package: 7 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.826Z

## What this package is

Four view templates exist as 0-byte stubs (about_us, contact_us, experts, projects) - abandoned features or never-built routes. The nav links to in-page anchors instead of real pages. The footer still links to Google+ (shut down April 2019). There is no privacy policy, no blog, and the 404/500 pages are generic Rails defaults with no site nav. This package turns the stubs into real pages, adds legal pages, and modernizes the footer.

## Why this package

A marketing site's job is to convert visitors into leads. Today, the nav has 5 items that don't go anywhere (they're anchors on a single page), 4 view files exist but are empty, and there's no privacy policy (legally required for a form collecting name + email + phone in Colorado and the EU). The site is structurally incomplete. This package fills the gaps and removes the dead links.

## Findings (each grounded in a specific file:line citation)

- [HIGH] UX7-01 - Four view templates exist as 0-byte stubs (about_us, contact_us, experts, projects) (app/views/index/about_us.html.slim:0, app/views/index/contact_us.html.slim:0, app/views/index/experts.html.slim:0, app/views/index/projects.html.slim:0)
- [HIGH] UX7-02 - Nav links are in-page anchors, not real routes - back button and deep-linking break (config/routes.rb:1-12, app/views/layouts/application.html.slim:42-48)
- [HIGH] UX7-03 - Footer links to Google+ (shut down April 2, 2019) - dead external link (app/views/layouts/application.html.slim:93-96)
- [MEDIUM] UX7-04 - No privacy policy or terms of service - legally required for PII collection (config/routes.rb:1-12, app/views/layouts/application.html.slim:60-79)
- [MEDIUM] UX7-05 - No blog / news / case-study section - no content marketing surface (config/routes.rb:1-12, app/views/index/index.html.slim:57-78)
- [MEDIUM] UX7-06 - 404/422/500 pages are generic Rails defaults with no site nav (public/404.html:1-50, public/422.html:1-50, public/500.html:1-50)
- [LOW] UX7-07 - Footer address uses </br> inside <li> - invalid HTML (app/views/layouts/application.html.slim:65)
- [LOW] UX7-08 - Nav items use uppercase TEXT instead of CSS text-transform - hurts screen readers (app/views/layouts/application.html.slim:42-48)

## How to apply this package

1. Unzip the package into a working directory.
2. Read `ANALYSIS.md` end to end - it documents every defect with the
   exact file and line number where it was found.
3. Read `ARCHITECTURE.md` for the proposed changes and their order.
4. Work through `TASKS.md` in order; each task cites the finding it fixes.
5. For each task, verify the matching spec in `SPECS.md` before marking it done.
6. `EVIDENCE.json` is the machine-readable list of every citation; use it
   to cross-check claims or feed an automated verifier.
7. `src/` contains the patched or new files; copy them into the repo,
   resolving any conflicts with the current state.

## Truth-grounded guarantee

Every claim in this package is backed by a citation to a real file and
line number in the cloned vivim repository (commit 71886e9,
2014-12-22). If a claim cannot be verified by reading the cited file at
the cited line, it should be treated as invalid and discarded.

## Source repository

- **Name**: vivim
- **URL**:  https://github.com/vivim/vivim
- **Version**: 0.1.0
- **Commit inspected**: 71886e93f5743ed49d3b7ca3380644e9e054f60b
- **Commit date**: 2014-12-22

## License

Contents inherit the vivim repository's license. New files are MIT.
