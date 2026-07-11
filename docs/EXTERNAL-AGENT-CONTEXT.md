# External Agent Context: Document I/O Metadata Diff System

**Purpose:** Full context for an external agent (no repo access) to design a custom document I/O metadata diff system.

---

## 1. Project Overview

**vivim-final** is a local-first AI conversation platform built with:
- **Runtime:** Bun
- **Language:** TypeScript (strict mode, ESNext target)
- **ORM:** Prisma v6.5
- **Database:** SQLite (WAL mode, foreign_keys=ON, synchronous=NORMAL)
- **Linter/Formatter:** Biome
- **Testing:** Bun test runner
- **Build:** tsup (ESM + DTS)

---

## 2. The Problem Statement

Design a **Document I/O Metadata Diff System** — a pure local wrapper for traditional documents (Word, PDF, Excel, etc.) used by professionals who make infrequent but contextually important edits.

### Key Requirements

1. **Inbound/Outbound Wrapping:** Every document read (inbound) or write (outbound) must be wrapped to capture metadata
2. **Rich Metadata Context:** Each "touch" of a document captures extensive contextual metadata (who, what, why, when, where, how)
3. **Time Travel Ability:** Full history of document states with ability to restore任何 previous version
4. **Git-like Diffing:** Visual comparison of document changes with metadata overlay
5. **Local-First:** No cloud dependency — all data stored locally

### Target Users

- Legal professionals (contracts, briefs, filings)
- Medical professionals (patient records, research papers)
- Financial analysts (reports, models, presentations)
- Academic researchers (papers, thesis, grants)
- Government officials (policy documents, reports)

---

## 3. Architecture Patterns from vivim-final

The design should follow these established patterns:

### 3.1 Engine-Based Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    13+ Engines                               │
│                                                             │
│  Each engine has:                                           │
│  • Store Contract (typed interface)                         │
│  • Public Interface (class with methods)                    │
│  • Dependencies injected via constructor                    │
│  • Unit-testable with mocked stores                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Store Contract Pattern

```typescript
// Engine depends on CONTRACT, not implementation
interface DocumentStore {
  getDocument(id: string): Promise<DocumentRow | null>;
  upsertDocument(doc: DocumentRow): Promise<void>;
  // ... other methods
}

// Implementation in storage/impl/
class DocumentStoreImpl implements DocumentStore {
  constructor(private db: Database) {}
  // ... Prisma-based implementation
}
```

### 3.3 Event Bus Pattern

```typescript
// Typed in-process pub/sub
type DocumentEvent =
  | { type: 'document:created'; documentId: string; metadata: DocumentMetadata }
  | { type: 'document:updated'; documentId: string; changes: DocumentDiff }
  | { type: 'document:version_created'; documentId: string; versionId: string }
  | { type: 'document:restored'; documentId: string; restoredFrom: string };

class DocumentEventBus {
  emit(event: DocumentEvent): void;
  on(type: string, handler: EventHandler): () => void;
}
```

### 3.4 ConfigManager Pattern

```typescript
// Re-programmable configuration
interface DocumentSystemConfig {
  maxVersions: number;           // Default: 100
  autoSnapshot: boolean;         // Default: true
  metadataRequired: boolean;     // Default: true
  compressionEnabled: boolean;   // Default: true
  retentionDays: number;         // Default: 365
}
```

---

## 4. Proposed Engine Architecture

### Engine List

| Engine | Purpose | Dependencies |
|--------|---------|--------------|
| `DocumentIOWrapper` | Core wrapper for inbound/outbound operations | `DocumentStore`, `EventBus` |
| `MetadataCaptureEngine` | Extract rich metadata from document operations | `MetadataStore`, `ConfigManager` |
| `VersionControlEngine` | Manage document versions and snapshots | `VersionStore`, `EventBus` |
| `DiffEngine` | Generate visual diffs with metadata overlay | `DiffStore`, `VersionControlEngine` |
| `TimeTravelEngine` | Restore任何 previous document state | `VersionStore`, `DiffEngine` |
| `SearchIndexEngine` | Index metadata for fast search | `SearchStore`, `EventBus` |
| `ExportEngine` | Export documents with full history | `DocumentStore`, `VersionStore` |

