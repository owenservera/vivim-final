/**
 * components/canvas/command-stack.ts
 * --------------------------------------------------------------------
 * Harvested from POC `html-shell-sdk-1/src/lib/canvas-sdk/command-stack.ts`.
 * Enforces state integrity: every canvas mutation (drag, resize, spawn,
 * dismiss) goes through a Command. Stack capped at `maxSize` entries.
 * Powers `useCanvasHistory` (undo/redo).
 */

export interface Command {
  id: string;
  description: string;
  execute(): void;
  undo(): void;
}

export class CommandStack {
  private past: Command[] = [];
  private future: Command[] = [];
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  execute(cmd: Command): void {
    cmd.execute();
    this.past.push(cmd);
    if (this.past.length > this.maxSize) this.past.shift();
    this.future = []; // new branch clears redo
  }

  undo(): Command | null {
    const cmd = this.past.pop();
    if (cmd) {
      cmd.undo();
      this.future.push(cmd);
    }
    return cmd ?? null;
  }

  redo(): Command | null {
    const cmd = this.future.pop();
    if (cmd) {
      cmd.execute();
      this.past.push(cmd);
    }
    return cmd ?? null;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  getUndoDescription(): string | null {
    return this.past[this.past.length - 1]?.description ?? null;
  }

  getRedoDescription(): string | null {
    return this.future[this.future.length - 1]?.description ?? null;
  }

  get size(): number {
    return this.past.length;
  }
}
