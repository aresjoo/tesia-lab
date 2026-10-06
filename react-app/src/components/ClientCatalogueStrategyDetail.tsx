import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { CataloguePreviewResult } from '../client-catalogue-preview'
import { catalogueAssets, catalogueTitle, catalogueUniverses } from '../client-catalogue'
import { catalogueDateReader, catalogueEquityWindow, catalogueOrders } from '../client-catalogue-presentation'
import { catalogueDetailLocale } from '../client-catalogue-detail-locale'
import type { SharedLocation } from '../client-shared-strategies'
import { useClientPreferences } from '../client-preferences'
import { sharedPercent } from '../client-shared-number-format'
import { ClientSharedDetailShell } from './ClientSharedDetailShell'
import { ClientCatalogueChart, ClientCatalogueChartControls } from './ClientCatalogueChart'
import type { CatalogueChartInterval, CatalogueChartMode } from '../client-catalogue-chart'
import { ClientSharedPerformance } from './ClientSharedPerformance'
import { ClientCatalogueOrders } from './ClientCatalogueOrders'
import { ClientCatalogueJudgments } from './ClientCatalogueJudgments'
import { useCatalogueOrdersNavigation } from '../use-catalogue-orders-navigation'
import copy from '../client-catalogue-ui-copy.json'
import kindCopy from '../client-strategy-filter-copy.json'
import identityCopy from '../client-strategy-identity-copy.json'
import detailCopy from '../client-detail-skin-copy.json'
import '../client-catalogue.css'
import '../client-catalogue-detail-header.css'
import { readCatalogueDetailHeader } from '../client-catalogue-detail-header-presentation'
import { catalogueHeaderText } from '../client-catalogue-detail-header-copy'
import { ClientStrategyGlyph } from './ClientStrategyGlyph'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'
import settingsCopy from '../client-settings-copy.json'
import { sharingCopy } from '../client-sharing-copy'
import { Share2 } from 'lucide-react'

