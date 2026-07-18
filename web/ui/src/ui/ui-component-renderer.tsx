// web/ui/src/ui/ui-component-renderer.tsx
// Renders a raw DB-backed UiComponent payload (html/css) as a React component.
// Used by the conceptual model bridge so backend-resolved UI code nodes can be
// hot-swapped into the registry without shipping a React component per surface.

import type { AnyComponent } from './registry.js'

export interface UiComponentPayload {
  /** Catalog key used by backend override claims (e.g. `chat.entry.system`). */
  componentKey: string
  html?: string | null
  css?: string | null
  script?: string | null
}

/** Build a React component that renders a raw html/css UiComponent payload. */
export function createUiComponentRenderer(payload: UiComponentPayload): AnyComponent {
  return function UiComponentRenderer() {
    return (
      <div className="conceptual-ui-component" data-key={payload.componentKey}>
        {payload.css ? <style>{payload.css}</style> : null}
        {payload.html ? (
          <div
            className="conceptual-ui-component__body"
            dangerouslySetInnerHTML={{ __html: payload.html }}
          />
        ) : null}
        {payload.script ? (
          <script dangerouslySetInnerHTML={{ __html: payload.script }} />
        ) : null}
      </div>
    )
  }
}
