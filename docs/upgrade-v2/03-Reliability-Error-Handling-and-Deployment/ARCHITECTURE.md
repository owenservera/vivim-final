# Architecture

## Current state of vivim

vivim is a Ruby on Rails 4.1.1 marketing website:

```
+-----------------------------+
|  Slim views (Turbolinks)    |  app/views/index/*.html.slim
+-----------------------------+
|  IndexController (5 routes) |  app/controllers/index_controller.rb
+-----------------------------+
|  InfoMailer (contact form)  |  app/mailers/info_mailer.rb
+-----------------------------+
|  Rails 4.1.1 / Rack 1.5.2   |  Gemfile, Gemfile.lock
+-----------------------------+
|  Unicorn 4.8.3              |  config/unicorn/production.rb
+-----------------------------+
|  Capistrano 3.2.1           |  config/deploy*.rb
+-----------------------------+
|  Ruby 2.1.2                 |  .ruby-version
+-----------------------------+
```

Marketing website for Vivim (Denver-based mobile/web dev studio). Ruby on Rails 4.1.1, last commit December 2014. Cloned and inspected line-by-line to produce truth-grounded upgrade packages.

## Changes proposed by this package

- [REL-01] Contact mailer raises unhandled exceptions; user sees a 500 page -> Wrap the deliver call in a begin/rescue.
- [REL-02] No error tracking service is configured -> Add sentry-rails to the production group.
- [REL-03] Capistrano 3.2.1 with hardcoded production IP, port, and SSH key path -> Move all server config to environment variables (read via ENV.
- [REL-04] No background job processor; mail is sent synchronously in the request -> Add Sidekiq (or good_job for a Postgres-backed alternative that needs no Redis).
- [REL-05] Unicorn before_fork/after_fork hooks reference ActiveRecord directly -> Delete config/unicorn/ entirely when migrating to Puma (see CQ-08).
- [REL-06] No health check endpoint; load balancer cannot verify app health -> Add a /up route that returns 200 only if the DB connection works and 503 otherwise.
- [REL-07] Log level is hardcoded to :info with no tags -> Add config.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
