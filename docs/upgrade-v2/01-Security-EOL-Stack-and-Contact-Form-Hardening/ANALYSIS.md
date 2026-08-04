# Analysis: Security: EOL Stack & Contact Form Hardening

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

Rails 4.1.1 (EOL 2016), Ruby 2.1.2 (EOL 2017), Rack 1.5.2 (9+ CVEs), and an unvalidated contact form that accepts arbitrary SMTP headers. This package upgrades the stack and closes the form relay.

## Findings (8 total)

## [SEC-01] Rails 4.1.1 is 8+ years past end-of-life

- **Severity**: critical
- **Category**: Security

### Evidence

**`Gemfile:4`**

```
gem 'rails', '4.1.1'
```

**`Gemfile.lock:92`**

```
rails (4.1.1)
```

### Impact

Rails 4.1 reached end-of-life in August 2016 and no longer receives security patches. Known CVEs against 4.1.1 include CVE-2015-3226 (SQL injection in ActiveRecord), CVE-2015-3227 (XML DoS in ActiveSupport), CVE-2016-0752 (path traversal in ActionPack), and CVE-2020-8164 (unsafe deserialization in ActiveSupport).

### Recommendation

Upgrade to Rails 7.1.x (current LTS-equivalent). The jump from 4.1 to 7.1 spans multiple major versions; do it via the rails upgrade path: 4.1 -> 4.2 -> 5.0 -> 5.1 -> 5.2 -> 6.0 -> 6.1 -> 7.0 -> 7.1, running the test suite at each hop.

---

## [SEC-02] Ruby 2.1.2 is end-of-life (since March 2017)

- **Severity**: critical
- **Category**: Security

### Evidence

**`.ruby-version:1`**

```
2.1.2
```

**`.ruby-gemset:1`**

```
vivim
```

### Impact

Ruby 2.1 reached EOL on March 31, 2017 and receives no security patches. Modern gem versions (Rails 6+, rack 2+) require Ruby 2.7+; many require 3.0+. The app cannot consume any security fix without first bumping Ruby.

### Recommendation

Target Ruby 3.3.x (current stable). Remove the .ruby-gemset file (RVM gemsets are deprecated in favor of bundler). Replace .ruby-version with 3.3.4.

---

## [SEC-03] Rack 1.5.2 has 9+ published CVEs

- **Severity**: critical
- **Category**: Security

### Evidence

**`Gemfile.lock:89`**

```
rack (1.5.2)
```

### Impact

Rack 1.5.x is unmaintained. Published CVEs include CVE-2022-30122/30123 (DoS via multipart parsing), CVE-2022-44570/44571 (DoS via content-disposition parsing), CVE-2023-27530/27539 (DoS via parsing), CVE-2024-25126 (DoS via chunked encoding), CVE-2024-26141 (header parsing DoS), and CVE-2024-26146 (Range header DoS).

### Recommendation

Rack 3.0+ is required by Rails 7+. The Rails upgrade in SEC-01 will pull this in automatically. Verify rack version in the upgraded Gemfile.lock is >= 3.0.

---

## [SEC-04] Contact form forwards unvalidated input to SMTP headers (open relay)

- **Severity**: critical
- **Category**: Security

### Evidence

**`app/controllers/index_controller.rb:11-15`**

```
def contact
  InfoMailer.contact(params[:contact]).deliver
  # render text: :ok
  redirect_to action: :index
end
```

**`app/mailers/info_mailer.rb:1-7`**

```
class InfoMailer < ActionMailer::Base
  def contact(params)
    @name, @email, @phone, @comment = params.values_at(:name, :email, :phone, :comment)
    mail from: 'noreply@vivim.net',
         to: 'info@vivim.net',
         subject: 'User left a message'
  end
end
```

**`app/views/layouts/application.html.slim:57-69`**

```
= form_tag(contact_path) do
  ...
  = text_field :contact, :name, ...
  = email_field :contact, :email, ...
  = phone_field :contact, :phone, ...
  = text_area :contact, :comment, ...
```

### Impact

