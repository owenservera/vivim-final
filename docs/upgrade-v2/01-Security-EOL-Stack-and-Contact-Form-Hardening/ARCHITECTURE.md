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

- [SEC-01] Rails 4.1.1 is 8+ years past end-of-life -> Upgrade to Rails 7.
- [SEC-02] Ruby 2.1.2 is end-of-life (since March 2017) -> Target Ruby 3.
- [SEC-03] Rack 1.5.2 has 9+ published CVEs -> Rack 3.
- [SEC-04] Contact form forwards unvalidated input to SMTP headers (open relay) -> Add a ContactFormValidator with strict format checks on :email (RFC 5321), length caps on :name (80 chars) and :comment (2000 chars), a honeypot field, and per-IP rate limiting (e.
- [SEC-05] Kernel#open used to read sitemap file (dangerous anti-pattern) -> Replace `open(path).
- [SEC-06] Real-looking secret_key_base committed in secrets.yml.example -> Replace the example values with the literal string `<%= ENV['SECRET_KEY_BASE'] %>` for all environments, and add a CI check that rejects any 128-char hex string in any yml file.
- [SEC-07] Production server IP and SSH key path committed to repo -> Move all deployment target config to environment variables or a CI-only secret.
- [SEC-08] force_ssl is commented out in production -> Uncomment `config.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
