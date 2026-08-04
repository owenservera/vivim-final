/**
 * VIVIM Local Server — Unit Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { LocalServer } from "../src/local-server/index.js";
import type { VivimConfig } from "../src/shared/types.js";

const TEST_CONFIG: VivimConfig = {
  tunnel: {
    enabled: false,
    serverUrl: "",
    subdomain: "",
    protocolVersion: "1.0",
    heartbeatIntervalMs: 30000,
    heartbeatTimeoutMs: 10000,
    reconnectInitialDelayMs: 1000,
    reconnectMaxDelayMs: 60000,
    reconnectJitterFactor: 0.25,
    maxConcurrentRequests: 50,
    requestTimeoutMs: 30000,
    authToken: null,
  },
  p2p: {
    enabled: false,
    bootstrapNodes: [],
    mdnsEnabled: false,
    mdnsInterval: 10000,
    dhtEnabled: false,
    relayEnabled: false,
    maxPeers: 50,
    maxConcurrentTransfers: 5,
    maxFileSize: 524288000,
    identityPath: "",
  },
  localServer: {
    enabled: true,
    host: "127.0.0.1",
    port: 18080,
    corsEnabled: true,
    corsOrigins: ["http://localhost:18080"],
    rateLimitPerMinute: 100,
    maxRequestBodyBytes: 10485760,
    staticDir: "./workspace-ui",
  },
  orchestrator: {
    healthCheckIntervalMs: 5000,
    restartDelayMs: 2000,
    maxRestartAttempts: 5,
    statusReportIntervalMs: 60000,
  },
  logging: {
    level: "error",
    pretty: false,
    logDir: null,
  },
};

describe("LocalServer", () => {
  let server: LocalServer;

  beforeAll(async () => {
    server = new LocalServer(TEST_CONFIG);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should be running after start", () => {
    expect(server.isRunning()).toBe(true);
  });

  it("should respond to health check", async () => {
    const response = await fetch("http://127.0.0.1:18080/api/health");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  it("should respond to status endpoint", async () => {
    const response = await fetch("http://127.0.0.1:18080/api/status");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.localServer).toBeDefined();
    expect(data.localServer.running).toBe(true);
  });

  it("should return 404 for unknown API routes", async () => {
    const response = await fetch("http://127.0.0.1:18080/api/nonexistent");
    expect(response.status).toBe(404);
  });

  it("should handle CORS preflight", async () => {
    const response = await fetch("http://127.0.0.1:18080/api/health", {
      method: "OPTIONS",
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("should include CORS headers on responses", async () => {
    const response = await fetch("http://127.0.0.1:18080/api/health");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });
});
