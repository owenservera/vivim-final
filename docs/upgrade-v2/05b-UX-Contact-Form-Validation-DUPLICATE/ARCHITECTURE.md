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

- [UX5-01] Form submission silently redirects with no user feedback -> Set flash[:notice] on success and flash[:alert] on failure (rescue StandardError around the deliver call).
- [UX5-02] Form fields have no accessible labels (placeholders only) -> Add explicit <label for='contact_name'> elements above each field.
- [UX5-03] No client-side or server-side input validation beyond HTML 'required' -> Add a ContactForm ActiveModel (or dry-validation) schema with: name (3-100 chars), email (RFC 5322 format), phone (optional, E.
- [UX5-04] No spam protection on the contact endpoint (honeypot / reCAPTCHA / rate limit) -> Add (1) a honeypot field that must remain empty, (2) a server-side rate limit (rack-attack: max 5 submissions per IP per hour), (3) optional reCAPTCHA v3 with a 0.
- [UX5-05] Form status messages have no aria-live region - screen readers hear nothing -> Add <div role='status' aria-live='polite' class='sr-only'> to the contact section that renders flash[:notice].
- [UX5-06] Submit button uses ignored 'value' attribute instead of inner text -> Remove the value='Submit' attribute.
- [UX5-07] Inline onclick handlers will break under any Content Security Policy -> Replace onclick attributes with data-event-category and data-event-action data attributes.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
