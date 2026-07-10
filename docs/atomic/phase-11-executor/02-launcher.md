# Unit 11.2: Chrome Launcher

**Phase:** 11 | **File:** `src/executor/launcher.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Cross-platform Chrome binary launcher
**Source:** cap-store `src/executor/launcher.ts` (205 lines, port to vivim-final)

## Purpose
Cross-platform Chrome/Chromium binary discovery and process spawning. Auto-detects Chrome per OS (macOS, Windows, Linux) with configurable override. Supports headless, hidden (windowless), and visible modes. Manages profile isolation per provider+account.

## Interface
```typescript
export interface LaunchResult {
  process: ChildProcess;
  debugPort: number;
  pid: number;
  profileDir: string;
}

export interface ChromeLaunchOptions {
  visible?: boolean;
  profileDir?: string;
  debugPort?: number;
  extraArgs?: string[];
  userDataDir?: string;
  disableGpu?: boolean;
  windowSize?: { width: number; height: number };
}

export async function launchChrome(opts?: ChromeLaunchOptions): Promise<LaunchResult>;
export async function findChromeBinary(): Promise<string>;
export function getDefaultChromePaths(): string[];
export function buildChromeArgs(opts: ChromeLaunchOptions): string[];
export async function killChrome(pid: number): Promise<void>;
export async function isChromeRunning(pid: number): Promise<boolean>;
```

## Required Capabilities
- Auto-detect Chrome binary per OS (macOS: `/Applications/Google Chrome.app/...`, Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`, Linux: `google-chrome` or `chromium-browser`)
- Config override via `CHROME_PATH` env var or passed path
- Cross-platform argument building: `--remote-debugging-port=N`, `--user-data-dir=DIR`, `--no-first-run`, `--disable-extensions`, etc.
- Headless mode (`--headless=new`) vs visible mode
- Hidden mode on Windows (no window) via `--window-position=-32000,-32000`
- Profile isolation: unique profile dir per call
- Port allocation: use specified port or find available port
- Process tracking (PID for cleanup)
- Graceful kill (SIGTERM then SIGKILL after timeout)
- Timeout detection (Chrome must start within N seconds)

## Tests
- [ ] `findChromeBinary()` returns non-empty path on current OS
- [ ] `launchChrome()` spawns Chrome process, returns debugPort
- [ ] `launchChrome({ visible: true })` launches visible window
- [ ] `launchChrome({ visible: false })` launches headless/hidden
- [ ] `killChrome(pid)` terminates process
- [ ] `buildChromeArgs()` produces correct args including remote debugging port
- [ ] Chrome at debugPort responds to CDP WebSocket connection

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/launcher.test.ts` passes
- Chrome launches and CDP port responds within 15s (requires Chrome installed)

## Port Notes
Port from cap-store `src/executor/launcher.ts`. Use `Bun.spawn()` for process creation (cap-store uses Node's `child_process.spawn`). Adapt OS detection to use `process.platform`. Keep cross-platform Chrome path logic.
