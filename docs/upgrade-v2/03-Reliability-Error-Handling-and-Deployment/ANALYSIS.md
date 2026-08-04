# Analysis: Reliability: Error Handling & Deployment Refresh

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

The contact mailer raises a 500 on any SMTP failure with no user feedback, there is no error tracking (no Sentry/Rollbar), the Capistrano config hardcodes the production IP and SSH port in the repo, and the only deploy path is a 2014-vintage Capistrano 3.2.1 script. This package adds error handling, observability, and a modern deploy pipeline.

## Findings (7 total)

## [REL-01] Contact mailer raises unhandled exceptions; user sees a 500 page

- **Severity**: high
- **Category**: Reliability

### Evidence

**`app/controllers/index_controller.rb:11-15`**

```
def contact\n  InfoMailer.contact(params[:contact]).deliver\n  # render text: :ok\n  redirect_to action: :index\nend
```

### Impact

If the SMTP server is unreachable, if the email address fails RFC validation at the SMTP layer, or if ActionMailer raises for any reason, the user sees Rails' default 500 error page. There is no rescue, no flash message, no fallback. The user thinks the form is broken and tries again, generating duplicate failed attempts. No error is logged to a tracking system because none is configured.

### Recommendation

Wrap the deliver call in a begin/rescue. On failure, log to Sentry, show the user a friendly 'try again later' flash, and offer a direct mailto: link. Queue the submission for retry via a background job.

---

## [REL-02] No error tracking service is configured

- **Severity**: high
- **Category**: Reliability

### Evidence

**`Gemfile:1-27`**

```
(no sentry-rails, no rollbar, no honeybadger, no errbit gem)
```

**`config/initializers/:n/a`**

```
(directory contains 7 files; none is sentry.rb, rollbar.rb, or honeybadger.rb)
```

### Impact

Production errors are invisible. The only signal is the log file on the production server, which nobody reads until a customer complains. There is no stack trace capture, no breadcrumbs, no release tagging, no alerting.

### Recommendation

Add sentry-rails to the production group. Initialize in config/initializers/sentry.rb reading DSN from ENV. Tag releases with the git SHA. Backfill breadcrumbs for the contact flow.

---

## [REL-03] Capistrano 3.2.1 with hardcoded production IP, port, and SSH key path

- **Severity**: high
- **Category**: Reliability

### Evidence

**`config/deploy.rb:1-7`**

```
lock '3.2.1'\nset :application, 'vivim'\nset :repo_url, 'git@github.com:Vivim/vivim.git'\nset :linked_dirs, fetch(:linked_dirs, []) + %w[bin log tmp/pids tmp/cache tmp/sockets public/system]\nset :linked_files, %w[config/database.yml config/secrets.yml config/environment_variables.yml]
```

**`config/deploy/production.rb:1-7`**

```
server '104.131.184.230', user: 'deployer', roles: [:app, :web, :db]\nset :stage, :production\nset :rails_env, :production\nset :deploy_to, '/home/deployer/vivim'\nset :deploy_user, 'deployer'\nset :ssh_options, { forward_agent: true, auth_methods: ['publickey'], keys: [ "~/.ssh/vivim.pem" ], port: 4321 }
```

### Impact

The deploy config is checked into the public repo. Anyone can read the production IP (104.131.184.230), SSH user (deployer), SSH port (4321), and the name of the SSH key file (vivim.pem). The repo_url uses a capital V (Vivim/vivim) which may be a renamed org. Capistrano 3.2.1 is from 2014; later 3.x releases fixed multiple issues with SSH agent forwarding and stage loading.

### Recommendation

Move all server config to environment variables (read via ENV.fetch in deploy.rb). Move deploy secrets to GitHub Actions secrets or a CI vault. Upgrade Capistrano to 3.18.x. Add a deploy dry-run check to CI that verifies the config parses without leaking secrets.

---

## [REL-04] No background job processor; mail is sent synchronously in the request

- **Severity**: medium
- **Category**: Reliability

### Evidence

**`app/controllers/index_controller.rb:12`**

```
InfoMailer.contact(params[:contact]).deliver
```

**`Gemfile:1-27`**

```
(no sidekiq, no delayed_job, no good_job, no resque)
```

### Impact

Mail delivery happens inside the HTTP request. If the SMTP server takes 5 seconds to respond, the user waits 5 seconds. If it times out at 30s, the user sees a 500. There is no retry, no deduplication, no queue visibility.

### Recommendation

Add Sidekiq (or good_job for a Postgres-backed alternative that needs no Redis). Change .deliver to .deliver_later. Add a Sidekiq dashboard behind admin auth.

---

## [REL-05] Unicorn before_fork/after_fork hooks reference ActiveRecord directly

- **Severity**: medium
- **Category**: Reliability

### Evidence

**`config/unicorn/production.rb:26-51`**

```
before_fork do |server, worker|\n  ActiveRecord::Base.connection.disconnect!\n  ...\nend\n\nafter_fork do |server, worker|\n  ActiveRecord::Base.connection.establish_connection\nend
```

### Impact

These hooks are Unicorn-specific. They will not survive the move to Puma (Puma handles connection pooling differently). If the team keeps Unicorn, the disconnect/establish pattern is fragile - a worker crash mid-disconnect can leak connections.

### Recommendation

Delete config/unicorn/ entirely when migrating to Puma (see CQ-08). Puma's connection pooling is automatic via the Rails connection pool.

---

## [REL-06] No health check endpoint; load balancer cannot verify app health

- **Severity**: medium
- **Category**: Reliability

### Evidence

**`config/routes.rb:1-10`**

```
Rails.application.routes.draw do\n  root controller: :index, action: :index\n  get "sitemap.xml" => "index#sitemap", format: :xml, as: :sitemap\n  [:mobile, :why_ror].each do |action|\n    get action, controller: :index, action: action\n  end\n  post :contact, controller: :index, action: :contact\nend
```

### Impact

There is no /healthz or /up endpoint. A load balancer (nginx, AWS ALB) cannot tell the difference between a healthy app and one that has booted but lost its DB connection. Deploys require manual smoke tests.

### Recommendation

Add a /up route that returns 200 only if the DB connection works and 503 otherwise. Wire it into the load balancer health check.

---

## [REL-07] Log level is hardcoded to :info with no tags

- **Severity**: low
- **Category**: Reliability

### Evidence

**`config/environments/production.rb:44-50`**

```
config.log_level = :info\n\n  # Prepend all log lines with the following tags.\n  # config.log_tags = [ :subdomain, :uuid ]
```

### Impact

Logs are unstructured strings with no request ID. Tracing a single user's request across logs requires grepping by IP, which fails behind a load balancer (all requests share the LB IP).

### Recommendation

Add config.log_tags = [:request_id, :remote_ip] and switch to structured JSON logging via lograge or rails_semantic_logger.

---

## Verification protocol

For each finding:

1. Open the cited file in the cloned repo at the cited line.
2. Confirm the snippet matches what is in the file.
3. Confirm the impact description matches what the code does.
4. Apply the recommendation.
5. Run the matching spec in `SPECS.md` to verify the fix.

If any finding's evidence does not match the actual file content,
**do not apply the recommendation** - report the discrepancy so the
analysis can be corrected.
