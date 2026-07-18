# PRD-04: Research Pipeline Bridge

**Phase:** 4 of 10
**Agent Assignment:** Agent B (Batch 2 — parallel with PRD-03, PRD-05)
**Depends On:** PRD-02 (Skill Audit)
**Blocks:** PRD-06 (Skill Refactoring)

---

## 1. Context

Two research systems exist:
1. **DevOps research** (`devops-research` skill): produces full reports, briefs, evidence, code paths in `docs/research/`. Has iterative convergence loop, freshness gates, confidence scoring.
2. **SpecKit research** (plan Phase 0): produces `research.md` inside `specs/NNN-name/`. Simpler format: Decision / Rationale / Alternatives.

These don't share output. A DevOps research brief on "CDP WebSocket patterns" isn't available to SpecKit plan Phase 0, so the plan re-investigates from scratch. Conversely, a SpecKit research.md isn't available to DevOps freshness checks.

## 2. User Stories

### US1 — Export DevOps Brief to SpecKit (P1)
**As an** agent running SpecKit plan Phase 0,
**I want** to check if a DevOps research brief already exists for a topic and import it,
**So that** I don't re-research known topics.

**Acceptance Scenarios:**
1. Given a DevOps brief at `docs/research/briefs/cdp-websocket-brief.md`, when plan Phase 0 runs research for "CDP WebSocket", then it finds and imports the brief.
2. Given no DevOps brief exists, when plan Phase 0 runs, then it produces its own `research.md` as usual.
3. When a brief is imported, then `research.md` is populated with the brief's content in SpecKit format.

### US2 — Export SpecKit Research to DevOps (P2)
**As an** agent running DevOps research freshness checks,
**I want** to find SpecKit `research.md` files and include them in freshness scanning,
**So that** SpecKit research doesn't go stale unnoticed.

**Acceptance Scenarios:**
1. Given `specs/007-conversation-resilience/research.md` with a date >6 months old, when freshness scan runs, then it's flagged as stale.
2. Given a fresh `research.md` (<6 months), when freshness scan runs, then it's marked as current.

### US3 — Bidirectional Format Conversion (P1)
**As a** bridge module,
**I want** to convert between DevOps brief format and SpecKit research.md format,
**So that** either system can consume the other's output.

**Acceptance Scenarios:**
1. Given a DevOps brief with `## Key Decisions`, `## Evidence Summary`, `## Confidence`, when converted to SpecKit format, then output has `## Decision`, `## Rationale`, `## Alternatives`.
2. Given a SpecKit `research.md` with `## Decision`, `## Rationale`, when converted to DevOps format, then output has `## Key Decisions`, `## Evidence Summary`, `## Confidence: Medium` (default).
3. Conversion preserves all substantive content — no data loss.

## 3. Functional Requirements

- **FR-001**: System MUST provide `findBriefForTopic(topic: string): Brief | null` that searches `docs/research/briefs/` for matching briefs.
- **FR-002**: System MUST provide `exportBriefForSpecKit(brief: Brief, featureDir: string): string` that converts a DevOps brief to SpecKit `research.md` format.
- **FR-003**: System MUST provide `importSpecKitResearch(featureDir: string): Brief | null` that reads SpecKit `research.md` and converts to DevOps brief format.
- **FR-004**: System MUST provide `convertBriefToSpecKit(content: string): string` for format conversion.
- **FR-005**: System MUST provide `convertSpecKitToBrief(content: string): Brief` for format conversion.
- **FR-006**: Conversion MUST preserve: topic, key decisions, evidence/sources, confidence level, date.
- **FR-007**: System MUST search for briefs by topic keyword matching (fuzzy, case-insensitive).
- **FR-008**: System MUST handle missing fields gracefully (e.g., brief without confidence → default "Medium").

## 4. Key Entities

- **Brief**: `{ topic: string, confidence: 'High'|'Medium'|'Low', sources: Source[], keyDecisions: string[], evidenceSummary: string, date: string, rawContent: string }`
- **Source**: `{ title: string, url: string, claim: string, confidence: string }`

