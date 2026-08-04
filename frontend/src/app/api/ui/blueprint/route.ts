/** GET /api/ui/blueprint?workspaceId=... — read full UI layout/theme */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
import { list } from '@/shared/universal-registry';
import { resolveProperties, type UIComponentSpec, type UIBlueprint } from '@/shared/ui-language';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ws = url.searchParams.get('workspaceId') ?? 'ws:global';
  const bag = getEngineBag();
  // Build a blueprint from the registry + engine specs.
  const allSpecs = bag.uiEngine.listSpecs();
  const components: Record<string, UIComponentSpec> = {};
  for (const s of allSpecs) components[s.id] = s;
  const blueprint: UIBlueprint = {
    workspaceId: ws,
    components,
    themeMode: bag.uiEngine.getBlueprint(ws).themeMode,
    accentColor: bag.uiEngine.getBlueprint(ws).accentColor,
    version: bag.uiEngine.getBlueprint(ws).version,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return NextResponse.json({ ok: true, blueprint });
}

/** POST /api/ui/blueprint — apply a reprogrammed spec (hot-swap without page reload) */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    workspaceId?: string;
    components?: Record<string, unknown>;
    themeMode?: string;
    accentColor?: string;
  };
  const bag = getEngineBag();
  const result = bag.uiEngine.applyBlueprint(
    body.workspaceId ?? 'ws:global',
    {
      components: body.components as never,
      themeMode: body.themeMode as 'light' | 'dark' | 'auto' | undefined,
      accentColor: body.accentColor,
    },
  );
  return NextResponse.json({ ok: true, blueprint: result });
}
