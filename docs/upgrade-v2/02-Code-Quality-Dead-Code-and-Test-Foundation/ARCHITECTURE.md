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

- [CQ-01] Four view files exist but are completely empty (0 bytes) -> Delete all four files.
- [CQ-02] Image filename contains a typo ('develpment') AND a space -> Rename the file to 'iphone-app-development-company-denver.
- [CQ-03] Mixed tab and space indentation in a Slim template (whitespace-sensitive) -> Normalize the entire file to 2-space indentation (Slim convention).
- [CQ-04] Copyright year is hardcoded to 2014 -> Render the year dynamically: `p (c) #{2014} - #{Time.
- [CQ-05] README.md is 19 bytes and contains only the project name -> Replace README.
- [CQ-06] Zero tests; the test/ tree contains only .keep placeholder files -> Adopt RSpec (Rails community standard) over minitest.
- [CQ-07] Helper module uses tabs for indentation (Ruby convention is 2 spaces) -> Run rubocop -A to auto-correct.
- [CQ-08] Unicorn 4.8.3 is deprecated; Puma is the Rails-default server since Rails 5 -> Replace unicorn with puma.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
