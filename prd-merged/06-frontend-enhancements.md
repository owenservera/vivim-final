# PRD: Frontend Enhancements (M7)

**Product:** vivim-final Frontend  
**Source:** intelligence-pack-acu-dcb-storage  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13  
**Phase:** 6 (Frontend UI)

---

## Executive Summary

This PRD details the implementation of frontend UI components for message management features in vivim-final. This enhancement adds pin/archive buttons and collections panel to the frontend, building on the backend capabilities implemented in previous phases.

**Key Deliverables:**
- Pin/archive buttons for messages
- Collections panel UI
- Message metadata display
- Collection management UI
- Integration with existing frontend architecture

**Estimated Effort:** 1 week  
**Risk Level:** Medium (frontend work, depends on backend APIs from M2 and M5)

---

## Background

### Current State

vivim-final frontend has:
- Basic chat interface with message display
- No pin/archive buttons on messages
- No collections panel
- No message metadata display
- No collection management UI
- Grep across `frontend/src` for pin/archive/collection features returns empty

### Dependencies

This phase depends on:
- **M2 (Collections System):** Backend collection APIs must be implemented
- **M5 (Message Metadata):** Backend message metadata APIs must be implemented
- **M6 (CRUD APIs):** Backend CRUD APIs must be implemented

### Problem Statement

The current frontend lacks:
1. **Message Pinning UI:** No way to pin/unpin messages
2. **Message Archiving UI:** No way to archive/unarchive messages
3. **Collections Panel:** No UI to view/manage collections
4. **Message Metadata Display:** No display of read status or metadata
5. **Collection Management:** No UI to create/edit collections

### Solution Overview

Implement frontend UI components that:
- Add pin/archive buttons to message cards
- Display message metadata (read status, pinned state)
- Provide collections panel for viewing/organizing collections
- Enable collection management (create, edit, delete)
- Integrate with existing frontend architecture

---

## Requirements

### Functional Requirements

#### FR-1: Message Pin/Archive Buttons

**FR-1.1:** Add pin button to message card:
- Toggle pin state on click
- Show pinned state visually (icon change)
- Display tooltip for pin/unpin action

**FR-1.2:** Add archive button to message card:
- Toggle archive state on click
- Show archived state visually (icon change)
- Display tooltip for archive/unarchive action

**FR-1.3:** Add read status indicator:
- Show unread indicator (dot or badge)
- Show read status visually
- Update status on message read

**FR-1.4:** Position buttons:
- Place buttons in message header or footer
- Consistent positioning across message types
- Responsive design for mobile

#### FR-2: Collections Panel

**FR-2.1:** Create collections panel component:
- Display collections in hierarchical tree
- Show collection icons and colors
- Show item count per collection
- Expand/collapse functionality

**FR-2.2:** Implement collection navigation:
- Click collection to filter messages
- Show messages in selected collection
- Breadcrumb navigation for hierarchy

**FR-2.3:** Implement collection management:
- Create new collection button
- Edit collection (name, color, icon)
- Delete collection with confirmation
- Move collection (change parent)

**FR-2.4:** Implement item management:
- Add message to collection (drag-drop or button)
- Remove message from collection
- Show collection membership in message card

#### FR-3: Message Metadata Display

**FR-3.1:** Display pinned state:
- Show pin icon on pinned messages
- Highlight pinned messages visually
- Filter view to show only pinned messages

**FR-3.2:** Display archived state:
- Show archive icon on archived messages
- Dim or hide archived messages
- Filter view to show archived messages

**FR-3.3:** Display read status:
- Show unread indicator
- Show read status in message metadata
- Filter view by read status

#### FR-4: Collection Management UI

**FR-4.1:** Create collection dialog:
- Input fields for name, description
- Color picker for collection color
- Icon selector for collection icon
- Parent selector for hierarchy

**FR-4.2:** Implement collection edit:
- Open dialog with existing values
- Save changes on submit
- Cancel button to discard changes

**FR-4.3:** Implement collection delete:
- Confirmation dialog
- Cascade delete warning (items will be deleted)
- Delete button in dialog