### 4.1 DocumentIOWrapper (Core Engine)

**Purpose:** Intercept all document read/write operations and capture metadata.

```typescript
interface DocumentIOWrapper {
  // Inbound operations (reading documents)
  readInbound(filePath: string, context: InboundContext): Promise<DocumentWithMetadata>;
  
  // Outbound operations (writing documents)
  writeOutbound(doc: DocumentWithMetadata, context: OutboundContext): Promise<void>;
  
  // Bulk operations
  readInboundBatch(files: string[], context: InboundContext): Promise<DocumentWithMetadata[]>;
  writeOutboundBatch(docs: DocumentWithMetadata[], context: OutboundContext): Promise<void>;
}

interface InboundContext {
  source: string;           // Where the document came from
  purpose: string;          // Why it's being read
  user?: string;            // Who is reading it
  project?: string;         // Which project it belongs to
  tags?: string[];          // Custom tags for categorization
}

interface OutboundContext {
  destination: string;      // Where the document is going
  purpose: string;          // Why it's being written
  user?: string;            // Who is writing it
  changeReason?: string;    // Why the change was made
  reviewers?: string[];     // Who needs to review
  approvalRequired?: boolean;
}
```

### 4.2 MetadataCaptureEngine

**Purpose:** Extract and store rich metadata for every document touch.

```typescript
interface DocumentMetadata {
  // Core metadata
  documentId: string;
  versionId: string;
  timestamp: number;
  
  // Content metadata
  title: string;
  author: string;
  created: number;
  modified: number;
  fileSize: number;
  pageCount?: number;
  wordCount?: number;
  
  // Edit metadata
  editType: 'create' | 'read' | 'update' | 'delete' | 'restore';
  editSource: string;       // Application/tool used
  editUser: string;
  editReason?: string;
  editDuration?: number;    // Time spent editing
  
  // Context metadata
  project?: string;
  tags: string[];
  category: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
  
  // Technical metadata
  fileHash: string;         // SHA-256 of content
  format: string;           // PDF, DOCX, etc.
  encoding?: string;
  compression?: string;
  
  // Diff metadata
  previousVersionId?: string;
  changeSummary?: string;
  changeStats: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    bytesChanged: number;
  };
}
```

### 4.3 VersionControlEngine

**Purpose:** Manage document versions with full snapshot capability.

```typescript
interface VersionControlEngine {
  // Create new version
  createVersion(docId: string, content: Buffer, metadata: Partial<DocumentMetadata>): Promise<Version>;
  
  // Get version
  getVersion(docId: string, versionId: string): Promise<Version>;
  getVersionByHash(docId: string, hash: string): Promise<Version>;
  
  // List versions
  listVersions(docId: string, opts?: VersionListOptions): Promise<Version[]>;
  getVersionTimeline(docId: string): Promise<VersionTimeline>;
  
  // Restore version
  restoreVersion(docId: string, versionId: string, context: OutboundContext): Promise<DocumentWithMetadata>;
  
  // Compare versions
  compareVersions(docId: string, from: string, to: string): Promise<VersionDiff>;
}

interface Version {
  id: string;
  documentId: string;
  versionNumber: number;
  contentHash: string;
  contentSize: number;
  metadata: DocumentMetadata;
  snapshotPath: string;     // Path to full snapshot
  diffPath?: string;        // Path to diff from previous version
  createdAt: number;
  createdBy: string;
}
```

### 4.4 DiffEngine

**Purpose:** Generate visual diffs with metadata overlay.

