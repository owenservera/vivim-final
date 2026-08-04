# Analysis: Code Quality: Dead Code, Broken Assets, Test Foundation

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

Four empty view files, a typo'd image filename with a space, mixed tab/space indentation in a whitespace-sensitive template engine, a copyright stuck on 2014, a 19-byte README, and 0% test coverage (the test/ tree is all .keep files). This package cleans the rot and lays a test foundation.

## Findings (8 total)

## [CQ-01] Four view files exist but are completely empty (0 bytes)

- **Severity**: medium
- **Category**: Code Quality

### Evidence

**`app/views/index/about_us.html.slim:1`**

```
(file is 0 bytes - empty)
```

**`app/views/index/contact_us.html.slim:1`**

```
(file is 0 bytes - empty)
```

**`app/views/index/experts.html.slim:1`**

```
(file is 0 bytes - empty)
```

**`app/views/index/projects.html.slim:1`**

```
(file is 0 bytes - empty)
```

### Impact

These four files take up space in the views tree, confuse maintainers (are they stubs? deleted content?), and are never rendered because config/routes.rb only routes :index, :mobile, :why_ror, :contact, and :sitemap. They are dead code.

### Recommendation

Delete all four files. If the routes were ever intended, add them to routes.rb and write the views; otherwise remove the files.

---

## [CQ-02] Image filename contains a typo ('develpment') AND a space

- **Severity**: medium
- **Category**: Code Quality

### Evidence

**`app/views/index/index.html.slim:68`**

```
a.colorbox href="images/iPhone-app- develpment-company-denver.png"
```

**`app/views/index/index.html.slim:70`**

```
img.img-responsive src="images/iPhone-app- develpment-company-denver.png" alt='Denver mobile app developers'
```

**`public/images/iPhone-app- develpment-company-denver.png:n/a (binary file)`**

```
(file exists on disk with the typo + space in its name)
```

### Impact

The filename 'iPhone-app- develpment-company-denver.png' has both a typo ('develpment' instead of 'development') and a literal space. URL-encoding the space works in browsers but is fragile across email clients, sitemap generators, and social share previewers. The typo is also an SEO liability - the alt text is correct but the URL is misspelled.

### Recommendation

Rename the file to 'iphone-app-development-company-denver.png' (lowercase, hyphens, correct spelling). Update the two references in index.html.slim. Add a redirect from the old URL for any inbound links.

---

## [CQ-03] Mixed tab and space indentation in a Slim template (whitespace-sensitive)

- **Severity**: high
- **Category**: Code Quality

### Evidence

**`app/views/layouts/application.html.slim:7-8`**

```
\tmeta name="viewport" content="width=device-width, initial-scale=1.0"\n\tmeta http-equiv="X-UA-Compatible" content="IE=edge"
```

**`app/views/layouts/application.html.slim:4-6`**

```
    title=title_phrase\n    meta name="description" content="# {meta_description_content}"\n    meta name="keywords" content="# {meta_keywords_content}"
```

### Impact

Slim is whitespace-sensitive: indentation defines the HTML tree structure. Lines 4-6 use 4 spaces; lines 7-8 use a single tab. Today this happens to render correctly because both indent under the same parent, but any refactor that adds a sibling element between them will produce an unpredictable parse tree. This is a latent bug.

### Recommendation

Normalize the entire file to 2-space indentation (Slim convention). Add an editorconfig entry to enforce spaces for .slim files. Run a slim-lint check in CI.

---

## [CQ-04] Copyright year is hardcoded to 2014

- **Severity**: medium
- **Category**: Code Quality

### Evidence

**`app/views/layouts/application.html.slim:73`**

```
p (c) 2014 - Vivim
```

### Impact

The site footer says '(c) 2014 - Vivim' indefinitely. This signals to visitors that the site is abandoned, which (given the last commit was December 2014) is technically true.

### Recommendation

