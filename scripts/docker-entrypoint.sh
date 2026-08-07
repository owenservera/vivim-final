#!/bin/sh
# scripts/docker-entrypoint.sh
# Process supervisor for the vivim-final container.
# Starts the backend (bun serve) and frontend (next standalone) in parallel,
# forwards signals, and exits when either crashes.
#
# Session 2 (2026-08-07): created alongside the Dockerfile.

set -e

# Run migrations before starting the backend (idempotent — skips if applied).
echo "[entrypoint] running prisma migrate deploy..."
bun x prisma migrate deploy 2>&1 || {
  echo "[entrypoint] WARNING: prisma migrate deploy failed — continuing (DB may be uninitialized)"
}

# Start backend in the background.
echo "[entrypoint] starting backend on :9420..."
bun run src/cli/index.ts serve &
BACKEND_PID=$!

# Give the backend a moment to bind before starting the frontend.
sleep 2

# Start frontend (Next.js standalone server) in the background.
# The standalone server expects to be run with `node` or `bun` and reads
# HOSTNAME and PORT from the env.
echo "[entrypoint] starting frontend on :3000..."
cd /app/frontend/standalone
bun server.js &
FRONTEND_PID=$!
cd /app

# Graceful shutdown — forward SIGTERM/SIGINT to both children.
shutdown() {
  echo "[entrypoint] shutting down..."
  kill -TERM "$BACKEND_PID" 2>/dev/null || true
  kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

# Wait for either child to exit. If one crashes, take the other down too.
wait -n "$BACKEND_PID" "$FRONTEND_PID"
EXIT_CODE=$?
echo "[entrypoint] a child exited with code $EXIT_CODE — shutting down"
shutdown
exit "$EXIT_CODE"
