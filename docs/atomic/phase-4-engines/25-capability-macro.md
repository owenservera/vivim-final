# Unit 4.25: CapabilityMacro support

**Phase:** 4 | **File:** `src/engines/capability-macro.ts`
**Depends:** 4.7 HarnessRuntime, 4.3 CapabilityResolutionEngine | **Produces:** Stored, reusable capability DAG macros
**Source:** `03-merged-schema.md` §L9 (`capability_macro`), `01-merged-epic.md` §Capability macros (design slot)

## Purpose
New engine that lets users save a named, reusable capability sequence (`dag_json`) scoped to a `provider_id` and invoke it as a single capability. `capability_macro` holds the DAG; `CapabilityMacroEngine` provides CRUD, activation toggle, and execution by delegating the serialized DAG to `HarnessRuntime.executeDag()`. This is the engine-side owner of `capability_macro` — no other unit reads/writes it.

Macros are a user-facing design slot; the engine only needs to store, list, toggle, and run them.

## Interface
```typescript
interface CapabilityMacroRow {
  id: string;
  name: string;
  description: string | null;
  providerId: string | null;     // null = provider-agnostic
  dagJson: string;               // serialized HarnessDAG
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface MacroRunResult {
  macroId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}

class CapabilityMacroEngine {
  constructor(
    private store: CapabilityMacroStore,
    private runtime: HarnessRuntime,
  ) {}

  async define(input: Omit<CapabilityMacroRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<CapabilityMacroRow>;
  async list(opts?: { providerId?: string; activeOnly?: boolean }): Promise<CapabilityMacroRow[]>;
  async get(id: string): Promise<CapabilityMacroRow | null>;
  async toggle(id: string, isActive: boolean): Promise<void>;
  async remove(id: string): Promise<void>;
  async run(macroId: string, input: Record<string, unknown>): Promise<MacroRunResult>;
}
```

## Store Contract
```typescript
interface CapabilityMacroStore {
  list(opts?: { providerId?: string; activeOnly?: boolean }): Promise<CapabilityMacroRow[]>;
  get(id: string): Promise<CapabilityMacroRow | null>;
  create(input: CapabilityMacroRow): Promise<CapabilityMacroRow>;
  update(id: string, patch: Partial<CapabilityMacroRow>): Promise<void>;
  delete(id: string): Promise<void>;
}
```

## Tests
- [ ] `define()` persists a macro and `list()` returns it
- [ ] `toggle()` flips `isActive`; `list({ activeOnly: true })` filters correctly
- [ ] `run()` deserializes `dagJson` and delegates to `HarnessRuntime.executeDag()`
- [ ] `run()` on an inactive macro returns `ok: false` without dispatching
- [ ] `remove()` deletes the macro; `get()` returns null after

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `CapabilityMacroStore` + `HarnessRuntime`
- Sole owner of `capability_macro`
