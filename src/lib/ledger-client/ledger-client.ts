/**
 * Ledger Client — Cloud ↔ Desktop Sync
 *
 * Handles:
 * 1. First-time signup (POST /beta/signup)
 * 2. Tunnel JWT minting (POST /tunnel/token)
 * 3. Pull-based ledger sync (GET /ledger/sync)
 * 4. Ed25519 chain verification
 * 5. Manifest application to local DB
 *
 * The client is stateless between calls — credentials are passed via config
 * and persisted externally (config file or keychain). The sync cursor
 * (lastSyncedHash) is the only mutable state, stored in the local DB.
 */
import { EventEmitter } from "node:events";
import { getLogger } from "../tunnel-shared/logger.js";
import { computeEntryHash, verifyBatch } from "./chain-verifier.js";
import type {
  LedgerClientConfig,
  LedgerClientState,
  LedgerEntry,
  LedgerHealthResponse,
  LedgerSignupResponse,
  LedgerSyncResponse,
  LedgerTunnelTokenResponse,
} from "./types.js";

const log = getLogger("ledger-client");

// ─── Events ─────────────────────────────────────────────────────

export interface LedgerClientEvents {
  "signup-complete": (data: LedgerSignupResponse) => void;
  "sync-start": () => void;
  "sync-complete": (data: { applied: number; entries: LedgerEntry[] }) => void;
  "sync-error": (error: Error) => void;
  "tunnel-token": (data: LedgerTunnelTokenResponse) => void;
  "state-change": (state: LedgerClientState) => void;
}

// ─── Client ─────────────────────────────────────────────────────

export class LedgerClient {
  private config: LedgerClientConfig;
  private state: LedgerClientState = "uninitialized";
  private lastSyncedHash: string | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private events = new EventEmitter();

  constructor(config: LedgerClientConfig) {
    this.config = config;
  }

  // ── Lifecycle ──────────────────────────────────────────

  /** Initialize from stored credentials. Call once at startup. */
  async init(): Promise<void> {
    log.info("Initializing ledger client");

    if (this.config.userToken && this.config.subdomain && this.config.userId) {
      this.setState("synced");
      log.info(
        { userId: this.config.userId, subdomain: this.config.subdomain },
        "Ledger client initialized with stored credentials",
      );
    } else {
      this.setState("uninitialized");
      log.info("No stored credentials — signup required");
    }
  }

