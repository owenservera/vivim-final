import { proxyToBackend } from '@/lib/proxy-to-backend'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  return proxyToBackend(req)
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req)
}

export async function PUT(req: NextRequest) {
  return proxyToBackend(req)
}

export async function DELETE(req: NextRequest) {
  return proxyToBackend(req)
}
