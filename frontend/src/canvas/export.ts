// Canvas export to PNG / SVG / JSON / PDF.
//
// - PNG: rasterized via html-to-image. Captures full bounding box or viewport.
// - SVG: vector. Preserves text and edges. Ideal for embedding in docs.
// - JSON: full canvas state. Re-importable. Stable key ordering for git.
// - PDF: multi-page if canvas is large. One page per bounding-box tile.

import { serializeCanvas } from './persistence'
import type { CanvasState } from './types'

export type ExportFormat = 'png' | 'svg' | 'json' | 'pdf'

export interface ExportOptions {
  format: ExportFormat
  // "viewport" = only what's visible; "bounds" = full canvas bounding box.
  area: 'viewport' | 'bounds'
  padding?: number
  background?: string // hex color, default = palette.background
  scale?: number // pixel ratio multiplier (PNG only)
}

export async function exportCanvas(state: CanvasState, options: ExportOptions): Promise<Blob> {
  switch (options.format) {
    case 'json':
      return new Blob([serializeCanvas(state)], { type: 'application/json' })
    case 'png':
      return exportToPng(state, options)
    case 'svg':
      return exportToSvg(state, options)
    case 'pdf':
      return exportToPdf(state, options)
  }
}

// PNG export uses html-to-image to rasterize the canvas DOM element.
// We clone the canvas node, expand its bounding box to fit all content,
// and call toPng with a pixel ratio for retina quality.
async function exportToPng(state: CanvasState, options: ExportOptions): Promise<Blob> {
  // Dynamic import keeps html-to-image out of the main bundle.
  const { toPng } = await import('html-to-image')
  const el = document.querySelector('[data-canvas-root]') as HTMLElement | null
  if (!el) throw new Error('canvas root element not found')

  const bbox = computeBoundingBox(state, options.padding ?? 100)
  const pixelRatio = options.scale ?? 2
  const dataUrl = await toPng(el, {
    width: bbox.width,
    height: bbox.height,
    style: {
      transform: 'translate(0, 0)',
      transformOrigin: 'top left',
    },
    pixelRatio,
    backgroundColor: options.background ?? '#fafaf9',
  })
  const resp = await fetch(dataUrl)
  return resp.blob()
}

// SVG export builds a vector representation directly from canvas state.
// We do NOT rasterize the DOM; we render nodes as <rect> + <text> and
// edges as <path>. This keeps text selectable and file size small.
async function exportToSvg(state: CanvasState, options: ExportOptions): Promise<Blob> {
  const bbox = computeBoundingBox(state, options.padding ?? 100)
  const svg = buildSvg(state, bbox, options.background ?? '#fafaf9')
  return new Blob([svg], { type: 'image/svg+xml' })
}

// PDF export uses jsPDF. For large canvases we tile into A4 pages.
async function exportToPdf(state: CanvasState, options: ExportOptions): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const bbox = computeBoundingBox(state, options.padding ?? 100)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  // First rasterize to PNG, then place into the PDF (potentially tiled).
  const pngBlob = await exportToPng(state, options)
  const pngDataUrl = await blobToDataUrl(pngBlob)

  const cols = Math.ceil(bbox.width / pageW)
  const rows = Math.ceil(bbox.height / pageH)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r > 0 || c > 0) pdf.addPage()
      pdf.addImage(pngDataUrl, 'PNG', -c * pageW, -r * pageH, bbox.width, bbox.height)
    }
  }
  return pdf.output('blob') as Blob;
}

function computeBoundingBox(state: CanvasState, padding: number) {
  if (state.nodes.length === 0) {
    return { x: 0, y: 0, width: 800, height: 600 }
  }
  const xs = state.nodes.flatMap((n) => [n.position.x, n.position.x + (n.size?.x ?? 0)])
  const ys = state.nodes.flatMap((n) => [n.position.y, n.position.y + (n.size?.y ?? 0)])
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function buildSvg(
  state: CanvasState,
  bbox: { x: number; y: number; width: number; height: number },
  bg: string,
): string {
  const edges = state.edges
    .map((e) => {
      const from = state.nodes.find((n) => n.id === e.from)
      const to = state.nodes.find((n) => n.id === e.to)
      if (!from || !to) return ''
      const x1 = from.position.x + (from.size?.x ?? 0) / 2 - bbox.x
      const y1 = from.position.y + (from.size?.y ?? 0) / 2 - bbox.y
      const x2 = to.position.x + (to.size?.x ?? 0) / 2 - bbox.x
      const y2 = to.position.y + (to.size?.y ?? 0) / 2 - bbox.y
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      return `<path d="M${x1},${y1} Q${mx},${my - 40} ${x2},${y2}" stroke="#94a3b8" stroke-width="2" fill="none" marker-end="url(#arrow)" />`
    })
    .join('\n')

  const nodes = state.nodes
    .map((n) => {
      const x = n.position.x - bbox.x
      const y = n.position.y - bbox.y
      const w = n.size?.x ?? 320
      const h = n.size?.y ?? 200
      const label = escapeXml(n.label ?? '')
      return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#e7e5e4" stroke-width="1" /><text x="${x + 12}" y="${y + 24}" font-family="Inter, sans-serif" font-size="14" fill="#1c1917">${label}</text></g>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${bbox.width}" height="${bbox.height}" viewBox="0 0 ${bbox.width} ${bbox.height}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
    </marker>
  </defs>
  <rect x="0" y="0" width="${bbox.width}" height="${bbox.height}" fill="${bg}" />
  ${edges}
  ${nodes}
</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