#### FR-5: API Integration

**FR-5.1:** Integrate with message metadata APIs:
- `PATCH /api/conversations/:id/messages/:mid` for metadata updates
- `GET /api/conversations/:id/messages` with metadata filters
- `PATCH /api/conversations/:id/messages/batch` for bulk operations

**FR-5.2:** Integrate with collection APIs:
- `POST /api/collections` for creating collections
- `GET /api/collections` for listing collections
- `PATCH /api/collections/:id` for updating collections
- `DELETE /api/collections/:id` for deleting collections
- `POST /api/collections/:id/items` for adding items
- `DELETE /api/collections/:id/items/:itemType/:itemId` for removing items

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** Pin/archive button response < 100ms
**NFR-1.2:** Collections panel load < 500ms for 100 collections
**NFR-1.3:** Collection update response < 200ms

#### NFR-2: Accessibility

**NFR-2.1:** All buttons must have keyboard navigation
**NFR-2.2:** All icons must have aria-labels
**NFR-2.3:** Color selections must be accessible (contrast)

#### NFR-3: Responsiveness

**NFR-3.1:** UI must work on mobile (320px+)
**NFR-3.2:** Collections panel must be collapsible on mobile
**NFR-3.3:** Touch targets must be at least 44px

#### NFR-4: Compatibility

**NFR-4.1:** Must work with existing frontend architecture
**NFR-4.2:** Must not break existing message display
**NFR-4.3:** Must integrate with existing theme system

---

## Technical Design

### Component Architecture

#### Message Card Enhancement

```typescript
// frontend/src/components/message/MessageCard.tsx

import { useState } from 'react';
import { Pin, Archive, Check } from 'lucide-react';

interface MessageCardProps {
  message: Message;
  onPinToggle: (messageId: string) => void;
  onArchiveToggle: (messageId: string) => void;
  onReadStatusChange: (messageId: string, status: 'unread' | 'read') => void;
}

export function MessageCard({
  message,
  onPinToggle,
  onArchiveToggle,
  onReadStatusChange,
}: MessageCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handlePinToggle = async () => {
    setIsLoading(true);
    try {
      await onPinToggle(message.id);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleArchiveToggle = async () => {
    setIsLoading(true);
    try {
      await onArchiveToggle(message.id);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReadStatusToggle = async () => {
    const newStatus = message.readStatus === 'unread' ? 'read' : 'unread';
    setIsLoading(true);
    try {
      await onReadStatusChange(message.id, newStatus);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className={`message-card ${message.isArchived ? 'archived' : ''}`}>
      <div className="message-header">
        <div className="message-actions">
          <button
            onClick={handlePinToggle}
            disabled={isLoading}
            aria-label={message.isPinned ? 'Unpin message' : 'Pin message'}
            className={`action-button ${message.isPinned ? 'pinned' : ''}`}
          >
            <Pin className={message.isPinned ? 'filled' : 'outline'} />
          </button>
          
          <button
            onClick={handleArchiveToggle}
            disabled={isLoading}
            aria-label={message.isArchived ? 'Unarchive message' : 'Archive message'}
            className={`action-button ${message.isArchived ? 'archived' : ''}`}
          >
            <Archive className={message.isArchived ? 'filled' : 'outline'} />
          </button>
          
          <button
            onClick={handleReadStatusToggle}
            disabled={isLoading}
            aria-label={`Mark as ${message.readStatus === 'unread' ? 'read' : 'unread'}`}
            className={`action-button read-status ${message.readStatus}`}
          >
            <Check className={message.readStatus === 'read' ? 'visible' : 'hidden'} />
          </button>
        </div>
      </div>
      
      <div className="message-content">
        {/* Existing message content */}
      </div>
    </div>
  );
}
```

#### Collections Panel

