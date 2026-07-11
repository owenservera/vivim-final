---
description: Seed the database with initial data
agent: db
---

Seed the vivim-final database.

1. Verify database connection: `bunx prisma db push --accept-data-loss` (or check migrations exist)
2. Run: `bun run seed`
3. Verify seed completed by checking a few tables: `bunx prisma studio` (or query)
4. Report what was seeded

If seed fails, check:
- Database file exists
- Migrations have been applied
- Foreign key ordering in seed files
