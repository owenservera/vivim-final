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

- [UX6-01] Bootstrap 3 navbar markup (navbar-toggle, icon-bar) - BS3 EOL July 2019 -> Migrate to Bootstrap 5.
- [UX6-02] Images use img-responsive (Bootstrap 3 class, removed in BS4/5) -> Replace all 22 occurrences of img-responsive with img-fluid.
- [UX6-03] Hero banner loads full-size PNG with no srcset/sizes -> Generate 3 sizes of devices.
- [UX6-04] No apple-touch-icon, no theme-color, no PWA manifest -> Add <link rel='apple-touch-icon' href='/apple-touch-icon.
- [UX6-05] Carousel autoPlay:3000 ignores prefers-reduced-motion -> Read window.
- [UX6-06] Colorbox lightbox has no touch/swipe support - mobile users cannot navigate -> Replace Colorbox with a modern lightbox (GLightbox, Photoswipe, or a CSS-only :target pattern).
- [UX6-07] Copyright year hardcoded as '© 2014 - Vivim' - never updates -> Replace with: p © #{Date.
- [UX6-08] viewport meta lacks viewport-fit=cover for notch/Dynamic Island -> Update to: meta name='viewport' content='width=device-width, initial-scale=1.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