```typescript
interface DiffEngine {
  // Generate diff
  generateDiff(docId: string, from: string, to: string): Promise<DocumentDiff>;
  
  // Get diff with context
  getDiffWithContext(docId: string, from: string, to: string, context: DiffContext): Promise<DocumentDiffWithContext>;
  
  // Export diff
  exportDiff(diff: DocumentDiff, format: 'html' | 'pdf' | 'json'): Promise<Buffer>;
}

interface DocumentDiff {
  documentId: string;
  fromVersion: string;
  toVersion: string;
  changes: DiffChange[];
  stats: DiffStats;
  metadata: {
    fromMetadata: DocumentMetadata;
    toMetadata: DocumentMetadata;
    timeDelta: number;      // Time between versions
    userDelta: string;      // Who made changes
  };
}

interface DiffChange {
  type: 'add' | 'remove' | 'modify' | 'move';
  position: DiffPosition;
  content: {
    before?: string;
    after?: string;
  };
  metadata: {
    editUser: string;
    editTimestamp: number;
    editReason?: string;
  };
}
```

### 4.5 TimeTravelEngine

**Purpose:** Restore any previous document state with full context.

```typescript
interface TimeTravelEngine {
  // Get document state at specific time
  getStateAtTime(docId: string, timestamp: number): Promise<DocumentWithMetadata>;
  
  // Get document state at specific version
  getStateAtVersion(docId: string, versionId: string): Promise<DocumentWithMetadata>;
  
  // Create timeline view
  getTimeline(docId: string, opts?: TimelineOptions): Promise<DocumentTimeline>;
  
  // Restore to specific point
  restoreToPoint(docId: string, target: string, context: OutboundContext): Promise<DocumentWithMetadata>;
  
  // Create branch (like git branches)
  createBranch(docId: string, branchName: string, fromVersion: string): Promise<DocumentBranch>;
  mergeBranch(docId: string, branchName: string, context: OutboundContext): Promise<void>;
}
```

---

## 5. Database Schema (SQLite)

### 5.1 Core Tables

```sql
-- Document registry
CREATE TABLE document (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  sensitivity TEXT NOT NULL DEFAULT 'internal',
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  format TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Document versions
CREATE TABLE document_version (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  content_size INTEGER NOT NULL,
  snapshot_path TEXT NOT NULL,
  diff_path TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(document_id, version_number)
);

-- Document metadata (rich context for each touch)
CREATE TABLE document_metadata (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES document_version(id) ON DELETE CASCADE,
  metadata_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Edit history (audit trail)
CREATE TABLE document_edit_history (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES document_version(id) ON DELETE CASCADE,
  edit_type TEXT NOT NULL,
  edit_source TEXT NOT NULL,
  edit_user TEXT NOT NULL,
  edit_reason TEXT,
  edit_duration_ms INTEGER,
  change_summary TEXT,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  lines_modified INTEGER DEFAULT 0,
  bytes_changed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Document tags
CREATE TABLE document_tag (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(document_id, tag)
);

-- Document branches (for parallel work)
CREATE TABLE document_branch (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  base_version_id TEXT NOT NULL REFERENCES document_version(id),
  head_version_id TEXT NOT NULL REFERENCES document_version(id),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(document_id, branch_name)
);

-- Document merges (track merge operations)
CREATE TABLE document_merge (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  source_branch TEXT NOT NULL,
  target_branch TEXT NOT NULL,
  source_version_id TEXT NOT NULL,
  target_version_id TEXT NOT NULL,
  result_version_id TEXT NOT NULL,
  conflict_resolution TEXT,
  merged_at INTEGER NOT NULL,
  merged_by TEXT NOT NULL
);

-- Search index (for full-text search)
CREATE TABLE document_search_index (
  id TEXT NOT NULL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES document_version(id),
  content_text TEXT,
  metadata_text TEXT,
  created_at INTEGER NOT NULL
);
```

### 5.2 Views

