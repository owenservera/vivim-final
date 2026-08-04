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

- [UX8-01] CoffeeScript is deprecated and removed from Rails 7 defaults -> Transpile the .
- [UX8-02] Turbolinks is deprecated - replaced by Hotwire/Turbo in 2021 -> Replace turbolinks with @hotwired/turbo-rails.
- [UX8-03] jQuery loaded as a global - 90KB+ for what could be 0KB of vanilla JS -> Replace jQuery selectors with native querySelector/querySelectorAll.
- [UX8-04] Google Fonts loaded render-blocking without preconnect -> Add <link rel='preconnect' href='https://fonts.
- [UX8-05] All project screenshots are PNG (no WebP/AVIF) - 30-50% larger -> Batch-convert all PNGs to WebP using cwebp (or sharp if Node-based).
- [UX8-06] Stylesheet uses .sass indented syntax (deprecated in favor of .scss) -> Rename to application.
- [UX8-07] Three jQuery plugins loaded (flexslider, colorbox, owl.carousel) for a single page -> Audit usage: flexslider appears unused (no .
- [UX8-08] Google Fonts link has no integrity or crossorigin attributes -> Add crossorigin='anonymous' and integrity='sha384-.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
