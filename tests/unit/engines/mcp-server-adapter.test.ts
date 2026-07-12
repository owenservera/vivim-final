import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { McpServerAdapter } from '../../../src/engines/mcp-server-adapter.js'

function makeGovernor() {
  return {
    cdp: {
      send: mock(() => Promise.resolve({})),
      getPageState: mock(() => Promise.resolve({ url: 'https://example.com', title: 'Example' })),
    },
    launch: mock(() => Promise.resolve({ slaveId: 's1' })),
  } as any
}

describe('McpServerAdapter', () => {
  let gov: ReturnType<typeof makeGovernor>
  let adapter: McpServerAdapter

  beforeEach(() => {
    gov = makeGovernor()
    adapter = new McpServerAdapter(gov)
  })

  test('getTools returns registered chrome tools', () => {
    const tools = adapter.getTools()
    const names = tools.map((t: any) => t.name)
    expect(names).toContain('chrome_launch')
    expect(names).toContain('chrome_navigate')
    expect(names).toContain('chrome_click')
    expect(names).toContain('chrome_screenshot')
    expect(names).toContain('chrome_get_state')
  })

  test('callTool routes chrome_navigate to CDP', async () => {
    const result = await adapter.callTool('chrome_navigate', {
      slaveId: 's1',
      url: 'https://x.com',
    })
    expect(gov.cdp.send).toHaveBeenCalledWith('s1', 'Page.navigate', { url: 'https://x.com' })
    expect(result.content).toEqual({ success: true })
  })

  test('callTool routes chrome_click to CDP', async () => {
    const result = await adapter.callTool('chrome_click', { slaveId: 's1', selector: '#btn' })
    expect(gov.cdp.send).toHaveBeenCalledWith('s1', 'Runtime.evaluate', {
      expression: "document.querySelector('#btn')?.click()",
    })
    expect(result.content).toEqual({ success: true })
  })

  test('callTool routes chrome_get_state to getPageState', async () => {
    const result = await adapter.callTool('chrome_get_state', { slaveId: 's1' })
    expect(gov.cdp.getPageState).toHaveBeenCalledWith('s1')
    expect(result.content).toEqual({ url: 'https://example.com', title: 'Example' })
  })

  test('callTool returns error for unknown tool', async () => {
    const result = await adapter.callTool('unknown_tool', {})
    expect(result.isError).toBe(true)
  })

  test('isRunning returns false before start', () => {
    expect(adapter.isRunning()).toBe(false)
  })
})
