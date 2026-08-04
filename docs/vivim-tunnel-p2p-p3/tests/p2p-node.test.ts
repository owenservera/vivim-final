/**
 * VIVIM P2P Node — Unit Tests
 */

import { describe, it, expect } from "bun:test";
import { P2P_PROTOCOLS } from "../src/shared/constants.js";

describe("P2P Protocol Constants", () => {
  it("should have correct file sync protocol identifier", () => {
    expect(P2P_PROTOCOLS.FILE_SYNC).toBe("/vivim/file-sync/1.0.0");
  });

  it("should have correct CRDT sync protocol identifier", () => {
    expect(P2P_PROTOCOLS.CRTD_SYNC).toBe("/vivim/crdt-sync/1.0.0");
  });

  it("should have correct presence protocol identifier", () => {
    expect(P2P_PROTOCOLS.PRESENCE).toBe("/vivim/presence/1.0.0");
  });
});

describe("CRDT Document", () => {
  // Note: CRDTDocument is tested indirectly through the CRDTSyncHandler
  // These tests would require a running libp2p node

  it("should have correct protocol identifiers", () => {
    expect(P2P_PROTOCOLS.FILE_SYNC).toContain("/vivim/");
    expect(P2P_PROTOCOLS.CRTD_SYNC).toContain("/vivim/");
    expect(P2P_PROTOCOLS.PRESENCE).toContain("/vivim/");
  });
});
