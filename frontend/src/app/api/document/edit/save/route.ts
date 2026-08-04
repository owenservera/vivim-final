/** POST /api/document/edit/save */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { documentId: string; content: string };
  const bag = getEngineBag();
  const result = await bag.documentEditorEngine.save(body);
  return NextResponse.json(result);
}
