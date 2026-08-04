/** POST /api/document/edit/undo */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { documentId: string; userId: string };
  const bag = getEngineBag();
  const session = await bag.documentEditorEngine.undo(body.documentId, body.userId ?? 'user:demo');
  return NextResponse.json({ ok: true, session });
}
