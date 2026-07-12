# Interview Log — Provider Logic Metadata Adjustments

**Date:** 2026-07-11
**Interviewer:** AI (devops-roadmap)
**Respondent:** User (VIVIM.inc)
**Units:** 2.13, 2.14, 2.15, 2.16

---

## Context

User asked: "would you make any architectural adjustments now before we continue?"

AI analyzed the current schema against the provider logic lifecycle design and identified 4 targeted adjustments.

---

## Questions & Answers

### Q1: Should we add DOM interaction config fields to ProviderEndpoint?

**User:** Yes, this is needed to determine how to interact with each provider's UI.

**Decision:** Add `composerType`, `sendMethod`, `contentEditable` fields.

---

### Q2: Should we rename selectorJson → selectorsJson?

**User:** Yes, the singular name is misleading.

**Decision:** Rename field, update all references.

---

### Q3: Should we auto-compute parserHash?

**User:** Yes, manual computation is error-prone.

**Decision:** Add hash computation in ProviderRegistrar.

---

### Q4: Should we add delta path validation?

**User:** Yes, invalid paths cause silent failures.

**Decision:** Add Zod validation regex.

---

## Synthesized Atomic Specs

All 4 units approved as-is:
- 2.13: ProviderEndpoint DOM Interaction Config
- 2.14: ProviderEndpoint selectorsJson Rename
- 2.15: ProviderParser Hash Auto-computation
- 2.16: ProviderStreamConfig Delta Path Validation

---

## Approval

**Status:** ✅ Approved
**Next:** Merge to tracker, begin implementation
