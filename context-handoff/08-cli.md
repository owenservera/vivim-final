# CLI Usage

## Entry Point
`bun src/cli/index.ts <command> [args]`

## Commands

| Command | Args | Purpose |
|---------|------|---------|
| interpret | `<text>` | NL → capability execution |
| execute | `<capability-id>` | Direct capability execution |
| conversations | list/create/get | Conversation CRUD |
| providers | list/register | Provider management |
| health | check/providers | Health status |
| config | get/set/delete | Configuration |

## Example Usage
```bash
# Interpret natural language
bun src/cli/index.ts interpret "chat with claude"

# Execute capability directly
bun src/cli/index.ts execute cap:claude:chat --prompt "hello"

# List conversations
bun src/cli/index.ts conversations list

# Check provider health
bun src/cli/index.ts health providers
```

## CLI Generation
All capabilities auto-generate CLI commands via UnifiedCapabilityRegistry:
- See `src/engines/unified-registry.ts`
- CLI registration in `src/cli/commands/`