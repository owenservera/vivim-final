// src/engines/humanized-interaction.ts
// Humanized mouse/keyboard interaction to reduce bot detection.
// Adapted from dao-ai/cdp-browser (MIT) for vivim-final.

import type { CDPTransport } from './chrome-governor.js'

/**
 * Cubic bezier interpolation for natural mouse curves.
 * Produces organic-looking paths instead of linear jumps.
 */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/**
 * Sleep with random jitter to vary timing between actions.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 10))
}

/**
 * Move mouse along a Bézier curve (not a linear jump).
 * Reduces detection by anti-bot systems that check for instantaneous movement.
 *
 * @param transport - CDP transport
 * @param slaveId - Chrome slave session ID
 * @param fromX - Starting X coordinate
 * @param fromY - Starting Y coordinate
 * @param toX - Target X coordinate
 * @param toY - Target Y coordinate
 */
export async function humanizedMouseMove(
  transport: CDPTransport,
  slaveId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<void> {
  const steps = 15 + Math.floor(Math.random() * 10)
  const cp1x = fromX + (toX - fromX) * 0.3 + (Math.random() - 0.5) * 40
  const cp1y = fromY + (toY - fromY) * 0.3 + (Math.random() - 0.5) * 40
  const cp2x = fromX + (toX - fromX) * 0.7 + (Math.random() - 0.5) * 40
  const cp2y = fromY + (toY - fromY) * 0.7 + (Math.random() - 0.5) * 40

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(cubicBezier(t, fromX, cp1x, cp2x, toX))
    const y = Math.round(cubicBezier(t, fromY, cp1y, cp2y, toY))
    await transport.send(slaveId, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
    })
    await sleep(8)
  }
}

/**
 * Click an element with humanized mouse movement + natural click timing.
 * Moves to the target via Bézier curve, then clicks with slight delay.
 *
 * @param transport - CDP transport
 * @param slaveId - Chrome slave session ID
 * @param x - Target X coordinate
 * @param y - Target Y coordinate
 * @param fromX - Starting X (defaults to random viewport position)
 * @param fromY - Starting Y (defaults to random viewport position)
 */
export async function humanizedClick(
  transport: CDPTransport,
  slaveId: string,
  x: number,
  y: number,
  fromX?: number,
  fromY?: number,
): Promise<void> {
  const startX = fromX ?? Math.floor(Math.random() * 800) + 200
  const startY = fromY ?? Math.floor(Math.random() * 400) + 100

  await humanizedMouseMove(transport, slaveId, startX, startY, x, y)
  await sleep(50 + Math.random() * 100)

  await transport.send(slaveId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
  await sleep(10 + Math.random() * 30)

  await transport.send(slaveId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
}

/**
 * Viewport jitter: random ±15px offset to defeat fingerprinting.
 * Apply once per page load, not per interaction.
 *
 * @param transport - CDP transport
 * @param slaveId - Chrome slave session ID
 */
export async function jitterViewport(transport: CDPTransport, slaveId: string): Promise<void> {
  const jitterX = Math.floor(Math.random() * 30) - 15
  const jitterY = Math.floor(Math.random() * 30) - 15
  await transport.send(slaveId, 'Emulation.setDeviceMetricsOverride', {
    width: 1280 + jitterX,
    height: 720 + jitterY,
    deviceScaleFactor: 1,
    mobile: false,
  })
}
