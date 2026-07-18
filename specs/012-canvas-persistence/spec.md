# Feature Specification: Canvas Persistence

**Feature Branch**: `012-canvas-persistence`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: DB-backed canvas mirror so layer positions survive server restarts

## User Scenarios

### User Story 1 — Layout Survives Restart (P1)

User arranges canvas layers, restarts the app, and their layout is preserved.

**Acceptance Scenarios**:
1. **Given** user drags a layer to position (300, 400) and resizes to 600x400, **When** server restarts, **Then** layer is at position (300, 400) with size 600x400
2. **Given** canvas loads for first time after app update, **When** layout is restored, **Then** all layers are at their last-saved positions

### User Story 2 — Auto-Save on Drag (P1)

Layout saves automatically when user finishes dragging a layer.

**Acceptance Scenarios**:
1. **Given** user drags a layer to new position, **When** drag stops and 500ms debounce passes, **Then** "Layout saved" checkmark appears briefly
2. **Given** rapid drags in sequence, **When** only last position is saved, **Then** only one POST is sent (debounced)

### User Story 3 — Manual Save/Reset (P2)

User can explicitly save the current layout or reset to default.

**Acceptance Scenarios**:
1. **Given** canvas toolbar, **When** user clicks "Save Layout", **Then** current positions are persisted and "Layout saved" confirmation appears
2. **Given** user clicks "Reset to Default", **When** confirmation dialog appears, **Then** all layers return to seed positions

## Requirements

- **FR-001**: CanvasMirror MUST persist layer positions, sizes, visibility, and lock state to DB
- **FR-002**: Layout MUST auto-save on every drag stop with 500ms debounce
- **FR-003**: Layout MUST restore on canvas mount from DB mirror store
- **FR-004**: System MUST show "Saving..." and "Saved" indicators in status bar
- **FR-005**: CanvasMirrorStoreImpl MUST implement CanvasMirrorStore contract with Prisma

## Success Criteria

- SC-001: Layout persists across server restart with zero data loss
- SC-002: Auto-save completes within 200ms of drag stop
- SC-003: Canvas restore completes within 1 second of mount
