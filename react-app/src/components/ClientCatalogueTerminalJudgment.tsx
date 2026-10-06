import { useId, useMemo, useState } from 'react'
import { catalogueTitle, findCatalogueStrategy } from '../client-catalogue'
import { catalogueDateReader } from '../client-catalogue-presentation'
import { useCatalogueCopyInspection, type CatalogueCopyView, type CatalogueCopyInspection } from '../use-catalogue-copy-account'
import { useClientPreferences } from '../client-preferences'
import { catalogueTerminalModel } from '../client-catalogue-terminal'
import { catalogueJudgmentLocale } from '../client-catalogue-judgment-locale-copy'
import { useCataloguePreviewLocale } from '../client-catalogue-preview-locale'
import { catalogueTerminalText } from '../client-catalogue-terminal-copy'
import { sharedPercent, sharedNumber } from '../client-shared-number-format'
import common from '../client-catalogue-ui-copy.json'
import judgmentCopy from '../client-catalogue-judgment-copy.json'
import '../client-catalogue-terminal.css'

function Content({ data, onManage, onFind }: { data: CatalogueCopyInspection; onManage: (id: string) => void; onFind: () => void }) {
  const { language } = useClientPreferences(), words = judgmentCopy[language]
  const previewLocale = useCataloguePreviewLocale()
  const t = (key: Parameters<typeof catalogueTerminalText>[1], values?: Readonly<Record<string, string>>) => catalogueTerminalText(language, key, values)
  const model = useMemo(() => catalogueTerminalModel(data.value, language), [data.value, language])
  const localized = useMemo(() => catalogueJudgmentLocale(data.value, language), [data.value, language])
  const [expanded, setExpanded] = useState(false), [limit, setLimit] = useState(8)
  const id = useId(), thought = localized.thought
  const dateAt = useMemo(() => catalogueDateReader(data.value.calendar), [data.value.calendar])
  const date = (i: number) => dateAt(i).toLocaleDateString(language)
  const civilDate = (i: number) => {
    const day = dateAt(i)
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  }
  return <div className="cctj-body" data-source="client-snapshot-preview" data-copy-id={data.entry.record.id}>
    <header className="cctj-status"><p className="cctj-kind">{language === 'ko' ? catalogueTitle(data.value.strategy.name) : localized.sourceOwned ? previewLocale.text(localized.title) : localized.title}<span>{t(data.value.strategy.kind)} · {t('choose')}</span></p>
      <h3 lang={localized.headline.language}>{localized.headline.text}</h3><p className="cctj-basis">{t('basis', { date: date(data.value.result.params.endI) })}</p>
      <dl className="cctj-positions">
        {model.holdings.map((p, index) => <div key={p.id} data-position={p.id}><dt>{localized.assets[index].text} {p.side ? words[p.side] : t('spot')}{p.leverage && p.leverage > 1 ? ` ${sharedNumber(p.leverage, language)}×` : ''}</dt><dd>{p.weight != null && model.holdings.length > 1 && <span className="cctj-weight">{t('weight')} {sharedPercent(p.weight * 100, language, 0, false)}</span>} <span className={`cctj-return ${Number(p.percent.toFixed(1)) === 0 ? '' : p.percent > 0 ? 'up' : 'dn'}`}>{sharedPercent(p.percent, language)}</span></dd></div>)}
        {!model.holdings.length && <div><dt>{t('position')}</dt><dd>{t('none')}</dd></div>}
        {model.cash != null && model.holdings.length > 1 && <div><dt>{t('cash')}</dt><dd>{t('weight')} {sharedPercent(model.cash * 100, language, 0, false)}</dd></div>}
        {!model.holdings.length && model.pick && <div><dt>{t('selected')}</dt><dd>{localized.pick?.text}</dd></div>}
        <div><dt>{t('exit')}</dt><dd lang={localized.rule.language}>{localized.rule.text}</dd></div>
      </dl>
    </header>
    {thought.head && <section className="cctj-thought"><h4>{t('thought')}</h4>{language !== 'ko' && !thought.translated && <small>{words.sourceLanguage}</small>}<p lang={thought.language}>{thought.head}{thought.rest && <span id={`${id}-thought`} hidden={!expanded}> {thought.rest}</span>}</p>{thought.rest && <button type="button" className="cctj-link" aria-expanded={expanded} aria-controls={`${id}-thought`} onClick={() => setExpanded(!expanded)}>{t(expanded ? 'less' : 'more')}</button>}</section>}
    {model.history.length > 0 && <section className="cctj-feed" aria-labelledby={`${id}-history`}><h4 id={`${id}-history`}>{words.heading}</h4>{model.history.slice(0, limit).map((m, index) => {
      const text = localized.history[index], key = `${m.k}:${m.i}:${m.a ?? ''}:${index}`
      const separateFill = m.fillIndex !== undefined && m.fillIndex !== m.i
      const expandable = Boolean(text.rest || separateFill)
      const label = language === 'ko' ? m.title : words[data.value.strategy.fut && m.k === 'buy' ? 'entry' : data.value.strategy.fut && m.k === 'sell' ? 'exit' : m.k]
      const summary = <><span className="cctj-date">{m.from !== undefined && m.from !== m.i ? `${date(m.from)} ~ ` : ''}<time dateTime={civilDate(m.i)}>{date(m.i)}</time></span>
        <b>{label}{m.cnt !== undefined && m.cnt > 1 ? language === 'ko' ? ` ${sharedNumber(m.cnt, language, 0)}회` : ` ×${sharedNumber(m.cnt, language, 0)}` : ''}</b>
        <span className="cctj-summary" lang={text.language}>{language !== 'ko' && !text.translated && <small lang={language}>{words.sourceLanguage}</small>}{text.head}{expandable && <u><span className="cctj-show">{t('full')}</span><span className="cctj-hide">{t('less')}</span></u>}</span></>
      return expandable ? <details key={key} data-judgment-kind={m.k} data-judgment-index={m.i}>
        <summary>{summary}</summary>{text.rest && <p lang={text.language}>{text.rest}</p>}
        {separateFill && <p>{words.signal} {date(m.i)} · {words.fill} {date(m.fillIndex!)}</p>}
      </details> : <div key={key} className="cctj-static" data-judgment-kind={m.k} data-judgment-index={m.i}>{summary}</div>
    })}{limit < model.history.length && <button type="button" className="cctj-link" onClick={() => setLimit(n => n + 20)}>{words.more.replace('{count}', String(model.history.length - limit))}</button>}</section>}
    <footer><button type="button" className="cctj-manage" onClick={() => onManage(data.entry.record.id)}>{t('manage')}</button><button type="button" className="cctj-link" onClick={onFind}>{t('find')}</button></footer>
    <small className="cctj-disclosure">{t('preview')}</small>
  </div>
}

