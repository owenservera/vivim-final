---
description: Create a new Prisma migration with descriptive name
agent: db
---

Create a new Prisma migration for the vivim-final project.

Migration name: $ARGUMENTS

Steps:
1. Verify `prisma/schema.prisma` has the intended changes
2. Run `bunx prisma migrate dev --name $ARGUMENTS`
3. Read the generated SQL in `prisma/migrations/` to verify correctness
4. Run `bunx prisma generate` to update the client
5. Report what changed

If no migration name provided, prompt for one.
