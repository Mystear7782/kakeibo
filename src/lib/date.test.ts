import { describe, expect, it } from 'vitest'
import { addMonths, daysInMonth, firstWeekday, monthEnd, shortDate, todayJst } from './date'

describe('todayJst', () => {
  it('UTC の夕方は日本ではすでに翌日になる', () => {
    expect(todayJst(new Date('2026-11-03T15:00:00Z'))).toBe('2026-11-04')
  })

  it('UTC の同じ日の昼は日本でも同じ日', () => {
    expect(todayJst(new Date('2026-11-03T14:59:59Z'))).toBe('2026-11-03')
  })

  it('年をまたぐ境界も日本時間で判定する', () => {
    expect(todayJst(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01')
  })
})

describe('addMonths', () => {
  it('月をまたぐ', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-03', -15)).toBe('2024-12')
  })
})

describe('daysInMonth', () => {
  it('2月は平年と閏年で変わる', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
  })

  it('月末の日付を返す', () => {
    expect(monthEnd('2026-04')).toBe('2026-04-30')
    expect(monthEnd('2026-12')).toBe('2026-12-31')
  })
})

describe('firstWeekday', () => {
  it('月初の曜日(0 = 日曜)', () => {
    expect(firstWeekday('2026-11')).toBe(0) // 2026-11-01 は日曜日
    expect(firstWeekday('2026-12')).toBe(2) // 2026-12-01 は火曜日
    expect(firstWeekday('2026-08')).toBe(6) // 2026-08-01 は土曜日
  })
})

describe('shortDate', () => {
  it('月日を M/D にする', () => {
    expect(shortDate('2026-11-03')).toBe('11/3')
    expect(shortDate('2026-01-15')).toBe('1/15')
  })
})