```sql
-- Document with latest version info
CREATE VIEW document_with_latest AS
SELECT 
  d.*,
  dv.id as latest_version_id,
  dv.version_number as latest_version,
  dv.content_hash as latest_hash,
  dv.created_at as latest_modified
FROM document d
LEFT JOIN document_version dv ON dv.document_id = d.id
  AND dv.version_number = (
    SELECT MAX(version_number) 
    FROM document_version 
    WHERE document_id = d.id
  );

-- Document timeline
CREATE VIEW document_timeline AS
SELECT 
  dv.document_id,
  dv.id as version_id,
  dv.version_number,
  dv.content_hash,
  deh.edit_type,
  deh.edit_user,
  deh.edit_reason,
  deh.change_summary,
  dv.created_at
FROM document_version dv
JOIN document_edit_history deh ON deh.version_id = dv.id
ORDER BY dv.document_id, dv.version_number DESC;

-- Document statistics
CREATE VIEW document_stats AS
SELECT 
  d.id,
  d.title,
  COUNT(DISTINCT dv.id) as version_count,
  COUNT(DISTINCT dt.id) as tag_count,
  COUNT(DISTINCT db.id) as branch_count,
  MIN(dv.created_at) as first_version,
  MAX(dv.created_at) as latest_version
FROM document d
LEFT JOIN document_version dv ON dv.document_id = d.id
LEFT JOIN document_tag dt ON dt.document_id = d.id
LEFT JOIN document_branch db ON db.document_id = d.id
GROUP BY d.id;
```

---

## 6. ID Generation

Following vivim-final's pattern using ULID:

```typescript
import { ulid } from 'ulid';

export function newDocumentId(): string {
  return ulid();
}

export function newVersionId(): string {
  return ulid();
}

export function newMetadataId(): string {
  return ulid();
}

export function deriveDocumentId(filePath: string, hash: string): string {
  return `doc:${hash}:${path.basename(filePath)}`;
}

export function deriveVersionId(documentId: string, versionNumber: number): string {
  return `${documentId}:v${versionNumber}`;
}
```

---

## 7. Error Hierarchy

```typescript
export class DocumentSystemError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DocumentSystemError';
    this.code = code;
    this.details = details;
  }
}

export class DocumentNotFoundError extends DocumentSystemError {
  constructor(documentId: string) {
    super('DocumentNotFoundError', `Document ${documentId} not found`);
  }
}

export class VersionNotFoundError extends DocumentSystemError {
  constructor(documentId: string, versionId: string) {
    super('VersionNotFoundError', `Version ${versionId} not found for document ${documentId}`);
  }
}

export class ConflictError extends DocumentSystemError {
  constructor(message: string) {
    super('ConflictError', message);
  }
}

export class MetadataRequiredError extends DocumentSystemError {
  constructor(operation: string) {
    super('MetadataRequiredError', `Metadata is required for ${operation}`);
  }
}
```

---

## 8. File Structure

```
src/
├── engines/
│   ├── document-io-wrapper.ts          # Core I/O wrapper
│   ├── metadata-capture-engine.ts      # Metadata extraction
│   ├── version-control-engine.ts       # Version management
│   ├── diff-engine.ts                  # Diff generation
│   ├── time-travel-engine.ts           # Time travel operations
│   ├── search-index-engine.ts          # Search indexing
│   └── export-engine.ts                # Export with history
├── storage/
│   ├── contracts/
│   │   ├── document-store.ts
│   │   ├── version-store.ts
│   │   ├── metadata-store.ts
│   │   ├── diff-store.ts
│   │   └── search-store.ts
│   └── impl/
│       ├── document-store-impl.ts
│       ├── version-store-impl.ts
│       ├── metadata-store-impl.ts
│       ├── diff-store-impl.ts
│       └── search-store-impl.ts
├── schema/
│   ├── document.ts                     # Zod schemas for documents
│   └── metadata.ts                     # Zod schemas for metadata
├── config.ts                           # Configuration
├── errors.ts                           # Error classes
└── ids.ts                              # ID generation
```

---

## 9. API Endpoints

### 9.1 Document Operations

