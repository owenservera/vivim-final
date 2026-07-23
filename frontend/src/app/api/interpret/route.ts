/**
 * app/api/interpret/route.ts
 * --------------------------------------------------------------------
 * POST /api/interpret — the ONE ENTRY POINT (invariant 5).
 *
 * Every user action — whether from CLI, UI, API, or MCP — is a
 * UnifiedCapability that flows through this endpoint. It dispatches
 * to POST /api/capabilities/:id/execute.
 *
 * For the prototype, we accept a natural-language-ish intent and
 * return the matched capability id. Real NL parsing lives in the
 * nlcl engine (bundle 04) — out of scope for this build.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag, newTraceId } from '@/lib/canvas-engine-bootstrap';

const REQUEST_SCHEMA = z.object({
  text: z.string(),
  context: z
    .object({
      workspaceId: z.string().optional(),
      providerId: z.string().optional(),
      userId: z.string().optional(),
    })
    .default({}),
});

// Tiny intent matcher — real impl uses nlcl/catalog.ts from bundle 04.
const INTENTS: Array<{ pattern: RegExp; capabilityId: string }> = [
  { pattern: /^(list|show)\s+(conversations?|chats?)/i, capabilityId: 'cap:conversation:list' },
  { pattern: /^(send|compose)\s+(message|email|chat)/i, capabilityId: 'cap:message:send' },
  { pattern: /^(resolve|open)\s+(canvas|surface)/i, capabilityId: 'cap:canvas:resolve' },
  { pattern: /^(publish|define)\s+(component|layer|definition)/i, capabilityId: 'cap:canvas:define' },
  { pattern: /^(patch|update|edit)\s+(component|layer|definition)/i, capabilityId: 'cap:canvas:set_layout' },
  { pattern: /^(spawn|mount)\s+(layer|node)/i, capabilityId: 'cap:canvas:spawn' },
  { pattern: /^(dismiss|unmount)\s+(layer|node)/i, capabilityId: 'cap:canvas:dismiss' },
  { pattern: /^(help|commands?)/i, capabilityId: 'cap:help:help' },
];

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const traceId = newTraceId();
  const bag = getEngineBag();
  const text = parsed.data.text.trim();
  const match = INTENTS.find((i) => i.pattern.test(text));

  if (!match) {
    return NextResponse.json({
      ok: false,
      traceId,
      error: 'No matching capability. Try: "list conversations", "send message", "resolve canvas", "publish component".',
    });
  }

  bag.eventBus.emit({
    type: 'capability:executed',
    capabilityId: match.capabilityId,
    traceId,
    ok: true,
    latencyMs: 0,
  });

  return NextResponse.json({
    ok: true,
    traceId,
    capabilityId: match.capabilityId,
    executeUrl: `/api/capabilities/${encodeURIComponent(match.capabilityId)}/execute`,
  });
}
