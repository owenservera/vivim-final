# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### REL-S1

- **Requirement**: Contact form MUST return within 500ms p95 even when SMTP is slow.
- **Verification**: k6 load test with 200ms artificial SMTP delay reports p95 < 500ms.

#### REL-S2

- **Requirement**: Any unhandled exception in production MUST be captured by Sentry with email/phone redacted.
- **Verification**: Inspect a sample Sentry event from /contact; email and phone fields show [REDACTED].

#### REL-S3

- **Requirement**: GET /up MUST return 200 'ok' when DB is reachable and 503 when not.
- **Verification**: Stop postgres; curl /up returns 503; start postgres; curl /up returns 200.

#### REL-S4

- **Requirement**: Production deploy MUST be triggered by push to main and MUST run tests before deploy.
- **Verification**: Push a failing test to main; deploy job fails and does not reach the cap stage.

#### REL-S5

- **Requirement**: No file in config/deploy* MAY contain an IP address literal.
- **Verification**: grep -E '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b' config/deploy* returns 0 matches.

#### REL-S6

- **Requirement**: Every production log line MUST be valid JSON with a request_id field.
- **Verification**: tail -100 production.log | jq -e '.request_id' exits 0 on every line.
