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
