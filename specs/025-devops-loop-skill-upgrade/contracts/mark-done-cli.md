# Contract: devops mark done (FR-001)

**CLI**: `bun run devops mark <id> done [<message>]`

**Behavior**:
1. Validate `<id>` exists and is `in_progress`.
2. Transition state to `done` (existing state machine).
3. Append PROGRESS.md audit line with resolved `<sha>` (no `[PENDING-COMMIT]`).
4. `git add -A`
5. `git commit -m "<type>(<scope>): <message>"` (default message if none provided)
6. Exit 0 on success.

**Errors**:
- Unit not found → exit 1, error message.
- Unit not `in_progress` → warn, still attempt commit if state allows.
- Git commit fails → exit 1, preserve state (no partial commit).

**Idempotency**: Calling on already-`done` unit warns and exits 0 (no double commit).
