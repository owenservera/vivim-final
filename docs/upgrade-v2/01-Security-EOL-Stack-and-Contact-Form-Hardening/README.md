# Security: EOL Stack & Contact Form Hardening

> Upgrade package for **vivim** v0.1.0
> Package: 1 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.583Z

## What this package is

Rails 4.1.1 (EOL 2016), Ruby 2.1.2 (EOL 2017), Rack 1.5.2 (9+ CVEs), and an unvalidated contact form that accepts arbitrary SMTP headers. This package upgrades the stack and closes the form relay.

## Why this package

The entire dependency tree was frozen in December 2014. Every layer has accumulated years of published CVEs, and the contact endpoint forwards raw user input straight into mail headers. No other upgrade matters if the app is this exploitable.

## Findings (each grounded in a specific file:line citation)

- [CRITICAL] SEC-01 - Rails 4.1.1 is 8+ years past end-of-life (Gemfile:4, Gemfile.lock:92)
- [CRITICAL] SEC-02 - Ruby 2.1.2 is end-of-life (since March 2017) (.ruby-version:1, .ruby-gemset:1)
- [CRITICAL] SEC-03 - Rack 1.5.2 has 9+ published CVEs (Gemfile.lock:89)
- [CRITICAL] SEC-04 - Contact form forwards unvalidated input to SMTP headers (open relay) (app/controllers/index_controller.rb:11-15, app/mailers/info_mailer.rb:1-7, app/views/layouts/application.html.slim:57-69)
- [HIGH] SEC-05 - Kernel#open used to read sitemap file (dangerous anti-pattern) (app/controllers/index_controller.rb:17-24)
- [HIGH] SEC-06 - Real-looking secret_key_base committed in secrets.yml.example (config/secrets.yml.example:13-17)
- [MEDIUM] SEC-07 - Production server IP and SSH key path committed to repo (config/deploy/production.rb:1-7)
- [MEDIUM] SEC-08 - force_ssl is commented out in production (config/environments/production.rb:41-42)

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
