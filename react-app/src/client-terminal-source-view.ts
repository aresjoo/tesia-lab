/** Adapts the client's SYNTHETIC reference fixture, never service/API evidence. */
import type { ClientAgentEvent, ClientRuleCheck } from './client-agent-view'
export { sourceMoney } from './client-preview-money'
import { normalizeSourceTerminalParameters, sourceTerminalDate, sourceTerminalPrices, sourceTerminalRsi, sourceTerminalSma, type SourceTerminalEvaluation, type SourceTerminalSeed } from './client-terminal-source-fixture'

export const sourceDay = (i: number) => {
  const date = sourceTerminalDate(i)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const sourceChartTime = (i: number) => Date.parse(`${sourceDay(i)}T00:00:00Z`) / 1000
export const sourceChartPoints = sourceTerminalPrices.map((value, i) => ({ time: sourceChartTime(i), value }))
export const sourcePercent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
export const sourceTone = (n: number): 'up' | 'dn' | 'zz' => n > 0 ? 'up' : n < 0 ? 'dn' : 'zz'

import type { ClientLanguage } from './client-preferences'
import { ruleCheckText } from './client-rule-check-copy'
import { sharedNumber } from './client-shared-number-format'
import { terminalBarsText, terminalReadText } from './client-terminal-read-copy'

/** Latest source rules use one card per actual evaluation, not invented scan ticks. */
export function sourceAgentStatusSummary(seed: SourceTerminalSeed, events: readonly ClientAgentEvent[], language: ClientLanguage = 'ko') {
  if (!events.length || seed.status !== 'live') return undefined
  return `${ruleCheckText(language, 'title')} · ${events[0].timeLabel}`
}

export function sourceAgentEvents(seed: SourceTerminalSeed, result: SourceTerminalEvaluation, money: (n: number, signed?: boolean) => string, language: ClientLanguage = 'ko'): ClientAgentEvent[] {
  const p = normalizeSourceTerminalParameters(seed.parameters)
  const t = (key: Parameters<typeof ruleCheckText>[1], values?: Readonly<Record<string, string>>) => ruleCheckText(language, key, values)
  const read = (key: Parameters<typeof terminalReadText>[1]) => terminalReadText(language, key)
  const number = (n: number, digits: 0 | 1 | 2 | 4 | 'auto') => sharedNumber(n, language, digits)
  const percent = (n: number, digits: 1 | 2 = 1) => `${n >= 0 ? '+' : ''}${number(n, digits)}%`
  const byEntry = new Map(result.trades.map(trade => [trade.entry, trade]))
  const byExit = new Map(result.trades.map(trade => [trade.exit, trade]))
  let entryIndex: number | null = null
  // Track the actual entry while traversing chronologically. The old HTML used
  // ev.entryI ?? ev.i, which can attach an exit to its own close rather than entry.
  const events = result.L.evs.map(ev => {
    if (ev.k === 'entry') entryIndex = ev.i
    const price = sourceTerminalPrices[ev.i]
    const rows: ClientRuleCheck['rows'][number][] = []
    const outputs: ClientRuleCheck['outputs'][number][] = []
    const provenance = read('simulationRange')
    if (ev.k === 'watch' || ev.k === 'entry') {
      const previous = sourceTerminalPrices[ev.i - 1]
      const rsi = sourceTerminalRsi(ev.i - 1)
      const ma20 = sourceTerminalSma(ev.i, 20), ma60 = sourceTerminalSma(ev.i, 60)
      const gap = ma20 == null || ma60 == null ? null : Math.abs(ma20 - ma60) / price
      rows.push({ label: t('rsi', { value: number(p.rsiTh, 'auto') }), value: number(rsi, 1), state: rsi < p.rsiTh ? 'ok' : 'no' },
        { label: t('bounce'), value: percent((price / previous - 1) * 100, 2), state: price > previous * 1.005 ? 'ok' : 'no' })
      if (p.trendFilter) rows.push({ label: t('trend'), value: gap == null ? '—' : `${number(gap * 100, 1)}%`, state: gap == null ? 'unknown' : gap > .03 ? 'ok' : 'no' })
      if (ev.k === 'entry') {
        const trade = byEntry.get(ev.i)
        const quantity = trade ? trade.capB / price : result.pos?.entryI === ev.i ? result.pos.qty : null
        outputs.push({ label: t('order'), text: `${t('buy')} ${quantity === null ? '—' : number(quantity, 4)} ${seed.symbol}, ${money(price)}` },
          { label: t('risk'), text: `${read('stopLoss')} ${money(price * (1 + p.sl / 100))} (${number(p.sl, 'auto')}%)${p.tp == null ? '' : `, ${read('takeProfit')} ${money(price * (1 + p.tp / 100))} (+${number(p.tp, 'auto')}%)`}, ${t('holding25')}` })
      }
    } else {
      const entryPrice = entryIndex === null ? null : sourceTerminalPrices[entryIndex]
      const held = entryIndex === null ? null : ev.i - entryIndex
      const change = entryPrice === null ? null : (price / entryPrice - 1) * 100
      const current = change === null ? '—' : percent(change)
      rows.push({ label: `${read('stopLoss')} ${number(p.sl, 'auto')}% (${entryPrice === null ? '—' : money(entryPrice * (1 + p.sl / 100))})`, value: current, state: change === null ? 'unknown' : ev.k === 'exit-sl' ? 'hit' : 'na' })
      if (p.tp != null) rows.push({ label: `${read('takeProfit')} +${number(p.tp, 'auto')}% (${entryPrice === null ? '—' : money(entryPrice * (1 + p.tp / 100))})`, value: current, state: change === null ? 'unknown' : ev.k === 'exit-tp' ? 'hit' : 'na' })
      rows.push({ label: t('holding25'), value: held === null ? '—' : `${number(held, 0)}/25`, state: held === null ? 'unknown' : ev.k === 'exit-time' ? 'hit' : 'na' })
      if (ev.k.startsWith('exit')) {
        const trade = byExit.get(ev.i)
        if (trade && trade.entry === entryIndex && entryPrice !== null) {
          const exitPrice = trade.kind === 'sl' ? entryPrice * (1 + p.sl / 100) : trade.kind === 'tp' && p.tp !== null ? entryPrice * (1 + p.tp / 100) : price
          outputs.push({ label: t('order'), text: `${t('sell')}, ${money(exitPrice)} · ${seed.symbol}` },
            { label: t('result'), text: `${money(trade.krw, true)} (${percent(trade.pnl * 100)}) · ${terminalBarsText(language, held!, 0)}`, tone: sourceTone(trade.krw) })
        }
        entryIndex = null
      }
    }
    return { id: `${seed.id}:${ev.i}`, type: ev.k, timeLabel: sourceDay(ev.i), text: ev.txt,
      ruleCheck: { barIndex: ev.i, rows, outputs, provenance } } satisfies ClientAgentEvent
  })
  return events.reverse()
}
