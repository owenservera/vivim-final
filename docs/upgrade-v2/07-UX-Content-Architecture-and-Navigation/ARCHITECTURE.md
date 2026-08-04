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

- [UX7-01] Four view templates exist as 0-byte stubs (about_us, contact_us, experts, projects) -> Decide: build them as real pages, or delete them.
- [UX7-02] Nav links are in-page anchors, not real routes - back button and deep-linking break -> Promote the 5 anchor sections to real routes: /about-us, /experts, /projects, /clients, /contact.
- [UX7-03] Footer links to Google+ (shut down April 2, 2019) - dead external link -> Remove the .
- [UX7-04] No privacy policy or terms of service - legally required for PII collection -> Add /privacy and /terms routes, controllers, and views.
- [UX7-05] No blog / news / case-study section - no content marketing surface -> Add a /case-studies section with at least 3 written case studies (client, challenge, solution, result with metrics).
- [UX7-06] 404/422/500 pages are generic Rails defaults with no site nav -> Move error rendering into the app (errors_controller + app/views/errors/not_found.
- [UX7-07] Footer address uses </br> inside <li> - invalid HTML -> Replace </br> with a properly structured address: li: address <a href='.
- [UX7-08] Nav items use uppercase TEXT instead of CSS text-transform - hurts screen readers -> Write the nav text in normal case: 'About us', 'Experts', 'Projects', 'Clients', 'Why RoR?', 'Mobile', 'Contact us'.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