```
POST   /api/documents                    # Create document
GET    /api/documents                    # List documents
GET    /api/documents/:id                # Get document
PUT    /api/documents/:id                # Update document
DELETE /api/documents/:id                # Delete document

POST   /api/documents/:id/read           # Read document (inbound)
POST   /api/documents/:id/write          # Write document (outbound)
```

### 9.2 Version Operations

```
GET    /api/documents/:id/versions       # List versions
GET    /api/documents/:id/versions/:vid  # Get specific version
POST   /api/documents/:id/versions       # Create version
POST   /api/documents/:id/restore/:vid   # Restore version
```

### 9.3 Diff Operations

```
GET    /api/documents/:id/diff/:from/:to  # Get diff
GET    /api/documents/:id/diff/:from/:to/html  # Get HTML diff
POST   /api/documents/:id/diff/export    # Export diff
```

### 9.4 Time Travel Operations

```
GET    /api/documents/:id/timeline       # Get timeline
GET    /api/documents/:id/state/:target  # Get state at point
POST   /api/documents/:id/restore/:target  # Restore to point
```

### 9.5 Branch Operations

```
GET    /api/documents/:id/branches       # List branches
POST   /api/documents/:id/branches       # Create branch
POST   /api/documents/:id/merge/:branch  # Merge branch
```

---

## 10. Key Design Decisions

### 10.1 Metadata Capture Strategy

**Question:** Should metadata be captured automatically or require explicit context?

**Recommendation:** Hybrid approach
- **Automatic:** File hash, timestamp, file size, format, edit user (from system)
- **Required:** Edit reason, change summary (prompt user if missing)
- **Optional:** Tags, project, sensitivity, reviewers

### 10.2 Storage Strategy

**Question:** How to store document snapshots?

**Options:**
1. **Full snapshots:** Store complete file for each version (simple but space-heavy)
2. **Diffs only:** Store only changes (space-efficient but complex restore)
3. **Hybrid:** Full snapshots for major versions, diffs for minor edits

**Recommendation:** Hybrid approach
- Major versions (manual saves): Full snapshot
- Auto-saves: Diffs only
- Configurable threshold

### 10.3 Diff Generation

**Question:** What diff algorithm to use?

**Options:**
1. **Line-based diff:** Classic diff algorithm
2. **Word-based diff:** More granular changes
3. **Semantic diff:** Understand document structure

**Recommendation:** Start with line-based, add word-based as option
- Line-based for text files
- Word-based for documents with formatting
- Semantic for specific formats (PDF, DOCX)

### 10.4 Time Travel Implementation

**Question:** How to handle conflicts during restore?

**Options:**
1. **Force restore:** Overwrite current state
2. **Create branch:** Preserve current state, create new branch
3. **Merge:** Attempt to merge changes

**Recommendation:** Default to create branch, allow force restore with confirmation

---

## 11. Integration Points

### 11.1 External Systems

```typescript
// File system watchers
interface FileSystemWatcher {
  watch(path: string, callback: (event: FileEvent) => void): void;
  unwatch(path: string): void;
}

// Cloud storage integration
interface CloudStorageAdapter {
  upload(doc: DocumentWithMetadata, cloudPath: string): Promise<void>;
  download(cloudPath: string): Promise<DocumentWithMetadata>;
  sync(localPath: string, cloudPath: string): Promise<SyncResult>;
}

// Email integration
interface EmailAdapter {
  sendDocument(doc: DocumentWithMetadata, recipients: string[]): Promise<void>;
  receiveDocument(emailId: string): Promise<DocumentWithMetadata>;
}
```

### 11.2 UI Components

