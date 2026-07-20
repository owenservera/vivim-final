import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

export function createConceptualRouter(ctx: ServerContext) {
  const svc = ctx.conceptualModel
  if (!svc) {
    return async (_req: Request, _url: URL) =>
      errorResponse('Conceptual model not initialized', 'ConceptualUnavailable', 503)
  }

  return async (req: Request, url: URL): Promise<Response> => {
    // GET /api/conceptual/families
    if (url.pathname === '/api/conceptual/families' && req.method === 'GET') {
      try {
        return json({ ok: true, families: await svc.listFamilies() })
      } catch (e) {
        return errorResponse((e as Error).message, 'ListFamiliesFailed', 500)
      }
    }

    // GET /api/conceptual/provider-types/:slug
    const typeMatch = url.pathname.match(/^\/api\/conceptual\/provider-types\/([^/]+)$/)
    if (typeMatch && req.method === 'GET') {
      try {
        const family = await svc.getFamilyBySlug(typeMatch[1] ?? '')
        if (!family) return errorResponse('Family not found', 'NotFound', 404)
        return json({ ok: true, family })
      } catch (e) {
        return errorResponse((e as Error).message, 'GetFamilyFailed', 500)
      }
    }

    // GET /api/conceptual/resolve?providerId=&familyId=&primitiveId=&variant=
    if (url.pathname === '/api/conceptual/resolve' && req.method === 'GET') {
      try {
        const providerId = url.searchParams.get('providerId') ?? ''
        const familyId = url.searchParams.get('familyId') ?? ''
        const primitiveId = url.searchParams.get('primitiveId') ?? ''
        const variant = url.searchParams.get('variant') ?? null
        if (!primitiveId) return errorResponse('primitiveId is required', 'BadRequest', 400)
        const resolved = await svc.resolveComponent({
          providerId,
          familyId,
          primitiveId,
          variant,
        })
        return json({ ok: true, component: resolved })
      } catch (e) {
        return errorResponse((e as Error).message, 'ResolveFailed', 500)
      }
    }

    // GET /api/conceptual/surface?providerId=
    if (url.pathname === '/api/conceptual/surface' && req.method === 'GET') {
      try {
        const providerId = url.searchParams.get('providerId') ?? ''
        if (!providerId) return errorResponse('providerId is required', 'BadRequest', 400)
        const family = await svc.resolveFamilyForProvider(providerId)
        if (!family) return errorResponse('Provider has no family', 'NotFound', 404)
        const slots = await svc.resolveSurface(providerId, family.id)
        return json({
          ok: true,
          providerId,
          family: family.slug,
          slots: slots.map(
            (s: {
              primitive: unknown
              component: unknown
              tier: unknown
              fromSystemDefault: unknown
            }) => ({
              primitive: s.primitive,
              component: s.component,
              tier: s.tier,
              fromSystemDefault: s.fromSystemDefault,
            }),
          ),
        })
      } catch (e) {
        return errorResponse((e as Error).message, 'SurfaceResolveFailed', 500)
      }
    }

    return errorResponse('Unknown conceptual route', 'NotFound', 404)
  }
}
