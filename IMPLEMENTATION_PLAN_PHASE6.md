# Phase 6: Frontend Enhancements - Comprehensive Implementation Plan

**Project:** vivim-final  
**Phase:** 6 - Frontend UI  
**Status:** Ready to Implement  
**Date:** 2026-08-13  
**Backend Status:** Phases 1-5 Complete (All APIs ready)

---

## Executive Summary

This plan provides detailed, step-by-step implementation instructions for Phase 6 frontend enhancements. All backend APIs from Phases 1-5 are complete and tested. This plan focuses on frontend component creation, API integration, and wiring into the existing frontend architecture.

**Backend APIs Available:**
- Message Metadata: `PATCH /api/conversations/:id/messages/:mid`, `PATCH /api/conversations/:id/messages/batch`
- Collections: `POST/GET/PATCH/DELETE /api/collections`, item management endpoints
- Storage: TTL, VACUUM, backup endpoints (for admin panel)

**Frontend Stack:**
- Next.js (React)
- TypeScript
- Tailwind CSS
- Lucide Icons
- TanStack Query (for API state)

---

## Implementation Phases

### Phase 6.1: Message Card Enhancement (Days 1-2)

#### Step 1.1: Create Message Metadata Hook

**File:** `frontend/src/hooks/useMessageMetadata.ts`

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

interface MessageMetadata {
  isPinned?: number
  isArchived?: number
  readStatus?: string
}

export function useMessageMetadata(conversationId: string) {
  const queryClient = useQueryClient()

  const updateMetadata = useMutation({
    mutationFn: async ({ messageId, updates }: { messageId: string; updates: MessageMetadata }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update metadata')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })

  const batchUpdate = useMutation({
    mutationFn: async ({ messageIds, updates }: { messageIds: string[]; updates: MessageMetadata }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, updates }),
      })
      if (!response.ok) throw new Error('Failed to batch update')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })

  return {
    updateMetadata: updateMetadata.mutateAsync,
    batchUpdate: batchUpdate.mutateAsync,
    isUpdating: updateMetadata.isPending,
  }
}
```

#### Step 1.2: Enhance PartRenderer with Message Actions

**File:** `frontend/src/render/PartRenderer.tsx`

Add action buttons to the PartRenderer component:

```typescript
import { Pin, Archive, Check, MoreVertical } from 'lucide-react'

// Add to existing PartRenderer props
interface PartRendererProps {
  part: RenderablePart
  index: number
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
  // New props for metadata
  messageId?: string
  isPinned?: boolean
  isArchived?: boolean
  readStatus?: string
  onPinToggle?: (messageId: string) => void
  onArchiveToggle?: (messageId: string) => void
  onReadStatusToggle?: (messageId: string) => void
}

// Add action buttons to render
const renderMessageActions = () => {
  if (!messageId) return null

  return (
    <div className="flex items-center gap-1 ml-2">
      <button
        onClick={() => onPinToggle?.(messageId)}
        disabled={isUpdating}
        aria-label={isPinned ? 'Unpin message' : 'Pin message'}
        className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          isPinned ? 'text-blue-500' : 'text-gray-400'
        }`}
      >
        <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
      </button>

      <button
        onClick={() => onArchiveToggle?.(messageId)}
        disabled={isUpdating}
        aria-label={isArchived ? 'Unarchive message' : 'Archive message'}
        className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          isArchived ? 'text-orange-500' : 'text-gray-400'
        }`}
      >
        <Archive className={`w-4 h-4 ${isArchived ? 'fill-current' : ''}`} />
      </button>

      <button
        onClick={() => onReadStatusToggle?.(messageId)}
        disabled={isUpdating}
        aria-label={`Mark as ${readStatus === 'unread' ? 'read' : 'unread'}`}
        className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          readStatus === 'read' ? 'text-green-500' : 'text-gray-400'
        }`}
      >
        <Check className={`w-4 h-4 ${readStatus === 'read' ? 'fill-current' : ''}`} />
      </button>
    </div>
  )
}
```

#### Step 1.3: Update MessageBlock to Pass Metadata

**File:** `frontend/src/components/chat/MessageBlock.tsx`

