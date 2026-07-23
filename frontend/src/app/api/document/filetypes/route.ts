/** GET /api/document/filetypes — list all 30 supported filetypes */
import { NextResponse } from 'next/server';
import { DOCUMENT_FILETYPES, DOCUMENT_FILETYPE_COUNT, filetypesByCategory } from '@/shared/document-types';

export async function GET() {
  return NextResponse.json({
    ok: true,
    count: DOCUMENT_FILETYPE_COUNT,
    filetypes: DOCUMENT_FILETYPES,
    byCategory: filetypesByCategory(),
  });
}
