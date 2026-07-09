// devops/index.ts
// CLI entry: `bun run devops <cmd> [args]`
//
//   select            -> print next implementable unit as JSON (or "null")
//   mark <id> <s>    -> transition state: pending|in_progress|done|blocked
//   gate             -> run quality gate, print JSON, exit non-zero on fail
//   report           -> print progress summary

import { selectNext } from "./select.ts";
import { markUnit } from "./mark.ts";
import { runGate } from "./gate.ts";
import { report } from "./report.ts";

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "select": {
      const sel = await selectNext();
      console.log(sel ? JSON.stringify(sel, null, 2) : "null");
      break;
    }
    case "mark": {
      const [id, state] = args;
      if (!id || !state) {
        console.error("usage: devops mark <id> <pending|in_progress|done|blocked>");
        process.exit(1);
      }
      await markUnit(id, state as "pending" | "in_progress" | "done" | "blocked");
      console.log(`marked ${id} -> ${state}`);
      break;
    }
    case "gate": {
      const res = await runGate();
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.pass ? 0 : 1);
    }
    case "report": {
      console.log(await report());
      break;
    }
    default: {
      console.error("usage: bun run devops <select|mark|gate|report>");
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
