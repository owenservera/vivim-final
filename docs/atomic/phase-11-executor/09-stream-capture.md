# Unit 11.9: Stream Capture

**Phase:** 11 | **File:** `src/executor/stream-capture.ts`
**Depends:** 11.1 CDP Client | **Produces:** AI streaming response interceptor via CDP

## Purpose
Intercepts streaming AI responses from provider web UIs via CDP. Uses `Runtime.consoleAPICalled` or network interception to capture streaming text chunks as they appear in the browser, enabling real-time response streaming rather than waiting for completion.

## Interface
```typescript
export class StreamCapture {
  constructor(private cdp: BunCdpClient) {}

  async startCapture(opts?: CaptureOptions): Promise<void>;
  async stopCapture(): Promise<CaptureResult>;
  onChunk(handler: (chunk: StreamChunk) => void): void;
  get capturedChunks(): StreamChunk[];
}

export interface CaptureOptions {
  pollIntervalMs?: number;            // default 100
  captureMode?: 'console' | 'dom' | 'network';
  selector?: string;                  // DOM selector to monitor for new content
  networkPattern?: string;            // URL pattern to intercept
}

export interface StreamChunk {
  text: string;
  timestamp: number;
  index: number;
}

export interface CaptureResult {
  chunks: StreamChunk[];
  fullText: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  captureMode: string;
}

export class StreamCaptureError extends Error {}
```

## Required Capabilities
- Three capture modes:
  - **console**: intercept `console.log` calls from the page (some providers log stream tokens)
  - **dom**: poll a DOM element and detect content changes (works generically)
  - **network**: intercept network responses matching a URL pattern
- `startCapture()`: begin monitoring, clear previous chunks
- `stopCapture()`: stop monitoring, return accumulated text
- `onChunk()`: real-time callback for each detected chunk
- Timestamp each chunk with high-resolution time
- Reconstruct full text from chunks

## Tests
- [ ] DOM capture: polls element, detects content changes (requires browser)
- [ ] `startCapture()` then `stopCapture()` returns accumulated chunks
- [ ] `onChunk()` fires for each detected text change
- [ ] Console capture: page console.log → captured (requires browser)
- [ ] Network capture: intercepts matching URL pattern (requires browser)

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/stream-capture.test.ts` passes

## Design Notes
This is a new file (not ported from cap-store). cap-store uses a different streaming approach. For vivim-final, DOM polling mode is the most reliable across providers and should be the default. Console mode is fastest but only works for providers that stream via console API. Network mode is most complete but requires provider-specific URL patterns.
