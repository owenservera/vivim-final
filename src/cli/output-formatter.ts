// src/cli/output-formatter.ts
// CLI output formatter — JSON, pretty, table modes

export type OutputMode = 'json' | 'pretty' | 'table' | 'watch'

export class OutputFormatter {
  format(data: unknown, mode: OutputMode): string {
    switch (mode) {
      case 'json':
        return JSON.stringify(data, null, 2)
      case 'pretty':
        return this.prettyPrint(data)
      case 'table':
        return this.tablePrint(data)
      case 'watch':
        return JSON.stringify(data, null, 2)
      default:
        return JSON.stringify(data)
    }
  }

  private prettyPrint(data: unknown): string {
    if (data === null || data === undefined) return String(data)
    if (typeof data === 'string') return data
    if (Array.isArray(data)) {
      return data.map((item) => this.prettyPrint(item)).join('\n')
    }
    return JSON.stringify(data, null, 2)
  }

  private tablePrint(data: unknown): string {
    if (!Array.isArray(data) || data.length === 0) return 'No data'
    const first = data[0]
    if (typeof first !== 'object' || first === null) {
      return data.join('\n')
    }
    const keys = Object.keys(first)
    const header = keys.join(' | ')
    const sep = keys.map(() => '---').join(' | ')
    const rows = data.map((row) =>
      keys.map((k) => String((row as Record<string, unknown>)[k] ?? '')).join(' | '),
    )
    return [header, sep, ...rows].join('\n')
  }
}
