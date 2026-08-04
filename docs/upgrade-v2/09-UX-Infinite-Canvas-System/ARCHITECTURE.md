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

- [UX9-01] Flat card list hides package relationships - no spatial overview exists -> Add an /canvas route that renders all packages as draggable nodes on an infinite 2D workspace.
- [UX9-02] No infinite pan/zoom workspace - users cannot lay out artifacts spatially -> Implement an infinite canvas with a viewport transform (scale + translate) that supports pan (space-drag, middle-mouse, two-finger trackpad), zoom (cmd+scroll, pinch, +/- keys), and a coordinate range of [-100000, +100000] on both axes.
- [UX9-03] No user-configurable theme/layout/behavior - one size fits nobody -> Introduce a typed CanvasConfig schema (see src/canvas/config.
- [UX9-04] No node-type extensibility - cannot add custom artifact kinds (notes, screenshots, embeds) -> Define a NodeType registry (src/canvas/nodes/registry.
- [UX9-05] No keyboard-first / vim-modal canvas interaction - mouse-only is a power-user blocker -> Implement a vim-style modal command layer (src/canvas/commands.
- [UX9-06] No persistence of canvas state - layout is lost on refresh -> Persist canvas state to IndexedDB (local-first, no server round-trip) on every change with a 500ms debounce.
- [UX9-07] No templates library - every user rebuilds common layouts from scratch -> Ship a templates directory (src/canvas/templates/) with at least 6 built-in templates: kanban, dependency-graph, mind-map, timeline, swimlane-by-team, severity-matrix.
- [UX9-08] No minimap / bird's-eye navigator - users get lost on large canvases -> Add a CanvasMinimap component (src/components/canvas/CanvasMinimap.
- [UX9-09] No find / command palette - cannot locate a node by name across a large canvas -> Add a CanvasPalette component (src/components/canvas/CanvasPalette.
- [UX9-10] No export to PNG/SVG/JSON/PDF - cannot share canvas outside the app -> Add a CanvasExport module (src/canvas/export.
- [UX9-11] No spatial bookmarks / camera positions - cannot save and jump to views -> Add a bookmarks system: press `m` to mark the current viewport, give it a name, and a hotkey (1-9).
- [UX9-12] No collaboration foundation - single-user only, no real-time multi-edit -> Lay the collaboration foundation without shipping the full feature: (1) make canvas state a CRDT (use Y.

## Order of application

Apply findings in severity order (critical first), then by dependency:

1. Critical security findings first (stack upgrade, form hardening).
2. High-severity findings (error handling, dead code, tests).
3. Medium and low findings last (cleanup, SEO, polish).

Within a severity, prefer findings that unblock others. For example,
upgrading Rails (SEC-01) unblocks the rack-attack gem (SEC-04 fix).
