// 日付はすべて 'YYYY-MM-DD'、月は 'YYYY-MM' の文字列で扱う。端末のタイムゾーンに依存しない。

const pad = (n: number) => String(n).padStart(2, '0')

// 日付の境界は Asia/Tokyo で判定する
export function todayJst(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// 入力できる年の範囲。ブラウザの日付欄は6桁の年(例: 203301年)まで入れられてしまうため、アプリ側で制限する
export const MIN_YEAR = 2000
export const MAX_YEAR = 2100
export const MIN_MONTH = `${MIN_YEAR}-01`
export const MAX_MONTH = `${MAX_YEAR}-12`
export const MIN_DATE = `${MIN_YEAR}-01-01`
export const MAX_DATE = `${MAX_YEAR}-12-31`

const inYearRange = (year: number): boolean => year >= MIN_YEAR && year <= MAX_YEAR

/** 'YYYY-MM' の形式で、年が MIN_YEAR〜MAX_YEAR の範囲内 */
export function isValidMonth(ym: string): boolean {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym)
  return !!m && inYearRange(Number(m[1]))
}

/** 'YYYY-MM-DD' の形式で、実在する日付、かつ年が MIN_YEAR〜MAX_YEAR の範囲内 */
export function isValidDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (!inYearRange(y)) return false
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

export const monthOf = (date: string): string => date.slice(0, 7)

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// 月の1日の曜日(0 = 日曜)
export function firstWeekday(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
}

/** 月を前後に動かしたときの選択。選ぶ日は、今月なら今日、それ以外は1日 */
export function shiftedSelection(
  month: string,
  delta: number,
  today: string = todayJst(),
): { month: string; day: number } {
  const next = addMonths(month, delta)
  return { month: next, day: next === monthOf(today) ? Number(today.slice(8, 10)) : 1 }
}

export const dateOf = (ym: string, day: number): string => `${ym}-${pad(day)}`

export const monthStart = (ym: string): string => `${ym}-01`

export const monthEnd = (ym: string): string => dateOf(ym, daysInMonth(ym))

// 'YYYY-MM-DD' → 'M/D'
export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4))
}
