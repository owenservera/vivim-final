# Analysis: Web Presence: SEO, GA4, i18n Refresh

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

Google Analytics Universal (analytics.js) was sunset in July 2023 - the site collects zero analytics today. Marketing copy is hardcoded in Ruby helper methods instead of i18n files. The sitemap config is hardcoded to vivim.net. There is no JSON-LD structured data, no canonical tags, and robots.txt is fully commented out.

## Findings (7 total)

## [WEB-01] Google Analytics Universal (analytics.js) was sunset July 2023

- **Severity**: high
- **Category**: Web Presence

### Evidence

**`app/views/layouts/_google_analytics_js.html.erb:2-9`**

```
(see WEB-01 evidence block below; full snippet in EVIDENCE.json)
```

### Evidence block

```
Original lines 2-9 of app/views/layouts/_google_analytics_js.html.erb:

  <script type="text/javascript">
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
    ga('create', 'UA-52801750-1', 'auto');
    ga('send', 'pageview');
  </script>

Key markers: 'google-analytics.com/analytics.js' (UA endpoint, sunset July 2023)
            'UA-52801750-1' (Universal Analytics property ID, no longer processed)
```

### Impact

UA-52801750-1 is a Universal Analytics property. Google stopped processing UA hits on July 1, 2023. The site has had zero analytics collection for over 2 years. The GA snippet still loads, still sends hits, still costs bandwidth - but Google discards them on receipt.

### Recommendation

Replace with Google Analytics 4 via gtag.js. Create a GA4 measurement ID (G-XXXXXXX) in the GA console. Update the partial. Consider adding Plausible or Fathom as a privacy-friendly alternative.

---

## [WEB-02] All marketing copy is hardcoded in Ruby helper methods, not i18n

- **Severity**: medium
- **Category**: Web Presence

### Evidence

**`app/helpers/application_helper.rb:2-12`**

```
def title_phrase\n  'Denver Mobile App Development | Web Design | UX/UI Design'\nend\n\ndef meta_description_content\n  'Denver Mobile App Development company focused on making cutting edge apps...'\nend\n\ndef meta_keywords_content\n  'Denver mobile app development, Denver mobile application development, Denver mobile app developer...'
```

**`config/locales/en.yml:1-20`**

```
(file exists but only has the Rails default scaffolding - no vivim strings)
```

### Impact

Every copy change requires editing a Ruby file, running tests, and deploying. Non-technical team members (marketers, sales) cannot edit copy. There is no path to localization. The meta_keywords_content is also a list of comma-separated SEO terms - a practice Google has ignored since 2009.

### Recommendation

Move all user-facing strings to config/locales/en.yml under vivim: keys. Replace helper methods with t('.title') lookups. Delete the keywords meta tag entirely (Google ignores it).

---

## [WEB-03] Sitemap config hardcoded to www.vivim.net

- **Severity**: medium
- **Category**: Web Presence

### Evidence

**`config/sitemap.rb:1-9`**

```
host "www.vivim.net"\n\nsitemap :site do\n  url root_url, last_mod: Time.now, change_freq: "daily", priority: 1.0\n  url mobile_url, last_mod: Time.now, change_freq: "daily", priority: 1.0\n  url why_ror_url, last_mod: Time.now, change_freq: "daily", priority: 1.0\nend
```

**`public/sitemaps/sitemap.xml:1`**

```
(precompiled static file in the repo)
```

### Impact

The host is hardcoded, so the sitemap cannot be regenerated for staging or a domain change without editing source. The precompiled sitemap.xml in public/sitemaps/ is committed to the repo, which means search engines see whatever was committed in 2014 unless someone manually regenerates.

### Recommendation

Read the host from ENV. Move sitemap generation to a Rake task that runs on deploy. Add the sitemap URL to Google Search Console.

---

## [WEB-04] robots.txt is fully commented out

- **Severity**: medium
- **Category**: Web Presence

### Evidence

**`public/robots.txt:1-5`**

```
# See http://www.robotstxt.org/robotstxt.html for documentation...\n#\n# To ban all spiders from the entire site uncomment the next two lines:\n# User-agent: *\n# Disallow: /
```

### Impact

All rules are commented out, so robots.txt is effectively empty. Search engines will crawl everything (including /up, /contact, /sitemap.xml itself). There is no reference to the sitemap, which means crawlers have to discover it via the meta tag or Search Console submission.

### Recommendation

Uncomment User-agent: * and add an Allow: / plus a Sitemap: https://vivim.net/sitemap.xml directive. Disallow /up so the health check is not indexed.

---

## [WEB-05] No canonical URL or Open Graph tags

- **Severity**: low
- **Category**: Web Presence

### Evidence

**`app/views/layouts/application.html.slim:1-18`**

```
(see WEB-05 evidence block below; full layout head section)
```

### Evidence block

```
Original lines 1-18 of app/views/layouts/application.html.slim:

  doctype html
  html
    head
      title=title_phrase
      meta name="description" content="#{meta_description_content}"
      meta name="keywords" content="#{meta_keywords_content}"
  \tmeta name="viewport" content="width=device-width, initial-scale=1.0"
  \tmeta http-equiv="X-UA-Compatible" content="IE=edge"
      link rel="shortcut icon" href="/favicon.png"
      = csrf_meta_tags
      = stylesheet_link_tag 'application', 'data-turbolinks-track' => true
      = javascript_include_tag 'application', 'data-turbolinks-track' => true
      link href='http://fonts.googleapis.com/css?family=Source+Sans+Pro...' rel='stylesheet' type='text/css'

Key markers: no rel="canonical" link tag
            no og:* meta tags
            no twitter:card meta tags
            http:// fonts URL (also flagged in WEB-07)
```

### Impact

Without rel=canonical, search engines may index both www and non-www versions of the same page, splitting page rank. Without Open Graph tags, social shares (Facebook, LinkedIn, Slack) show no preview image or title.

### Recommendation

Add canonical_link_tag to the layout. Add og:title, og:description, og:image, og:url meta tags. Add twitter:card tags for X/Twitter previews.

---

## [WEB-06] No JSON-LD structured data

- **Severity**: low
- **Category**: Web Presence

### Evidence

**`app/views/layouts/application.html.slim:1-18`**

```
(no script type='application/ld+json' tag anywhere in the layout)
```

**`app/views/index/index.html.slim:1-135`**

```
(no structured data in any view)
```

### Impact

Without structured data, Google does not know the business is a local service in Denver with a phone number and address. The site misses out on Local Business rich results, which are the primary way mobile users find service businesses.

### Recommendation

Add a LocalBusiness JSON-LD block to the layout, populated from a single config file or i18n entry. Include name, address, geo, telephone, openingHours, url, and sameAs (social profiles).

---

## [WEB-07] Google Fonts loaded over HTTP (not HTTPS)

- **Severity**: low
- **Category**: Web Presence

### Evidence

**`app/views/layouts/application.html.slim:16`**

```
link href='http://fonts.googleapis.com/css?family=Source+Sans+Pro:200,300,400,600,700,900,200italic,300italic,400italic,600italic,700italic,900italic' rel='stylesheet' type='text/css'
```

### Impact

Loading fonts over HTTP on an HTTPS page triggers mixed-content warnings in modern browsers, and the request may be blocked entirely. Browsers also no longer cache cross-origin HTTP resources securely.

### Recommendation

Change http:// to https://. Better yet, self-host the font subset to avoid the third-party request and improve Core Web Vitals.

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
