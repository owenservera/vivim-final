# Analysis: UX: Contact Form Validation, Feedback & Accessibility

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

The contact form POSTs to /contact, the controller silently redirects to / with no flash message, no validation, no spam protection, and no accessible labels. Users who submit the form get zero feedback - they don't know if it worked, failed, or vanished. This package adds accessible labels, client + server validation, a honeypot, and an aria-live status region.

## Findings (7 total)

## [UX5-01] Form submission silently redirects with no user feedback

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/controllers/index_controller.rb:11-15`**

```
def contact\n  InfoMailer.contact(params[:contact]).deliver\n  # render text: :ok\n  redirect_to action: :index\nend
```

**`app/views/layouts/application.html.slim:29`**

```
= yield
```

### Evidence block

```
Original lines 11-15 of app/controllers/index_controller.rb:

  def contact
    InfoMailer.contact(params[:contact]).deliver
    # render text: :ok
    redirect_to action: :index
  end

Original line 29 of app/views/layouts/application.html.slim (the layout body):

  = yield

Key markers: no flash[:notice] / flash[:alert] assignment
            no render of a status region in the layout
            the redirect_to drops the user back on /#contact with no signal
```

### Impact

When a visitor fills out the form and clicks Send, the page redirects to / and the form clears. There is no toast, no banner, no inline confirmation - the user has no idea whether their message was sent, queued, or lost. Conversion-data wise, every form submit is invisible: the site owner cannot tell successful sends from failures. Users commonly re-submit 3-5 times, producing duplicate emails to info@vivim.net.

### Recommendation

Set flash[:notice] on success and flash[:alert] on failure (rescue StandardError around the deliver call). Render a visually-hidden aria-live='polite' status region in the layout that exposes the flash message. Scroll the user back to #contact via the URL fragment.

---

## [UX5-02] Form fields have no accessible labels (placeholders only)

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:62-77`**

```
= text_field :contact, :name, class: 'form-control', placeholder: 'Name', required: true\n= email_field :contact, :email, class: 'form-control', placeholder: 'Email', required: true\n= phone_field :contact, :phone, class: 'form-control', placeholder: 'Phone Number'\n= text_area :contact, :comment, class: 'form-control', placeholder: 'Comment', rows: 6, required: true
```

### Impact

Placeholders disappear the moment a user starts typing. Screen readers may not announce placeholders at all (depending on browser+AT combo). WCAG 2.1 SC 1.3.1 (Info and Relationships) and SC 3.3.2 (Labels or Instructions) both require programmatic labels. The form fails automated accessibility audits (axe, Lighthouse a11y).

### Recommendation

Add explicit <label for='contact_name'> elements above each field. Move the placeholder text into the label. Keep placeholders as hints (e.g. 'Jane Doe') but never as the primary label.

---

## [UX5-03] No client-side or server-side input validation beyond HTML 'required'

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:62-77`**

```
(only required: true on name/email/comment - no format, no length, no pattern)
```

**`app/mailers/info_mailer.rb:2-7`**

```
def contact(params)\n  @name, @email, @phone, @comment = params.values_at(:name, :email, :phone, :comment)\n  mail from: 'noreply@vivim.net',\n       to: 'info@vivim.net',\n       subject: 'User left a message'\nend
```

### Impact

HTML 'required' is trivially bypassed (curl, disabled JS, old browsers). The mailer takes whatever values_at returns and drops them into @name/@email/@phone/@comment with no length cap, no format check, no HTML stripping. A 5MB comment field will be accepted and forwarded into the ActionMailer pipeline, where it may crash the SMTP relay or be quarantined.

### Recommendation

Add a ContactForm ActiveModel (or dry-validation) schema with: name (3-100 chars), email (RFC 5322 format), phone (optional, E.164 or US format), comment (10-5000 chars). Validate on both client (HTML pattern + maxlength) and server (raise if invalid).

---

## [UX5-04] No spam protection on the contact endpoint (honeypot / reCAPTCHA / rate limit)

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`config/routes.rb:11`**

```
post :contact, controller: :index, action: :contact
```

**`app/controllers/index_controller.rb:11-15`**

```
(no rate limit check, no honeypot field, no captcha verification before InfoMailer.contact(...).deliver)
```

### Impact

The /contact endpoint is a public, unauthenticated POST that triggers an outbound email. This is a textbook spam-relay target. Bots will discover it within days of going live and flood info@vivim.net with hundreds of submissions per hour. The current code has zero defenses: no honeypot, no reCAPTCHA, no rate limit, no IP throttling.

### Recommendation

Add (1) a honeypot field that must remain empty, (2) a server-side rate limit (rack-attack: max 5 submissions per IP per hour), (3) optional reCAPTCHA v3 with a 0.5 threshold for suspicious submissions. Reject silently (HTTP 422) rather than 500 so bots can't probe.

---

## [UX5-05] Form status messages have no aria-live region - screen readers hear nothing

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:29`**

```
= yield
```

**`app/views/layouts/application.html.slim:56-83`**

```
(no div[aria-live], no role='status', no role='alert' anywhere in the contact section)
```

### Impact

Even if a flash message were added (UX5-01 fix), without an aria-live region screen-reader users would not hear it announce. They would only know the page redirected. WCAG 2.1 SC 4.1.3 (Status Messages) requires status messages to be programmatically determinable without receiving focus.

### Recommendation

Add <div role='status' aria-live='polite' class='sr-only'> to the contact section that renders flash[:notice]. For errors, use role='alert' aria-live='assertive'. Test with NVDA + Firefox and VoiceOver + Safari.

---

## [UX5-06] Submit button uses ignored 'value' attribute instead of inner text

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:79`**

```
button.btn.btn-green type="submit" value='Submit' onClick="ga('send', 'event', { eventCategory: 'Start', eventAction: 'Send'});" Send
```

### Impact

The value='Submit' attribute on a <button type='submit'> is ignored by browsers - the inner text 'Send' is what gets rendered. The value attribute is only meaningful on <input type='submit'>. This is harmless today but signals author confusion and will trip up future maintainers.

### Recommendation

Remove the value='Submit' attribute. Keep the inner text 'Send'. The onClick GA handler should be moved to a data attribute and bound in app.js (also fixes UX5-08 / CSP).

---

## [UX5-07] Inline onclick handlers will break under any Content Security Policy

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:67`**

```
li Phone: #{link_to '720.504.0111', 'tel:7205040111', class: 'phone', onclick: "ga('send', 'event', { eventCategory: 'Phone', eventAction: 'Click'});"}
```

**`app/views/layouts/application.html.slim:79`**

```
button.btn.btn-green type="submit" value='Submit' onClick="ga('send', 'event', { eventCategory: 'Start', eventAction: 'Send'});" Send
```

### Impact

Inline event handlers require 'unsafe-inline' in the script-src CSP directive. Once a real CSP is added (recommended in the security package), these handlers will be silently dropped by the browser. The phone-click and form-submit events will stop firing, breaking the only two GA events the site tracks.

### Recommendation

Replace onclick attributes with data-event-category and data-event-action data attributes. Bind a single delegated listener in app.js that reads the data attributes and calls gtag('event', ...).

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
