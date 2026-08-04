# Analysis: UX: Content Architecture & Navigation Features

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

Four view templates exist as 0-byte stubs (about_us, contact_us, experts, projects) - abandoned features or never-built routes. The nav links to in-page anchors instead of real pages. The footer still links to Google+ (shut down April 2019). There is no privacy policy, no blog, and the 404/500 pages are generic Rails defaults with no site nav. This package turns the stubs into real pages, adds legal pages, and modernizes the footer.

## Findings (8 total)

## [UX7-01] Four view templates exist as 0-byte stubs (about_us, contact_us, experts, projects)

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/views/index/about_us.html.slim:0`**

```
(file exists but is 0 bytes - empty stub)
```

**`app/views/index/contact_us.html.slim:0`**

```
(file exists but is 0 bytes - empty stub)
```

**`app/views/index/experts.html.slim:0`**

```
(file exists but is 0 bytes - empty stub)
```

**`app/views/index/projects.html.slim:0`**

```
(file exists but is 0 bytes - empty stub)
```

### Evidence block

```
File listing of app/views/index/:
  $ ls -la app/views/index/
  -rw-r--r--  1 z  z    0 Dec 22  2014 about_us.html.slim       <-- EMPTY
  -rw-r--r--  1 z  z    0 Dec 22  2014 contact_us.html.slim     <-- EMPTY
  -rw-r--r--  1 z  z    0 Dec 22  2014 experts.html.slim        <-- EMPTY
  -rw-r--r--  1 z  z 7234 Dec 22  2014 index.html.slim
  -rw-r--r--  1 z  z 3222 Dec 22  2014 mobile.html.slim
  -rw-r--r--  1 z  z    0 Dec 22  2014 projects.html.slim       <-- EMPTY
  -rw-r--r--  1 z  z 3887 Dec 22  2014 why_ror.html.slim

4 of 7 view files are 0 bytes - abandoned features or never-built routes.
config/routes.rb does NOT wire these views to any URL, so they are
unreachable. Either delete them or build them out.
```

### Impact

Four empty view files exist in the codebase from the original Rails generate scaffold. They are not routed (config/routes.rb only defines index, mobile, why_ror, contact, sitemap). They are dead code that confuses new developers ("is /about_us supposed to work?") and they cannot be removed by a Rails upgrade task without manual review.

### Recommendation

Decide: build them as real pages, or delete them. If deleting: rm the 4 files and add a comment in routes.rb. If building: add routes for /about_us, /experts, /projects, /contact_us and populate each with real content (or move the corresponding in-page section into the dedicated page).

---

## [UX7-02] Nav links are in-page anchors, not real routes - back button and deep-linking break

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`config/routes.rb:1-12`**

```
Rails.application.routes.draw do\n  root controller: :index, action: :index\n  get "sitemap.xml" => "index#sitemap", format: :xml, as: :sitemap\n  [:mobile, :why_ror].each do |action|\n    get action, controller: :index, action: action\n  end\n  post :contact, controller: :index, action: :contact\nend
```

**`app/views/layouts/application.html.slim:42-48`**

```
li: a.scroller href="#{root_path}#aboutus" data-section="#aboutus" ABOUT US\nli: a.scroller href="#{root_path}#features" data-section="#features" EXPERTS\nli: a.scroller href="#{root_path}#projects" data-section="#projects" PROJECTS\nli: a.scroller href="#{root_path}#clients" data-section="#clients" CLIENTS\nli = link_to 'WHY ROR?', why_ror_path\nli = link_to 'MOBILE', mobile_path\nli: a.scroller href="#{root_path}#contact" data-section="#contact" CONTACT US
```

### Impact

5 of 7 nav items are anchor links (/#aboutus, /#features, /#projects, /#clients, /#contact). They don't add history entries, so the back button doesn't take the user back to the previous section. Deep-linking (sharing vivim.net/#aboutus) works but only after JS loads. Search engines treat all 5 as the same page (the homepage), so they cannot rank individually. Users cannot open them in new tabs to compare sections.

### Recommendation

Promote the 5 anchor sections to real routes: /about-us, /experts, /projects, /clients, /contact. Each renders the corresponding section in its own page with shared layout. Keep the homepage as an index of all sections. Add a sitemap entry for each new route.

---

## [UX7-03] Footer links to Google+ (shut down April 2, 2019) - dead external link

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:93-96`**

```
.social\n  a.facebook href="https://www.facebook.com/Vivimdesign": i.icon-facebook\n  a.twitter href="https://twitter.com/VivimDesign": i.icon-twitter\n  a.gplus href="https://plus.google.com/u/0/110040302903868037182/posts": img.gplus-button src='/images/icon-google-plus.png'
```

### Impact

Google+ was shut down for consumers on April 2, 2019. The plus.google.com URL now returns a 404 / redirect to a shutdown notice. Every visitor who taps the Google+ icon lands on a dead page. This is both a UX failure (broken link) and a credibility signal (the site has not been audited since 2019).

### Recommendation

Remove the .gplus link entirely. If a presence on a Google-owned social platform is desired, link to the Vivim YouTube channel or Google Business Profile instead. Update the social block to use brand SVG icons (Font Awesome brands) instead of the icon-google-plus.png image.

---

## [UX7-04] No privacy policy or terms of service - legally required for PII collection

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`config/routes.rb:1-12`**

