# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [REL-T01] Add sentry-rails with PII scrubbing  (_effort: M_)

- **Acceptance**: Trigger a forced exception in production; Sentry receives the event with email/phone redacted.

#### [REL-T02] Wrap contact deliver in begin/rescue with user-friendly flash  (_effort: S_)

- **Acceptance**: Simulate SMTP failure; user sees 'try again later' notice; event captured by Sentry.

#### [REL-T03] Move contact mail to a background job (deliver_later)  (_effort: M_)

- **Acceptance**: Contact form returns within 200ms; Sidekiq dashboard shows the enqueued job.

#### [REL-T04] Add /up health check endpoint  (_effort: S_)

- **Acceptance**: curl https://vivim.net/up returns 'ok' 200; returns 503 when DB is disconnected.

#### [REL-T05] Upgrade Capistrano to 3.18 and externalize all secrets  (_effort: M_)

- **Acceptance**: grep -E '104\.131|4321|vivim.pem' config/deploy* returns 0; deploy succeeds via GitHub Actions.

#### [REL-T06] Switch to lograge JSON output with request_id tagging  (_effort: S_)

- **Acceptance**: Log lines parse as JSON with jq; each has a request_id field.

#### [REL-T07] Wire GitHub Actions deploy pipeline  (_effort: L_)

- **Acceptance**: Push to main triggers tests + deploy; smoke test passes; rollback command documented.

#### [REL-T08] Delete config/unicorn/ and before_fork/after_fork hooks  (_effort: S_)

- **Acceptance**: config/unicorn/ directory does not exist; puma boots cleanly.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
