/** Client b2ee991d cpMeta/cpPerf/cpAiNote/cpWkBars/cpDonut projection.
 * Synthetic source preview only: these nickname-derived amounts, people and
 * rule-based comments are not service data, model advice or trading authority.
 * No transport/storage/clock; shared service schemas are deliberately untouched.
 */
import type { SharedStrategy } from './client-shared-strategies'

export const copyTraderPeriods = [7, 30, 90, 180] as const
export type CopyTraderPeriod = typeof copyTraderPeriods[number]
export type CopyTraderMeta = {
  nick: string; days: number; share: number; copiers: number; cap: number
  aum: number; total: number; lastTradeMin: number; bio: string
}
export type CopyTraderPerformance = {
  roi: number; pnl: number; copiersPnl: number; winRate: number; mdd: number
  wins: number; losses: number; n: number; eq: SharedStrategy['result']['eq']
}
export type CopyTraderAiNote = { w: 0 | 1; t: string }
export type CopyTraderWeeklyBars = {
  available: boolean
  bars: { value: number; heightPx: number; positive: boolean }[]
}
export type CopyTraderAssetAllocation = {
  label: string; percent: number; color: string; dashArray: string; dashOffset: string
}

/** UTF-16 code-unit hash, including unsigned 32-bit overflow, as in cpHash. */
export function copyTraderHash(nick: string): number {
  let h = 0
  for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) >>> 0
  return h
}

export function copyTraderMeta(nick: string): CopyTraderMeta {
  const h = copyTraderHash(nick), aum = 25000 + (h % 90) * 1000
  // Exact teth-copy.js copytrade defaults at the pinned source revision.
  return {
    nick, days: 34 + (h % 420), share: .1, copiers: 3 + (h % 97), cap: 500,
    aum, total: Math.round(aum * 1.6) + (h % 7000), lastTradeMin: 5 + (h % 700),
    bio: ['원칙대로만 삽니다. 손절은 기계처럼.', '추세가 확인되기 전에는 움직이지 않아요.',
      '하락장에서 살아남는 것이 첫 번째 목표입니다.', '복리는 지루함을 견딘 사람의 몫이에요.'][h % 4],
  }
}

export function copyTraderPerformance(strategy: SharedStrategy, days: CopyTraderPeriod = 30): CopyTraderPerformance {
  const r = strategy.result, eq = r.eq || [], m = copyTraderMeta(strategy.nick)
  if (!eq.length) return { roi: r.ret, pnl: 0, copiersPnl: 0, winRate: r.winRate || 0, mdd: r.mdd, wins: 0, losses: 0, n: r.n, eq: [] }
  const cut = eq[eq.length - 1].i - days
  let win = eq.filter(e => e.i >= cut)
  // Source fallback intentionally retains the original trade cut below.
  if (win.length < 2) win = eq.slice()
  const roi = (win[win.length - 1].v / win[0].v - 1) * 100, pnl = m.aum * roi / 100
  let peak = -1e18, mdd = 0
  win.forEach(e => {
    if (e.v > peak) peak = e.v
    const drawdown = (e.v / peak - 1) * 100
    if (drawdown < mdd) mdd = drawdown
  })
  const trades = (r.trades || []).filter(t => (t.exit != null ? t.exit : t.entry) >= cut)
  const wins = trades.filter(t => t.pnl > 0).length
  return {
    roi, pnl, copiersPnl: pnl * Math.min(1.6, m.copiers / 20),
    winRate: trades.length ? wins / trades.length * 100 : (r.winRate || 0),
    mdd: Math.abs(mdd), wins, losses: trades.length - wins, n: trades.length,
    eq: win.map(e => ({ ...e })),
  }
}

