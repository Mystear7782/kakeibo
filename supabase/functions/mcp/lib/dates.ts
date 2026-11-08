// 日付・月の検証。
// 「今日」「今月」の解釈はClaude側が行う。Edge FunctionはUTCで動くため、サーバー側では
// 「今日」を決めない（日本時間とずれるため）。ここでは形式と実在する日付かだけを検証する。
import { z } from 'zod'

/** YYYY-MM-DD で、実在する日付(2026-02-30などは不可) */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で指定してください（日本時間の日付。例: 2026-11-03）')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, '実在しない日付です')

/** YYYY-MM */
export const monthSchema = z.string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM 形式で指定してください（日本時間の月。例: 2026-11）')

export const DATE_NOTE =
  '日付・月は日本時間で指定する。「今日」「昨日」「今月」などは呼び出し側(Claude)が日本時間で解釈して具体的な値にすること（サーバーはUTCで動くため、サーバー側では今日の日付を決めない）。'

/** 'YYYY-MM' の月数の差（to - from） */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}