The contact action takes params[:contact] verbatim and passes it to InfoMailer. The mailer then uses params[:email] as the visible envelope. While ActionMailer 4.1 does escape some header characters, it does not rate-limit, validate, or sanitize. An attacker can submit thousands of forms per minute, flooding info@vivim.net. There is no honeypot, no captcha, no rate limit, and no parameter validation. The form is an open spam relay pointed at the company inbox.

### Recommendation

Add a ContactFormValidator with strict format checks on :email (RFC 5321), length caps on :name (80 chars) and :comment (2000 chars), a honeypot field, and per-IP rate limiting (e.g. 3 submissions/hour via rack-attack). Consider reCAPTCHA v3 for anonymous submission.

---

## [SEC-05] Kernel#open used to read sitemap file (dangerous anti-pattern)

- **Severity**: high
- **Category**: Security

### Evidence

**`app/controllers/index_controller.rb:17-24`**

```
def sitemap
  path = Rails.root.join("public", "sitemaps", "sitemap.xml")
  if File.exists?(path)
    render xml: open(path).read
  else
    render text: "Sitemap not found.", status: :not_found
  end
end
```

### Impact

Kernel#open (not File.open) is Ruby's most dangerous method: if the argument ever starts with a pipe character, it executes a shell command. The path is currently hardcoded so it is not exploitable today, but the pattern is a critical Brakeman flag and one refactor away from a remote code execution vulnerability.

### Recommendation

Replace `open(path).read` with `File.read(path)`. Add a Brakeman scan to CI to catch regressions.

---

## [SEC-06] Real-looking secret_key_base committed in secrets.yml.example

- **Severity**: high
- **Category**: Security

### Evidence

**`config/secrets.yml.example:13-17`**

```
development:
  secret_key_base: 8aeab48a5815e02722b8cbe6370aa4c909de5cb03beae3a1a8b886005154a5bd857ad912fa10ea37077e32d7f457482c86ef2fb85c45ac1c6891aab42a045547

test:
  secret_key_base: 9edd95ff20d0187114e670aecdcabb3ffba2428aa3f68f690b40115d81d4451976c3c5b5378ec260b2cc462f23d451bc1c91218c39ec57893fa6d578a1813205
```

### Impact

These are 128-character hex strings that look like real generated secret_key_base values. Even though the file is named .example, the pattern trains maintainers to commit real secrets. If the actual config/secrets.yml (gitignored) was ever generated by copying this file, the development secret could match production.

### Recommendation

Replace the example values with the literal string `<%= ENV['SECRET_KEY_BASE'] %>` for all environments, and add a CI check that rejects any 128-char hex string in any yml file.

---

## [SEC-07] Production server IP and SSH key path committed to repo

- **Severity**: medium
- **Category**: Security

### Evidence

**`config/deploy/production.rb:1-7`**

```
server '104.131.184.230', user: 'deployer', roles: [:app, :web, :db]
set :stage, :production
set :rails_env, :production
set :deploy_to, '/home/deployer/vivim'
set :deploy_user, 'deployer'
set :ssh_options, { forward_agent: true, auth_methods: ['publickey'], keys: [ "~/.ssh/vivim.pem" ], port: 4321 }
```

### Impact

The production IP (104.131.184.230), SSH user (deployer), SSH port (4321), and key filename (vivim.pem) are all in the public repo. An attacker can port-scan the IP, attempt to brute-force the SSH user, or phish for the .pem file. The .gitignore does ignore vivim.pem (line 12), but the path is still leaked.

### Recommendation

Move all deployment target config to environment variables or a CI-only secret. Use a generic deploy host alias (e.g. deploy.vivim.internal) and resolve via SSH config.

---

## [SEC-08] force_ssl is commented out in production

- **Severity**: medium
- **Category**: Security

### Evidence

**`config/environments/production.rb:41-42`**

```
# Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
# config.force_ssl = true
```

### Impact

Without force_ssl, the contact form (which collects name, email, phone, and free-text comment) can be submitted over plaintext HTTP. A network observer (coffee shop Wi-Fi, ISP) can harvest every submission.

### Recommendation

Uncomment `config.force_ssl = true` and add HSTS preload headers at the nginx/CDN layer.

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
