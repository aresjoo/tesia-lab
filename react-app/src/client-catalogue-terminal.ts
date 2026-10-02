import type { CataloguePreviewResult } from './client-catalogue-preview'
import type { ClientLanguage } from './client-preferences'
import { catalogueTitle } from './client-catalogue'
import { catalogueTerminalText } from './client-catalogue-terminal-copy'
import judgmentCopy from './client-catalogue-judgment-copy.json' with { type: 'json' }

/** Display only, from the same worker result used by source strategy detail.
 * Never infer a venue, personal position, future execution time or cash balance. */
export function catalogueTerminalModel(value: CataloguePreviewResult, language: ClientLanguage) {
  const { strategy, result } = value, state = result.state
  const t = (key: Parameters<typeof catalogueTerminalText>[1], values?: Readonly<Record<string, string>>) => catalogueTerminalText(language, key, values)
  const open = state.open, positions = Array.isArray(open) ? open : open ? [open] : []
  const labels = (lang: ClientLanguage) => positions.map(p => `${catalogueTitle(p.k)}${'side' in p ? ` ${judgmentCopy[lang][p.side < 0 ? 'short' : 'long']}` : ''}`).join(', ')
  // The source's own return includes leverage/funding in futures. Do not
  // recompute or substitute the price-only chg, nor the copied user's return.
  const holdings = positions.map(p => ({ id: `${p.k}:${p.tid}`, asset: catalogueTitle(p.k),
    side: 'side' in p ? p.side < 0 ? 'short' as const : 'long' as const : null,
    leverage: 'lev' in p ? p.lev : null, weight: 'w' in p ? p.w : null,
    percent: 'pnl' in p ? p.pnl : p.chg,
  }))
  const pick = 'pick' in state && state.pick ? catalogueTitle(state.pick) : null
  const ruleAt = (lang: ClientLanguage) => {
    const r = (key: Parameters<typeof catalogueTerminalText>[1], values?: Readonly<Record<string, string>>) => catalogueTerminalText(lang, key, values)
    return strategy.fut ? strategy.trail ? r('trail', { percent: String(strategy.trail) }) : strategy.sl ? r('stop', { percent: String(strategy.sl) }) : r('rerank')
      : strategy.kind === 'agent' ? r('agentExit', { percent: String(strategy.trail) })
        : r('stopTarget', { stop: String(strategy.sl) }) + (strategy.tp != null ? r('target', { target: String(strategy.tp) }) : '')
  }
  const object = (assets: string) => {
    const last = assets.codePointAt(assets.length - 1) ?? 0
    return assets + (last < 0xac00 || last > 0xd7a3 || (last - 0xac00) % 28 ? '을' : '를')
  }
  const assets = labels(language)
  const headline = positions.length ? language === 'ko' && strategy.fut && positions.length === 1 ? `${assets} 포지션을 보유하고 있습니다` : t('holding', { assets: language === 'ko' ? object(assets) : assets })
    : strategy.kind === 'mix' && pick ? t('signal', { asset: pick }) : t('waiting')
  const messages = value.judgments ?? []
  // Source sk-brain3 tbCopyThought: decision + condition, followed by the
  // existing deterministic source explanation. "Next reassessment" describes
  // the rule; it is not a fabricated live scheduler timestamp or LLM response.
  const decision = positions.length ? `저는 ${object(labels('ko'))} 유지합니다.` : '저는 지금 현금으로 기다립니다.'
  const condition = strategy.kind === 'agent'
    ? strategy.fut
      ? positions.length ? `${ruleAt('ko')} 정리합니다.` : '다음 재평가에서 방향이 정해지면 진입합니다.'
      : positions.length ? `보유 종목이 고점 대비 ${strategy.trail}% 밀리거나 다음 재평가에서 순위가 밀리면 정리합니다.` : '다음 재평가에서 기준을 넘는 종목이 있으면 진입합니다.'
    : positions.length ? `${ruleAt('ko')} 정리합니다.` : '신호가 켜지고 시장 확인을 통과하는 날에만 진입합니다.'
  const rest = messages.find(m => m.k === 'now')?.t
  return { holdings, headline, pick, rule: ruleAt(language),
    cash: 'cash' in state && Number.isFinite(state.cash) ? state.cash : null,
    thought: `${decision} ${condition}${rest ? ` ${rest}` : ''}`,
    history: messages.filter(m => m.k !== 'now' && m.k !== 'intro'),
  }
}

/** Keep decimal prices intact; expand source prose, never synthesize analysis. */
export function splitCatalogueThought(text: string) {
  const sentences = text.split(/(?<=[.!?。！？])\s+/)
  return { head: sentences.slice(0, 2).join(' '), rest: sentences.slice(2).join(' ') }
}