  /** Start periodic incremental sync. */
  async start(): Promise<void> {
    if (!this.config.userToken) {
      log.warn("Cannot start sync — no user token");
      return;
    }

    // Run initial sync immediately
    await this.sync();

    // Schedule periodic sync
    this.syncTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (err) {
        log.error({ err }, "Periodic sync failed");
      }
    }, this.config.syncIntervalMs);

    log.info({ intervalMs: this.config.syncIntervalMs }, "Ledger sync started");
  }

  /** Stop periodic sync. */
  async stop(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    log.info("Ledger sync stopped");
  }

  // ── Query ──────────────────────────────────────────────

  hasCredentials(): boolean {
    return !!(this.config.userToken && this.config.subdomain && this.config.userId);
  }

  getState(): LedgerClientState {
    return this.state;
  }

  getLastSyncedHash(): string | null {
    return this.lastSyncedHash;
  }

  /** Set the sync cursor (called after applying entries). */
  setLastSyncedHash(hash: string | null): void {
    this.lastSyncedHash = hash;
  }

  // ── Auth Flow ──────────────────────────────────────────

  /**
   * First-time signup. Creates user + token + subdomain + entitlements.
   * Stores credentials in config for subsequent calls.
   */
  async signup(email: string): Promise<LedgerSignupResponse> {
    this.setState("signup-pending");
    log.info({ email }, "Signing up to ledger service");

    const res = await this.fetch<LedgerSignupResponse>("/api/v1/beta/signup", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
    });

    // Store credentials
    this.config.userToken = res.token;
    this.config.subdomain = res.subdomain;
    this.config.userId = res.userId;

    this.events.emit("signup-complete", res);
    this.setState("synced");
    log.info(
      { userId: res.userId, subdomain: res.subdomain, providers: res.entitledProviderCount },
      "Signup complete",
    );

    return res;
  }

  /**
   * Mint a tunnel JWT for connecting to the tunnel-gateway.
   * Called once per session (JWT expires in 1 hour).
   */
  async mintTunnelToken(): Promise<LedgerTunnelTokenResponse> {
    if (!this.config.userToken) {
      throw new Error("No user token — must signup first");
    }

    log.info("Minting tunnel token");

    const res = await this.fetch<LedgerTunnelTokenResponse>("/api/v1/tunnel/token", {
      method: "POST",
      headers: this.authHeaders(),
    });

    this.events.emit("tunnel-token", res);
    log.info(
      { subdomain: res.subdomain, expiresIn: res.expiresIn },
      "Tunnel token minted",
    );

    return res;
  }

  /**
   * Fetch the ledger service health (chain head + public key).
   */
  async health(): Promise<LedgerHealthResponse> {
    return this.fetch<LedgerHealthResponse>("/api/v1/health");
  }

  // ── Sync Flow ──────────────────────────────────────────

  /**
   * Incremental sync. Fetches entries since lastSyncedHash.
   * Verifies chain integrity + Ed25519 signatures.
   * Returns verified entries for the caller to apply.
   */
  async sync(): Promise<{ applied: number; entries: LedgerEntry[] }> {
    if (!this.config.userToken) {
      throw new Error("No user token — must signup first");
    }

    this.setState("syncing");
    this.events.emit("sync-start");

    try {
      const { entries, hasMore, newSyncCursor } = await this.fetchSyncEntries();

      if (entries.length === 0) {
        this.setState("synced");
        this.events.emit("sync-complete", { applied: 0, entries: [] });
        return { applied: 0, entries: [] };
      }

      // Verify the batch
      const { verified, lastHash } = await verifyBatch(
        entries.map((e) => ({
          prevHash: e.prevHash,
          hash: e.hash,
          signature: e.signature,
          contentJson: e.contentJson,
        })),
        this.lastSyncedHash,
        this.config.publicKeyHex,
      );

      // Map verified hashes back to full entries
      const verifiedEntries = entries.filter((e) =>
        verified.some((v) => v.hash === e.hash),
      );

      // Update cursor
      this.lastSyncedHash = lastHash;

      this.setState("synced");
      this.events.emit("sync-complete", {
        applied: verifiedEntries.length,
        entries: verifiedEntries,
      });

      log.info(
        { applied: verifiedEntries.length, hasMore, cursor: lastHash?.slice(0, 8) },
        "Sync complete",
      );

      // If there are more pages, fetch them
      if (hasMore) {
        const next = await this.sync();
        return {
          applied: verifiedEntries.length + next.applied,
          entries: [...verifiedEntries, ...next.entries],
        };
      }

      return { applied: verifiedEntries.length, entries: verifiedEntries };
    } catch (err) {
      this.setState("error");
      const error = err instanceof Error ? err : new Error(String(err));
      this.events.emit("sync-error", error);
      log.error({ err: error.message }, "Sync failed");
      throw error;
    }
  }

  /**
   * Full resync (no since param). Used on first sync or corruption.
   */
  async fullSync(): Promise<{ applied: number; entries: LedgerEntry[] }> {
    this.lastSyncedHash = null;
    return this.sync();
  }

  // ── Private Helpers ────────────────────────────────────

  private async fetchSyncEntries(): Promise<LedgerSyncResponse> {
    const params = new URLSearchParams();
    if (this.lastSyncedHash) {
      params.set("since", this.lastSyncedHash);
    }
    params.set("limit", "500");

    const query = params.toString();
    const path = `/api/v1/ledger/sync${query ? `?${query}` : ""}`;

    return this.fetch<LedgerSyncResponse>(path, {
      headers: this.authHeaders(),
    });
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.userToken) {
      headers["Authorization"] = `Bearer ${this.config.userToken}`;
    }
    return headers;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    log.debug({ url, method: init?.method ?? "GET" }, "Fetching");

    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  private setState(state: LedgerClientState): void {
    if (this.state !== state) {
      const prev = this.state;
      this.state = state;
      this.events.emit("state-change", state);
      log.debug({ from: prev, to: state }, "State change");
    }
  }

  // ── Event Emitter (typed) ──────────────────────────────

  on<K extends keyof LedgerClientEvents>(
    event: K,
    handler: LedgerClientEvents[K],
  ): void {
    this.events.on(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof LedgerClientEvents>(
    event: K,
    handler: LedgerClientEvents[K],
  ): void {
    this.events.off(event, handler as (...args: unknown[]) => void);
  }
}
