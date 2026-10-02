import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { catalogueAssets, catalogueTitle, findCatalogueStrategy } from '../client-catalogue'
import { catalogueDateReader } from '../client-catalogue-presentation'
import { catalogueCopyDecimal } from '../client-catalogue-copy-setup'
import { useCatalogueCopyInspection, type CatalogueCopyInspection, type CatalogueCopyView } from '../use-catalogue-copy-account'
import type { SharedLocation } from '../client-shared-strategies'
import { catalogueCopyLocation } from '../client-shared-navigation'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { copyHistoryText } from '../client-copy-history-copy'
import { copyActionText, copySummaryText } from '../client-copy-trading-copy'
import { commonBacktestText } from '../client-common-backtest-copy'
import words from '../client-catalogue-copy-management-copy.json'
import settingsCopy from '../client-settings-copy.json'
import common from '../client-catalogue-ui-copy.json'
import setupWords from '../client-catalogue-copy-setup-copy.json'
import '../client-copy-trading.css'
import '../client-catalogue-copy-management.css'

type DialogType = ComponentType<{ title: string; children: ReactNode; onClose: () => void; trigger?: HTMLElement; focusKey?: string }>
type Navigation = (next: SharedLocation, replace?: boolean) => void
type Action = { kind: 'adjust' | 'stop' | 'flat' | 'settings'; trigger?: HTMLElement }
type Tab = 'pos' | 'hist' | 'share' | 'bal' | 'tx'
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
function text(language: ClientLanguage, key: keyof typeof words) { return words[key][languages.indexOf(language)] }
const tone = (v: number) => v > 0 ? 'u' : v < 0 ? 'd' : ''
function useFormat() {
  const { language } = useClientPreferences()
  const money = (v: number | undefined) => v === undefined || !Number.isFinite(v) ? '—' : new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  const percent = (v: number | undefined) => v === undefined || !Number.isFinite(v) ? '—' : `${v.toLocaleString(language, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%`
  const date = (v: number) => new Date(v).toLocaleString(language, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  return { language, money, percent, date, t: (key: keyof typeof words) => text(language, key) }
}

export function ClientCatalogueCopyHistoryList({ account, navigate, headingLevel = 3 }: { account: CatalogueCopyView; navigate: Navigation; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const { language, t, money } = useFormat()
  if (!account.owner || !account.error && !account.state?.copies.length) return null
  return <section className="catalogue-copy-history"><Heading>{t('back')}</Heading>{account.error ? <p role="alert">{t('storage')} <button type="button" className="obtn" onClick={account.store.retry}>{common[language].retry}</button></p> : <ul>{account.state?.copies.map(({ record, settlement }) => <li key={record.id}><button type="button" className="nm" onClick={() => navigate(catalogueCopyLocation(record.id))}>{catalogueTitle(findCatalogueStrategy(record.binding.strategyId)!.name)}</button><span>{record.status === 'closed' ? t('stopped') : record.stopI !== undefined ? t('winding') : t('back')}</span>{settlement && <span>{copySummaryText(language, '정산 완료, {amount} 회수', { amount: money(settlement.back) })}</span>}</li>)}</ul>}</section>
}

function CopyRow({ label, secondary, amount, note, className = '' }: { label: ReactNode; secondary?: ReactNode; amount: ReactNode; note?: ReactNode; className?: string }) {
  return <div className="cq-row"><div className="a"><b>{label}</b>{secondary && <span>{secondary}</span>}</div><div className="z"><b className={'num ' + className}>{amount}</b>{note && <span>{note}</span>}</div></div>
}
function CopyEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="cq-list"><div className="cq-row cq-none"><div className="a"><b>{title}</b>{children && <span>{children}</span>}</div></div></div>
}
function CopyPositions({ data, onFlat, busy }: { data: CatalogueCopyInspection; onFlat: () => void; busy: boolean }) {
  const { language, money, percent, t } = useFormat(), c = common[language]
  const { entry: { record }, value, projection: { calculation: d } } = data
  const open = value.result.state.open
  const positions = d.posOpen && record.status === 'active' ? (Array.isArray(open) ? open : open ? [open] : []).filter(p => record.stopI === undefined || p.entry <= record.stopI) : []
  const total = positions.reduce((n, p) => n + ('w' in p ? p.w ?? 1 : 1), 0) || 1
  const price = (v: number) => v.toLocaleString(language, { maximumFractionDigits: 6 })
  const config = value.strategy
  const rule = config.fut ? config.trail ? t('favorable').replace('{percent}', String(config.trail)) : config.sl ? t('adverse').replace('{percent}', String(config.sl)) : 'exitN' in config && config.exitN ? t('baseline').replace('{days}', String(config.exitN)) : t('flip')
    : config.kind === 'agent' ? t('trail').replace('{percent}', String(config.trail)) : config.sl !== undefined ? `${commonBacktestText(language, 'stop')} ${config.sl}%, ${commonBacktestText(language, 'take')} ${config.tp == null ? commonBacktestText(language, 'noTake') : `+${config.tp}%`}` : t('same')
  return <section className="cq-sec cq-positions" aria-label={t('positions')}><div className="cq-sh"><h3>{t('positions')}{positions.length > 0 && <span> {positions.length}</span>}</h3>{positions.length > 0 && <button type="button" className="cq-gray" disabled={busy} onClick={onFlat}>{record.stopI !== undefined ? t('endFlat') : copySummaryText(language, '포지션 전체 정리')}</button>}</div>
    {!positions.length ? <CopyEmpty title={t('positionEmpty')}>{record.status === 'closed' ? t('closedEmpty') : record.stopI !== undefined ? t('windingEmpty') : undefined}</CopyEmpty> : <><div className="cq-list">{positions.map(p => {
      const weight = ('w' in p ? p.w ?? 1 : 1) / total, unreal = d.unreal * weight
      return <CopyRow key={p.k + ':' + p.tid} label={<>{catalogueTitle(p.k)} {'side' in p && p.side < 0 ? c.short : c.long}{'lev' in p && p.lev > 1 ? ' ' + p.lev + '×' : ''}</>}
        secondary={<>{t('allocated')} {money(d.invested * weight)} · {t('sourceEntry')} {price(p.ep)} · {copySummaryText(language, '현재가')} {price(p.px)}<br/>{rule}</>}
        amount={(unreal > 0 ? '+' : '') + money(unreal)} className={tone(unreal)} note={t('sourceReturn') + ' ' + percent(p.chg)}/>
    })}</div><p className="cq-basis">{t('positionsBasis')}</p></>}
  </section>
}
function CopyPanel({ budget, data }: { budget: boolean; data: CatalogueCopyInspection }) {
  const { language, money, percent, date, t } = useFormat(), c = common[language]
  const { entry: { record }, value, projection: { calculation: d } } = data
  const day = (i: number) => catalogueDateReader(value.calendar)(i).toLocaleDateString(language)
  const price = (v: number) => v.toLocaleString(language, { maximumFractionDigits: 6 })
  if (budget) return <div className="cq-list cq-budget">{record.ledger.map((event, i) => {
    const lot = d.lots[i], added = event.type === 'add'
    const applied = !added || !lot ? undefined : lot.inv === null || d.stopI !== null && lot.inv > d.stopI ? t(record.status === 'active' && d.stopI === null ? 'awaiting' : 'returned') : lot.inv === lot.i ? t('immediately') : day(lot.inv)
    return <CopyRow key={i} label={t(added ? 'budgetAdd' : 'budgetOut')} secondary={<time dateTime={new Date(event.at).toISOString()}>{date(event.at)}</time>} amount={(added ? '+' : '−') + money(event.amount)} note={applied}/>
  }).reverse()}</div>
  return <>{!data.trades.length ? <CopyEmpty title={t('tradeEmpty')}>{t('tradeEmptyHint')}</CopyEmpty> : <div className="cq-list cq-trades">{data.trades.map(({ source: p, invested, pnl }) => <details className="cq-row cq-det" key={p.id} data-trade-id={p.id}>
    <summary><div className="a"><b>{catalogueTitle(p.asset)} {p.side !== undefined && p.side < 0 ? c.short : c.long}{p.lev && p.lev > 1 ? ' ' + p.lev + '×' : ''}</b><span>{t('closedOn').replace('{date}', day(p.exit))}, {t(p.kind === 'sl' ? 'exitStop' : p.kind === 'tp' ? 'exitTarget' : p.kind === 'time' ? 'exitTime' : p.kind === 'trail' ? 'exitTrail' : p.kind === 'rot' ? 'exitRotation' : 'exitRule')}</span></div><div className="z"><b className={'num ' + tone(pnl)}>{(pnl > 0 ? '+' : '') + money(pnl)}</b><span>{t('sourceReturn')} {percent(p.pnl * 100)}</span></div></summary>
    <div className="cq-more"><span>{c.entry} {day(p.entry)} · {t('sourceEntry')} {price(p.ep)}</span><span>{t('sourceExit')} {price(p.xp)} · {t('allocated')} {money(invested)}</span></div>
  </details>)}</div>}<p className="cq-basis">{t('recordBasis')}</p></>
}

export function ClientCatalogueCopyManagement({ account, id, tab = 'pos', navigate, Dialog, onBack, backLabel, signedIn, onLogin, onHelp }: {
  account: CatalogueCopyView; id: string; tab?: Tab; navigate: Navigation; Dialog: DialogType; onBack: () => void; backLabel?: string; signedIn: boolean; onLogin: () => void; onHelp?: (trigger: HTMLElement) => void
}) {
  const inspection = useCatalogueCopyInspection(account, id, true), { language, money, percent, t } = useFormat()
  const [action, setAction] = useState<Action | null>(null), title = useRef<HTMLHeadingElement>(null)
  const tabsId = useId(), tabs = useRef<HTMLDivElement>(null), budget = tab === 'bal'
  const data = inspection.data, entry = account.state?.copies.find(item => item.record.id === id)
  const [known, setKnown] = useState(entry)
  if (entry && known !== entry) setKnown(entry)
  const record = entry?.record ?? known?.record
  const strategy = record && findCatalogueStrategy(record.binding.strategyId)
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [id])
  const open = (kind: Action['kind']) => setAction({ kind, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined })
  if (!signedIn) return <div className="cpp-empty"><b>{copySummaryText(language, '로그인 후 카피를 관리할 수 있어요')}</b><button type="button" className="wbtn" onClick={onLogin}>{copySummaryText(language, '로그인')}</button></div>
  const d = data?.projection.calculation
  const status = account.error || !record ? '—' : record.status === 'closed' ? t('stopped') : record.stopI !== undefined ? t('winding') : t('active')
  const date = record ? new Date(entry?.settlement?.at ?? record.ledger[0].at).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const line = !record ? '' : record.status === 'closed' ? t('ended').replace('{date}', date) : record.stopI !== undefined ? t(entry?.stopMode === 'wait' ? 'waitingExit' : 'manualExit') : t('started').replace('{date}', date)
  const net = data ? data.entry.settlement?.net ?? d?.net : undefined
  const metrics: [string, number | undefined, boolean][] = [[t('available'), d?.avail, false], ...(record?.status === 'active' && d && d.waiting > 0.005 ? [[t('pendingAmount'), d.waiting, false] as [string, number, boolean]] : []),
    [copySummaryText(language, '미실현 손익'), d?.unreal, true], [copySummaryText(language, '실현 손익'), d?.realized, true],
    [copySummaryText(language, '수익 분배 지급'), data ? data.entry.settlement?.share ?? d?.share : undefined, false], [t('deposited'), d?.inv, false]]
  const selectTab = (nextBudget: boolean) => navigate(catalogueCopyLocation(id, nextBudget ? 'bal' : 'hist'), true)
  return <section className="cpp cpx cq-page catalogue-copy-management" aria-label={t('title')} data-copy-id={id}>
    <button type="button" className="ss3-back cq-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>{backLabel ?? t('back')}</button>
    <header className="cq-hd"><h2 className="cpp-nick" ref={title} tabIndex={-1}>{strategy ? catalogueTitle(strategy.name) : t('title')}</h2><p>{line} {strategy && <button type="button" className="cq-link" onClick={() => navigate({ nick: strategy.id, period: 'all' })}>{t('sourceLink')}</button>}</p></header>
    <section className="cq-hero" aria-label={t('current')}><small>{t('current')} <span className="cpp-meta">{status}</span></small><div className="big num" data-metric="current" tabIndex={0} role="region" aria-label={t('current')}>{money(d?.est)}</div>
      <div className="cq-pl"><span>{t('net')} <b className={'num ' + tone(net ?? 0)} data-metric="net">{(net !== undefined && net > 0 ? '+' : '') + money(net)}</b></span><span>{t('myReturn')} <b className={'num ' + tone(d?.myPct ?? 0)}>{percent(d === undefined ? undefined : d.myPct * 100)}</b></span></div>
      <p className="cq-cmp">{t('compare')} <b className={'num ' + tone(d?.pnlPct ?? 0)}>{percent(d === undefined ? undefined : d.pnlPct * 100)}</b></p>
      {d && d.grossIn > 0 && (record?.status === 'active' && d.waiting > 0.005 ? <p className="cq-why">{t('waitingBudget').replace('{amount}', money(d.waiting))}</p> : Math.abs((d.myPct - d.pnlPct) * 100) >= 1 && <p className="cq-why">{t('timingWhy')}</p>)}
    </section>
    {record?.status === 'active' && <div className="cq-acts">{record.stopI === undefined ? <><button type="button" className="cq-cta" disabled={!data || account.busy} onClick={() => open('adjust')}>{t('budget')}</button><button type="button" className="cq-link" onClick={() => open('settings')}>{copySummaryText(language, '설정')}</button><button type="button" className="cq-link" disabled={!data || account.busy} onClick={() => open('stop')}>{t('stop')}</button></> : <button type="button" className="cq-cta" disabled={!data || account.busy} onClick={() => open('flat')}>{t('endFlat')}</button>}</div>}
    <details className="cq-amt"><summary>{t('amountDetails')}</summary><div className="cq-list">{metrics.map(([label, amount, signed]) => <CopyRow key={label} label={label} amount={<span data-metric={label}>{(signed && amount !== undefined && amount > 0 ? '+' : '') + money(amount)}</span>} className={signed ? tone(amount ?? 0) : ''}/>)}</div></details>
    {account.error ? <p role="alert" className="copy-storage-error">{t('storage')} <button type="button" className="obtn" onClick={inspection.retry}>{common[language].retry}</button></p> : !record ? <div className="cpp-empty">{copySummaryText(language, '카피를 찾을 수 없어요')}</div> : !data ? <p role="status" aria-busy={inspection.state === 'loading'}>{common[language][inspection.state === 'error' ? 'failed' : 'loading']}{inspection.state === 'error' && <button type="button" className="obtn" onClick={inspection.retry}>{common[language].retry}</button>}</p> : <>
      <CopyPositions data={data} busy={account.busy} onFlat={() => open('flat')}/>
      <section className="cq-sec"><div className="cq-tabs" role="tablist" aria-label={copyHistoryText(language, 'tabs')} ref={tabs} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
        event.preventDefault()
        const next = event.key === 'Home' ? false : event.key === 'End' ? true : !budget
        tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next ? 1 : 0]?.focus({ preventScroll: true })
        selectTab(next)
      }}>{([false, true] as const).map(isBudget => <button type="button" role="tab" key={String(isBudget)} id={tabsId + (isBudget ? '-budget' : '-trades')} aria-controls={tabsId + '-panel'} aria-selected={budget === isBudget} tabIndex={budget === isBudget ? 0 : -1} className={budget === isBudget ? 'on' : ''} onClick={() => selectTab(isBudget)}>{t(isBudget ? 'budgetHistory' : 'trades')}</button>)}</div>
        <div role="tabpanel" tabIndex={0} id={tabsId + '-panel'} aria-labelledby={tabsId + (budget ? '-budget' : '-trades')}><CopyPanel budget={budget} data={data}/></div>
      </section>
    </>}
    {onHelp && <p className="cq-help"><button type="button" className="cq-link" onClick={event => onHelp(event.currentTarget)}>{settingsCopy.help[language]}</button></p>}
    <p className="cpp-foot cq-basis">{t('unit')} · {common[language].boundary}</p>
    {action && record && <CatalogueCopyAction key={id + ':' + action.kind} account={account} id={id} record={record} data={data} loadState={inspection.state} action={action} Dialog={Dialog} retry={inspection.retry} onAdjust={() => setAction({ ...action, kind: 'adjust' })} onClose={() => setAction(null)} onAdjusted={() => selectTab(true)}/>}
  </section>
}

