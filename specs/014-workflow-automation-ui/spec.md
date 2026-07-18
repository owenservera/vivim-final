# Feature Specification: Workflow Automation UI

**Feature Branch**: `014-workflow-automation-ui`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: Visual workflow editor for creating scheduled automations without code

## User Scenarios

### User Story 1 — View Active Automations (P1)

User opens the automation dashboard and sees all scheduled workflows with their status and last run time.

**Acceptance Scenarios**:
1. **Given** automations exist, **When** dashboard loads, **Then** each automation shows: name, schedule (human-readable), last run status, and enable/disable toggle
2. **Given** an automation was disabled, **When** user toggles it on, **Then** scheduler picks it up on next cycle

### User Story 2 — Create New Automation (P1)

User creates a scheduled task with natural language schedule input.

**Acceptance Scenarios**:
1. **Given** user clicks "New Automation", **When** form opens, **Then** fields: name, description, schedule input, trigger type, action selector
2. **Given** user types "every weekday at 8am" in schedule field, **When** input is parsed, **Then** preview shows "Mon-Fri at 08:00" and cron expression "0 8 * * 1-5"
3. **Given** user selects action "Send Daily Digest", **When** automation is saved, **Then** it appears in dashboard with "Scheduled" status

### User Story 3 — Run History (P2)

User can view when automations ran and their outcomes.

**Acceptance Scenarios**:
1. **Given** an automation has run 5 times, **When** user clicks "History", **Then** timeline shows each run with timestamp, duration, and status (success/failure)

### User Story 4 — Pre-built Templates (P3)

User can create common automations from templates.

**Acceptance Scenarios**:
1. **Given** user clicks "From Template", **When** template list appears, **Then** options include: Daily Digest, Health Report, Memory Reindex, Cleanup Inactive
2. **Given** user selects "Daily Digest", **When** template is loaded, **Then** form is pre-filled with sensible defaults that can be customized

## Requirements

- **FR-001**: Dashboard MUST list all automations with status, schedule, and last run
- **FR-002**: Natural language schedule input MUST parse phrases like "every weekday at 8am" into cron
- **FR-003**: Action selector MUST show capabilities from the capability catalog
- **FR-004**: Run history MUST show timestamp, duration, and status for each execution
- **FR-005**: Enable/disable toggle MUST immediately pause/resume scheduler
- **FR-006**: Pre-built templates MUST be configurable before saving

## Success Criteria

- SC-001: New automation created in under 2 minutes
- SC-002: Natural language schedule parsed correctly in 95% of common phrases
- SC-003: Run history loads within 500ms for 1000 entries