type CatalogueHeaderProps = {
  value: CataloguePreviewResult; title: RefObject<HTMLHeadingElement | null>; owner?: string | null
  onCopy: () => void; onAnalyze: () => void; onWatch: () => void; onCopyLink: () => void
  onVerify?: (signal: AbortSignal) => void | Promise<void>; watched: boolean; analyzing: boolean
}
export function ClientCatalogueDetailHeader(props: CatalogueHeaderProps) {
  return <CatalogueHeaderContent key={JSON.stringify([props.owner ?? null, props.value.strategy.id, props.value.sourceSha, props.value.dataVersion])} {...props}/>
}
function CatalogueHeaderContent({ value, title, onCopy, onAnalyze, onWatch, onCopyLink, onVerify, watched, analyzing }: CatalogueHeaderProps) {
  const { language } = useClientPreferences(), id = useId(), metadata = readCatalogueDetailHeader(value)
  const h = (key: Parameters<typeof catalogueHeaderText>[1]) => catalogueHeaderText(language, key)
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  const wrap = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), items = useRef<(HTMLButtonElement | null)[]>([])
  const request = useRef<AbortController | null>(null), currentVerify = useRef(onVerify)
  useLayoutEffect(() => {
    if (currentVerify.current !== onVerify) { request.current?.abort(); request.current = null; setPending(false); setFailed(false) }
    currentVerify.current = onVerify
    return () => { request.current?.abort(); request.current = null }
  }, [onVerify])
  useLayoutEffect(() => { if (open) items.current.find(item => item && !item.disabled)?.focus({ preventScroll: true }) }, [open])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent | FocusEvent) => { if (event.target instanceof Node && !wrap.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', outside)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', outside) }
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }
  const verify = async () => {
    if (!onVerify || request.current || !metadata?.hasConfiguration) return
    const controller = new AbortController(), callback = onVerify
    request.current = controller; setPending(true); setFailed(false)
    try { await callback(controller.signal) }
    catch { if (request.current === controller && !controller.signal.aborted && currentVerify.current === callback) setFailed(true) }
    finally { if (request.current === controller) { request.current = null; setPending(false) } }
  }
  if (!metadata) return <p role="status">{settingsCopy.actionUnavailable[language]}</p>
  const row = catalogueDetailLocale(value, language).identity
  const actions = [
    { label: sharingCopy(language, 'TETH에게 분석시키기'), run: onAnalyze, disabled: analyzing },
    { label: h(watched ? 'unwatch' : 'watch'), run: onWatch, pressed: watched },
    { label: h('copyLink'), run: onCopyLink },
  ]
  const since = metadata.since ? new Intl.DateTimeFormat(language, { year: 'numeric', month: 'numeric', day: 'numeric', calendar: 'gregory' }).format(metadata.since) : '—'
  const amount = new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(metadata.minimum)
  return <header className="shared-detail-head catalogue-source-header">
    <div className="shared-detail-title-row"><div className="shared-detail-identity"><ClientStrategyGlyph kind={row.kind} evidence={row.glyph} size={44}/><div className="shared-detail-title"><h2 className="ss3-dtitle" ref={title} tabIndex={-1}>{row.title}</h2><div className="ss3-dsub"><b>{kindCopy[language][metadata.strategy.kind]}</b><span>{row.asset}</span><span>{detailCopy[language].registeredBy} @{metadata.strategy.by}</span></div></div></div><div className="shared-detail-tools"><button type="button" className="shared-detail-share" aria-label={h('copyLink')} onClick={onCopyLink}><Share2 size={17} aria-hidden="true"/></button><button type="button" className="shared-detail-watch" aria-pressed={watched} onClick={onWatch}>{h(watched ? 'unwatch' : 'watch')}</button></div></div>
    <p className="ss3-ddescription">{catalogueTitle(row.description)}</p>
    <div className="ss3-dacts shared-detail-actions"><button type="button" className="wbtn" onClick={onCopy}>{h('copy')}</button>
      {metadata.hasConfiguration && <button type="button" className="shared-detail-analysis" aria-label={h('verifyLabel')} disabled={!onVerify || pending} aria-busy={pending} title={!onVerify ? settingsCopy.actionUnavailable[language] : undefined} onClick={() => { void verify() }}>{h('verify')}</button>}
      <div className="catalogue-source-meta"><button type="button" className="catalogue-source-venue" aria-describedby={`${id}-venue`}><img src={`/assets/logos/${metadata.strategy.ex}.png`} alt="" width="16" height="16"/>{row.venue.name}<span id={`${id}-venue`} className="catalogue-source-tooltip" role="tooltip">{h('venueHint')}</span></button><span data-catalogue-source-minimum>{h('minimum')} {amount}</span><span data-catalogue-source-since>{h('since')} {since}</span></div>
      <div className="catalogue-source-more" ref={wrap}><button ref={trigger} type="button" aria-label={h('more')} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined} onClick={() => setOpen(!open)} onKeyDown={event => { if (!event.nativeEvent.isComposing && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true) } }}>⋯</button>
        {open && <div id={`${id}-menu`} className="catalogue-source-menu" role="menu" aria-label={h('more')} onKeyDown={event => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing || event.keyCode === 229) return
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
          else if (event.key === 'Tab') { close() }
          else if (['Home','End','ArrowDown','ArrowUp'].includes(event.key)) {
            event.preventDefault(); const enabled = items.current.filter(item => item && !item.disabled), index = enabled.indexOf(document.activeElement as HTMLButtonElement)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
            enabled[next]?.focus({ preventScroll: true })
          }
        }}>{actions.map((action, index) => <button key={index} ref={node => { items.current[index] = node }} type="button" role="menuitem" disabled={action.disabled} aria-pressed={action.pressed} onClick={() => { close(); action.run() }}>{action.label}</button>)}</div>}
      </div>
    </div>
    {failed && <p role="alert">{nativeAccountText(language, 'failed')}</p>}
  </header>
}

/** Full-run catalogue evidence, never a legacy RSI row or service adapter.
 * Overview KPIs preserve mkOvKpi's selected/full-history distinction. */