Render the year dynamically: `p (c) #{2014} - #{Time.current.year} Vivim`. Better yet, move the string to i18n and update it in one place.

---

## [CQ-05] README.md is 19 bytes and contains only the project name

- **Severity**: low
- **Category**: Code Quality

### Evidence

**`README.md:1-5`**

```
vivim\n=====\n\nvivim
```

**`README.rdoc:1-30`**

```
== README\n\nThis README would normally document whatever steps are necessary...\n\nThings you may want to cover:\n\n* Ruby version\n\n* System dependencies...
```

### Impact

Neither README helps anyone. A new contributor cannot install, run, test, or deploy the app. The .rdoc file is the Rails default scaffold with placeholder bullets.

### Recommendation

Replace README.md with a real one covering: what the app is, prerequisites (Ruby 3.3, Postgres, Node), setup steps, test command, deploy command. Delete README.rdoc (Rails no longer generates .rdoc by default).

---

## [CQ-06] Zero tests; the test/ tree contains only .keep placeholder files

- **Severity**: high
- **Category**: Code Quality

### Evidence

**`test/controllers/.keep:1`**

```
(0 bytes)
```

**`test/fixtures/.keep:1`**

```
(0 bytes)
```

**`test/helpers/.keep:1`**

```
(0 bytes)
```

**`test/integration/.keep:1`**

```
(0 bytes)
```

**`test/mailers/.keep:1`**

```
(0 bytes)
```

**`test/models/.keep:1`**

```
(0 bytes)
```

**`test/test_helper.rb:1-13`**

```
ENV['RAILS_ENV'] ||= 'test'\nrequire File.expand_path('../../config/environment', __FILE__)\nrequire 'rails/test_help'\n\nclass ActiveSupport::TestCase\n  fixtures :all\nend
```

**`db/schema.rb:14`**

```
ActiveRecord::Schema.define(version: 0) do
```

### Impact

The schema version is 0 - no migrations have ever been run. There are no models, no controllers, no mailers, no integration tests. Only test_helper.rb exists, and it is the Rails default. Every change to the codebase ships unverified.

### Recommendation

Adopt RSpec (Rails community standard) over minitest. Write request specs for the 5 routes (index, mobile, why_ror, contact, sitemap). Add a SimpleCov gate at 80% for app/. Run on every PR.

---

## [CQ-07] Helper module uses tabs for indentation (Ruby convention is 2 spaces)

- **Severity**: low
- **Category**: Code Quality

### Evidence

**`app/helpers/application_helper.rb:2-12`**

```
\tdef title_phrase\n\t\t'Denver Mobile App Development | Web Design | UX/UI Design'\n\tend
```

### Impact

The rest of the Ruby codebase (controllers, mailers) uses 2-space indentation. application_helper.rb uses tabs. RuboCop will flag every line; the inconsistency makes diffs noisy.

### Recommendation

Run rubocop -A to auto-correct. Add a .rubocop.yml with the standard Rails ruleset.

---

## [CQ-08] Unicorn 4.8.3 is deprecated; Puma is the Rails-default server since Rails 5

- **Severity**: low
- **Category**: Code Quality

### Evidence

**`Gemfile.lock:155-158`**

```
unicorn (4.8.3)\n  kgio (~> 2.6)\n  rack\n  raindrops (~> 0.7)
```

**`Gemfile:25-27`**

```
group :production do\n  gem 'unicorn'\nend
```

**`config/unicorn/production.rb:1-52`**

```
# 52-line unicorn config including before_fork / after_fork hooks
```

### Impact

Unicorn 4.x was last released in 2014. The Rails ecosystem moved to Puma (multi-threaded, better memory footprint, default since Rails 5). The 52-line unicorn config is dead weight that adds operational complexity for no benefit.

### Recommendation

Replace unicorn with puma. Delete config/unicorn/. Add config/puma.rb with worker_count tuned to the instance size.

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
