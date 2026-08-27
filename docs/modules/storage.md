# Storage Module

**Purpose:** Data persistence and dual-database architecture for vivim-final.

## Description
Implements a dual-database strategy with separate databases for different concerns:
- Primary database for core application data
- Secondary database for archival/cold storage

## Public Interface
- Prisma ORM access via `@prisma/client`
- Database connection management
- Migration and seeding scripts

## Internal Gotchas
- Dual-db architecture requires explicit client selection for cross-boundary operations
- Schema versioning is manual - see `docs/architecture/dual-db.md`
- Seed data lives in `seeds/` but is compiled into desktop snapshot

## Owner: VIVIM.inc
## Last Reviewed: 2026-08-15