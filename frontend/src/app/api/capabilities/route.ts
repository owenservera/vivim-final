import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/proxy-to-backend';

export async function GET(req: NextRequest) {
  return proxyToBackend(req);
}
