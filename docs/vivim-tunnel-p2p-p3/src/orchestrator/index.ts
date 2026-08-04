/**
 * VIVIM Orchestrator — Main Entry Point
 *
 * Starts all subsystems and manages their lifecycle.
 * This is the main entry point for the VIVIM desktop app.
 *
 * Usage:
 *   bun run src/orchestrator/index.ts --config config/development.toml
 */

import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { ServiceManager } from "./service-manager.js";
import { initLogger, getLogger } from "../shared/logger.js";
import type { VivimConfig } from "../shared/types.js";

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    config: { type: "string", short: "c" },
    help: { type: "boolean", short: "h" },
  },
  strict: true,
});

if (values.help) {
  console.log(`
VIVIM Tunnel + P2P Orchestrator

Usage:
  vivim-tunnel [options]

Options:
  -c, --config <path>   Path to configuration file
  -h, --help           Show this help message

Environment Variables:
  VIVIM_TUNNEL_TOKEN    JWT token for tunnel authentication
  VIVIM_SUBDOMAIN       Subdomain to claim (e.g., "user1")
  VIVIM_TUNNEL_URL      Tunnel server URL (default: wss://tunnel.vivim.live/connect)
  VIVIM_PORT            Local server port (default: 8080)
  `);
  process.exit(0);
}

// Load configuration
const config: VivimConfig = loadConfig(values.config as string | undefined);

// Initialize logger
const logger = initLogger(config.logging);
const log = getLogger("orchestrator");

log.info("VIVIM Tunnel + P2P Orchestrator starting");

// Create service manager
const serviceManager = new ServiceManager(config);

// Handle process signals
process.on("SIGINT", async () => {
  log.info("SIGINT received, shutting down");
  await serviceManager.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  log.info("SIGTERM received, shutting down");
  await serviceManager.stop();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log.fatal({ reason }, "Unhandled rejection");
  process.exit(1);
});

// Start all services
serviceManager.start().then(() => {
  log.info("Orchestrator started successfully");

  // Periodic status logging
  setInterval(() => {
    const status = serviceManager.getStatus();
    log.info(
      {
        tunnel: status.tunnel,
        p2p: status.p2p,
        localServer: status.localServer,
        uptime: status.uptime,
      },
      "Orchestrator status",
    );
  }, 60_000);
}).catch((err) => {
  log.fatal({ err }, "Failed to start orchestrator");
  process.exit(1);
});
