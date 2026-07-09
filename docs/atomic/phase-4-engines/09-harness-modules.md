# Unit 4.14-4.18: Harness Modules (5 units)

**Phase:** 4 | **Files:** `seeds/harness/` (5 files)
**Depends:** 4.7 HarnessRuntime | **Produces:** Capability-specific orchestration modules
**Source:** `06-merged-seeds.md` §Harness Module Contract

## HarnessModule Contract (all must implement)
```typescript
interface HarnessModule {
  name: string;
  version: number;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  preconditions: string[];
  postconditions: string[];
  execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult>;
}
```

## 4.14: composer.module.ts
- Purpose: Interact with chat composer element
- Actions: focus, type, clear, send, get_content
- Preconditions: ['page_loaded']
- Postconditions: ['composer_visible']
- Input schema: { action: 'focus'|'type'|'clear'|'send'|'get_content', text?: string, selector?: string }
- Default selector: `[contenteditable]`
- Send: clicks `[aria-label="Send Message"]` or dispatches Enter key

## 4.15: login.module.ts
- Purpose: Handle login flows
- Actions: wait_for_form, type_email, type_password, submit, detect_login_state
- Preconditions: ['page_loaded']
- Postconditions: ['logged_in' | 'login_failed']
- Waits for email input, types credentials, clicks submit
- Detects login state via URL change or DOM indicator

## 4.16: navigation.module.ts
- Purpose: Navigate to URLs and wait for page readiness
- Actions: navigate, wait_for, get_current_url
- Preconditions: ['chrome_running']
- Postconditions: ['page_loaded']
- Uses Governor.cdp.send('Page.navigate', { url })
- Waits for page load event + optional selector

## 4.17: capture.module.ts
- Purpose: Capture network responses and DOM state
- Actions: start_capture, stop_capture, get_response_body, screenshot
- Enables Network domain, intercepts matching requests
- Returns response body for matched URL patterns
- Screenshot via Page.captureScreenshot

## 4.18: selector.module.ts
- Purpose: DOM querying and element interaction
- Actions: query, query_all, wait_for, click, get_text, get_attribute
- Preconditions: ['page_loaded']
- Supports CSS, XPath, aria-label, text-content selectors
- Returns element properties (text, attributes, visibility, bounding box)
- Emits telemetry for selector hit/miss

## Tests (per module)
- [ ] composer: focus→type→send sequence completes
- [ ] login: detects login form, types credentials
- [ ] navigation: navigates to URL and waits for load
- [ ] capture: captures network response matching pattern
- [ ] selector: queries element by CSS, aria, text

## Gate
- All 5 modules implement HarnessModule interface
- Zod schemas validate input/output
- Dynamic import() loads each module
