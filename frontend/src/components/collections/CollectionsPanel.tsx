'use client'

import { useState } from 'react'
import { Folder, FolderOpen, Plus, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { useCollections, type Collection } from '@/hooks/useCollections'

export function CollectionsPanel() {
  const { collections, isLoading, createCollection, updateCollection, deleteCollection } = useCollections()
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

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

  const tree = buildTree(collections)

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
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Edit collection"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
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

interface CollectionDialogProps {
  collection?: Collection
  onClose: () => void
  onSave: (collection: Partial<Collection>) => Promise<void>
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

const ICONS = ['folder', 'star', 'heart', 'bookmark', 'tag', 'archive', 'box', 'briefcase']

function CollectionDialog({ collection, onClose, onSave }: CollectionDialogProps) {
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
            <Plus className="w-5 h-5 rotate-45" />
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
