# Reliability: Error Handling & Deployment Refresh

> Upgrade package for **vivim** v0.1.0
> Package: 3 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.625Z

## What this package is

The contact mailer raises a 500 on any SMTP failure with no user feedback, there is no error tracking (no Sentry/Rollbar), the Capistrano config hardcodes the production IP and SSH port in the repo, and the only deploy path is a 2014-vintage Capistrano 3.2.1 script. This package adds error handling, observability, and a modern deploy pipeline.

## Why this package

When the mailer fails today, the user sees a generic Rails error page and the submission is lost forever - there is no log entry, no alert, no retry. The deploy pipeline is a single point of failure: one SSH key compromise gives an attacker the production host, port, and deploy path. Reliability work closes both holes.

## Findings (each grounded in a specific file:line citation)

- [HIGH] REL-01 - Contact mailer raises unhandled exceptions; user sees a 500 page (app/controllers/index_controller.rb:11-15)
- [HIGH] REL-02 - No error tracking service is configured (Gemfile:1-27, config/initializers/:n/a)
- [HIGH] REL-03 - Capistrano 3.2.1 with hardcoded production IP, port, and SSH key path (config/deploy.rb:1-7, config/deploy/production.rb:1-7)
- [MEDIUM] REL-04 - No background job processor; mail is sent synchronously in the request (app/controllers/index_controller.rb:12, Gemfile:1-27)
- [MEDIUM] REL-05 - Unicorn before_fork/after_fork hooks reference ActiveRecord directly (config/unicorn/production.rb:26-51)
- [MEDIUM] REL-06 - No health check endpoint; load balancer cannot verify app health (config/routes.rb:1-10)
- [LOW] REL-07 - Log level is hardcoded to :info with no tags (config/environments/production.rb:44-50)

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
