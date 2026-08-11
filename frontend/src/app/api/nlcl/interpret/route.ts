import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/proxy-to-backend';

// Fix path mismatch: use-interpret.ts calls /api/nlcl/interpret but backend
// expects /api/interpret. Proxy with corrected path.
export async function POST(req: NextRequest) {
  return proxyToBackend(req, '/api/interpret');
}
