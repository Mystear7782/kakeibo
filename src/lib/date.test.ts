import { describe, expect, it } from 'vitest'
import {
  addMonths,
  daysInMonth,
  firstWeekday,
  isValidDate,
  isValidMonth,
  monthEnd,
  shiftedSelection,
  shortDate,
  todayJst,
} from './date'

describe('isValidMonth', () => {
  it('2000年1月〜2100年12月の YYYY-MM だけを受け付ける', () => {
    for (const ym of ['2000-01', '2026-11', '2100-12']) expect(isValidMonth(ym), ym).toBe(true)
  })

  it('6桁の年（ブラウザが受け付けてしまう値）や範囲外の年は受け付けない', () => {
    for (const ym of ['203301-12', '1999-12', '2101-01', '0000-01', '99999-01']) {
      expect(isValidMonth(ym), ym).toBe(false)
    }
  })

  it('月が0や13以上、空や形式違いは受け付けない', () => {
    for (const ym of ['2026-00', '2026-13', '', '2026', '2026/11', '2026-1']) {
      expect(isValidMonth(ym), ym).toBe(false)
    }
  })
})

describe('isValidDate', () => {
  it('実在する日付で、年が範囲内ならよい（閏日も）', () => {
    for (const d of ['2026-11-14', '2000-01-01', '2100-12-31', '2028-02-29']) expect(isValidDate(d), d).toBe(true)
  })

  it('実在しない日付は受け付けない', () => {
    for (const d of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-04-31']) {
      expect(isValidDate(d), d).toBe(false)
    }
  })

  it('6桁の年や範囲外の年、空は受け付けない', () => {
    for (const d of ['203301-12-01', '1999-12-31', '2101-01-01', '', '2026-1-1']) {
      expect(isValidDate(d), d).toBe(false)
    }
  })
})

describe('shiftedSelection', () => {
  const today = '2026-11-14'

  it('今月に動かしたときは今日を選ぶ', () => {
    expect(shiftedSelection('2026-12', -1, today)).toEqual({ month: '2026-11', day: 14 })
    expect(shiftedSelection('2026-10', 1, today)).toEqual({ month: '2026-11', day: 14 })
  })

  it('今月以外に動かしたときは1日を選ぶ', () => {
    expect(shiftedSelection('2026-11', 1, today)).toEqual({ month: '2026-12', day: 1 })
    expect(shiftedSelection('2026-11', -1, today)).toEqual({ month: '2026-10', day: 1 })
  })

  it('年をまたぐ', () => {
    expect(shiftedSelection('2026-12', 1, today)).toEqual({ month: '2027-01', day: 1 })
  })
})

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
