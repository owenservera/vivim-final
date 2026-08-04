# UX: Contact Form Validation, Feedback & Accessibility

> Upgrade package for **vivim** v0.1.0
> Package: 5 of 4 (deep analysis)
> Generated: 2026-08-02T21:54:17.222Z

## What this package is

The contact form POSTs to /contact, the controller silently redirects to / with no flash message, no validation, no spam protection, and no accessible labels. Users who submit the form get zero feedback - they don't know if it worked, failed, or vanished. This package adds accessible labels, client + server validation, a honeypot, and an aria-live status region.

## Why this package

The contact form is the single conversion mechanism on the entire site. Today it is functionally broken from a UX perspective: the success path is indistinguishable from the failure path, screen-reader users hear nothing, and the form will accept any garbage including multi-megabyte comment blobs. Fixing this is the highest-impact UX work that can be done without restructuring the rest of the site.

## Findings (each grounded in a specific file:line citation)

- [HIGH] UX5-01 - Form submission silently redirects with no user feedback (app/controllers/index_controller.rb:11-15, app/views/layouts/application.html.slim:29)
- [HIGH] UX5-02 - Form fields have no accessible labels (placeholders only) (app/views/layouts/application.html.slim:62-77)
- [MEDIUM] UX5-03 - No client-side or server-side input validation beyond HTML 'required' (app/views/layouts/application.html.slim:62-77, app/mailers/info_mailer.rb:2-7)
- [MEDIUM] UX5-04 - No spam protection on the contact endpoint (honeypot / reCAPTCHA / rate limit) (config/routes.rb:11, app/controllers/index_controller.rb:11-15)
- [MEDIUM] UX5-05 - Form status messages have no aria-live region - screen readers hear nothing (app/views/layouts/application.html.slim:29, app/views/layouts/application.html.slim:56-83)
- [LOW] UX5-06 - Submit button uses ignored 'value' attribute instead of inner text (app/views/layouts/application.html.slim:79)
- [LOW] UX5-07 - Inline onclick handlers will break under any Content Security Policy (app/views/layouts/application.html.slim:67, app/views/layouts/application.html.slim:79)

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
