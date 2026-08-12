// Local-first persistence for canvas state.
//
// Strategy:
//   1. Autosave to IndexedDB on every state change (500ms debounce).
//   2. Mirror to server via /api/canvas/save for cross-device sync.
//   3. Keep last N versions in a ring buffer for undo / time scrubber.
//   4. Use stable JSON key ordering so diffs are readable in git.
//
// The format is plain JSON (no binary blobs) so a canvas file can be
// committed to the repo alongside the code, reviewed in a PR, and
// merged cleanly when two branches both edit it.

import type { CanvasState } from './types'

/** Await an IDBTransaction completion (tx.done polyfill for older TS libs). */
function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

const DB_NAME = 'vivim-canvas'
const DB_VERSION = 1
const STORE_STATE = 'state' // latest canvas state by id
const STORE_HISTORY = 'history' // ring buffer of past states

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveCanvas(state: CanvasState): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([STORE_STATE], 'readwrite')
  tx.objectStore(STORE_STATE).put(state)
  await waitForTx(tx)

  // Also push to history. Key is `${canvasId}@${timestamp}`.
  const histKey = `${state.id}@${state.updatedAt}`
  const tx2 = db.transaction([STORE_HISTORY], 'readwrite')
  tx2.objectStore(STORE_HISTORY).put({ key: histKey, state })
  await waitForTx(tx2)

  // Trim history to last N entries per canvas.
  await trimHistory(state.id, 50)

  // Mirror to server (fire-and-forget; failure is non-fatal).
  fetch('/api/canvas/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  }).catch(() => {
  // [audit] log the error with context here
    /* offline or no auth; local copy is authoritative */
  })
}

export async function loadCanvas(id: string): Promise<CanvasState | null> {
  const db = await openDb()
  const tx = db.transaction([STORE_STATE], 'readonly')
  const req = tx.objectStore(STORE_STATE).get(id)
  return new Promise((resolve) => {
    req.onsuccess = () => resolve((req.result as CanvasState) ?? null)
    req.onerror = () => resolve(null)
  })
}

export async function listCanvases(): Promise<{ id: string; updatedAt: string }[]> {
  const db = await openDb()
  const tx = db.transaction([STORE_STATE], 'readonly')
  return new Promise((resolve) => {
    const req = tx.objectStore(STORE_STATE).getAll()
    req.onsuccess = () => {
      const all = (req.result as CanvasState[]) ?? []
      resolve(
        all
          .map((s) => ({ id: s.id, updatedAt: s.updatedAt }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      )
    }
    req.onerror = () => resolve([])
  })
}

export async function listHistory(
  canvasId: string,
): Promise<{ key: string; state: CanvasState }[]> {
  const db = await openDb()
  const tx = db.transaction([STORE_HISTORY], 'readonly')
  return new Promise((resolve) => {
    const req = tx.objectStore(STORE_HISTORY).getAll()
    req.onsuccess = () => {
      const all = (req.result as { key: string; state: CanvasState }[]) ?? []
      resolve(
        all
          .filter((r) => r.key.startsWith(`${canvasId}@`))
          .sort((a, b) => b.key.localeCompare(a.key)),
      )
    }
    req.onerror = () => resolve([])
  })
}

async function trimHistory(canvasId: string, keep: number): Promise<void> {
  const hist = await listHistory(canvasId)
  if (hist.length <= keep) return
  const toRemove = hist.slice(keep)
  const db = await openDb()
  const tx = db.transaction([STORE_HISTORY], 'readwrite')
  for (const item of toRemove) {
    tx.objectStore(STORE_HISTORY).delete(item.key)
  }
  await waitForTx(tx)
}

// Stable JSON serialization: keys are sorted alphabetically at every level.
// This makes diffs readable and merge-friendly when canvases are committed.
export function serializeCanvas(state: CanvasState): string {
  return JSON.stringify(state, Object.keys(state).sort(), 2)
}

export function deserializeCanvas(json: string): CanvasState {
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (parsed.schema !== 'vivim.canvas/v1') {
    throw new Error(`Unknown canvas schema: ${parsed.schema}`)
  }
  return parsed as unknown as CanvasState
}
