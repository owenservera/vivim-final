# Issue Tracker — vivim-final

**Tracker:** GitHub Issues
**Repo:** `owenservera/vivim-final`
**CLI:** `gh` (GitHub CLI)

## Conventions

- Issues use conventional commit prefixes in title: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Reference engine names in titles when applicable: `feat(ConversationManager): add session validation`
- Labels follow the triage vocabulary in `triage-labels.md`
- Milestones map to phases in `docs/roadmap/ROADMAP.md`

## Creating Issues

```bash
gh issue create --title "feat(CdpTransport): add session validation" --body "..." --label "ready-for-agent"
```

## Reading Issues

```bash
gh issue list --label "ready-for-agent" --json number,title,labels
gh issue view 42 --json title,body,labels,state
```

## Updating Issues

```bash
gh issue edit 42 --add-label "needs-info"
gh issue close 42 --comment "Fixed in abc123"
```
