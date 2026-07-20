// web/ui/src/ui/defaults/entry.tsx
// chat.entry — the host layout for the chat surface. Swappable as a whole:
// a provider/capability can replace the entire arrangement (sidebar + header +
// thread + composer) without touching ChatPage logic.

import type { EntryProps } from './types.js'

export function ChatEntry({ sidebar, header, thread, errorBar, composer }: EntryProps) {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', background: '#fff' }}>
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {header}
        {thread}
        {errorBar}
        {composer}
      </div>
    </div>
  )
}