## 5. Technical Design

### 5.1 Format Mapping

| DevOps Brief Field | SpecKit research.md Field |
|--------------------|---------------------------|
| `## TL;DR` | `## Summary` (first paragraph) |
| `## Key Decisions` | `## Decision` (numbered list) |
| `## Evidence Summary` | `## Rationale` (bullet list with sources) |
| `## Sources` | `## Sources` (same format) |
| `## Open Questions` | `## Alternatives` (if applicable) |
| `confidence: High/Medium/Low` | Comment at top: `<!-- confidence: High -->` |

| SpecKit Field | DevOps Brief Field |
|---------------|-------------------|
| `## Decision` | `## Key Decisions` |
| `## Rationale` | `## Evidence Summary` |
| `## Alternatives` | `## Open Questions` |
| (none) | `confidence: Medium` (default) |
| (none) | `date: file mtime` |

### 5.2 Module Structure

```
devops/
  research-bridge.ts          # main module (new)
  research-bridge.test.ts     # tests (new)
```

### 5.3 Topic Matching Algorithm

1. Normalize topic: lowercase, strip punctuation, split into words
2. List all files in `docs/research/briefs/`
3. For each brief filename: normalize, check if any topic word appears in filename
4. Rank by number of matching words
5. Return best match if score > threshold (0.3)

### 5.4 Integration Points

- **SpecKit plan Phase 0**: Before writing `research.md`, call `findBriefForTopic()`. If found, use `exportBriefForSpecKit()` to populate.
- **DevOps research freshness**: Scan `specs/*/research.md` in addition to `docs/research/reports/`.
- **PRD-06 (Skill Refactoring)**: Update `devops-research` SKILL.md to document the bridge.

### 5.5 Error Handling

- If `docs/research/briefs/` doesn't exist: return null (no briefs yet)
- If `specs/NNN-name/research.md` doesn't exist: return null
- If brief format is unparseable: log warning, return null
- If topic is empty: return null

## 6. Constitution Check

- [ ] This is a file-format bridge — reads/writes markdown. No DB, no capabilities.
- [ ] TypeScript strict, no `any`.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/research-bridge.test.ts`)
- Test `findBriefForTopic` finds matching brief
- Test `findBriefForTopic` returns null for no match
- Test `exportBriefForSpecKit` produces valid research.md format
- Test `importSpecKitResearch` reads and converts correctly
- Test round-trip: brief → SpecKit → brief preserves key content
- Test round-trip: research.md → DevOps → research.md preserves key content
- Test handles missing fields gracefully
- Test topic matching is case-insensitive
- Test topic matching handles partial matches

### Test Fixtures
- Create `tests/fixtures/research-briefs/` with sample briefs
- Create `tests/fixtures/specs/` with sample research.md files

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/research-bridge.ts` | CREATE | Bridge module |
| `tests/unit/engines/research-bridge.test.ts` | CREATE | Unit tests |
| `tests/fixtures/research-briefs/` | CREATE | Test fixtures |
| `tests/fixtures/specs/` | CREATE | Test fixtures |
| `devops/index.ts` | MODIFY | Add exports |

## 9. Success Criteria

- [ ] `findBriefForTopic("cdp websocket")` finds a matching brief
- [ ] `exportBriefForSpecKit(brief, dir)` produces a valid `research.md`
- [ ] `importSpecKitResearch(dir)` converts to DevOps brief format
- [ ] Round-trip conversion preserves decisions, evidence, confidence
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/research-bridge.test.ts` passes

## 10. Parallelization Notes

**Depends on:** PRD-02 (Skill Audit) — needs the audit to confirm which skills need research bridging.
**Blocks:** PRD-06 (Skill Refactoring uses bridge to update devops-research and devops-roadmap skills).
**Can start with:** Interface + format conversion logic + tests. The integration into SpecKit plan Phase 0 happens in PRD-06.
