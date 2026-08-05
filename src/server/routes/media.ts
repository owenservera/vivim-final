// src/server/routes/media.ts
// REST API routes for media attachment management.

import { z } from 'zod'
import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createMediaRouter(ctx: ServerContext) {
  return async function mediaRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (
      ctx as unknown as {
        mediaStore?: {
          getMediaById(id: string): Promise<unknown>
          getMediaByContentItem(contentItemId: string): Promise<unknown[]>
          getMediaByType(mediaType: string): Promise<unknown[]>
          getUndownloaded(): Promise<unknown[]>
          createMedia(input: unknown): Promise<unknown>
          updateMedia(id: string, updates: unknown): Promise<unknown>
          updateDownloadProgress(id: string, progress: number): Promise<unknown>
          markDownloaded(id: string, localPath: string): Promise<unknown>
          deleteMedia(id: string): Promise<void>
        }
      }
    ).mediaStore

    if (!store) {
      return errorResponse('MediaStore not available', 'EngineUnavailable', 503)
    }

    try {
      // GET /api/media/undownloaded
      if (req.method === 'GET' && path === '/api/media/undownloaded') {
        const attachments = await store.getUndownloaded()
        return json({ attachments, count: (attachments as unknown[]).length })
      }

      // GET /api/media/types/:type
      const typeMatch = path.match(/^\/api\/media\/types\/([^/]+)$/)
      if (req.method === 'GET' && typeMatch && typeMatch[1]) {
        const attachments = await store.getMediaByType(decodeURIComponent(typeMatch[1]))
        return json({ attachments, count: (attachments as unknown[]).length })
      }

      // GET /api/media
      if (req.method === 'GET' && path === '/api/media') {
        const contentItemId = url.searchParams.get('contentItemId') ?? undefined
        const mediaType = url.searchParams.get('mediaType') ?? undefined
        if (contentItemId) {
          const attachments = await store.getMediaByContentItem(contentItemId)
          return json({ attachments, count: (attachments as unknown[]).length })
        }
        if (mediaType) {
          const attachments = await store.getMediaByType(mediaType)
          return json({ attachments, count: (attachments as unknown[]).length })
        }
        return errorResponse('contentItemId or mediaType is required', 'ValidationError', 400)
      }

      // POST /api/media
      if (req.method === 'POST' && path === '/api/media') {
        const schema = z.object({
          providerId: z.string().min(1, 'providerId is required'),
          contentItemId: z.string().optional(),
          mediaType: z.string().min(1, 'mediaType is required'),
          mimeType: z.string().min(1, 'mimeType is required'),
          filename: z.string().optional(),
          originalUrl: z.string().min(1, 'originalUrl is required'),
          localPath: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          thumbnailLocalPath: z.string().optional(),
          sizeBytes: z.number().int().nonnegative().optional(),
          width: z.number().int().nonnegative().optional(),
          height: z.number().int().nonnegative().optional(),
          durationSeconds: z.number().nonnegative().optional(),
          providerNativeId: z.string().optional(),
          metadataJson: z.string().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const attachment = await store.createMedia(parsed.data)
        return json({ attachment }, 201)
      }

      // GET /api/media/:id
      const attachmentMatch = path.match(/^\/api\/media\/([^/]+)$/)
      if (req.method === 'GET' && attachmentMatch && attachmentMatch[1]) {
        const attachment = await store.getMediaById(attachmentMatch[1])
        if (!attachment) return errorResponse('Media attachment not found', 'NotFound', 404)
        return json({ attachment })
      }

      // PUT /api/media/:id
      if (req.method === 'PUT' && attachmentMatch && attachmentMatch[1]) {
        const body = (await req.json()) as Record<string, unknown>
        const attachment = await store.updateMedia(attachmentMatch[1], body)
        return json({ attachment })
      }

      // DELETE /api/media/:id
      if (req.method === 'DELETE' && attachmentMatch && attachmentMatch[1]) {
        await store.deleteMedia(attachmentMatch[1])
        return json({ success: true })
      }

      // POST /api/media/:id/download
      const downloadMatch = path.match(/^\/api\/media\/([^/]+)\/download$/)
      if (req.method === 'POST' && downloadMatch && downloadMatch[1]) {
        const body = (await req.json()) as { localPath?: string }
        if (!body.localPath || typeof body.localPath !== 'string') {
          return errorResponse('localPath is required', 'ValidationError', 400)
        }
        const attachment = await store.markDownloaded(downloadMatch[1], body.localPath)
        return json({ attachment })
      }

      // PUT /api/media/:id/progress
      const progressMatch = path.match(/^\/api\/media\/([^/]+)\/progress$/)
      if (req.method === 'PUT' && progressMatch && progressMatch[1]) {
        const body = (await req.json()) as { progress?: number }
        if (body.progress === undefined || typeof body.progress !== 'number') {
          return errorResponse('progress is required (number)', 'ValidationError', 400)
        }
        const attachment = await store.updateDownloadProgress(progressMatch[1], body.progress)
        return json({ attachment })
      }

      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