function CatalogueCopyAction({ account, id, record, data, loadState, action, Dialog, retry, onClose, onAdjust, onAdjusted }: {
  account: CatalogueCopyView; id: string; record: CatalogueCopyInspection['entry']['record']; data?: CatalogueCopyInspection; loadState: 'loading' | 'error' | 'ready'; action: Action; Dialog: DialogType; retry: () => void; onAdjust: () => void; onClose: () => void; onAdjusted: () => void
}) {
  const { language, t, money } = useFormat(), strategy = findCatalogueStrategy(record.binding.strategyId), sw = setupWords[language], inputId = useId()
  const [amount, setAmount] = useState(''), [direction, setDirection] = useState<'add' | 'out'>('add'), [mode, setMode] = useState<'now' | 'wait' | 'manual'>('now')
  const [failed, setFailed] = useState(false), [confirmLoss, setConfirmLoss] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => { pending.current?.abort() }, [])

  const raw = catalogueCopyDecimal(amount), available = data && (direction === 'add' ? account.state?.spot : data.projection.calculation.avail)
  const valid = Boolean(data && available !== undefined && Number.isFinite(raw) && raw > 0 && raw <= available)
  const disabled = account.busy || !data || Boolean(account.error) || record.status !== 'active'
    || (action.kind === 'adjust' || action.kind === 'settings') && record.stopI !== undefined
  useLayoutEffect(() => {
    if (!disabled) return
    const dialog = actionsRef.current?.closest('dialog'), active = document.activeElement
    if (dialog && (active === document.body || active instanceof HTMLElement && dialog.contains(active) && active.matches(':disabled'))) {
      dialog.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    }
  }, [disabled])
  const retryWithFocus = (event: MouseEvent<HTMLButtonElement>) => {
    // Successful reads remove this button. Keep the keyboard in the same dialog
    // without moving a user's still-enabled input or repeating the mutation.
    event.currentTarget.closest('dialog')?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    retry()
  }
  const submit = async () => {
    if (pending.current || disabled || action.kind === 'adjust' && !valid) return
    const request = new AbortController(); pending.current = request; setFailed(false)
    const result = await (action.kind === 'adjust' ? account.store.adjust(id, raw, direction, Date.now(), confirmLoss, request.signal) : action.kind === 'stop' ? account.store.stop(id, mode, Date.now(), request.signal) : account.store.flatten(id, Date.now(), request.signal))
    if (request.signal.aborted) return
    pending.current = null
    if (!result.ok) { if (result.error === 'confirm-loss') setConfirmLoss(true); else setFailed(true); return }
    onClose(); if (action.kind === 'adjust') onAdjusted()
  }
  return <Dialog title={action.kind === 'adjust' ? t('budget') : action.kind === 'settings' ? t('copySettings') : action.kind === 'stop' ? t('stop') : copySummaryText(language, '포지션 전체 정리')} onClose={onClose} trigger={action.trigger}>
    {account.error && <p role="alert">{t('storage')} <button type="button" className="obtn" onClick={retryWithFocus}>{common[language].retry}</button></p>}
    {!account.error && !data && <p role="status">{common[language][loadState === 'error' ? 'failed' : 'loading']}{loadState === 'error' && <button type="button" className="obtn" onClick={retryWithFocus}>{common[language].retry}</button>}</p>}
    {action.kind === 'settings' ? <><p>{t('settingHint')}</p><dl className="catalogue-copy-settings"><div><dt>{t('copyMethod')}</dt><dd>{t('sourceRatio')}</dd></div><div><dt>{t('startDate')}</dt><dd>{new Date(record.ledger[0].at).toLocaleDateString(language)}</dd></div><div><dt>{t('assets')}</dt><dd>{strategy ? catalogueAssets(strategy).map(catalogueTitle).join(', ') : '—'}</dd></div><div><dt>{sw.budget}</dt><dd>{account.error ? '—' : money(record?.settings.amount)}</dd></div><div><dt>{sw.loss}</dt><dd>{record?.settings.loss}%</dd></div><div><dt>{sw.timing}</dt><dd>{record?.settings.existing === 'copy' ? sw.current : sw.next}</dd></div><div><dt>{sw.cap}</dt><dd>{record?.settings.cap}%</dd></div></dl></>
      : action.kind === 'adjust' ? <><div className="cpa-tgl" role="group" aria-label={copyActionText(language, '잔고 조정 방식')}>{(['add', 'out'] as const).map(value => <button type="button" aria-pressed={direction === value} className={direction === value ? 'on' : ''} key={value} disabled={account.busy} onClick={() => { setDirection(value); setConfirmLoss(false); setFailed(false) }}>{t(value === 'add' ? 'added' : 'withdrawn')}</button>)}</div><label htmlFor={inputId}>{copyActionText(language, '조정 금액')}</label><div className="cps-in"><input id={inputId} inputMode="decimal" value={amount} autoComplete="off" disabled={account.busy} aria-invalid={Boolean(amount && !valid)} onChange={e => { setAmount(e.target.value); setConfirmLoss(false); setFailed(false) }}/><span className="un">USD</span><button type="button" className="mx" disabled={disabled} onClick={() => { setAmount(String(available ?? '')); setConfirmLoss(false); setFailed(false) }}>{sw.max}</button></div><p>{copySummaryText(language, '가용')} {money(available)}</p>{amount && !valid && !disabled && <p role="alert">{copyActionText(language, raw > 0 ? direction === 'add' ? '스팟 잔고보다 커요' : '출금 가능 금액을 넘었어요' : '0보다 큰 금액을 입력해주세요')}</p>}{confirmLoss && <p role="alert">{copyActionText(language, '잠깐, 손실 구간이에요')}</p>}</>
        : action.kind === 'stop' ? <><p>{t('stopHint')}</p><div className="catalogue-copy-stop">{(['now', 'wait', 'manual'] as const).map(value => <label key={value}><input type="radio" name={inputId} value={value} checked={mode === value} disabled={account.busy} onChange={() => setMode(value)}/><span>{t(value)}</span></label>)}</div></>
          : <p>{copyActionText(language, '열려 있는 카피 포지션을 현재가로 정리해요.')} {record?.stopI !== undefined ? t('endFlat') : copySummaryText(language, '포지션이 없는 동안에도 카피는 유지돼요.')}</p>}
    {failed && <p role="alert">{sw.failed}</p>}
    <div className="ss3-dacts" ref={actionsRef}><button type="button" className="obtn" onClick={onClose}>{action.kind === 'settings' ? sw.close : copyActionText(language, '취소')}</button>{action.kind === 'settings' && <button type="button" className="wbtn" disabled={disabled} onClick={onAdjust}>{t('budget')}</button>}{action.kind !== 'settings' && <button type="button" className="wbtn" disabled={disabled || action.kind === 'adjust' && !valid} aria-busy={account.busy} onClick={() => { void submit() }}>{copyActionText(language, '확인')}</button>}</div>
  </Dialog>
}
