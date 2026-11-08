export const num = (n: number): string => Math.round(n).toLocaleString('ja-JP')

export const yen = (n: number): string => `¥${num(n)}`

// 入力欄の文字から数字だけを取り出す。DBの integer に収まる9桁まで
export const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, 9)
