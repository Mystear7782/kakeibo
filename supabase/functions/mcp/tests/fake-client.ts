// deno-lint-ignore-file no-explicit-any -- PostgREST の呼び出しを真似るため、行は緩い型で扱う
// テスト用のメモリ上の Supabase クライアント。ツールが使う範囲の PostgREST の呼び出しだけを真似る
// （RLS・トリガー・制約は再現しない。DB側の振る舞いは本番に適用したマイグレーションで担保する）。
import type { Client } from '../lib/client.ts'

type Row = Record<string, any>
type Result = { data: any; error: any; count?: number | null }

const DEFAULTS: Record<string, () => Row> = {
  categories: () => ({ is_hidden: false }),
  fixed_costs: () => ({
    is_month_end: false,
    is_variable: false,
    auto_record: true,
    is_subscription: false,
    pay_month: null,
    pay_day: null,
    end_month: null,
    tracking_from: '2026-11-01',
    recorded_through: '2026-10-31',
  }),
  transactions: () => ({
    memo: '',
    source: 'manual',
    external_id: null,
    fixed_cost_id: null,
    is_estimated: false,
  }),
}

export class FakeDb {
  tables: Record<string, Row[]> = { categories: [], fixed_costs: [], transactions: [] }
  rpcs: Record<string, (args: any) => any[]> = {}
  rpcCalls: { name: string; args: any }[] = []
  private n = 0

  id(): string {
    this.n += 1
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`
  }

  insert(table: string, row: Row): Row {
    const full = {
      id: this.id(),
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...DEFAULTS[table]?.(),
      ...row,
    }
    this.tables[table].push(full)
    return full
  }

  category(kind: string, name: string, extra: Row = {}): Row {
    const sortOrder = this.tables.categories.filter((c) => c.kind === kind).length * 10 + 10
    return this.insert('categories', { kind, name, sort_order: sortOrder, ...extra })
  }

  client(): Client {
    return {
      from: (table: string) => new Query(this, table),
      rpc: (name: string, args: any = {}) => {
        this.rpcCalls.push({ name, args })
        const fn = this.rpcs[name]
        return Promise.resolve(fn ? { data: fn(args), error: null } : { data: null, error: { message: `no rpc ${name}` } })
      },
    } as unknown as Client
  }
}

class Query implements PromiseLike<Result> {
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private filters: ((r: Row) => boolean)[] = []
  private orders: { col: string; asc: boolean }[] = []
  private payload: any
  private returning = false
  private wantCount = false
  private head = false
  private window: [number, number] | null = null
  private cap: number | null = null
  private one: 'single' | 'maybe' | null = null

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode === 'select') {
      this.wantCount = opts?.count === 'exact'
      this.head = !!opts?.head
    } else {
      this.returning = true
    }
    return this
  }
  insert(payload: any) { this.mode = 'insert'; this.payload = payload; return this }
  update(payload: any) { this.mode = 'update'; this.payload = payload; return this }
  delete() { this.mode = 'delete'; return this }

  eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this }
  gte(col: string, val: any) { this.filters.push((r) => r[col] >= val); return this }
  lte(col: string, val: any) { this.filters.push((r) => r[col] <= val); return this }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(r[col])); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending ?? true }); return this }
  limit(n: number) { this.cap = n; return this }
  range(from: number, to: number) { this.window = [from, to]; return this }
  single() { this.one = 'single'; return this }
  maybeSingle() { this.one = 'maybe'; return this }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected)
  }

  private exec(): Result {
    const rows = this.db.tables[this.table]
    const matched = rows.filter((r) => this.filters.every((f) => f(r)))
    let out: Row[]
    let count: number | null = null

    if (this.mode === 'insert') {
      const inputs: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
      if (this.table === 'categories') {
        for (const p of inputs) {
          if (rows.some((c) => c.kind === p.kind && c.name === p.name)) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
          }
        }
      }
      out = inputs.map((p) => this.db.insert(this.table, p))
    } else if (this.mode === 'update') {
      for (const r of matched) Object.assign(r, this.payload, { updated_at: new Date().toISOString() })
      out = matched
    } else if (this.mode === 'delete') {
      this.db.tables[this.table] = rows.filter((r) => !matched.includes(r))
      out = matched
    } else {
      out = matched.slice()
      for (const { col, asc } of this.orders.slice().reverse()) {
        out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
      }
      if (this.wantCount) count = out.length
      if (this.window) out = out.slice(this.window[0], this.window[1] + 1)
      if (this.cap !== null) out = out.slice(0, this.cap)
      if (this.head) return { data: null, error: null, count }
    }

    if ((this.mode === 'insert' || this.mode === 'update' || this.mode === 'delete') && !this.returning) {
      return { data: null, error: null }
    }
    if (this.one === 'single') {
      return out.length === 1
        ? { data: structuredClone(out[0]), error: null, count }
        : { data: null, error: { code: 'PGRST116', message: 'expected a single row' } }
    }
    if (this.one === 'maybe') return { data: out[0] ? structuredClone(out[0]) : null, error: null, count }
    return { data: structuredClone(out), error: null, count }
  }
}
