// tests/helpers/prisma-mock.ts
// Minimal in-memory Prisma-model mock for store-impl unit tests.
// Supports the subset of query shapes the Phase 3 store impls use:
// create / createMany / findUnique / findFirst / findMany / upsert / update / delete
// with equality where-clauses, {lt,gte,not} operators, orderBy, take, skip.

type Row = Record<string, unknown>
type Where = Record<string, unknown>
type OrderBy = Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]

function matchWhere(row: Row, where?: Where): boolean {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    const val = row[key]
    if (cond !== null && typeof cond === 'object') {
      const op = cond as Record<string, unknown>
      if ('lt' in op && !((val as number) < (op.lt as number))) return false
      if ('lte' in op && !((val as number) <= (op.lte as number))) return false
      if ('gt' in op && !((val as number) > (op.gt as number))) return false
      if ('gte' in op && !((val as number) >= (op.gte as number))) return false
      if ('not' in op && val === op.not) return false
    } else if (val !== cond) {
      return false
    }
  }
  return true
}

function applyOrder(rows: Row[], orderBy?: OrderBy): Row[] {
  if (!orderBy) return rows
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy]
  return rows.slice().sort((a, b) => {
    for (const spec of specs) {
      for (const [key, dir] of Object.entries(spec)) {
        const av = a[key] as number | string
        const bv = b[key] as number | string
        if (av === bv) continue
        const cmp = av < bv ? -1 : 1
        return dir === 'desc' ? -cmp : cmp
      }
    }
    return 0
  })
}

export interface MockTable {
  create(args: { data: Row }): Promise<Row>
  createMany(args: { data: Row[] }): Promise<{ count: number }>
  findUnique(args: { where: Where }): Promise<Row | null>
  findFirst(args: { where?: Where; orderBy?: OrderBy }): Promise<Row | null>
  findMany(args?: {
    where?: Where
    orderBy?: OrderBy
    take?: number
    skip?: number
  }): Promise<Row[]>
  upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>
  update(args: { where: Where; data: Row }): Promise<Row>
  delete(args: { where: Where }): Promise<Row>
  readonly rows: Row[]
}

export function makeTable(seed: Row[] = []): MockTable {
  const rows: Row[] = seed.slice()
  return {
    rows,
    async create({ data }) {
      const rec = { ...data }
      rows.push(rec)
      return rec
    },
    async createMany({ data }) {
      for (const d of data) rows.push({ ...d })
      return { count: data.length }
    },
    async findUnique({ where }) {
      return rows.find((r) => matchWhere(r, where)) ?? null
    },
    async findFirst({ where, orderBy }) {
      return (
        applyOrder(
          rows.filter((r) => matchWhere(r, where)),
          orderBy,
        )[0] ?? null
      )
    },
    async findMany(args) {
      let out = applyOrder(
        rows.filter((r) => matchWhere(r, args?.where)),
        args?.orderBy,
      )
      const skip = args?.skip ?? 0
      out = out.slice(skip)
      if (args?.take !== undefined) out = out.slice(0, args.take)
      return out
    },
    async upsert({ where, create, update }) {
      const existing = rows.find((r) => matchWhere(r, where))
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const rec = { ...create }
      rows.push(rec)
      return rec
    },
    async update({ where, data }) {
      const existing = rows.find((r) => matchWhere(r, where))
      if (!existing) throw new Error('Record to update not found')
      Object.assign(existing, data)
      return existing
    },
    async delete({ where }) {
      const idx = rows.findIndex((r) => matchWhere(r, where))
      if (idx === -1) throw new Error('Record to delete does not exist')
      const [removed] = rows.splice(idx, 1)
      return removed as Row
    },
  }
}
