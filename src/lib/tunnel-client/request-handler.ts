/**
 * VIVIM Tunnel Client — Request Handler
 *
 * Forwards incoming HTTP request frames from the tunnel to the local server,
 * then sends the response back through the tunnel.
 */

import { TUNNEL_DEFAULTS } from "../tunnel-shared/constants.js";
import { getLogger } from "../tunnel-shared/logger.js";
import { TunnelTimeoutError } from "../tunnel-shared/errors.js";
import {
  createHttpResponseFrame,
  createHttpChunkFrame,
  createHttpAbortFrame,
  encodeFrame,
} from "./frame-protocol.js";
import type {
  HttpRequestFrame,
  HttpResponseFrame,
  LocalServerRequest,
  LocalServerResponse,
} from "../tunnel-shared/types.js";
import type { TunnelMetrics, PendingRequest } from "./types.js";

const log = getLogger("request-handler");

export interface RequestHandlerConfig {
  localServerUrl: string;
  requestTimeoutMs: number;
  maxConcurrentRequests: number;
}

const DEFAULT_CONFIG: RequestHandlerConfig = {
  localServerUrl: "http://127.0.0.1:8080",
  requestTimeoutMs: TUNNEL_DEFAULTS.REQUEST_TIMEOUT_MS,
  maxConcurrentRequests: TUNNEL_DEFAULTS.MAX_CONCURRENT_REQUESTS,
};

export class RequestHandler {
  private config: RequestHandlerConfig;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private metrics: TunnelMetrics;
  private sendFn: (data: string) => void;

  constructor(
    sendFn: (data: string) => void,
    metrics: TunnelMetrics,
    config?: Partial<RequestHandlerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sendFn = sendFn;
    this.metrics = metrics;
  }

  async handleRequest(frame: HttpRequestFrame): Promise<void> {
    const { id } = frame;

    // Check concurrency limit
    if (this.pendingRequests.size >= this.config.maxConcurrentRequests) {
      log.warn(
        { id, pending: this.pendingRequests.size },
        "Max concurrent requests reached, sending abort",
      );
      this.sendAbort(id, "Too many concurrent requests", "CONCURRENCY_LIMIT");
      return;
    }

    // Create timeout
    const timeout = setTimeout(() => {
      log.warn({ id }, "Request timeout, sending abort");
      this.pendingRequests.delete(id);
      this.sendAbort(id, "Gateway timeout", "REQUEST_TIMEOUT");
    }, this.config.requestTimeoutMs);

    // Track pending request
    this.pendingRequests.set(id, { id, frame, receivedAt: Date.now(), timeout });

    this.metrics.totalRequests++;
    this.metrics.totalBytesIn += JSON.stringify(frame).length;

    try {
      // Forward to local server
      const localReq: LocalServerRequest = {
        method: frame.method,
        path: frame.path,
        query: frame.query,
        headers: {
          ...frame.headers,
          "x-forwarded-for": frame.remoteAddress,
          "x-forwarded-proto": frame.protocol,
          "x-vivim-tunnel": "true",
          "x-vivim-request-id": id,
        },
        body: frame.body
          ? Buffer.from(frame.body, "base64").toString("utf-8")
          : null,
        remoteAddress: frame.remoteAddress,
      };

      const response = await this.forwardToLocalServer(localReq);
      this.sendResponse(id, frame, response);

      // Clean up
      clearTimeout(timeout);
      this.pendingRequests.delete(id);
    } catch (err) {
      clearTimeout(timeout);
      this.pendingRequests.delete(id);

      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ id, err: errMsg }, "Request handling failed");
      this.sendAbort(id, errMsg, "INTERNAL_ERROR");
    }
  }

  private async forwardToLocalServer(req: LocalServerRequest): Promise<LocalServerResponse> {
    const url = new URL(req.path, this.config.localServerUrl);

    // Add query parameters
    for (const [key, value] of Object.entries(req.query)) {
      url.searchParams.set(key, value);
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: req.headers as Record<string, string>,
    };

    if (req.body && req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = req.body;
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Read response body
    const contentType = response.headers.get("content-type") ?? "";
    const isStreaming = contentType.includes("text/event-stream") ||
                        contentType.includes("application/octet-stream");

    let body: string | null = null;
    let bodySize = 0;
    let chunked = false;

    if (isStreaming) {
      // For streaming responses, we'll use chunked encoding
      chunked = true;
      // The streaming logic is handled separately
      body = null;
    } else {
      const bodyBuffer = await response.arrayBuffer();
      bodySize = bodyBuffer.byteLength;
      body = Buffer.from(bodyBuffer).toString("base64");
    }

    // Extract response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      headers,
      body,
      chunked,
    };
  }

  private sendResponse(
    requestId: string,
    requestFrame: HttpRequestFrame,
    response: LocalServerResponse,
  ): void {
    const duration = Date.now() - requestFrame.timestamp;

    const frame = createHttpResponseFrame(
      requestId,
      response.status,
      response.headers,
      response.body,
      response.bodySize ?? (response.body ? Buffer.from(response.body, "base64").length : 0),
      response.chunked,
      duration,
    );

    const encoded = encodeFrame(frame);
    this.sendFn(encoded);

    this.metrics.totalResponses++;
    this.metrics.totalBytesOut += encoded.length;
    this.metrics.averageLatencyMs = this.updateAverageLatency(duration);

    log.debug(
      { requestId, status: response.status, duration, chunked: response.chunked },
      "Response sent",
    );
  }

  private sendAbort(requestId: string, reason: string, code: string): void {
    const frame = createHttpAbortFrame(requestId, reason, code);
    const encoded = encodeFrame(frame);
    this.sendFn(encoded);
  }

  private updateAverageLatency(newLatency: number): number {
    const total = this.metrics.totalResponses;
    const prev = this.metrics.averageLatencyMs;
    return (prev * (total - 1) + newLatency) / total;
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  cancelAll(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      this.sendAbort(id, reason, "TUNNEL_DISCONNECT");
    }
    this.pendingRequests.clear();
  }
}