```typescript
// frontend/src/components/collections/CollectionsPanel.tsx

import { useState } from 'react';
import { Folder, FolderOpen, Plus, Edit, Trash2 } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  icon?: string;
  itemCount: number;
  children?: Collection[];
}

export function CollectionsPanel() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const toggleExpand = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };
  
  const selectCollection = (collectionId: string) => {
    setSelectedCollection(collectionId);
    // Filter messages by collection
  };
  
  const renderCollection = (collection: Collection, level: number = 0) => {
    const isExpanded = expandedCollections.has(collection.id);
    const isSelected = selectedCollection === collection.id;
    
    return (
      <div key={collection.id} style={{ marginLeft: `${level * 16}px` }}>
        <div
          className={`collection-item ${isSelected ? 'selected' : ''}`}
          onClick={() => selectCollection(collection.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(collection.id);
            }}
            className="expand-button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {collection.children && collection.children.length > 0 ? (
              isExpanded ? <FolderOpen /> : <Folder />
            ) : (
              <Folder />
            )}
          </button>
          
          <span className="collection-name">{collection.name}</span>
          <span className="collection-count">({collection.itemCount})</span>
          
          <div className="collection-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Open edit dialog
              }}
              aria-label="Edit collection"
            >
              <Edit />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Open delete confirmation
              }}
              aria-label="Delete collection"
            >
              <Trash2 />
            </button>
          </div>
        </div>
        
        {isExpanded && collection.children && (
          <div className="collection-children">
            {collection.children.map(child => renderCollection(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="collections-panel">
      <div className="collections-header">
        <h2>Collections</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="create-button"
          aria-label="Create new collection"
        >
          <Plus />
        </button>
      </div>
      
      <div className="collections-list">
        {collections.map(collection => renderCollection(collection))}
      </div>
      
      {showCreateDialog && (
        <CollectionDialog
          onClose={() => setShowCreateDialog(false)}
          onSave={(collection) => {
            // Create collection
            setShowCreateDialog(false);
          }}
        />
      )}
    </div>
  );
}
```

#### Collection Dialog

