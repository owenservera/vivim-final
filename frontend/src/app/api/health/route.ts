/** GET /api/health — lightweight health check for load balancers and monitors. */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-error-handler';

const startedAt = Date.now();

export const dynamic = "force-static";

export const GET = apiHandler(async () => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);

  let backendOk = false;
  let dbOk = false;
  try {
    const port = process.env.CAP_STORE_PORT ?? '9420';
    const res = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    backendOk = res.ok;
    if (backendOk) {
      const data = await res.json() as { db?: string };
      dbOk = data.db === 'ok';
    }
  } catch {
    backendOk = false;
  }

  const status = backendOk && dbOk ? 'ok' : backendOk ? 'degraded' : 'down';

  return NextResponse.json(
    {
      status,
      uptime,
      timestamp: new Date().toISOString(),
      backend: backendOk ? 'connected' : 'unreachable',
      database: dbOk ? 'ok' : backendOk ? 'unknown' : 'unreachable',
      version: process.env.npm_package_version ?? '0.0.0',
    },
    {
      status: backendOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    },
  );
});

