# Repo → Full Documentation & Audience Copy — Brief

**Source:** [full report](../reports/repo-to-docs-copy-skills-sota-2026.md)
**Confidence:** High | **Sources:** 17 | **Date:** 2026-08-08

## TL;DR

No single skill converts a repo into investor/customer/partner copy. The best recent
(2026) approach is a 3-stage stack: **(1)** extract/maintain truth from source with
`repo-docs-skills` (living docs) or `documentation-writer` (Diátaxis), **(2)** generate
per-audience copy with founder/marketing skills, **(3)** de-AI the output with
`Humanizer` (9.6/10).

## Key Decisions

1. **Docs layer → repo-docs-skills** (ZJU AI4GC Lab, Jun 2026): README + walkthroughs +
   code-map + modules + glossary + change-log + AGENTS.md sync. Only pack with a validator
   script and "living docs" sync modes. Windows install: `irm <raw>/install.ps1 | iex`.
2. **Investor copy → emotixco/claude-skills-founder** (pitch-deck, fundraise-prep,
   product-brief, landing-page, email-sequence, GTM) **+ PitchCraft** (SkillProof 9.2/10).
3. **Customer/partner copy → coreyhaines31/marketingskills** (`copywriting` 156.7K
   installs — #1 marketing skill) + **Promote** (8.8/10, git release diff → X thread)
   + **Changelog Generator** (9.2/10, commit history → customer release notes).
4. **Non-technical/educational → codebase-to-course** (5.3K★): interactive HTML course
   with plain-English code translation + quizzes.

## Evidence Summary

- `golang-documentation` 33.7K installs; `documentation-writer` 23.4K (★36.8K repo) (High)
- repo-docs-skills security-scanned PASSED, 445★, created Jun 2026 (High)
- copywriting 156.7K installs = #1 marketing skill on install leaderboard (High)
- SkillProof tested: Humanizer 9.6, Crafting Effective READMEs 9.2, Changelog Gen 9.2,
  PitchCraft 9.2, Promote 8.8, GTM Positioning 9.6, App Marketing Copy 9.6 (High)
- codebase-to-course ★5.3K, confirmed working via DeepWiki + 3 mirrors (High)

## Open Questions

- Freshness of `claude-skills-founder` (4 commits, Mar 2026 — low maintenance signal).
- Whether repo-docs-skills's Python validator needs Python in the runtime env.
- No verified "repo → partner one-pager/battlecard" skill; GTM/battlecard coverage is
  via SkillProof `Competitive Intel` (8.4/10) and `B2B GTM Launch` (9.2/10) — untested in-repo.

## Used In

- General research (not unit/ADR-linked). Candidate to inform a future "documentation &
  release-copy pipeline" capability or devops unit if the project adopts one.
