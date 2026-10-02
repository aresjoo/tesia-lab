import { commonDate } from './client-common-backtest-preview'

type EquityPoint = { readonly i: number; readonly value: number }
export type CommonMonth = {
  month: string
  first: string
  last: string
  base: number
  closing: number
  returnPct: number
  partial: boolean
}

/** Compound unrounded monthly observations, never sum displayed percentages. */
export function commonYears(months: readonly CommonMonth[]) {
  const years = new Map<string, CommonMonth[]>()
  for (const month of months) {
    const year = month.month.slice(0, 4)
    years.set(year, [...(years.get(year) ?? []), month])
  }
  return [...years].map(([year, observed]) => ({ year, months: observed,
    returnPct: (observed.reduce((growth, month) => growth * (1 + month.returnPct / 100), 1) - 1) * 100,
    partial: observed.length !== 12 || observed.some(month => month.partial),
  }))
}

/** Display-only projection of the existing preview equity, not a backtest engine.
 * The first month starts at initial capital; subsequent months use the previous
 * month's closing balance, exactly as btBuild/btMonths in the client source. */
export function commonMonths(points: readonly EquityPoint[], capital: number): CommonMonth[] {
  const months: CommonMonth[] = []
  let previous = capital
  for (const point of points) {
    const date = commonDate(point.i), month = date.slice(0, 7)
    let current = months.at(-1)
    if (!current || current.month !== month) {
      current = { month, first: date, last: date, base: previous, closing: point.value, returnPct: 0, partial: false }
      months.push(current)
    }
    current.last = date
    current.closing = point.value
    previous = point.value
  }
  for (const month of months) {
    const [year, number] = month.month.split('-').map(Number)
    const lastDay = new Date(year, number, 0).getDate()
    month.partial = Number(month.first.slice(-2)) !== 1 || Number(month.last.slice(-2)) !== lastDay
    month.returnPct = (month.closing / month.base - 1) * 100
  }
  return months
}
