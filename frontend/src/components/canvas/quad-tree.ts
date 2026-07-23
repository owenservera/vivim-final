/**
 * components/canvas/quad-tree.ts
 * --------------------------------------------------------------------
 * Harvested from POC `html-shell-sdk-1/src/lib/canvas-sdk/quad-tree.ts`.
 * O(log n) spatial index for hit testing and viewport culling (W2).
 * Used by CanvasSurface to virtualize off-screen nodes (S91 stress).
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface QTEntry<T> {
  bb: BoundingBox;
  data: T;
}

export class QuadTree<T> {
  private boundary: BoundingBox;
  private capacity: number;
  private entries: QTEntry<T>[] = [];
  private divided = false;
  private nw: QuadTree<T> | null = null;
  private ne: QuadTree<T> | null = null;
  private sw: QuadTree<T> | null = null;
  private se: QuadTree<T> | null = null;

  constructor(boundary: BoundingBox, capacity = 8) {
    this.boundary = boundary;
    this.capacity = capacity;
  }

  private subdivide(): void {
    const { x, y, width, height } = this.boundary;
    const hw = width / 2;
    const hh = height / 2;
    const cap = this.capacity;
    this.nw = new QuadTree<T>({ x, y, width: hw, height: hh }, cap);
    this.ne = new QuadTree<T>({ x: x + hw, y, width: hw, height: hh }, cap);
    this.sw = new QuadTree<T>({ x, y: y + hh, width: hw, height: hh }, cap);
    this.se = new QuadTree<T>({ x: x + hw, y: y + hh, width: hw, height: hh }, cap);
    this.divided = true;
    for (const entry of this.entries) {
      this.insertIntoChildren(entry);
    }
    this.entries = [];
  }

  private insertIntoChildren(entry: QTEntry<T>): boolean {
    return (
      this.nw!.insert(entry) ||
      this.ne!.insert(entry) ||
      this.sw!.insert(entry) ||
      this.se!.insert(entry)
    );
  }

  insert(entry: QTEntry<T>): boolean {
    if (!this.intersects(this.boundary, entry.bb)) return false;
    if (!this.divided && this.entries.length < this.capacity) {
      this.entries.push(entry);
      return true;
    }
    if (!this.divided) this.subdivide();
    return this.insertIntoChildren(entry);
  }

  queryBB(bb: BoundingBox): T[] {
    const results: T[] = [];
    this._queryBB(bb, results);
    return results;
  }

  private _queryBB(bb: BoundingBox, results: T[]): void {
    if (!this.intersects(this.boundary, bb)) return;
    for (const entry of this.entries) {
      if (this.intersects(entry.bb, bb)) {
        results.push(entry.data);
      }
    }
    if (this.divided) {
      this.nw!._queryBB(bb, results);
      this.ne!._queryBB(bb, results);
      this.sw!._queryBB(bb, results);
      this.se!._queryBB(bb, results);
    }
  }

  queryPoint(point: Vec2): T[] {
    return this.queryBB({ x: point.x, y: point.y, width: 1, height: 1 });
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  clear(): void {
    this.entries = [];
    this.divided = false;
    this.nw = this.ne = this.sw = this.se = null;
  }

  get count(): number {
    let c = this.entries.length;
    if (this.divided) {
      c += this.nw!.count + this.ne!.count + this.sw!.count + this.se!.count;
    }
    return c;
  }
}
