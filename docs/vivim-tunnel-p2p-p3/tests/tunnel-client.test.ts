/**
 * VIVIM Tunnel Client — Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createHttpResponseFrame, createHttpChunkFrame, createHttpAbortFrame, createPingFrame, encodeFrame, decodeFrame } from "../src/tunnel-client/frame-protocol.js";
import { Heartbeat } from "../src/tunnel-client/heartbeat.js";
import { ReconnectionManager } from "../src/tunnel-client/reconnection.js";
import { PROTOCOL_VERSION } from "../src/shared/constants.js";

describe("Frame Protocol", () => {
  it("should create a valid HTTP response frame", () => {
    const frame = createHttpResponseFrame(
      "req_123",
      200,
      { "content-type": "text/html" },
      "PGh0bWw+",
      7,
      false,
      42,
    );

    expect(frame.type).toBe("http.response");
    expect(frame.requestId).toBe("req_123");
    expect(frame.status).toBe(200);
    expect(frame.chunked).toBe(false);
    expect(frame.duration).toBe(42);
  });

  it("should create a valid HTTP chunk frame", () => {
    const frame = createHttpChunkFrame("req_123", 0, "Y2h1bms=", false);

    expect(frame.type).toBe("http.chunk");
    expect(frame.requestId).toBe("req_123");
    expect(frame.chunkIndex).toBe(0);
    expect(frame.lastChunk).toBe(false);
  });

  it("should create a valid HTTP abort frame", () => {
    const frame = createHttpAbortFrame("req_123", "Timeout", "REQUEST_TIMEOUT");

    expect(frame.type).toBe("http.abort");
    expect(frame.requestId).toBe("req_123");
    expect(frame.reason).toBe("Timeout");
    expect(frame.code).toBe("REQUEST_TIMEOUT");
  });

  it("should create a valid ping frame", () => {
    const frame = createPingFrame(42);

    expect(frame.type).toBe("ping");
    expect(frame.latencyHint).toBe(42);
  });

  it("should encode and decode frames correctly", () => {
    const original = createHttpResponseFrame(
      "req_abc",
      200,
      { "content-type": "text/plain" },
      "aGVsbG8=",
      5,
      false,
      10,
    );

    const encoded = encodeFrame(original);
    expect(typeof encoded).toBe("string");

    // Response frames are not inbound, so we can't decode them directly
    // But we can verify the JSON structure
    const parsed = JSON.parse(encoded);
    expect(parsed.type).toBe("http.response");
    expect(parsed.requestId).toBe("req_abc");
  });

  it("should decode an http.request frame", () => {
    const raw = JSON.stringify({
      id: "01J5XKQ8M3N4P5R6S7T8U9V0W",
      type: "http.request",
      timestamp: Date.now(),
      version: PROTOCOL_VERSION,
      method: "GET",
      path: "/dashboard",
      query: {},
      headers: { accept: "text/html" },
      body: null,
      bodySize: 0,
      remoteAddress: "203.0.113.42",
      protocol: "https",
      host: "user1.vivim.live",
    });

    const frame = decodeFrame(raw);
    expect(frame.type).toBe("http.request");
    if (frame.type === "http.request") {
      expect(frame.method).toBe("GET");
      expect(frame.path).toBe("/dashboard");
    }
  });

  it("should reject invalid JSON", () => {
    expect(() => decodeFrame("not json")).toThrow();
  });

  it("should reject frames missing required fields", () => {
    expect(() => decodeFrame(JSON.stringify({ type: "http.request" }))).toThrow();
  });
});

describe("Heartbeat", () => {
  it("should send ping on start", () => {
    const sent: string[] = [];
    const metrics = {
      totalRequests: 0, totalResponses: 0, totalBytesIn: 0,
      totalBytesOut: 0, averageLatencyMs: 0, reconnectCount: 0,
      uptimeSeconds: 0, lastPingLatencyMs: null,
    };

    const heartbeat = new Heartbeat(
      (data) => sent.push(data),
      () => {},
      metrics,
      { intervalMs: 1000, timeoutMs: 500 },
    );

    heartbeat.start();
    expect(sent.length).toBeGreaterThan(0);

    const parsed = JSON.parse(sent[0]!);
    expect(parsed.type).toBe("ping");

    heartbeat.stop();
  });

  it("should trigger timeout callback when no pong received", () => {
    let timeoutCalled = false;
    const metrics = {
      totalRequests: 0, totalResponses: 0, totalBytesIn: 0,
      totalBytesOut: 0, averageLatencyMs: 0, reconnectCount: 0,
      uptimeSeconds: 0, lastPingLatencyMs: null,
    };

    const heartbeat = new Heartbeat(
      (data) => {}, // No-op: don't actually send
      () => { timeoutCalled = true; },
      metrics,
      { intervalMs: 100, timeoutMs: 50 },
    );

    heartbeat.start();

    // Wait for timeout
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        heartbeat.stop();
        expect(timeoutCalled).toBe(true);
        resolve();
      }, 200);
    });
  });
});

describe("ReconnectionManager", () => {
  it("should start with attempt 0", () => {
    const mgr = new ReconnectionManager(async () => {}, {
      initialDelayMs: 100,
      maxDelayMs: 1000,
      jitterFactor: 0,
    });

    expect(mgr.getAttempt()).toBe(0);
    mgr.stop();
  });

  it("should increment attempt on each retry", () => {
    let attempts = 0;
    const mgr = new ReconnectionManager(
      async () => {
        attempts++;
        throw new Error("fail"); // Always fail to trigger retries
      },
      { initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 },
    );

    mgr.start();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        mgr.stop();
        expect(attempts).toBeGreaterThan(0);
        resolve();
      }, 500);
    });
  });
});
