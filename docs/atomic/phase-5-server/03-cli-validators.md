# Unit 5.7-5.12: CLI Engine + Commands + Bridges + Zod Validators

**Phase:** 5 | **Files:** `src/cli/` (15 files), `src/schema/validators.ts`
**Depends:** Phase 5 Server | **Produces:** CLI entry point, command registry, 9 commands, 3 bridges, Zod validation
**Source:** `07-merged-api.md` §§A, E

## CLI Architecture

### CommandRegistry (`src/cli/command-registry.ts`)
```typescript
interface CliCommand {
  name: string;
  description: string;
  subsystem: 'cap-store' | 'backend' | 'extension';
  schema: ZodSchema;
  handler: (args: unknown) => Promise<CliOutput>;
  examples: string[];
}

class CommandRegistry {
  register(command: CliCommand): void;
  find(name: string): CliCommand | undefined;
  list(subsystem?: string): CliCommand[];
}
```

### CLI Entry (`src/cli/index.ts`)
- Parses subcommand from argv
- Routes to CommandRegistry
- Outputs via OutputFormatter (--json | --pretty | --table | --watch)
- Pipeline engine: cmd1 | cmd2 | cmd3 (Unix-style pipe)
- Exit code 0 on success, 1 on error

### Output Formatter (`src/cli/output-formatter.ts`)
```typescript
type OutputMode = 'json' | 'pretty' | 'table' | 'watch';
class OutputFormatter {
  format(data: unknown, mode: OutputMode): string;
}
```

### Bridges (3 files)
- `cap-store-bridge.ts` — HTTP client to cap-store REST API
- `backend-bridge.ts` — HTTP client to Rust backend
- `extension-bridge.ts` — Native messaging for Chrome extension

### Commands (9 files)
```
providers    → cap-store providers list/show
fleet        → cap-store fleet status/start/stop
conversations→ cap-store conversations list/create/send
admin        → cap-store admin seed/audit/drift
config       → cap-store config get/set/history
health       → cap-store telemetry health
version      → cap-store version
telemetry    → cap-store telemetry summary/compare
system       → cap-store serve
```

### 22 CLI Commands
```
cap-store providers list [--json] [--active]
cap-store providers show <slug> [--json]
cap-store fleet status [--json]
cap-store fleet start <providerId> <accountId>
cap-store fleet stop <providerId> <accountId>
cap-store conversations list [--provider <id>] [--limit <n>]
cap-store conversations create <providerId> [--title <t>]
cap-store conversations send <id> --message "<text>"
cap-store admin seed [--source <slug|all>]
cap-store admin audit <providerId> [--limit <n>]
cap-store admin drift [--provider <id>]
cap-store config get <engineId>
cap-store config set <engineId> <json>
cap-store config history <engineId>
cap-store telemetry health <providerId> [--days <n>]
cap-store telemetry summary <providerId> --from <date> --to <date>
cap-store telemetry compare --from <date> --to <date>
cap-store bindings history <bindingId>
cap-store bindings compare <bindingId>
cap-store capabilities versions <capabilityId>
cap-store capabilities rollback <capabilityId> <version>
cap-store version
cap-store serve
```

## Zod Validators (`src/schema/validators.ts`)
```typescript
// All write endpoints validated with Zod schemas:
export const CreateAccountSchema = z.object({ email: z.string().email() });
export const SendMessageSchema = z.object({ message: z.string().min(1).max(100000) });
export const CreateConversationSchema = z.object({ providerId: z.string().min(1), title: z.string().max(200).optional() });
export const UpdateConversationSchema = z.object({ title: z.string().max(200).optional(), state: z.enum(['active','archived','deleted']).optional() });
export const FleetStartSchema = z.object({ providerId: z.string().min(1), accountId: z.string().min(1) });
export const FleetStopSchema = z.object({ providerId: z.string().min(1), accountId: z.string().min(1) });
export const ConfigUpdateSchema = z.object({ config: z.record(z.unknown()), scopeType: z.enum(['global','provider','account','engine']).optional(), scopeId: z.string().optional() });
export const RollbackSchema = z.object({ version: z.number().int().positive() });
export const CapabilitySearchSchema = z.object({ query: z.string().min(1).max(100), planTier: z.enum(['free','pro','max','enterprise']).optional() });
```

## Tests
- [ ] CLI `providers list` returns providers in --json format
- [ ] CLI `conversations send` completes and returns SendResult
- [ ] CLI `admin seed` seeds all providers
- [ ] CLI `config get` returns config for engine
- [ ] CLI pipe: `providers list | admin seed` works
- [ ] Zod: invalid email rejected, valid message accepted
- [ ] Zod: invalid providerId rejected (empty string)

## Gate
- `bunx tsc --noEmit` passes
- All CLI commands work against test server
- Zod schemas validate all API request bodies
