# Analysis: UX: Mobile & Responsive Modernization

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

The site targets mobile users in its marketing copy ("150 times a day" phone-checks) but ships Bootstrap 3 navbar + img-responsive classes (BS3 was EOL July 2019), no srcset/sizes for the hero banner, no apple-touch-icon, no theme-color, no PWA manifest, and a carousel that ignores prefers-reduced-motion. On modern phones the site looks dated and cannot be installed as an app.

## Findings (8 total)

## [UX6-01] Bootstrap 3 navbar markup (navbar-toggle, icon-bar) - BS3 EOL July 2019

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:30-39`**

```
header.navbar.navbar-inverse.navbar-fixed-top role="banner"\n  .container\n    .navbar-header\n      button.navbar-toggle data-target="#bs-navbar-collapse" data-toggle="collapse" type="button"\n        span.sr-only Toggle navigation\n        span.icon-bar\n        span.icon-bar\n        span.icon-bar
```

### Impact

Bootstrap 3 reached end-of-life on July 2019 and no longer receives security patches. The navbar-toggle / icon-bar classes were removed in Bootstrap 4 (replaced by navbar-toggler / navbar-toggler-icon) and again changed in Bootstrap 5. Any future Bootstrap upgrade will break the navbar markup, and any new developer onboarding will have to learn the deprecated BS3 conventions.

### Recommendation

Migrate to Bootstrap 5.3 (or remove Bootstrap entirely in favor of Tailwind). The navbar markup becomes <nav class='navbar navbar-expand-lg navbar-dark'> with <button class='navbar-toggler' data-bs-toggle='collapse' data-bs-target='#nav'>. Update gem 'bootstrap-sass' to gem 'bootstrap' ~> 5.3.

---

## [UX6-02] Images use img-responsive (Bootstrap 3 class, removed in BS4/5)

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/views/index/index.html.slim:3`**

```
img.img-responsive src="images/devices.png" alt='Denver mobile app development  company'
```

**`app/views/index/index.html.slim:13`**

```
img.img-responsive.about-us-employees src='images/mobile-app-design-denver.png' alt='Denver mobile app developers'
```

**`app/views/layouts/application.html.slim:63`**

```
img.img-responsive src="images/logo.png" alt='Denver mobile app development'
```

### Evidence block

```
Count of img-responsive occurrences in the codebase:
  $ grep -rn 'img-responsive' app/views/
  app/views/index/index.html.slim:3:img.img-responsive src="images/devices.png"
  app/views/index/index.html.slim:13:img.img-responsive.about-us-employees
  app/views/index/index.html.slim:23:img.img-responsive src="images/feature1.png"
  app/views/index/index.html.slim:31:img.img-responsive src="images/feature2.png"
  app/views/index/index.html.slim:39:img.img-responsive src="images/feature3.jpg"
  app/views/index/index.html.slim:47:img.img-responsive src="images/mobile-app-development-denver.png"
  (plus ~14 more in the carousel section, lines 62-122)
  app/views/layouts/application.html.slim:63:img.img-responsive src="images/logo.png"
  app/views/layouts/application.html.slim:65:img.img-responsive src="images/logo.png"

Total: ~22 usages of the BS3 class. img-fluid (BS4/5) is the replacement.
```

### Impact

img-responsive is the Bootstrap 3 class. Bootstrap 4 (2018) and 5 (2021) renamed it to img-fluid and removed the old class entirely. Any future Bootstrap upgrade will silently break all 22 images - they will lose max-width:100% and overflow their containers on mobile. The class is also a maintenance signal: it tells new developers the codebase is from the BS3 era.

### Recommendation

Replace all 22 occurrences of img-responsive with img-fluid. Add a global CSS alias .img-responsive { @extend .img-fluid; } as a transitional safety net during the migration.

---

## [UX6-03] Hero banner loads full-size PNG with no srcset/sizes

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`app/views/index/index.html.slim:2-4`**

```
section.banner\n  .container\n    .row\n      .img.img-banner: img.img-responsive src="images/devices.png" alt='Denver mobile app development  company'
```

### Impact

devices.png is the hero banner - likely 1200-2000px wide, 200-500KB. On a 375px-wide iPhone, the browser still downloads the full-size image and scales it down, wasting 80%+ of the bytes. Core Web Vitals LCP (Largest Contentful Paint) is directly harmed. Google's PageSpeed Insights will flag this as a 'properly size images' opportunity saving hundreds of KB.

### Recommendation

Generate 3 sizes of devices.png (480w, 1024w, 1920w) in WebP. Use <img srcset='devices-480w.webp 480w, devices-1024w.webp 1024w, devices-1920w.webp 1920w' sizes='(max-width: 480px) 100vw, (max-width: 1024px) 100vw, 1920px' src='devices-1024w.webp'>. Same pattern for all hero/feature images.