export function copyTraderAiNote(kind: 'trust', data: { days: number; roi: number }): CopyTraderAiNote
export function copyTraderAiNote(kind: 'mdd', data: { mdd: number }): CopyTraderAiNote
export function copyTraderAiNote(kind: 'trust' | 'mdd', data: { days?: number; roi?: number; mdd?: number }): CopyTraderAiNote {
  if (kind === 'trust') {
    const days = data.days!, roi = data.roi!
    if (days < 90 && roi >= 50) return { w: 1, t: '트레이딩 ' + days + '일차 계좌의 수익률 ' + roi.toFixed(1) + '%는 아직 검증 기간이 짧아요. 최소 3개월 이상 이어지는지 지켜보고 판단해도 늦지 않아요.' }
    if (days < 90) return { w: 0, t: '기록이 ' + days + '일로 짧은 편이에요. 수치보다 손절 원칙이 지켜지는지를 먼저 봐주세요.' }
    return { w: 0, t: '기록이 ' + days + '일째 이어지고 있어요. 기간이 길수록 수치의 신뢰도가 높아요.' }
  }
  const mdd = data.mdd!
  if (mdd >= 15) return { w: 1, t: '가장 힘들었던 구간에서 고점 대비 ' + mdd.toFixed(1) + '% 내려갔어요. 이만큼의 평가 손실을 견딜 수 있는 금액으로만 시작하세요.' }
  return { w: 0, t: '최대 낙폭이 ' + mdd.toFixed(1) + '%로 관리되는 편이에요. 그래도 하락 구간은 언제든 다시 올 수 있어요.' }
}

export function copyTraderWeeklyBars(strategy: SharedStrategy): CopyTraderWeeklyBars {
  const eq = strategy.result.eq || []
  if (eq.length < 15) return { available: false, bars: [] }
  const last = eq.slice(-13 * 7), values: number[] = [], m = copyTraderMeta(strategy.nick)
  // Source counts seven equity samples, not calendar days or realized trades.
  // Keep its partial final group and its omission of changes between groups.
  for (let i = 0; i < 13; i++) {
    const segment = last.slice(i * 7, (i + 1) * 7)
    if (segment.length > 1) values.push((segment[segment.length - 1].v - segment[0].v) * m.aum)
  }
  const max = Math.max(...values.map(Math.abs)) || 1
  return { available: true, bars: values.map(value => ({ value, heightPx: Math.max(3, Math.round(Math.abs(value) / max * 92)), positive: value >= 0 })) }
}

export function copyTraderAssetAllocation(strategy: SharedStrategy): CopyTraderAssetAllocation[] {
  const h = copyTraderHash(strategy.nick), main = 58 + (h % 22)
  const second = Math.min(88 - main, 14 + (h % 12)), third = Math.max(4, Math.round((100 - main - second) * .7))
  const other = 100 - main - second - third
  const pairs: Record<string, string> = { '비트코인': 'BTC/USDT', '이더리움': 'ETH/USDT', '나스닥': 'NAS100/USDT' }
  const rows: [string, number, string][] = [
    [Object.hasOwn(pairs, strategy.asset) ? pairs[strategy.asset] : strategy.asset, main, '#8fb2ff'],
    [strategy.asset === '이더리움' ? 'BTC/USDT' : 'ETH/USDT', second, '#56c486'],
    ['SOL/USDT', third, '#eab308'], ['기타', other, '#5b6472'],
  ]
  const circumference = 2 * Math.PI * 40
  let offset = 0
  return rows.map(([label, percent, color]) => {
    const length = circumference * percent / 100
    const row = { label, percent, color, dashArray: length.toFixed(1) + ' ' + (circumference - length).toFixed(1), dashOffset: (-offset).toFixed(1) }
    offset += length
    return row
  })
}

export function projectCopyTraderProfile(strategy: SharedStrategy, period: CopyTraderPeriod = 30) {
  const meta = copyTraderMeta(strategy.nick), performance = copyTraderPerformance(strategy, period)
  return {
    period, meta, performance,
    // Source trust note uses ALL-period return; MDD note uses selected window.
    trustNote: copyTraderAiNote('trust', { days: meta.days, roi: strategy.result.ret }),
    mddNote: copyTraderAiNote('mdd', { mdd: performance.mdd }),
    weeklyBars: copyTraderWeeklyBars(strategy), allocation: copyTraderAssetAllocation(strategy),
  }
}
export type CopyTraderProfile = ReturnType<typeof projectCopyTraderProfile>
