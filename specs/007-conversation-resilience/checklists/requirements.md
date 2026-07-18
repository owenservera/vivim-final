# Requirements Checklist — Conversation Resilience

**Feature**: `007-conversation-resilience` · **Spec**: [spec.md](../spec.md)

Quality checklist for the *requirement writing* (not implementation tests). Toggled by `clarify`/`analyze`.
Items use the form: "Are [requirement] defined for [scenario]?" — prohibited: "Verify/Test/Confirm … behavior".

- [x] CHK001 Completeness: Are pre-flight checks (Chrome liveness, CDP connection, session validity) defined for the send pipeline? [Spec §FR-001]
- [x] CHK002 Completeness: Is the Chrome-crash recovery message + Retry action defined? [Spec §FR-002, US1]
- [x] CHK003 Completeness: Is the session-expiry re-login prompt defined? [Spec §FR-003, US2]
- [x] CHK004 Completeness: Is the circuit-open "temporarily unavailable" state with retry time defined? [Spec §FR-004, US3]
- [x] CHK005 Completeness: Is the single auto-reconnect attempt (FR-005) defined before surfacing an error? [Spec §FR-005]
- [x] CHK006 Consistency: Are all resilience states required to surface as UI slots, not hardcoded strings? [Spec §FR-006]
- [x] CHK007 Unambiguous: Are success criteria measurable and tech-agnostic? [Spec §SC-001..003]
- [x] CHK008 Consistency: Does SC-003 (no raw stack trace) conflict with any requirement? [Spec §SC-003]
