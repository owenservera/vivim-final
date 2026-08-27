// src/mcp/serp-parser.ts
// Lightweight Google SERP (search results page) parser. Extracts organic
// result blocks from the raw HTML using regex/string scanning — no DOM library,
// matching the repo's no-new-dependencies rule. Strips ad blocks, decodes
// Google redirect URLs (/url?q=), and tolerates missing snippets.

export interface SerpResult {
  rank: number
  title: string
  url: string
  snippet: string
}

/** Parse organic Google results out of raw SERP HTML. */
export function parseGoogleSerp(html: string): SerpResult[] {
  if (!html) return []

  // Strip ad blocks: Google marks ads with data-text-ad / uEierd / data-ad-slot.
  const noAds = html
    .replace(/<div[^>]*data-text-ad[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*\buEierd\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*data-ad-slot[^>]*>[\s\S]*?<\/div>/gi, '')

  // Organic results are <div class="g ..."> blocks containing an <h3> title.
  const blocks = extractResultBlocks(noAds)
  const results: SerpResult[] = []
  for (const block of blocks) {
    const title = extractTitle(block)
    if (!title) continue
    const url = extractUrl(block)
    const snippet = extractSnippet(block)
    results.push({ rank: results.length + 1, title, url, snippet })
  }
  return results
}

/** Find <div class="g..."> blocks by brace/div depth, non-greedy. */
function extractResultBlocks(html: string): string[] {
  const blocks: string[] = []
  const re = /<div[^>]*class="[^"]*\bg\b[^"]*"[^>]*>/gi
  let m = re.exec(html)
  while (m) {
    const start = m.index
    const openTag = m[0]
    // The class="g" div is matched by its opening tag; find its matching close
    // by counting <div>/</div> from the end of the opening tag.
    const open = openTag.endsWith('/>')
    if (open) {
      m = re.exec(html)
      continue
    }
    let depth = 1
    let i = re.lastIndex
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i)
      const nextClose = html.indexOf('</div>', i)
      if (nextOpen === -1 && nextClose === -1) break
      if (nextClose === -1 || (nextOpen !== -1 && nextOpen < nextClose)) {
        depth++
        i = nextOpen + 4
      } else {
        depth--
        i = nextClose + 6
      }
    }
    blocks.push(html.slice(start, i))
    m = re.exec(html)
  }
  return blocks
}

function extractTitle(block: string): string | null {
  const m = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block)
  if (!m) return null
  return decodeEntities(stripTags(m[1] ?? '')).trim()
}

/** Prefer the first result URL: /url?q= redirect, else the first href. */
function extractUrl(block: string): string {
  const redirect = /\/url\?q=([^&"']+)/i.exec(block)
  if (redirect?.[1]) return decodeURIComponent(redirect[1])
  const href = /href="([^"]+)"/i.exec(block)
  if (href?.[1]) return decodeEntities(href[1]).trim()
  return ''
}

function extractSnippet(block: string): string {
  // Modern: .VwiC3b snippet, or data-sncf block.
  const modern = /class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)
  if (modern) return decodeEntities(stripTags(modern[1] ?? '')).trim()
  const sncf = /data-sncf="[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)
  if (sncf) return decodeEntities(stripTags(sncf[1] ?? '')).trim()
  return ''
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}