/** Only the selected copy requests a read-only inspection. No polling and no
 * trade-detail fanout. An owner change retires selection and pending responses. */
export function ClientCatalogueTerminalJudgment({ account, onManage, onFind }: { account: CatalogueCopyView; onManage: (id: string) => void; onFind: () => void }) {
  const copies = account.state?.copies.filter(c => c.record.status === 'active') ?? []
  const [selection, setSelection] = useState<string | null>(null)
  const selected = copies.find(c => c.record.id === selection) ?? copies[0]
  // Reconcile removal immediately, so a later re-added record cannot silently
  // resurrect a selection the user already left.
  if (selection !== (selected?.record.id ?? null)) setSelection(selected?.record.id ?? null)
  const inspection = useCatalogueCopyInspection(account, selected?.record.id ?? '')
  return <ClientCatalogueTerminalJudgmentView account={account} selectedId={selected?.record.id ?? ''} onSelect={setSelection} inspection={inspection} onManage={onManage} onFind={onFind} />
}

export function ClientCatalogueTerminalJudgmentView({ account, selectedId, onSelect, inspection, onManage, onFind }: {
  account: CatalogueCopyView; selectedId: string; onSelect: (id: string) => void
  inspection: ReturnType<typeof useCatalogueCopyInspection>; onManage: (id: string) => void; onFind: () => void
}) {
  const { language } = useClientPreferences(), words = common[language]
  const previewLocale = useCataloguePreviewLocale()
  const copies = account.state?.copies.filter(c => c.record.status === 'active') ?? []
  const selected = copies.find(c => c.record.id === selectedId)
  const id = useId()
  if (!selected) return null
  return <section className="cctj" aria-label={catalogueTerminalText(language, 'choose')}>
    {copies.length > 1 && <div className="cctj-selector" role="group" aria-label={catalogueTerminalText(language, 'choose')}>{copies.map(({ record }) => { const strategy = findCatalogueStrategy(record.binding.strategyId); return <button type="button" key={record.id} aria-pressed={record.id === selected.record.id} aria-controls={`${id}-panel`} onClick={() => onSelect(record.id)} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>{language === 'ko' ? catalogueTitle(strategy?.name ?? record.binding.strategyId) : strategy ? previewLocale.text(strategy.name) : record.binding.strategyId}</button> })}</div>}
    <div id={`${id}-panel`} aria-busy={inspection.state === 'loading'}>{inspection.data ? <Content key={`${account.owner}:${selected.record.id}`} data={inspection.data} onManage={onManage} onFind={onFind} /> : <div className="cctj-pending" role="status"><p>{words[inspection.state === 'error' ? 'failed' : 'loading']}</p>{inspection.state === 'error' && <button type="button" className="cctj-link" onClick={inspection.retry}>{words.retry}</button>}</div>}</div>
  </section>
}
