import { describe, expect, test } from 'bun:test'
import { parseGoogleSerp } from '../../../src/mcp/serp-parser.js'

const SERP_HTML = `
<!doctype html><html><head><title>opencode - Google Search</title></head><body>
<div id="search">
  <div class="g uEierd" data-text-ad="1">
    <h3>Sponsored: Buy opencode</h3>
    <a href="/url?q=https%3A%2F%2Fads.example.com%2Fopencode&amp;sa=U">Buy</a>
    <div class="VwiC3b">An ad that must be stripped.</div>
  </div>
  <div class="g">
    <h3>opencode - The AI Agent</h3>
    <a href="/url?q=https%3A%2F%2Fopencode.example.com%2F&amp;sa=U&amp;ved=1"><h3>opencode - The AI Agent</h3></a>
    <div class="VwiC3b">opencode is an open-source AI coding agent.</div>
  </div>
  <div class="g">
    <h3>opencode docs</h3>
    <a href="/url?q=https%3A%2F%2Fdocs.example.com%2F&amp;sa=U"><h3>opencode docs</h3></a>
  </div>
  <div class="g">
    <h3>Another result</h3>
    <a href="https://direct.example.com/page"><h3>Another result</h3></a>
    <div data-sncf="1">Snippet with no class VwiC3b.</div>
  </div>
</div>
</body></html>
`

describe('parseGoogleSerp', () => {
  test('returns organic results with rank, title, url, snippet', () => {
    const results = parseGoogleSerp(SERP_HTML)
    expect(results.length).toBe(3) // ad stripped
    expect(results[0]?.rank).toBe(1)
    expect(results[0]?.title).toBe('opencode - The AI Agent')
    expect(results[0]?.url).toBe('https://opencode.example.com/')
    expect(results[0]?.snippet).toContain('open-source AI coding agent')
  })

  test('decodes Google redirect urls', () => {
    const results = parseGoogleSerp(SERP_HTML)
    expect(results[1]?.url).toBe('https://docs.example.com/')
  })

  test('handles missing snippet as empty string', () => {
    const results = parseGoogleSerp(SERP_HTML)
    expect(results[1]?.snippet).toBe('')
  })

  test('keeps direct (non-redirect) urls unchanged', () => {
    const results = parseGoogleSerp(SERP_HTML)
    expect(results[2]?.url).toBe('https://direct.example.com/page')
  })

  test('empty input → empty array', () => {
    expect(parseGoogleSerp('')).toEqual([])
  })

  test('no organic blocks → empty array', () => {
    expect(parseGoogleSerp('<html><body>no results</body></html>')).toEqual([])
  })
})