```
(no /privacy or /terms route defined)
```

**`app/views/layouts/application.html.slim:60-79`**

```
(contact form collects name, email, phone, and free-text comment - all PII)
```

### Impact

The contact form collects name + email + phone + comment - personally identifiable information. Colorado Privacy Act (CPA, effective July 1, 2023) requires a privacy notice for any Colorado business collecting PII. GDPR (EU users) requires the same. California CCPA, Virginia VCDPA, etc. all require it. Without a /privacy page, the site is non-compliant in multiple jurisdictions and the form may be subject to enforcement.

### Recommendation

Add /privacy and /terms routes, controllers, and views. Link them in the footer next to the copyright. Privacy policy should cover: what data is collected (name, email, phone, comment), why (to respond to inquiries), how long (90 days then deleted), third parties (email provider, GA4 with anonymize_ip), and contact email for privacy requests.

---

## [UX7-05] No blog / news / case-study section - no content marketing surface

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`config/routes.rb:1-12`**

```
(no /blog, /news, /case-studies, or /portfolio route)
```

**`app/views/index/index.html.slim:57-78`**

```
(the projects section is just an image carousel - no written case studies)
```

### Impact

The site has zero content marketing surface. There is no blog to attract organic search traffic, no case studies to convert prospects, no news section to announce company updates. Every SEO opportunity beyond the 3 static pages is missed. The 'Recent Projects' carousel is just images - no titles, no client names, no descriptions, no links.

### Recommendation

Add a /case-studies section with at least 3 written case studies (client, challenge, solution, result with metrics). Add a /blog section with a CMS (ComfortableMexicanSofa, Storypark, or just markdown files in app/views/blog/posts/*.md). Wire each case study into the existing project carousel as the click-through target.

---

## [UX7-06] 404/422/500 pages are generic Rails defaults with no site nav

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`public/404.html:1-50`**

```
<!DOCTYPE html>\n<html>\n<head>\n  <title>The page you were looking for doesn't exist (404)</title>\n  ...\n  <div class="dialog">\n    <div>\n      <h1>The page you were looking for doesn't exist.</h1>\n      <p>You may have mistyped the address or the page may have moved.</p>\n    </div>\n    <p>If you are the application owner check the logs for more information.</p>\n  </div>
```

**`public/422.html:1-50`**

```
(same generic template, no nav, no brand)
```

**`public/500.html:1-50`**

```
(same generic template, no nav, no brand)
```

### Impact

When a user hits a 404, they see a Rails-default page with no Vivim branding, no nav, no logo, no 'back to home' link. They have no path back to the site. Same for 422 and 500. The 'If you are the application owner' message is developer-facing, not user-facing - it tells the visitor they're not the audience.

### Recommendation

Move error rendering into the app (errors_controller + app/views/errors/not_found.html.slim inside the application layout). Keep public/404.html as a fallback for asset pipeline failures. Brand the page, add the site nav, add a search box or a 'Back to home' button, and a contact link.

---

## [UX7-07] Footer address uses </br> inside <li> - invalid HTML

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:65`**

```
li: a href='https://www.google.com/maps/place/8400+E+Crescent+Pkwy+%23600,+Englewood,+CO+80111/@39.6224585,-104.889195,17z/data=!3m1!4b1!4m2!3m1!1s0x876c86565615fad3:0xba42a985286edf11' 8400 East Crescent Parkway Suite 600 </br> Greenwood Village, CO 80111
```

### Impact

The </br> tag inside a Slim template is invalid HTML - <br> is a void element and should be written as <br> or <br/>. The </br> closing tag is ignored by browsers but flagged by HTML validators. More importantly, putting a <br> inside an <a> inside an <li> is poor structure - the line break should be in the address itself (use <address> or a span with display:block).

### Recommendation

Replace </br> with a properly structured address: li: address <a href='...'> 8400 East Crescent Parkway Suite 600 <br> Greenwood Village, CO 80111 </a>. Or use a span with white-space: pre-line.

---

## [UX7-08] Nav items use uppercase TEXT instead of CSS text-transform - hurts screen readers

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:42-48`**

```
li: a.scroller href="#{root_path}#aboutus" data-section="#aboutus" ABOUT US\nli: a.scroller href="#{root_path}#features" data-section="#features" EXPERTS\nli: a.scroller href="#{root_path}#projects" data-section="#projects" PROJECTS\nli: a.scroller href="#{root_path}#clients" data-section="#clients" CLIENTS\nli = link_to 'WHY ROR?', why_ror_path\nli = link_to 'MOBILE', mobile_path\nli: a.scroller href="#{root_path}#contact" data-section="#contact" CONTACT US
```

### Impact

Screen readers may read all-caps text as acronyms ('ABOUT US' -> 'about us' is fine, but 'WHY ROR?' may be read as 'why ror' with wrong emphasis). Using CSS text-transform: uppercase lets screen readers see the natural-case text and apply correct pronunciation, while still rendering visually uppercase.

### Recommendation

Write the nav text in normal case: 'About us', 'Experts', 'Projects', 'Clients', 'Why RoR?', 'Mobile', 'Contact us'. Add a CSS rule: .nav-link { text-transform: uppercase; letter-spacing: 0.05em; } to keep the visual style.

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
