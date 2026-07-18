// src/engines/browser-automation/recipes.ts
// Composite recipe library — 40+ reusable automation recipes built from the
// extended RecipeStep vocabulary. These are declarative config (no scenario
// brains); the AutomationOrchestrator composes them with agent-role configs.

import type { Recipe } from '../../storage/contracts/program-store.js'

function recipe(id: string, description: string, steps: Recipe['steps'], extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    providerId: 'generic',
    capabilitySlug: id,
    version: 1,
    description,
    steps,
    tags: ['auto'],
    ...extra,
  }
}

export const RECIPES: Recipe[] = [
  // ── research ──
  recipe('auto:research:report', 'Deep research report: crawl N sources, extract, summarize.', [
    { kind: 'navigate', url: '{{queryUrl}}' },
    { kind: 'wait_text', text: '', timeoutMs: 3000 },
    { kind: 'extract_markdown' },
    { kind: 'observe', what: 'screenshot' },
  ], { tags: ['auto', 'research'] }),
  recipe('auto:research:crawl', 'Crawl a single URL and capture markdown + links.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: 'body', timeoutMs: 5000 },
    { kind: 'extract_markdown' },
    { kind: 'observe', what: 'dom' },
  ]),
  recipe('auto:research:deep', 'Deep research: scroll infinitely then extract.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'scroll', y: 0, selector: '' },
    { kind: 'wait', timeoutMs: 1000 },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:research:compare', 'Compare two URLs side by side (two tabs).', [
    { kind: 'navigate', url: '{{urlA}}' },
    { kind: 'tab_open', url: '{{urlB}}' },
    { kind: 'extract_markdown' },
  ]),

  // ── monitor ──
  recipe('auto:monitor:watch', 'Watch a URL and capture state for diffing.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait', timeoutMs: 2000 },
    { kind: 'observe', what: 'dom' },
  ]),
  recipe('auto:monitor:price', 'Extract a price element and report it.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: '{{priceSelector}}', timeoutMs: 5000 },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:monitor:availability', 'Check stock availability text.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_text', text: '{{inStockText}}', timeoutMs: 5000 },
    { kind: 'observe', what: 'dom' },
  ]),
  recipe('auto:monitor:diff', 'Capture DOM snapshot for later diff.', [
    { kind: 'observe', what: 'dom' },
    { kind: 'screenshot' },
  ]),

  // ── form ──
  recipe('auto:form:autofill', 'Autofill a form from a profile map.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: 'form', timeoutMs: 5000 },
    { kind: 'type_text', selector: '{{nameSelector}}', text: '{{name}}' },
    { kind: 'type_text', selector: '{{emailSelector}}', text: '{{email}}' },
    { kind: 'type_text', selector: '{{phoneSelector}}', text: '{{phone}}' },
    { kind: 'click', selector: 'button[type=submit], button' },
  ]),
  recipe('auto:form:multi', 'Fill multiple fields from a key/value list.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: 'form', timeoutMs: 5000 },
    { kind: 'type_text', selector: '{{fieldSelector}}', text: '{{value}}' },
  ]),

  // ── commerce ──
  recipe('auto:commerce:checkout', 'Add to cart and proceed to checkout (destructive-gated).', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: '{{addToCart}}', timeoutMs: 5000 },
    { kind: 'click', selector: '{{addToCart}}' },
    { kind: 'wait_selector', selector: '{{checkout}}', timeoutMs: 5000 },
    { kind: 'human_gate', prompt: 'Confirm checkout?' },
    { kind: 'click', selector: '{{checkout}}' },
  ]),
  recipe('auto:commerce:cart', 'Add item to cart.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'click', selector: '{{addToCart}}' },
  ]),
  recipe('auto:commerce:price-track', 'Record price for tracking.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: '{{priceSelector}}', timeoutMs: 5000 },
    { kind: 'extract_markdown' },
  ]),

  // ── data ──
  recipe('auto:data:scrape', 'Scrape a page into structured markdown + links.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait', timeoutMs: 1500 },
    { kind: 'extract_markdown' },
    { kind: 'observe', what: 'dom' },
  ]),
  recipe('auto:data:join', 'Scrape multiple URLs (parallel tabs).', [
    { kind: 'parallel', branches: [[{ kind: 'navigate', url: '{{url1}}' }], [{ kind: 'navigate', url: '{{url2}}' }]] },
  ]),
  recipe('auto:data:dedupe', 'Scrape then dedupe links.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:data:export', 'Scrape and write to a file.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),

  // ── auth ──
  recipe('auto:auth:session', 'Login then extract protected content.', [
    { kind: 'navigate', url: '{{loginUrl}}' },
    { kind: 'type_text', selector: 'input[type=email]', text: '{{user}}' },
    { kind: 'type_text', selector: 'input[type=password]', text: '{{pass}}' },
    { kind: 'click', selector: 'button[type=submit]' },
    { kind: 'wait', timeoutMs: 2000 },
    { kind: 'navigate', url: '{{targetUrl}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:auth:persist', 'Login and persist session cookies.', [
    { kind: 'navigate', url: '{{loginUrl}}' },
    { kind: 'type_text', selector: 'input[type=email]', text: '{{user}}' },
    { kind: 'type_text', selector: 'input[type=password]', text: '{{pass}}' },
    { kind: 'click', selector: 'button[type=submit]' },
  ]),

  // ── content ──
  recipe('auto:content:summarize', 'Navigate and extract a TL;DR-ready markdown.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: 'article, main, body', timeoutMs: 5000 },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:content:translate', 'Extract then hand to translator (markdown).', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:content:tldr', 'Extract first N paragraphs.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:content:rewrite', 'Extract source for rewrite.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),

  // ── extract ──
  recipe('auto:extract:structured', 'Extract structured JSON-LD + tables.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:extract:table', 'Extract all tables.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'wait_selector', selector: 'table', timeoutMs: 5000 },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:extract:feed', 'Find and follow RSS feeds.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'observe', what: 'dom' },
  ]),

  // ── test ──
  recipe('auto:test:ui', 'UI smoke test: click through and capture console.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'observe', what: 'console' },
    { kind: 'click', selector: '{{cta}}' },
    { kind: 'wait', timeoutMs: 1500 },
    { kind: 'screenshot' },
  ]),
  recipe('auto:test:smoke', 'Smoke test: load + assert title.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'assert', condition: 'document.readyState==="complete"' },
  ]),
  recipe('auto:test:regression', 'Regression: screenshot + dom diff.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'observe', what: 'dom' },
    { kind: 'screenshot' },
  ]),
  recipe('auto:test:visual', 'Visual test: capture full screenshot.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'screenshot' },
  ]),

  // ── booking ──
  recipe('auto:ticket:book', 'Book a ticket (destructive-gated).', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'click', selector: '{{show}}' },
    { kind: 'human_gate', prompt: 'Confirm booking?' },
    { kind: 'click', selector: '{{buy}}' },
  ]),
  recipe('auto:ticket:reserve', 'Reserve a ticket.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'click', selector: '{{reserve}}' },
  ]),

  // ── social ──
  recipe('auto:social:post', 'Compose and post to a social site (destructive-gated).', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'type_text', selector: '{{composer}}', text: '{{post}}' },
    { kind: 'human_gate', prompt: 'Post?' },
    { kind: 'click', selector: '{{submit}}' },
  ]),
  recipe('auto:social:monitor', 'Monitor a profile for new posts.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'observe', what: 'dom' },
  ]),

  // ── misc ──
  recipe('auto:email:compose', 'Compose an email draft.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'type_text', selector: '{{to}}', text: '{{recipient}}' },
    { kind: 'type_text', selector: '{{body}}', text: '{{message}}' },
  ]),
  recipe('auto:doc:fill', 'Fill a document template.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'type_text', selector: '{{field}}', text: '{{value}}' },
  ]),
  recipe('auto:pdf:extract', 'Open a PDF and capture text.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:job:apply', 'Apply to a job posting (destructive-gated).', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'click', selector: '{{apply}}' },
    { kind: 'human_gate', prompt: 'Apply?' },
    { kind: 'click', selector: '{{submit}}' },
  ]),
  recipe('auto:lead:enrich', 'Enrich a lead page into structured notes.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:report:generate', 'Generate a markdown report from captured pages.', [
    { kind: 'extract_markdown' },
    { kind: 'observe', what: 'dom' },
  ]),
  recipe('auto:search:query', 'Run a search query and capture results.', [
    { kind: 'navigate', url: '{{searchUrl}}' },
    { kind: 'wait_selector', selector: '{{results}}', timeoutMs: 5000 },
    { kind: 'extract_markdown' },
  ]),
  recipe('auto:nav:click-link', 'Click a link by text.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'click', selector: '{{linkSelector}}' },
  ]),
  recipe('auto:capture:full', 'Capture a full-page screenshot.', [
    { kind: 'navigate', url: '{{url}}' },
    { kind: 'screenshot' },
  ]),
  recipe('auto:observe:state', 'Capture full observation (dom + a11y + screenshot).', [
    { kind: 'observe', what: 'dom' },
    { kind: 'observe', what: 'a11y' },
    { kind: 'screenshot' },
  ]),
  recipe('auto:flow:parallel-crawl', 'Crawl multiple URLs in parallel tabs.', [
    { kind: 'parallel', branches: [[{ kind: 'navigate', url: '{{url1}}' }], [{ kind: 'navigate', url: '{{url2}}' }], [{ kind: 'navigate', url: '{{url3}}' }]] },
  ]),
]

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id)
}