```typescript
export const MessageBlock = memo(function MessageBlock({
  block,
  onCopy,
  onRetry,
  onEdit,
  messageId,
  isPinned,
  isArchived,
  readStatus,
  onPinToggle,
  onArchiveToggle,
  onReadStatusToggle,
}: {
  block: RenderablePart
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
  messageId?: string
  isPinned?: boolean
  isArchived?: boolean
  readStatus?: string
  onPinToggle?: (messageId: string) => void
  onArchiveToggle?: (messageId: string) => void
  onReadStatusToggle?: (messageId: string) => void
}) {
  return (
    <PartRenderer
      part={block}
      index={0}
      onCopy={onCopy}
      onRetry={onRetry}
      onEdit={onEdit}
      messageId={messageId}
      isPinned={isPinned}
      isArchived={isArchived}
      readStatus={readStatus}
      onPinToggle={onPinToggle}
      onArchiveToggle={onArchiveToggle}
      onReadStatusToggle={onReadStatusToggle}
    />
  )
})
```

#### Step 1.4: Wire in Chat Component

**File:** `frontend/src/components/chat/Chat.tsx` (or equivalent)

```typescript
import { useMessageMetadata } from '@/hooks/useMessageMetadata'

// Inside chat component
const conversationId = useCurrentConversationId()
const { updateMetadata, isUpdating } = useMessageMetadata(conversationId)

const handlePinToggle = async (messageId: string) => {
  await updateMetadata({ messageId, updates: { isPinned: 1 } })
}

const handleArchiveToggle = async (messageId: string) => {
  await updateMetadata({ messageId, updates: { isArchived: 1 } })
}

const handleReadStatusToggle = async (messageId: string) => {
  await updateMetadata({ messageId, updates: { readStatus: 'read' } })
}

// Pass to MessageBlock
<MessageBlock
  block={block}
  messageId={message.id}
  isPinned={message.isPinned === 1}
  isArchived={message.isArchived === 1}
  readStatus={message.readStatus}
  onPinToggle={handlePinToggle}
  onArchiveToggle={handleArchiveToggle}
  onReadStatusToggle={handleReadStatusToggle}
/>
```

---

### Phase 6.2: Collections Panel (Days 3-4)

#### Step 2.1: Create Collections Hook

**File:** `frontend/src/hooks/useCollections.ts`

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Collection {
  id: string
  name: string
  parentId: string | null
  description?: string
  color?: string
  icon?: string
  createdAt: number
  updatedAt: number
  itemCount?: number
  children?: Collection[]
}

