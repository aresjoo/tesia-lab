import type { ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { sourceJudgmentText } from '../client-source-judgment-copy'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import type { SourceTerminalSeed, SourceTerminalEvaluation } from '../client-terminal-source-fixture'
import { sourceDay } from '../client-terminal-source-view'
import '../client-source-judgment.css'

const icons: Readonly<Record<string, string>> = {
  binance: '/client-broker-assets/app-binance.png', bitget: '/client-broker-assets/app-bitget.png',
  okx: '/client-broker-assets/app-okx.png', woox: '/client-broker-assets/app-woox.png',
  bybit: '/client-broker-assets/app-bybit.png', upbit: '/client-broker-assets/app-upbit.png',
}

/** Explicit exchange identity; unknown IDs never inherit another venue's mark. */
export function ClientTerminalVenueIcon({ id }: { id: string }) {
  const src = Object.hasOwn(icons, id) ? icons[id] : undefined
  return src ? <img className="csj-icon" src={src} alt="" width={16} height={16} /> : null
}

/** 0eb338f7 tfTmStatusBlock. Accepts ONLY the historical synthetic producer.
 * No clock/polling or live account state is inferred from its final position. */
export function ClientSourceJudgmentStatus({ seed, result, exchangeName, preview, watch = false }: {
  seed: SourceTerminalSeed; result: SourceTerminalEvaluation; exchangeName: string
  preview: boolean; watch?: boolean
}) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof sourceJudgmentText>[1], values?: Readonly<Record<string, string>>) => sourceJudgmentText(language, key, values)
  const p = result.r.params
  // The preview's stopped/ready state intentionally follows the client's
  // presentation. Saved records instead display the historical position,
  // independent of whether the user has asked to run or pause that strategy.
  const position = !preview || seed.status === 'live' ? result.pos : null
  const headline = !preview ? 'result' : seed.status !== 'live' ? seed.status : watch ? 'watch' : position ? 'exit' : 'entry'
  const row = (key: 'position' | 'stop' | 'target' | 'holding' | 'condition', value: ReactNode) => <div className="csj-row" key={key} data-field={key}><dt>{t(key)}</dt><dd>{value}</dd></div>
  const percent = (value: number) => sharedPercent(value, language, 'auto', value >= 0)
  const asset = seed.symbol.split('/')[0]
  const entryRule = t('bounce', { rsi: sharedNumber(p.rsiTh, language, 'auto') }) + (p.trendFilter ? t('trend') : '')
  const exitRule = position ? t('exitRule', { stop: percent(p.sl), target: p.tp !== null ? t('targetClause', { percent: percent(p.tp) }) : '', days: sharedNumber(Math.max(0, 25 - position.bars), language, 0) }) : ''
  const thought = !preview ? position ? exitRule : entryRule : position ? `${t('maintain', { asset })} ${exitRule}` : seed.status === 'live' ? t('waitRule', { rsi: sharedNumber(p.rsiTh, language, 'auto') }) : seed.status === 'off' ? t('pausedRule') : ''
  return <><div className="csj-status" data-source="synthetic-daily" data-preview={preview}>
    <h3>{t(headline, { asset })}</h3>
    <p className="csj-venue"><ClientTerminalVenueIcon id={seed.exchangeId} /><span><b>{exchangeName}</b><span className="csj-scope">{t('scope', { date: sourceDay(p.endI) })}</span></span></p>
    <dl className="csj-list">
      {position ? <>
        {row('position', <><span>{t('long')} {sharedNumber(position.qty, language, 4)} {asset}</span><span className={`csj-change ${Number((position.chg * 100).toFixed(1)) === 0 ? 'zz' : position.chg > 0 ? 'up' : 'dn'}`}>{sharedPercent(position.chg * 100, language)}</span></>)}
        {row('stop', t('fromEntry', { percent: percent(p.sl) }))}
        {position.tpP !== null && p.tp !== null && row('target', t('fromEntry', { percent: percent(p.tp) }))}
        {row('holding', t(position.bars === 1 ? 'oneDay' : 'days', { days: sharedNumber(position.bars, language, 0) }))}
      </> : <>
        {row('position', t('none'))}
        {row('condition', entryRule)}
      </>}
    </dl>
  </div>{thought && <div className="csj-thought"><h4>{t(preview ? 'thought' : 'appliedRules')}</h4><p>{thought}</p></div>}</>
}
