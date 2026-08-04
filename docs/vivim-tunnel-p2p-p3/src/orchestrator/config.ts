/**
 * VIVIM Orchestrator — Configuration Loader
 *
 * Loads and validates configuration from TOML files.
 * Falls back to sensible defaults for all settings.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getLogger } from "../shared/logger.js";
import { ConfigError } from "../shared/errors.js";
import {
  TUNNEL_DEFAULTS,
  P2P_DEFAULTS,
  LOCAL_SERVER_DEFAULTS,
  ORCHESTRATOR_DEFAULTS,
} from "../shared/constants.js";
import type { VivimConfig } from "../shared/types.js";

const log = getLogger("config");

const DEFAULT_CONFIG: VivimConfig = {
  tunnel: {
    enabled: true,
    serverUrl: TUNNEL_DEFAULTS.SERVER_URL,
    subdomain: "",
    protocolVersion: "1.0",
    heartbeatIntervalMs: TUNNEL_DEFAULTS.HEARTBEAT_INTERVAL_MS,
    heartbeatTimeoutMs: TUNNEL_DEFAULTS.HEARTBEAT_TIMEOUT_MS,
    reconnectInitialDelayMs: TUNNEL_DEFAULTS.RECONNECT_INITIAL_DELAY_MS,
    reconnectMaxDelayMs: TUNNEL_DEFAULTS.RECONNECT_MAX_DELAY_MS,
    reconnectJitterFactor: TUNNEL_DEFAULTS.RECONNECT_JITTER_FACTOR,
    maxConcurrentRequests: TUNNEL_DEFAULTS.MAX_CONCURRENT_REQUESTS,
    requestTimeoutMs: TUNNEL_DEFAULTS.REQUEST_TIMEOUT_MS,
    authToken: null,
  },
  p2p: {
    enabled: true,
    bootstrapNodes: P2P_DEFAULTS.BOOTSTRAP_NODES as unknown as string[],
    mdnsEnabled: true,
    mdnsInterval: P2P_DEFAULTS.MDNS_INTERVAL,
    dhtEnabled: true,
    relayEnabled: true,
    maxPeers: P2P_DEFAULTS.MAX_PEERS,
    maxConcurrentTransfers: P2P_DEFAULTS.MAX_CONCURRENT_TRANSFERS,
    maxFileSize: P2P_DEFAULTS.MAX_FILE_SIZE,
    identityPath: "",
  },
  localServer: {
    enabled: true,
    host: LOCAL_SERVER_DEFAULTS.HOST,
    port: LOCAL_SERVER_DEFAULTS.PORT,
    corsEnabled: true,
    corsOrigins: LOCAL_SERVER_DEFAULTS.CORS_ORIGINS as unknown as string[],
    rateLimitPerMinute: LOCAL_SERVER_DEFAULTS.RATE_LIMIT_PER_MINUTE,
    maxRequestBodyBytes: LOCAL_SERVER_DEFAULTS.MAX_REQUEST_BODY_BYTES,
    staticDir: "./workspace-ui",
  },
  orchestrator: {
    healthCheckIntervalMs: ORCHESTRATOR_DEFAULTS.HEALTH_CHECK_INTERVAL_MS,
    restartDelayMs: ORCHESTRATOR_DEFAULTS.RESTART_DELAY_MS,
    maxRestartAttempts: ORCHESTRATOR_DEFAULTS.MAX_RESTART_ATTEMPTS,
    statusReportIntervalMs: ORCHESTRATOR_DEFAULTS.STATUS_REPORT_INTERVAL_MS,
  },
  logging: {
    level: "info",
    pretty: true,
    logDir: null,
  },
};

export function loadConfig(configPath?: string): VivimConfig {
  const config = { ...DEFAULT_CONFIG };

  if (configPath) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      // Simple TOML-like parsing (in production, use a TOML parser)
      // For now, we support JSON config files
      const parsed = JSON.parse(raw) as Partial<VivimConfig>;
      return deepMerge(config, parsed);
    } catch (err) {
      throw new ConfigError(
        `Failed to load config from ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  // Override with environment variables
  config.tunnel.authToken = process.env.VIVIM_TUNNEL_TOKEN ?? null;
  config.tunnel.subdomain = process.env.VIVIM_SUBDOMAIN ?? "";
  config.tunnel.serverUrl = process.env.VIVIM_TUNNEL_URL ?? TUNNEL_DEFAULTS.SERVER_URL;
  config.localServer.port = parseInt(process.env.VIVIM_PORT ?? String(LOCAL_SERVER_DEFAULTS.PORT), 10);

  // Validate required fields
  if (config.tunnel.enabled && !config.tunnel.authToken) {
    log.warn("VIVIM_TUNNEL_TOKEN not set — tunnel will not authenticate");
  }

  if (config.tunnel.enabled && !config.tunnel.subdomain) {
    log.warn("VIVIM_SUBDOMAIN not set — tunnel will not claim a subdomain");
  }

  return config;
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      ) as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}