export function ClientCatalogueStrategyDetail({ value, location, title, onNavigate, onCopy, onAnalyze, onWatch, onCopyLink, watched, analyzing, owner, onVerify }: {
  value: CataloguePreviewResult; location: SharedLocation; title: RefObject<HTMLHeadingElement | null>
  onNavigate: (location: SharedLocation, replace?: boolean) => void
  onCopy: () => void; onAnalyze: () => void; onWatch: () => void; onCopyLink: () => void; watched: boolean; analyzing: boolean
  owner?: string | null; onVerify?: (signal: AbortSignal) => void | Promise<void>
}) {
  const { language } = useClientPreferences(), text = copy[language]
  const { strategy, result } = value
  const display = useMemo(() => catalogueDetailLocale(value, language), [value, language])
  const row = display.identity, indexToDate = useMemo(() => catalogueDateReader(value.calendar), [value.calendar])
  const [days, setDays] = useState(30)
  const navigation = useCatalogueOrdersNavigation(location, onNavigate)
  const [mode, setMode] = useState<CatalogueChartMode>('ret'), [interval, setInterval] = useState<CatalogueChartInterval>('day')
  const window = useMemo(() => catalogueEquityWindow(result, days), [result, days])
  const orders = useMemo(() => catalogueOrders(value), [value])
  const formatDate = new Intl.DateTimeFormat(language, { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory' })
  const date = (index: number) => formatDate.format(indexToDate(index))
  const period = days ? text[String(days) as '7' | '30' | '90' | '365'] : text.all
  const instruments = [...new Set(catalogueAssets(strategy).map(asset => catalogueUniverses.coin8.list.includes(asset) ? text.spot : asset === '나스닥' || asset === 'S&P 500' ? text.tokenIndex : asset === '금' ? text.tokenGold : text.tokenStock))]
  const info = [
    [kindCopy[language].kindLabel, kindCopy[language][strategy.kind]],
    [text.target, catalogueAssets(strategy).map(asset => display.literal(catalogueTitle(asset)).text).join(', ')],
    [text.instrument, strategy.fut ? `${text.futures} · ${text.long} / ${text.short} · ${strategy.lev}×` : instruments.join(', ')],
    [identityCopy[language].venueLabel, row.venue.name],
    [text.record, `${date(result.params.startI)} ~ ${date(result.params.endI)}`],
    [detailCopy[language].registeredBy, `@${strategy.by}`],
  ]
  const number = (value: number, digits = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)
  return <ClientSharedDetailShell row={{ ...row, description: catalogueTitle(row.description) }} info={info} location={location} title={title} onNavigate={onNavigate} onCopy={onCopy} onAnalyze={onAnalyze} onWatch={onWatch} onCopyLink={onCopyLink} watched={watched} analyzing={analyzing} breadcrumbLabel={catalogueHeaderText(language, 'strategies')} header={<ClientCatalogueDetailHeader value={value} title={title} owner={owner} onCopy={onCopy} onAnalyze={onAnalyze} onWatch={onWatch} onCopyLink={onCopyLink} watched={watched} analyzing={analyzing} onVerify={onVerify}/> }>
    <div hidden={navigation.full}>
    <section className="catalogue-performance" aria-label={text.performance}>
      <h3>{text.performance}</h3>
      <div className="catalogue-kpis">
        <div data-catalogue-metric="ret"><small>{period} {text.return}</small><b>{window ? sharedPercent(window.ret, language) : '—'}</b></div>
        <div data-catalogue-metric="mdd"><small>{period} {text.mdd}</small><b>{window ? sharedPercent(window.mdd, language, 1, false) : '—'}</b></div>
        <div data-catalogue-metric="win"><small>{text.win}</small><b>{result.n >= 5 ? sharedPercent(result.winRate, language, 0, false) : '—'}</b></div>
        <div data-catalogue-metric="n"><small>{text.trades}</small><b>{number(result.n, 0)}</b></div>
      </div>
      <ClientCatalogueChartControls days={days} mode={mode} interval={interval} onDays={setDays} onMode={setMode} onInterval={setInterval}/>
      <ClientCatalogueChart value={value} days={days} mode={mode} interval={interval}/>
      <p className="catalogue-since">{date(result.params.startI)} · {text.since} {sharedPercent(result.ret, language)}</p>
      <p className="mt2">{text.calendarScope}</p>
      <ClientSharedPerformance catalogue={value}/>
    </section>
    {value.judgments && <ClientCatalogueJudgments messages={value.judgments} calendar={value.calendar} sourcePreview={value} active={!navigation.full && location.detailTab !== 'info'}/>}
    <ClientCatalogueOrders rows={orders} date={date} onOpen={navigation.open} onBack={navigation.back} openRef={navigation.openRef}/>
    </div>
    {navigation.full && <ClientCatalogueOrders rows={orders} date={date} full onOpen={navigation.open} onBack={navigation.back} headingRef={navigation.headingRef}/>}
  </ClientSharedDetailShell>
}