export function useCollections() {
  const queryClient = useQueryClient()

  const { data: collections, isLoading, error } = useQuery({
    queryKey: ['collections'],
    queryFn: async (): Promise<Collection[]> => {
      const response = await fetch('/api/collections')
      if (!response.ok) throw new Error('Failed to fetch collections')
      return response.json()
    },
  })

  const createCollection = useMutation({
    mutationFn: async (collection: Partial<Collection>) => {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      })
      if (!response.ok) throw new Error('Failed to create collection')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const updateCollection = useMutation({
    mutationFn: async ({ id, ...collection }: { id: string } & Partial<Collection>) => {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      })
      if (!response.ok) throw new Error('Failed to update collection')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete collection')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  return {
    collections: collections || [],
    isLoading,
    error,
    createCollection: createCollection.mutateAsync,
    updateCollection: updateCollection.mutateAsync,
    deleteCollection: deleteCollection.mutateAsync,
    isCreating: createCollection.isPending,
    isUpdating: updateCollection.isPending,
    isDeleting: deleteCollection.isPending,
  }
}
```

#### Step 2.2: Create Collections Panel Component

**File:** `frontend/src/components/collections/CollectionsPanel.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Folder, FolderOpen, Plus, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { useCollections, type Collection } from '@/hooks/useCollections'

export function CollectionsPanel() {
  const { collections, isLoading, createCollection, updateCollection, deleteCollection } = useCollections()
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Build hierarchical tree
  const buildTree = (flatCollections: Collection[]): Collection[] => {
    const map = new Map<string, Collection>()
    const roots: Collection[] = []

    flatCollections.forEach(col => {
      map.set(col.id, { ...col, children: [] })
    })

    flatCollections.forEach(col => {
      const node = map.get(col.id)!
      if (col.parentId && map.has(col.parentId)) {
        map.get(col.parentId)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  const tree =	buildTree(collections)

  const toggleExpand = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
  }

  const selectCollection = (collectionId: string) => {
    setSelectedCollection(collectionId)
    // TODO: Filter messages by collection
  }

  const renderCollection = (collection: Collection, level: number = 0) => {
    const isExpanded = expandedCollections.has(collection.id)
    const isSelected = selectedCollection === collection.id
    const hasChildren = collection.children && collection.children.length > 0

    return (
      <div key={collection.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => selectCollection(collection.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleExpand(collection.id)
            }}
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <Folder className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <Folder className={`w-4 h-4 ${collection.color || 'text-gray-500'}`} />

          <span className="flex-1 text-sm truncate">{collection.name}</span>

          {collection.itemCount !== undefined && (
            <span className="text-xs text-gray-400">{collection.itemCount}</span>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Open edit dialog
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Edit collection"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Open delete confirmation
              }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
              aria-label="Delete collection"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {collection.children!.map(child => renderCollection(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold">Collections</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Create new collection"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-center text-sm text-gray-400 py-4">Loading...</div>
        ) : tree.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-4">No collections yet</div>
        ) : (
          tree.map(collection => renderCollection(collection))
        )}
      </div>

      {showCreateDialog && (
        <CollectionDialog
          onClose={() => setShowCreateDialog(false)}
          onSave={async (collection) => {
            await createCollection(collection)
            setShowCreateDialog(false)
          }}
        />
      )}
    </div>
  )
}
```

---

### Phase 6.3: Collection Dialog (Day 5)

#### Step 3.1: Create Collection Dialog Component

**File:** `frontend/src/components/collections/CollectionDialog.tsx`

```typescript
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { type Collection } from '@/hooks/useCollections'

interface CollectionDialogProps {
  collection?: Collection
  onClose: () => void
  onSave: (collection: Partial<Collection>) => Promise<void>
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
]

const ICONS = ['folder', 'star', 'heart', 'bookmark', 'tag', 'archive', 'box', 'briefcase']

export function CollectionDialog({ collection, onClose, onSave }: CollectionDialogProps) {
  const [name, setName] = useState(collection?.name || '')
  const [description, setDescription] = useState(collection?.description || '')
  const [color, setColor] = useState(collection?.color || COLORS[0])
  const [icon, setIcon] = useState(collection?.icon || ICONS[0])
  const [parentId, setParentId] = useState(collection?.parentId || null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
        parentId: parentId || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save collection')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {collection ? 'Edit Collection' : 'Create Collection'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Collection name"
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="icon" className="block text-sm font-medium mb-1">
              Icon
            </label>
            <select
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {i.charAt(0).toUpperCase() + i.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : collection ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

---

### Phase 6.4: Integration and Testing (Days 6-7)

#### Step 4.1: Add Collections Panel to Sidebar

**File:** `frontend/src/components/layout/Sidebar.tsx` (or equivalent)

```typescript
import { CollectionsPanel } from '@/components/collections/CollectionsPanel'

// In sidebar component
<div className="flex-1 overflow-y-auto">
  {/* Existing sidebar content */}
  
  <div className="border-t border-gray-200 dark:border-gray-700">
    <CollectionsPanel />
  </div>
</div>
```

#### Step 4.2: Add Collection Filtering to Chat

```typescript
// In chat component, add collection filter state
const [selectedCollection, setSelectedCollection] = useState<string | null>(null)

// Filter messages by collection
const filteredMessages = selectedCollection
  ? messages.filter(m => m.collectionId === selectedCollection)
  : messages

// Pass to CollectionsPanel
<CollectionsPanel
  selectedCollection={selectedCollection}
  onCollectionSelect={setSelectedCollection}
/>
```

#### Step 4.3: Add Error Handling and Loading States

```typescript
// In all components, add error boundaries and loading states
{isLoading && <div className="text-center py-4">Loading...</div>}
{error && <div className="text-center py-4 text-red-500">Error: {error.message}</div>}
```

#### Step 4.4: Test Checklist

- [ ] Pin button toggles pin state
- [ ] Archive button toggles archive state
- [ ] Read status indicator updates
- [ ] Collections panel loads and displays collections
- [ ] Expand/collapse works for hierarchical collections
- [ ] Collection selection filters messages
- [ ] Create collection dialog works
- [ ] Edit collection dialog works
- [ ] Delete collection with confirmation works
- [ ] All buttons have keyboard navigation
- [ ] All icons have aria-labels
- [ ] Responsive design works on mobile
- [ ] Error handling displays user-friendly messages
- [ ] Loading states display correctly

---

## Testing Commands

```bash
# Frontend development server
cd frontend
bun run dev

# Frontend build
bun run build

# Frontend tests
bun test

# Lint
bun run lint
```

---

## Rollback Plan

If issues arise:
1. Revert component changes in git
2. Remove new hooks from `frontend/src/hooks/`
3. Remove new components from `frontend/src/components/`
4. Restore original PartRenderer.tsx
5. Restore original MessageBlock.tsx

---

## Success Criteria

- All Phase 6 components implemented
- All backend API integrations working
- All tests passing
- Accessibility compliance (WCAG AA)
- Performance targets met (<100ms button response, <500ms panel load)
