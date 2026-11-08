// MCPサーバーへのツール登録。ツール本体は tools/*.ts にあり、ここでは名前・説明・
// 入力スキーマ・注釈(annotations)を付けて結びつけるだけにしている。
import type { McpServer } from '@modelcontextprotocol/server'
import type { Client } from '../lib/client.ts'
import { DATE_NOTE } from '../lib/dates.ts'
import { listCategories, listCategoriesSchema, saveCategory, saveCategorySchema } from './categories.ts'
import {
  deleteFixedCost,
  deleteFixedCostSchema,
  listFixedCosts,
  listFixedCostsSchema,
  saveFixedCost,
  saveFixedCostSchema,
} from './fixed-costs.ts'
import {
  getCashflowSummary,
  getCashflowSummarySchema,
  getMonthSchedule,
  getMonthScheduleSchema,
  getSubscriptionSummary,
  getSubscriptionSummarySchema,
} from './reports.ts'
import {
  deleteTransaction,
  deleteTransactionSchema,
  listTransactions,
  listTransactionsSchema,
  logTransaction,
  logTransactionSchema,
  updateTransaction,
  updateTransactionSchema,
} from './transactions.ts'

// 読み取り専用 / 追加・更新(破壊的でない) / 破壊的 の3種類の注釈
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }

const MONEY_NOTE = '金額はすべて円の整数。'

export function registerTools(server: McpServer, sb: Client): void {
  // ===== 明細 =====
  server.registerTool('log_transaction', {
    title: '明細を登録',
    description:
      '明細を1件登録する。type は expense(支出) / income(収入) / transfer(振替・投資)。振替・投資は月の支払いに含まれない。' +
      '費目は名前かid（種別に合うものだけ）。' + MONEY_NOTE + DATE_NOTE +
      '直近2分以内に同じ内容の明細があれば、新規作成せずその既存行を返す(deduplicated: true)。',
    inputSchema: logTransactionSchema,
    annotations: WRITE,
  }, (a) => logTransaction(sb, a))

  server.registerTool('list_transactions', {
    title: '明細を検索',
    description:
      '期間・種別・費目で明細を検索する。新しい順。limit は最大200、続きは offset で取る。' +
      'total_matched は条件に合う総件数。' + MONEY_NOTE + DATE_NOTE,
    inputSchema: listTransactionsSchema,
    annotations: READ,
  }, (a) => listTransactions(sb, a))

  server.registerTool('update_transaction', {
    title: '明細を更新',
    description:
      '明細1件の項目を更新する（指定した項目だけが変わる）。固定費の見込み額の明細は、金額を指定すると自動で確定(is_estimated=false)になる。' +
      '既存データを書き換える操作なので、実行前に必ずユーザーへ変更内容を確認すること。' + MONEY_NOTE + DATE_NOTE,
    inputSchema: updateTransactionSchema,
    annotations: DESTRUCTIVE,
  }, (a) => updateTransaction(sb, a))

  server.registerTool('delete_transaction', {
    title: '明細を削除',
    description:
      '明細を1件削除する。元に戻せない操作なので、実行前に必ずユーザーへ削除対象を確認すること。' +
      '固定費の自動記録を削除しても、その分は再作成されない。一括削除はできない。',
    inputSchema: deleteTransactionSchema,
    annotations: DESTRUCTIVE,
  }, (a) => deleteTransaction(sb, a))

  // ===== 固定費 =====
  server.registerTool('list_fixed_costs', {
    title: '固定費の一覧',
    description:
      '固定費の一覧と、月額・年額の合計を返す。年払いは12で割って月額に含める。終了月が as_of_month より前のものは終了済みとして合計から除く。' +
      MONEY_NOTE + DATE_NOTE,
    inputSchema: listFixedCostsSchema,
    annotations: READ,
  }, (a) => listFixedCosts(sb, a))

  server.registerTool('save_fixed_cost', {
    title: '固定費を保存',
    description:
      '固定費を追加または更新する。fixed_cost_id を省略すると新規登録（name / amount / category / cycle / pay_day / payment_method / start_month が必要。yearly は pay_month も必要）、' +
      '指定するとその固定費の指定した項目だけを更新する（更新は既存の内容を書き換えるので、実行前にユーザーへ変更内容を確認すること）。' +
      '自動記録がオンなら支払日に明細が作られる。サブスクは is_subscription を true にする。解約したものは削除せず end_month を入れる。' +
      MONEY_NOTE + DATE_NOTE,
    inputSchema: saveFixedCostSchema,
    annotations: WRITE,
  }, (a) => saveFixedCost(sb, a))

  server.registerTool('delete_fixed_cost', {
    title: '固定費を削除',
    description:
      '固定費を1件削除する。元に戻せない操作なので、実行前に必ずユーザーへ削除対象を確認すること。' +
      '記録済みの明細は残るが固定費とのひもづけは外れ、サブスクの累計額からは消える。解約の場合は end_month を入れる方がよい。',
    inputSchema: deleteFixedCostSchema,
    annotations: DESTRUCTIVE,
  }, (a) => deleteFixedCost(sb, a))

  // ===== 費目 =====
  server.registerTool('list_categories', {
    title: '費目の一覧',
    description:
      '費目の一覧を返す（種類: expense / income / transfer / fixed）。既定では非表示の費目を含まない。' +
      '明細や固定費に使う費目の名前・id はここで確認する。',
    inputSchema: listCategoriesSchema,
    annotations: READ,
  }, (a) => listCategories(sb, a))

  server.registerTool('save_category', {
    title: '費目を保存',
    description:
      '費目を追加・更新・非表示にする。category_id を省略すると新規追加（kind と name が必要）、指定すると name / sort_order / is_hidden を更新する。' +
      '同じ種類で同じ名前の費目は登録できない。費目の削除はできない（使わなくなったら is_hidden=true）。' +
      '名前を変えると過去の記録の表示も変わるので、実行前にユーザーへ確認すること。',
    inputSchema: saveCategorySchema,
    annotations: WRITE,
  }, (a) => saveCategory(sb, a))

  // ===== 予定・集計 =====
  server.registerTool('get_month_schedule', {
    title: '月の予定',
    description:
      '指定した月の、まだ明細になっていない固定費を返す（status: planned=これから / unrecorded=支払日を過ぎたが未記録）。' +
      '月の支払いは「支出の明細 + 未記録の固定費」で計算する。' + MONEY_NOTE + DATE_NOTE,
    inputSchema: getMonthScheduleSchema,
    annotations: READ,
  }, (a) => getMonthSchedule(sb, a))

  server.registerTool('get_cashflow_summary', {
    title: '収支の集計',
    description:
      '月別の収入・支出・固定費・振替/投資・収支・貯蓄率を返す。貯蓄率は (収入 - 支出) / 収入（収入が0の月は null）。' +
      '振替・投資は支出に含めない。期間は最大36か月。' + MONEY_NOTE + DATE_NOTE,
    inputSchema: getCashflowSummarySchema,
    annotations: READ,
  }, (a) => getCashflowSummary(sb, a))

  server.registerTool('get_subscription_summary', {
    title: 'サブスクの集計',
    description:
      'サブスク(is_subscription の固定費)の一覧と、月額換算・年額換算の合計、今年の支払額、契約開始からの累計額を返す。' +
      '月額・年額の合計は解約済みを含めず、支払額は解約済みも含める。支払額は記録済みの明細の合計。' + MONEY_NOTE,
    inputSchema: getSubscriptionSummarySchema,
    annotations: READ,
  }, (a) => getSubscriptionSummary(sb, a))
}
