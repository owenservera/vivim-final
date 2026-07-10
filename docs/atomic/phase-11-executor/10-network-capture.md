# Unit 11.10: Network Capture

**Phase:** 11 | **File:** `src/executor/network-capture.ts`
**Depends:** 11.1 CDP Client | **Produces:** Network response interception via CDP

## Purpose
Intercepts HTTP network responses in Chrome via CDP `Network.responseReceived` and `Network.getResponseBody`. Captures API responses, streaming data, and page resources for debugging, replay, and extraction.

## Interface
```typescript
export class NetworkCapture {
  constructor(private cdp: BunCdpClient) {}

  async startCapture(opts?: NetworkCaptureOptions): Promise<void>;
  async stopCapture(): Promise<NetworkCaptureResult>;
  setUrlFilter(pattern: RegExp | string): void;
  getCapturedRequests(): CapturedRequest[];
  clear(): void;
  onRequest(handler: (req: CapturedRequest) => void): void;
}

export interface NetworkCaptureOptions {
  captureRequestBody?: boolean;      // default false
  captureResponseBody?: boolean;     // default true
  urlFilter?: RegExp | string;       // only capture matching URLs
  maxBodySize?: number;              // max bytes to capture per body (default 1MB)
}

export interface CapturedRequest {
  requestId: string;
  url: string;
  method: string;
  type: string;                     // Document, XHR, Fetch, WebSocket, etc.
  statusCode: number;
  statusText: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timestamp: number;
  durationMs: number;
}

export interface NetworkCaptureResult {
  requests: CapturedRequest[];
  totalCount: number;
  xhrCount: number;
  fetchCount: number;
  documentCount: number;
  totalBytes: number;
  startTime: number;
  endTime: number;
  durationMs: number;
}

export class NetworkCaptureError extends Error {}
```

## Required Capabilities
- Enable CDP Network domain: `Network.enable`
- Listen for `Network.responseReceived` events
- On matching response, call `Network.getResponseBody` to retrieve body
- Apply URL filter (regex or string match)
- Capture metadata: URL, method, status, headers, timing
- Group by request type (XHR, Fetch, Document)
- Body size limit to prevent OOM
- Streaming detection: identify chunked/streaming responses

## Tests
- [ ] `startCapture()` enables Network domain
- [ ] Captures XHR request with URL, method, status (requires browser)
- [ ] Captures response body (requires browser)
- [ ] URL filter excludes non-matching requests
- [ ] `stopCapture()` returns NetworkCaptureResult with correct counts
- [ ] Body size limit truncates large responses
- [ ] `onRequest()` fires for each captured request

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/network-capture.test.ts` passes

## Design Notes
This is a new file (not ported from cap-store). Essential for debugging provider API behavior, understanding streaming formats, and extracting response data that isn't visible in the DOM.
