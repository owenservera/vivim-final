// templates/result-renderer.tsx
// RESULT RENDERER — maps resultComponent/resultLayout contract fields to output UI.
//
// Copy into: web/ui/src/components/result-renderer.tsx

export interface RenderResult {
  ok: boolean
  data?: unknown
  error?: string
}

interface ResultRendererProps {
  component: string // text_block | image_grid | table | code_block | list | raw
  layout: string // inline | panel | modal
  result: RenderResult
}

function Body({ component, data }: { component: string; data: unknown }) {
  if (data == null) return <span className="cap-result__empty">—</span>
  switch (component) {
    case 'image_grid': {
      const urls = Array.isArray(data) ? (data as string[]) : []
      return (
        <div className="cap-result__images">
          {urls.map((u, i) => (
            <img key={i} src={u} alt="" className="cap-result__img" />
          ))}
        </div>
      )
    }
    case 'table': {
      const rows = (data as Record<string, unknown>[]) ?? []
      const cols = rows[0] ? Object.keys(rows[0]) : []
      return (
        <table className="cap-result__table">
          <thead>
            <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
    }
    case 'code_block':
      return <pre className="cap-result__code">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
    case 'list': {
      const items = Array.isArray(data) ? (data as unknown[]) : [data]
      return (
        <ul className="cap-result__list">
          {items.map((it, i) => <li key={i}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>)}
        </ul>
      )
    }
    case 'text_block':
    default:
      return <div className="cap-result__text">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</div>
  }
}

export function ResultRenderer({ component, layout, result }: ResultRendererProps) {
  if (!result.ok) {
    return <div className="cap-result cap-result--error" data-layout={layout}>{result.error}</div>
  }
  return (
    <div className={`cap-result cap-result--${component} cap-result--layout-${layout}`} data-layout={layout}>
      <Body component={component} data={result.data} />
    </div>
  )
}
