# Feature Specification: Data Portability (Export/Import)

**Feature Branch**: `010-data-portability`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: One-click export all user data + import from backup, with progress tracking

## User Scenarios

### User Story 1 — Export All Data (P1)

User exports all their conversations, memories, and canvas definitions in one click.

**Acceptance Scenarios**:
1. **Given** workspace settings is open, **When** user clicks "Export All Data", **Then** preview shows: conversations count, messages count, memory entries, canvas definitions
2. **Given** user selects JSON format and clicks Export, **When** export completes, **Then** browser downloads a .zip file containing conversations.json, memory.json, canvas.json, metadata.json
3. **Given** export is in progress, **When** progress reaches 100%, **Then** progress bar completes and download starts automatically

### User Story 2 — Import Data with Preview (P2)

User imports a previously exported .zip file with conflict resolution.

**Acceptance Scenarios**:
1. **Given** user clicks "Import Data" and selects a .zip file, **When** file is validated, **Then** preview shows: conversations to import, duplicates detected, new items
2. **Given** duplicates exist, **When** conflict resolution dialog appears, **Then** user can choose: skip duplicates, overwrite, or keep both
3. **Given** user confirms import, **When** import completes, **Then** imported conversations appear in conversation list

## Requirements

- **FR-001**: Export MUST bundle conversations, messages, memory records, and canvas definitions
- **FR-002**: Export MUST show item counts before generating download
- **FR-003**: Import MUST validate .zip structure before ingesting data
- **FR-004**: Import MUST detect duplicate conversations by externalId
- **FR-005**: Import MUST show progress per phase: parsing, importing conversations, importing memory, importing canvas
- **FR-006**: Import MUST require confirmation before modifying database

## Success Criteria

- SC-001: Export 1000 conversations under 30 seconds
- SC-002: Import validation completes under 5 seconds for 10MB file
- SC-003: Roundtrip (export → import) preserves all message content byte-identical