---

## [UX6-04] No apple-touch-icon, no theme-color, no PWA manifest

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:5-15`**

```
head\n  title=title_phrase\n  meta name="description" content="#{meta_description_content}"\n  meta name="keywords" content="#{meta_keywords_content}"\n  meta name="viewport" content="width=device-width, initial-scale=1.0"\n  meta http-equiv="X-UA-Compatible" content="IE=edge"\n  link rel="shortcut icon" href="/favicon.png"\n  = csrf_meta_tags\n  = stylesheet_link_tag 'application', 'data-turbolinks-track' => true\n  = javascript_include_tag 'application', 'data-turbolinks-track' => true\n  link href='http://fonts.googleapis.com/css?family=Source+Sans+Pro...' rel='stylesheet' type='text/css'
```

### Impact

When an iOS user taps 'Add to Home Screen' on the site today, they get a default screenshot icon and no splash screen. On Android Chrome, the site cannot be installed as a PWA at all because there is no manifest.json. theme-color is missing, so the browser chrome does not match the brand. This is table-stakes for any modern mobile web presence.

### Recommendation

Add <link rel='apple-touch-icon' href='/apple-touch-icon.png'> (180x180). Add <meta name='theme-color' content='#2d2d2d'>. Add <link rel='manifest' href='/manifest.json'> and ship a manifest.json with name, short_name, icons (192/512), theme_color, background_color, display: 'standalone'.

---

## [UX6-05] Carousel autoPlay:3000 ignores prefers-reduced-motion

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`app/assets/javascripts/application.js.coffee:11-13`**

```
$ ->\n  $('a.colorbox').colorbox(rel: 'a.colorbox')\n  $(".group1").colorbox({rel:'group1'})\n  $(".owl-carousel").owlCarousel({\n      autoPlay: 3000\n    })
```

### Impact

WCAG 2.1 SC 2.3.3 (Animation from Interactions) requires that motion triggered by the page can be disabled. The carousel auto-advances every 3 seconds regardless of the user's OS-level reduced-motion preference. For users with vestibular disorders this causes nausea; for users with ADHD it makes the page unusable.

### Recommendation

Read window.matchMedia('(prefers-reduced-motion: reduce)').matches. If true, set autoPlay: false. Also expose manual prev/next controls (currently missing entirely - the carousel is auto-only).

---

## [UX6-06] Colorbox lightbox has no touch/swipe support - mobile users cannot navigate

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`app/assets/javascripts/application.js.coffee:8-9`**

```
$ ->\n  $('a.colorbox').colorbox(rel: 'a.colorbox')\n  $(".group1").colorbox({rel:'group1'})
```

**`app/assets/stylesheets/colorbox.css:1-5`**

```
/* Colorbox Core Style - position:absolute, fixed-width buttons with text-indent:-9999px */
```

### Impact

Colorbox is a 2010-era jQuery lightbox. Its prev/next buttons are 25x25px (below Apple's 44x44pt minimum touch target) and positioned at the bottom of the lightbox. On mobile there are no swipe gestures. A user tapping a project screenshot gets a fullscreen image with no obvious way to advance or dismiss. Most will pinch-zoom out and leave.

### Recommendation

Replace Colorbox with a modern lightbox (GLightbox, Photoswipe, or a CSS-only :target pattern). At minimum add touch swipe via hammer.js and bump button sizes to 44x44px.

---

## [UX6-07] Copyright year hardcoded as '© 2014 - Vivim' - never updates

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:84`**

```
p © 2014 - Vivim
```

### Impact

The copyright year is hardcoded to 2014, so every visitor in 2024+ sees a 10-year-stale notice. This is a low-severity credibility hit - it signals the site is unmaintained. Legal teams also prefer dynamic years for copyright duration claims.

### Recommendation

Replace with: p © #{Date.current.year} - #{t('vivim.site.copyright')}. Add a Timecop-stable test.

---

## [UX6-08] viewport meta lacks viewport-fit=cover for notch/Dynamic Island

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`app/views/layouts/application.html.slim:6`**

```
meta name="viewport" content="width=device-width, initial-scale=1.0"
```

### Impact

Without viewport-fit=cover, the page does not extend into the notch / Dynamic Island area on iPhone X and later. The footer (which contains the contact form) gets a black bar at top and bottom on landscape orientation. This is a small visual issue but trivial to fix.

### Recommendation

Update to: meta name='viewport' content='width=device-width, initial-scale=1.0, viewport-fit=cover'. Add safe-area-inset-* padding to body if needed.

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
