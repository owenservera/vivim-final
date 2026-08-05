import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/document/edit/session?documentId=...&userId=... */
import { NextResponse } from 'next/server'
export async function GET(req: Request) {
  const url = new URL(req.url)
  const docId = url.searchParams.get('documentId') ?? ''
  const userId = url.searchParams.get('userId') ?? 'user:demo'
  const bag = getEngineBag()
  const session = await bag.documentEditorEngine.getSession(docId, userId)
  return NextResponse.json({ ok: true, session })
}
