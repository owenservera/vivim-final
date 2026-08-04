// frontend/src/hooks/useScreenReader.ts
// Screen reader announcements via aria-live region.
'use client'

import { useCallback, useEffect, useRef } from 'react'

type Politeness = 'polite' | 'assertive'

let liveRegion: HTMLElement | null = null

function ensureLiveRegion(politeness: Politeness): HTMLElement {
  const id = `sr-live-${politeness}`
  let region = document.getElementById(id)
  if (!region) {
    region = document.createElement('div')
    region.id = id
    region.setAttribute('aria-live', politeness)
    region.setAttribute('aria-atomic', 'true')
    region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'
    document.body.appendChild(region)
  }
  return region
}

export function useScreenReader() {
  const announce = useCallback((message: string, politeness: Politeness = 'polite') => {
    const region = ensureLiveRegion(politeness)
    // Clear then set to trigger re-announcement
    region.textContent = ''
    requestAnimationFrame(() => {
      region.textContent = message
    })
  }, [])

  return { announce }
}