```typescript
// Document viewer with diff overlay
interface DocumentViewer {
  render(doc: DocumentWithMetadata, diff?: DocumentDiff): void;
  highlightChanges(diff: DocumentDiff): void;
  showMetadata(metadata: DocumentMetadata): void;
}

// Timeline visualization
interface TimelineView {
  render(timeline: DocumentTimeline): void;
  selectVersion(versionId: string): void;
  createBranch(branchName: string): void;
}

// Metadata editor
interface MetadataEditor {
  render(metadata: DocumentMetadata): void;
  save(metadata: Partial<DocumentMetadata>): void;
  validate(metadata: DocumentMetadata): ValidationResult;
}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

```typescript
// Test each engine in isolation
describe('DocumentIOWrapper', () => {
  it('should capture metadata on inbound read', async () => {
    const store = mockDocumentStore();
    const wrapper = new DocumentIOWrapper(store, mockEventBus);
    
    const doc = await wrapper.readInbound('/path/to/file.pdf', {
      source: 'email',
      purpose: 'review'
    });
    
    expect(doc.metadata).toBeDefined();
    expect(doc.metadata.editType).toBe('read');
    expect(doc.metadata.editSource).toBe('email');
  });
});
```

### 12.2 Integration Tests

```typescript
// Test engine interactions
describe('Version Control Integration', () => {
  it('should create version with full metadata', async () => {
    const versionEngine = new VersionControlEngine(mockStore, mockEventBus);
    const metadataEngine = new MetadataCaptureEngine(mockStore, mockConfig);
    
    const version = await versionEngine.createVersion(
      'doc-123',
      contentBuffer,
      { editUser: 'user@example.com', editReason: 'Updated conclusions' }
    );
    
    expect(version.metadata).toBeDefined();
    expect(version.metadata.editReason).toBe('Updated conclusions');
  });
});
```

### 12.3 E2E Tests

```typescript
// Test full workflow
describe('Document Workflow E2E', () => {
  it('should support full lifecycle with time travel', async () => {
    // 1. Create document
    const doc = await createDocument('report.pdf', content);
    
    // 2. Edit document
    await updateDocument(doc.id, newContent, { editReason: 'Fixed typo' });
    
    // 3. View diff
    const diff = await getDiff(doc.id, 'v1', 'v2');
    expect(diff.stats.linesAdded).toBe(1);
    
    // 4. Restore to v1
    const restored = await restoreVersion(doc.id, 'v1');
    expect(restored.content).toEqual(content);
  });
});
```

---

## 13. Implementation Priorities

### Phase 1: Core (Week 1-2)
1. DocumentIOWrapper
2. MetadataCaptureEngine
3. VersionControlEngine
4. Basic diff generation

### Phase 2: Advanced (Week 3-4)
1. TimeTravelEngine
2. Branch support
3. Search indexing
4. Export engine

### Phase 3: Integration (Week 5-6)
1. Cloud storage integration
2. Email integration
3. UI components
4. API endpoints

### Phase 4: Polish (Week 7-8)
1. Performance optimization
2. Compression
3. Analytics
4. Documentation

---

## 14. Open Questions for External Agent

1. **Document Format Support:** Which formats should be supported initially? (PDF, DOCX, XLSX, etc.)

2. **Conflict Resolution:** How should merge conflicts be handled when multiple users edit the same document?

3. **Performance Requirements:** What are the expected file sizes and concurrent user counts?

4. **Security Requirements:** What encryption or access control is needed?

5. **Compliance Requirements:** Are there any regulatory requirements (GDPR, HIPAA, etc.)?

6. **Integration Requirements:** What existing systems need to be integrated?

7. **UI/UX Preferences:** Any specific UI framework or design patterns to follow?

8. **Deployment Model:** How will this be deployed? (Desktop app, web app, CLI tool, etc.)

---

## 15. References

- vivim-final architecture: `docs/merged-design-v2/02-merged-architecture.md`
- Engine patterns: `docs/merged-design-v2/04-merged-engines.md`
- Schema design: `docs/merged-design-v2/03-merged-schema.md`
- Error handling: `src/errors.ts`
- ID generation: `src/ids.ts`

---

**Document Version:** 1.0
**Last Updated:** 2026-07-11
**Author:** External Agent Context Generator
