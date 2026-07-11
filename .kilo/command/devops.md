---
description: Run the agentic DevOps orchestrator loop to autonomously implement atomic units
agent: build
---

Load the devops skill and run the agentic DevOps orchestrator loop: read docs/atomic/01-tracker.md, then repeatedly `bun run devops select` to get the next unit, implement it per its atomic file, run `bun run devops gate`, and on pass run `bun run devops mark <id> done` + commit. Continue until all units are done or only blocked units remain. Never pause to ask.