```typescript
// frontend/src/components/collections/CollectionDialog.tsx

interface CollectionDialogProps {
  collection?: Collection;
  onClose: () => void;
  onSave: (collection: Partial<Collection>) => void;
}

export function CollectionDialog({ collection, onClose, onSave }: CollectionDialogProps) {
  const [name, setName] = useState(collection?.name || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [color, setColor] = useState(collection?.color || '#3b82f6');
  const [icon, setIcon] = useState(collection?.icon || 'folder');
  const [parentId, setParentId] = useState(collection?.parentId || null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      color,
      icon,
      parentId,
    });
  };
  
  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>{collection ? 'Edit Collection' : 'Create Collection'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="color">Color</label>
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="icon">Icon</label>
            <select
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            >
              <option value="folder">Folder</option>
              <option value="star">Star</option>
              <option value="heart">Heart</option>
              <option value="bookmark">Bookmark</option>
            </select>
          </div>
          
          <div className="form-field">
            <label htmlFor="parent">Parent Collection</label>
            <select
              id="parent"
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
            >
              <option value="">None (Root)</option>
              {/* Parent collection options */}
            </select>
          </div>
          
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">
              {collection ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### API Integration

#### Message Metadata Hooks

```typescript
// frontend/src/hooks/useMessageMetadata.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useMessageMetadata() {
  const queryClient = useQueryClient();
  
  const updateMetadata = useMutation({
    mutationFn: async ({ messageId, updates }: { messageId: string; updates: any }) => {
      const response = await fetch(`/api/conversations/:id/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
  
  const batchUpdate = useMutation({
    mutationFn: async ({ messageIds, updates }: { messageIds: string[]; updates: any }) => {
      const response = await fetch('/api/conversations/:id/messages/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, updates }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
  
  return {
    updateMetadata: updateMetadata.mutateAsync,
    batchUpdate: batchUpdate.mutateAsync,
    isUpdating: updateMetadata.isPending,
  };
}
```

#### Collection Hooks

```typescript
// frontend/src/hooks/useCollections.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCollections() {
  const queryClient = useQueryClient();
  
  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const response = await fetch('/api/collections');
      return response.json();
    },
  });
  
  const createCollection = useMutation({
    mutationFn: async (collection: Partial<Collection>) => {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
  
  const updateCollection = useMutation({
    mutationFn: async ({ id, ...collection }: { id: string } & Partial<Collection>) => {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
  
  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
  
  return {
    collections,
    isLoading,
    createCollection: createCollection.mutateAsync,
    updateCollection: updateCollection.mutateAsync,
    deleteCollection: deleteCollection.mutateAsync,
  };
}
```

---

## Implementation Plan

### Phase 6.1: Message Card Enhancement (Day 1-2)

**Tasks:**
1. Add pin button to message card
2. Add archive button to message card
3. Add read status indicator
4. Integrate with message metadata APIs
5. Add styling for pinned/archived states
6. Add accessibility features

**Deliverables:**
- Enhanced message card component
- API integration hooks
- Styling and accessibility

**Success Criteria:**
- Pin/archive buttons work correctly
- Read status updates correctly
- Accessibility features work

### Phase 6.2: Collections Panel (Day 3-4)

**Tasks:**
1. Create collections panel component
2. Implement hierarchical tree display
3. Add expand/collapse functionality
4. Implement collection selection
5. Add collection management buttons
6. Integrate with collection APIs

**Deliverables:**
- Collections panel component
- API integration hooks
- Styling for panel

**Success Criteria:**
- Collections display correctly
- Expand/collapse works
- Selection works

### Phase 6.3: Collection Dialog (Day 5)

**Tasks:**
1. Create collection dialog component
2. Implement form fields (name, description, color, icon)
3. Implement parent selection
4. Add validation
5. Integrate with collection APIs
6. Add styling

**Deliverables:**
- Collection dialog component
- Form validation
- API integration

**Success Criteria:**
- Dialog opens/closes correctly
- Form validation works
- Collection creation/editing works

### Phase 6.4: Integration and Testing (Day 6-7)

**Tasks:**
1. Wire components into main app
2. Add collection panel to sidebar
3. Test with real backend APIs
4. Add error handling
5. Add loading states
6. Run full frontend tests

**Deliverables:**
- Integrated frontend
- Error handling
- Loading states
- Test results

**Success Criteria:**
- Components integrate correctly
- Error handling works
- Frontend tests pass

---

## Risk Mitigation

### Technical Risks

**Risk 1: Backend API Dependencies**
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Verify backend APIs are implemented
  - Add API error handling
  - Provide fallback UI when APIs unavailable

**Risk 2: Performance Issues**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Implement lazy loading for collections
  - Cache collection data
  - Optimize re-renders

**Risk 3: Styling Conflicts**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Use CSS modules or styled-components
  - Follow existing design system
  - Test on different screen sizes

### Integration Risks

**Risk 1: Breaking Existing UI**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - Add features incrementally
  - Test existing functionality
  - Feature flags for new features

**Risk 2: State Management Complexity**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Use existing state management patterns
  - Keep component state local where possible
  - Use React Query for server state

---

## Success Metrics

### Quantitative Metrics

- **Button Response Time:** < 100ms (target)
- **Collections Panel Load:** < 500ms for 100 collections (target)
- **Collection Update Response:** < 200ms (target)
- **Accessibility Score:** 100% WCAG AA compliance (target)

### Qualitative Metrics

- **User Experience:** Smooth interactions
- **Visual Consistency:** Matches existing design
- **Error Handling:** Clear error messages

---

## Rollout Plan

### Deployment Steps

1. Deploy to development environment
2. Test with backend APIs
3. Deploy to staging
4. Monitor for issues
5. Gradual rollout to production

### Rollback Plan

- Feature flags can disable new UI components
- CSS changes can be reverted
- Component changes can be rolled back

---

## References

- `AGENTS.md` - Project instructions and conventions
- `intelligence-pack-acu-dcb-storage/PRD_ACU_INTEGRATION.md` - Source ACU UI PRD
- `frontend/src/` - Existing frontend architecture
- Backend API documentation from M2 and M5
