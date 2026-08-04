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

- [WEB-01] Google Analytics Universal (analytics.js) was sunset July 2023 -> Replace with Google Analytics 4 via gtag.
- [WEB-02] All marketing copy is hardcoded in Ruby helper methods, not i18n -> Move all user-facing strings to config/locales/en.
- [WEB-03] Sitemap config hardcoded to www.vivim.net -> Read the host from ENV.
- [WEB-04] robots.txt is fully commented out -> Uncomment User-agent: * and add an Allow: / plus a Sitemap: https://vivim.
- [WEB-05] No canonical URL or Open Graph tags -> Add canonical_link_tag to the layout.
- [WEB-06] No JSON-LD structured data -> Add a LocalBusiness JSON-LD block to the layout, populated from a single config file or i18n entry.
- [WEB-07] Google Fonts loaded over HTTP (not HTTPS) -> Change http:// to https://.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
