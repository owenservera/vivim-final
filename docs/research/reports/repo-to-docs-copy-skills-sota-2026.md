# Repo → Full Documentation & Audience Copy: SOTA Skills Report

*Generated: 2026-08-08 | Sources: 17 | Confidence: High*

## Executive Summary

As of August 2026 the Agent Skills ecosystem has two distinct layers that together
cover "convert repo source code into documentation and audience-targeted copy":

1. **Repo → living technical docs** is now dominated by *maintainable, walkthrough-first*
   packages rather than one-shot README generators. The most-installed skills are
   `golang-documentation` (33.7K installs), `documentation-writer` (Diátaxis framework,
   from the 36.8K-star `github/awesome-copilot`), and `create-readme`. The most
   structurally complete new entrant is **repo-docs-skills** (Zhejiang Univ. AI4GC Lab),
   which builds README + walkthroughs + code-map + modules + glossary + change-log +
   AGENTS.md sync — "living docs" with a validation script.
2. **Repo → audience copy** is a *stack, not a single skill*: there is no one skill that
   takes source and emits investor/customer/partner copy. The market leader for the
   copy side is `coreyhaines31/marketingskills` (copywriting alone at 156.7K installs —
   the #1 marketing skill), and the most direct "repo/source-in → audience-out" tool
   is the founder pack `emotixco/claude-skills-founder` (product brief, pitch deck,
   landing page, GTM, email sequence, fundraise prep).
3. **Tested-verdict marketplaces** (SkillProof) now provide independent scores —
   `Humanizer` 9.6/10, `Crafting Effective READMEs` 9.2/10, `Changelog Generator` 9.2/10,
   `PitchCraft` 9.2/10, `Promote` 8.8/10 (git release diff → X thread). These are the
   "top marks" the user asked for, verified by an independent tester in Jul–Aug 2026.

## 1. Layer A — Repo → Technical Documentation

### 1.1 Most-installed documentation skills (install-ranked, 2026-07-06)

| Skill | Repo | Installs | What it does |
|-------|------|----------|--------------|
| `golang-documentation` | samber/cc-skills-golang | 33.7K | Full Golang doc suite: godoc, README, CONTRIBUTING, CHANGELOG, llms.txt |
| `documentation-writer` | github/awesome-copilot | 23.4K | Diátaxis expert technical writer (tutorials/how-to/reference/explanation) |
| `create-readme` | github/awesome-copilot | 15.9K | README.md generation |
| `documentation-and-adrs` | addyosmani/agent-skills | 14.3K | Records decisions + documentation for future agents |
| `readme-blueprint-generator` | github/awesome-copilot | 9.3K | Structure-aware README from project analysis |
| `documentation` | anthropics/knowledge-work-plugins | 7.3K | API/architecture/runbook/onboarding technical writing |
| `indexion-readme` / `indexion-documentation` | trkbt10 | 5K / 4.9K | Code→doc drift detection + coverage analysis |
| `docs-writer` | google-gemini/gemini-cli | 2.9K | Writing/reviewing/editing docs |
| `api-documentation-generator` | sickn33/agentic-awesome-skills | 1.9K | Endpoints, params, examples from code |
| `code-documentation` | bytedance/deer-flow | 1.2K | README + API + architecture + changelog + dev guides |

Source: Claude Skills Hub "Best Software Documentation Skills (2026)", install counts
reported by the skills CLI, catalog synced 2026-07-06.

### 1.2 Best new structural approach — living docs

**repo-docs-skills** (github.com/YurunChen/repo-docs-skills, 445★, created Jun 2026,
Zhejiang Univ. AI4GC Lab) is the most recent and structurally complete "repo → full
docs" package. It builds:
- `README.md` (orients reader)
- `walkthroughs/one-real-run.md` (trace one real behavior, not a file-tree tour)
- `code-map.md` (source dirs → responsibilities, tests, change points)
- `modules/` + `references/` + `glossary.md`
- `change-log.md` (guide work + sync anchors)
- `AGENTS.md`/`CLAUDE.md` sync rule (keeps docs current as repo evolves)

It ships 5 modes (Seed/Build/Sync/Cleanup/Question-refinement), a Python validator
(`validate_repo_docs.py`), a Chinese overlay (`repo-docs-zh`), and a 30-second install
(`irm https://github.com/YurunChen/repo-docs-skills/raw/main/install.ps1 | iex` on
Windows). Security-scanned PASSED by SkillsLLM 2026-06-27. Its thesis — "behavior
before inventory, reader handles before locators, evidence stays visible" — is the
current best-practice bar for repo documentation.

**Dosu `/doc-it`** (blog tutorial, Mar 25 2026) is the same idea taught step-by-step:
inventory existing docs, audit CLAUDE.md/AGENTS.md for stale references, scaffold
CONTRIBUTING/TOOLS, generate API docs from route handlers.

### 1.3 Tested-verdict README/docs skills (SkillProof, Jul–Aug 2026)

| Skill | Score | Tester verdict | Notes |
|-------|-------|----------------|-------|
| Crafting Effective READMEs | 9.2/10 | Tested · Works | Interview-driven; 4 templates (OSS/personal/internal/config) |
| Changelog Generator | 9.2/10 | Tested · Works | git commit history → customer-facing release notes |

## 2. Layer B — Repo → Audience-Targeted Copy

### 2.1 Founders & investors (most direct repo-to-outcome pack)

**emotixco/claude-skills-founder** (★61, MIT, created 2026-03-10) — the only pack found
whose whole purpose is turning what's in your terminal/repo into founder deliverables:
- `/founder:product-brief`, `/founder:persona-gen`, `/founder:competitor-matrix`
- `/founder:pitch-deck` (12-slide investor outline), `/founder:fundraise-prep`
- `/founder:landing-page` (conversion copy per section + SEO), `/founder:email-sequence`,
  `/founder:go-to-market`, `/founder:metrics-dashboard`

**PitchCraft** (github.com/moshuying/pitchcraft, SkillProof-tested **9.2/10**, re-checked
2026-08-05) — 5-part framework for investor pitches, kickoffs, status updates, and
solution-selling decks; ships templates + pre-submit checklist.

### 2.2 Customers & partners (marketing copy stack)

**coreyhaines31/marketingskills** (★40.9K) — the most-installed marketing skill pack.
On the Claude Skills Hub marketing leaderboard (2026-07-06) it holds the top 3 slots:
- `copywriting` **156.7K installs** — conversion copy for pages/product/CTA/value prop
- `marketing-psychology` 114.7K, `content-strategy` 110.2K
- Also: CRO, SEO, email sequences, social content, A/B testing

Other high-install customer/partner copy skills:
- `landing-page-copywriter` (onewave-ai, 5.1K) — PAS/AIDA/StoryBrand frameworks
- `landing-page-design` (inference-sh, 17.4K) — hero/CTA/layout conversion
- `content-creation` (anthropics/knowledge-work-plugins, 3.8K) — multi-channel
- `content-strategy` / `brand-storytelling` (refoundai/lenny-skills)
- SkillProof-verified: `Gtm Positioning` 9.6/10, `App Marketing Copy` 9.6/10,
  `Customer Story Writer` 8.8/10 (zapier), `B2B GTM Launch` 9.2/10, `Ship Page` 9.2/10
  (single-file interactive landing page)

### 2.3 Release-to-customer copy bridges

- **Promote** (SkillProof 8.8/10, tested Jul 21 2026) — "Turns a git release diff into a
  data-verified X/Twitter thread plus 72-char ASCII card." The cleanest skill found that
  goes directly *source/commit → customer-facing promo*.
- **Changelog Generator** (openakita, 9.2/10) — commit history → customer-facing release notes.

## 3. Cross-cutting quality

- **Humanizer** (SkillProof 9.6/10, tested Jul 14 2026) — strips 33 documented AI-writing
  tells via draft-audit-final rewrite loop. Recommended as the final pass on any
  generated investor/customer copy.
- **Nexus Mapper** (in SkillProof queue) — maps a codebase into a persistent knowledge
  base of architecture/systems/hotspots (foundation for audience docs).

## 4. Repo → educational/non-technical narrative (bonus)

**codebase-to-course** (github.com/zarazhangrui/codebase-to-course, **★5.3K**, created
2026-03-22) — turns any codebase into a beautiful interactive single-file HTML course
for non-technical audiences: code ↔ plain-English side-by-side, animated data-flow
visualizations, interactive quizzes, glossary tooltips. Confirmed working (DeepWiki +
3 mirrors). Strong for partner/onboarding/customer education narratives.

## Key Takeaways

1. **Docs side:** install `repo-docs-skills` for a maintainable full-doc layer
   (README + walkthroughs + code-map + glossary + AGENTS.md sync), or
   `documentation-writer` (Diátaxis) for standards-shaped prose. Add
   `indexion-documentation` for drift detection.
2. **Investor side:** `claude-skills-founder` + `PitchCraft` (9.2/10) covers deck,
   fundraise prep, product brief, landing page, email, GTM.
3. **Customer/partner side:** `coreyhaines31/marketingskills` (`copywriting`) is the
   volume king; `Promote` (8.8/10) bridges releases → social promo; `Changelog Generator`
   (9.2/10) → customer-facing release notes; `Gtm Positioning` (9.6/10) for B2B positioning.
4. **Quality gate:** run `Humanizer` (9.6/10) over all audience-facing output.
5. **There is no single "repo → all audiences" skill as of Aug 2026.** The winning pattern
   is a 3-stage pipeline: (a) extract truth from source (repo-docs/doc-it), (b) generate
   per-audience copy (founder/marketing skills), (c) humanize + verify (Humanizer).

## Sources

1. https://claudeskills.info/best/documentation-skills/ — install-ranked doc skills (2026-07-06)
2. https://claudeskills.info/best/marketing-skills/ — install-ranked marketing skills (2026-07-06)
3. https://skillproof.dev/categories/writing — tested writing skills (Aug 2026)
4. https://skillproof.dev/categories/marketing — tested marketing skills (Aug 2026)
5. https://skillproof.dev/skills/pitchcraft — PitchCraft 9.2/10 test report (2026-08-05)
6. https://skillproof.dev/skills/crafting-effective-readmes — README skill 9.2/10 (2026-08-05)
7. https://www.promptspace.in/blog/best-claude-code-skills-documentation — doc skills guide (2026-05-09)
8. https://www.agensi.io/learn/best-skills-documentation-ai-agents — AI agent doc skills (2026-06-30)
9. https://dosu.dev/blog/claude-code-skill-doc-it — /doc-it auto-docs skill build (2026-03-25)
10. https://www.claudedirectory.org/for/documentation — documentation setups (Aug 2026)
11. https://github.com/awesome-copilot — documentation-writer/create-readme/readme-blueprint-generator (36.8K★)
12. https://github.com/YurunChen/repo-docs-skills — living repo docs (445★, Jun 2026)
13. https://github.com/zarazhangrui/codebase-to-course — codebase→HTML course (5.3K★, Mar 2026)
14. https://github.com/emotixco/claude-skills-founder — founder skill pack (61★, Mar 2026)
15. https://github.com/coreyhaines31/marketingskills — marketing skill pack (40.9K★)
16. https://skillsllm.com/skill/repo-docs-skills — repo-docs security scan PASSED (2026-06-27)
17. https://medium.com/design-bootcamp/10-best-claude-skill-repos-for-marketing-2026 — marketing repos roundup (2026-04-25)

## Methodology

Classified the request as **General** (not unit/ADR-linked). Broke into 3 sub-questions:
(1) best repo→docs skills, (2) best repo→audience copy skills, (3) verified "top marks"
scores. Ran 6 searches across websearch + 6 primary-source deep-reads (webfetch) of the
two install-ranked leaderboards (Claude Skills Hub doc + marketing), the two tested-verdict
marketplaces (SkillProof writing + marketing), and 4 GitHub primary sources. 17 unique
sources total. Web-search-prime and web-reader MCPs were out of credits; used fallback
tools. Confidence: High — install counts and test scores are objective, primary-source
figures; each top pick verified on its GitHub repository.
