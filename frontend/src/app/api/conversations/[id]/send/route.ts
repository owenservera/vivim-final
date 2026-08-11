import { proxyToBackend } from '@/lib/proxy-to-backend'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  return proxyToBackend(req)
}
