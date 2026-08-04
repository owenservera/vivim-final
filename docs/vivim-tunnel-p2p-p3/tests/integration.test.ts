/**
 * VIVIM Integration Tests — Cross-Subsystem
 *
 * Tests the interaction between tunnel client, P2P node, and local server.
 */

import { describe, it, expect } from "bun:test";
import { PROTOCOL_VERSION, P2P_PROTOCOLS, TUNNEL_CLOSE_CODES } from "../src/shared/constants.js";

describe("Protocol Consistency", () => {
  it("should have consistent protocol version across all modules", () => {
    expect(PROTOCOL_VERSION).toBe("1.0");
  });

  it("should have all P2P protocol identifiers in the correct format", () => {
    const protocols = Object.values(P2P_PROTOCOLS);
    for (const protocol of protocols) {
      expect(protocol).toMatch(/^\/vivim\/[a-z-]+\/\d+\.\d+\.\d+$/);
    }
  });

  it("should have all tunnel close codes in the 4000 range for custom codes", () => {
    const customCodes = [
      TUNNEL_CLOSE_CODES.INVALID_JWT,
      TUNNEL_CLOSE_CODES.SUBDOMAIN_CONFLICT,
      TUNNEL_CLOSE_CODES.SUBDOMAIN_UNAUTHORIZED,
      TUNNEL_CLOSE_CODES.PROTOCOL_MISMATCH,
      TUNNEL_CLOSE_CODES.RATE_LIMITED,
      TUNNEL_CLOSE_CODES.SERVER_SHUTDOWN,
      TUNNEL_CLOSE_CODES.SERVER_MAINTENANCE,
    ];

    for (const code of customCodes) {
      expect(code).toBeGreaterThanOrEqual(4000);
      expect(code).toBeLessThan(5000);
    }
  });
});

describe("Config Validation", () => {
  it("should have valid default config values", async () => {
    const { loadConfig } = await import("../src/orchestrator/config.js");
    const config = loadConfig();

    expect(config.tunnel.protocolVersion).toBe("1.0");
    expect(config.p2p.maxPeers).toBeGreaterThan(0);
    expect(config.localServer.port).toBeGreaterThan(0);
    expect(config.localServer.host).toBe("127.0.0.1");
    expect(config.orchestrator.maxRestartAttempts).toBeGreaterThan(0);
  });
});

describe("Error Hierarchy", () => {
  it("should have proper error class hierarchy", async () => {
    const { VivimError, TunnelError, TunnelConnectionError, P2PError, P2PConnectionError } = await import("../src/shared/errors.js");

    const tunnelErr = new TunnelConnectionError("test");
    expect(tunnelErr).toBeInstanceOf(TunnelError);
    expect(tunnelErr).toBeInstanceOf(VivimError);
    expect(tunnelErr).toBeInstanceOf(Error);
    expect(tunnelErr.code).toBe("TUNNEL_CONNECTION_ERROR");

    const p2pErr = new P2PConnectionError("test");
    expect(p2pErr).toBeInstanceOf(P2PError);
    expect(p2pErr).toBeInstanceOf(VivimError);
    expect(p2pErr).toBeInstanceOf(Error);
    expect(p2pErr.code).toBe("P2P_CONNECTION_ERROR");
  });
});
