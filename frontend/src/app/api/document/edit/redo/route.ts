import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/document/edit/redo */
import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  const body = (await req.json()) as { documentId: string; userId: string }
  const bag = getEngineBag()
  const session = await bag.documentEditorEngine.redo(body.documentId, body.userId ?? 'user:demo')
  return NextResponse.json({ ok: true, session })
}
