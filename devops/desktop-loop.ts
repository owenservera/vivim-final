// devops/desktop-loop.ts
// Thin backward-compat entry. All logic lives in devops/desktop/.
//
// Usage:
//   bun run devops desktop-loop --version 0.1.1          # full run
//   bun run devops desktop-loop --version 0.1.1 --resume  # continue after a fix
//   bun run devops desktop-loop --reset                   # clear the ledger
//   bun run devops desktop-loop status                    # granular action
//   bun run devops desktop-loop build --version 0.1.1     # build only
//   bun run devops desktop-loop install --version 0.1.1   # install only
//   bun run devops desktop-loop launch                    # launch + readyz
//   bun run devops desktop-loop probe /health             # HTTP probe
//   bun run devops desktop-loop test smoke                # battery test
//
// Every action returns {action, ok, detail, data, artifacts} and exits 0/1.

export { runDesktopLoop, printLoopResult, runDesktopCli } from './desktop/index.js'
export type { GateResult, GateStatus, CycleRecord, DesktopLoopState } from './desktop/state.js'
