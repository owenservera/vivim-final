import { describe, expect, it } from 'bun:test'
import {
  isVivimOwner,
  isVivimImageName,
  pidsForPortRange,
} from '../../../devops/desktop/verify.ts'

describe('pidsForPortRange', () => {
  const netstat = `
  TCP    0.0.0.0:9421           0.0.0.0:0              LISTENING       14884
  TCP    0.0.0.0:9422           0.0.0.0:0              LISTENING       14884
  TCP    0.0.0.0:9423           0.0.0.0:0              LISTENING       7504
  TCP    0.0.0.0:4940           0.0.0.0:0              LISTENING       9999
`

  it('collects unique PIDs listening on the vivim port range', () => {
    expect(pidsForPortRange(netstat, 9421, 20)).toEqual([14884, 7504])
  })

  it('collapses duplicate PIDs across multiple ports', () => {
    const pids = pidsForPortRange(netstat, 9421, 20)
    expect(pids.filter((p) => p === 14884)).toHaveLength(1)
  })

  it('ignores listeners outside the requested range', () => {
    expect(pidsForPortRange(netstat, 9421, 20)).not.toContain(9999)
  })

  it('returns empty for no matching listeners', () => {
    expect(pidsForPortRange(netstat, 9500, 20)).toEqual([])
  })

  it('returns empty for blank input', () => {
    expect(pidsForPortRange('', 9421, 20)).toEqual([])
  })

  it('honors the port window size', () => {
    const wide = `
  TCP    0.0.0.0:9421           0.0.0.0:0              LISTENING       1
  TCP    0.0.0.0:9425           0.0.0.0:0              LISTENING       2
`
    expect(pidsForPortRange(wide, 9421, 5)).toEqual([1, 2])
    expect(pidsForPortRange(wide, 9421, 2)).toEqual([1])
  })
})

describe('isVivimOwner', () => {
  it('accepts an owner matching the expected launched PID', () => {
    expect(isVivimOwner('bun', 7456, 7456)).toBe(true)
  })

  it('accepts vivim-desktop / vivim-server by name', () => {
    expect(isVivimOwner('vivim-desktop', 100, null)).toBe(true)
    expect(isVivimOwner('vivim-server', 101, null)).toBe(true)
    expect(isVivimOwner('VIVIM-SERVER.EXE', 102, null)).toBe(true)
  })

  it('accepts a bun worker whose ancestor chain contains a vivim image', () => {
    // The compiled sidecar vivim-server.exe re-spawns the real server via
    // `bun run src/cli/index.ts serve`, so a `bun` port owner with a
    // vivim-server ancestor is the genuine server, not a squatter.
    expect(isVivimOwner('bun', 3088, null, ['bun', 'vivim-server'])).toBe(true)
    expect(isVivimOwner('bun', 3088, null, ['bun', 'vivim-server', 'vivim-desktop'])).toBe(true)
  })

  it('accepts an ancestor anywhere up the chain', () => {
    expect(isVivimOwner('node', 55, null, ['node', 'cmd', 'vivim-desktop'])).toBe(true)
    expect(isVivimOwner('bun', 66, null, ['bun', 'explorer', 'vivim-server'])).toBe(true)
  })

  it('rejects foreign owners that do not match expected PID', () => {
    expect(isVivimOwner('bun', 14884, 7456)).toBe(false)
    expect(isVivimOwner('node', 3, null)).toBe(false)
    expect(isVivimOwner('bun', 3088, null, ['bun', 'explorer'])).toBe(false)
  })

  it('rejects null pid or null name with no expected match', () => {
    expect(isVivimOwner(null, null, null)).toBe(false)
    expect(isVivimOwner(null, 5, null)).toBe(false)
  })
})

describe('isVivimImageName', () => {
  it('accepts vivim images with case/.exe tolerance', () => {
    expect(isVivimImageName('vivim-desktop')).toBe(true)
    expect(isVivimImageName('VIVIM-SERVER.EXE')).toBe(true)
    expect(isVivimImageName('vivim-server')).toBe(true)
  })

  it('rejects non-vivim names and null', () => {
    expect(isVivimImageName('bun')).toBe(false)
    expect(isVivimImageName('node')).toBe(false)
    expect(isVivimImageName(null)).toBe(false)
  })
})
