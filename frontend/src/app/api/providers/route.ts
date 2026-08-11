import { proxyToBackend } from '@/lib/proxy-to-backend'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  return proxyToBackend(req)
}
