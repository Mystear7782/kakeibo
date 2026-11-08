import type {
  CatKind,
  Category,
  FixedCost,
  FixedCostInput,
  ScheduleRow,
  SubscriptionRow,
  Transaction,
  TransactionInput,
} from '../lib/model'

export interface Api {
  ensureDefaultCategories(): Promise<void>

  /** 非表示の費目も含めて返す */
  listCategories(): Promise<Category[]>
  addCategory(kind: CatKind, name: string, sortOrder: number): Promise<void>
  updateCategory(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'sort_order' | 'is_hidden'>>,
  ): Promise<void>
  deleteCategory(id: string): Promise<void>
  isCategoryUsed(id: string): Promise<boolean>

  listFixedCosts(): Promise<FixedCost[]>
  saveFixedCost(input: FixedCostInput, id?: string): Promise<void>
  deleteFixedCost(id: string): Promise<void>

  listRecentTransactions(limit: number): Promise<Transaction[]>
  /** from と to を含む期間 */
  listTransactions(from: string, to: string): Promise<Transaction[]>
  saveTransaction(input: TransactionInput, id?: string): Promise<void>
  deleteTransaction(id: string): Promise<void>

  /** month は 'YYYY-MM'。明細になっていない固定費だけを返す */
  getMonthSchedule(month: string): Promise<ScheduleRow[]>
  getSubscriptionSummary(year: number): Promise<SubscriptionRow[]>
}
