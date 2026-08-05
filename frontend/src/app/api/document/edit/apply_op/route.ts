import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/document/edit/apply_op */
import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  const body = (await req.json()) as {
    documentId: string
    userId: string
    op: Record<string, unknown>
  }
  const bag = getEngineBag()
  const session = await bag.documentEditorEngine.applyOp(
    body.documentId,
    body.userId ?? 'user:demo',
    body.op as never,
  )
  return NextResponse.json({ ok: true, session })
}
