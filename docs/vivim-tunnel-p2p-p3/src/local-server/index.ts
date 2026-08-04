/**
 * VIVIM Local Server — Public API
 *
 * HTTP server running on localhost:8080 serving the workspace UI and API.
 * Uses Bun.serve() for native HTTP with streaming support.
 */

import { getLogger } from "../shared/logger.js";
import { LOCAL_SERVER_DEFAULTS } from "../shared/constants.js";
import { LocalServerStartError } from "../shared/errors.js";
import type { VivimConfig, LocalServerConfig } from "../shared/types.js";

const log = getLogger("local-server");

export class LocalServer {
  private config: LocalServerConfig;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private requestCount: number = 0;
  private startedAt: number = 0;

  constructor(config: VivimConfig) {
    this.config = config.localServer;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      log.info("Local server disabled in config");
      return;
    }

    try {
      this.server = Bun.serve({
        hostname: this.config.host,
        port: this.config.port,
        fetch: this.handleRequest.bind(this),
      });

      this.startedAt = Date.now();
      log.info(
        { host: this.config.host, port: this.config.port },
        "Local server started",
      );
    } catch (err) {
      throw new LocalServerStartError(
        `Failed to start local server: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
      log.info("Local server stopped");
    }
  }

  private async handleRequest(req: Request): Promise<Response> {
    this.requestCount++;
    const url = new URL(req.url);
    const startTime = Date.now();

    log.debug(
      { method: req.method, path: url.pathname, requestCount: this.requestCount },
      "Request received",
    );

    try {
      // CORS preflight
      if (req.method === "OPTIONS") {
        return this.corsResponse(req);
      }

      // Route handling
      const response = await this.route(req, url);

      // Add CORS headers
      return this.addCorsHeaders(response, req);
    } catch (err) {
      log.error(
        { method: req.method, path: url.pathname, err },
        "Request handling error",
      );

      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  private async route(req: Request, url: URL): Promise<Response> {
    const path = url.pathname;

    // Health check
    if (path === "/api/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          uptime: Math.floor((Date.now() - this.startedAt) / 1000),
          requestCount: this.requestCount,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Status endpoint (for tunnel status reporting)
    if (path === "/api/status") {
      return new Response(
        JSON.stringify({
          tunnel: { connected: false, subdomain: null },
          p2p: { running: false, peerCount: 0 },
          localServer: { running: true, port: this.config.port, requestCount: this.requestCount },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Workspace API routes
    if (path.startsWith("/api/")) {
      return this.handleApiRoute(req, url);
    }

    // Static file serving
    return this.serveStaticFile(path);
  }

  private async handleApiRoute(req: Request, url: URL): Promise<Response> {
    // Placeholder API routes — these would be wired to vivim-final engines
    const path = url.pathname;

    if (path === "/api/conversations" && req.method === "GET") {
      return new Response(
        JSON.stringify({ conversations: [], total: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (path === "/api/providers" && req.method === "GET") {
      return new Response(
        JSON.stringify({ providers: [], total: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (path === "/api/memory" && req.method === "GET") {
      return new Response(
        JSON.stringify({ memories: [], total: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // SSE endpoint for real-time updates
    if (path === "/api/events") {
      return this.handleSSE();
    }

    return new Response(
      JSON.stringify({ error: "Not Found", path }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  private handleSSE(): Response {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`),
        );

        // Keep-alive ping every 30s
        const interval = setInterval(() => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`),
          );
        }, 30_000);

        // Clean up on close
        // In production, this would be wired to the EventBus
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  private async serveStaticFile(path: string): Promise<Response> {
    // Default to index.html for SPA routing
    const filePath = path === "/" ? "/index.html" : path;
    const fullPath = `${this.config.staticDir}${filePath}`;

    try {
      const file = Bun.file(fullPath);
      if (await file.exists()) {
        return new Response(file);
      }
    } catch {
      // File not found, fall through to 404
    }

    // SPA fallback: serve index.html for unknown routes
    try {
      const indexFile = Bun.file(`${this.config.staticDir}/index.html`);
      if (await indexFile.exists()) {
        return new Response(indexFile);
      }
    } catch {
      // No index.html
    }

    return new Response("Not Found", { status: 404 });
  }

  private corsResponse(req: Request): Response {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": this.config.corsOrigins[0] ?? "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  private addCorsHeaders(response: Response, req: Request): Response {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", this.config.corsOrigins[0] ?? "*");
    headers.set("Access-Control-Allow-Credentials", "true");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // ─── Public API ────────────────────────────────────────────────

  getPort(): number {
    return this.config.port;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
