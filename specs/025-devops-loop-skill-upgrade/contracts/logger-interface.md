# Contract: Logger (FR-007)

**Module**: `src/lib/logger.ts`

**Interface**:
```ts
import type { Logger } from 'pino'

export function getLogger(engine: string): Logger
// Returns a pino child logger with `{ engine }` bound.
// Pretty-prints when NODE_ENV !== 'production'.
```

**Usage**:
```ts
import { getLogger } from '@/lib/logger.js'
const log = getLogger('ChromeGovernor')
log.info({ msg: 'slave launched', slaveId }, 'lifecycle')
```

**Output format** (production):
```json
{"level":30,"time":1234567890,"engine":"ChromeGovernor","msg":"slave launched","slaveId":"..."}
```

**Output format** (dev): pino-pretty human-readable.

**Errors**: `err` field carries `{ type, message, stack }` on `log.error`.
