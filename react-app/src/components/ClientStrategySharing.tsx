import type { BrokerServicePresentation } from '../client-broker-presentation'
import { connectedMyExchanges, effectiveMyExchange, matchesMyExchange, selectedMyExchanges, type MyExchangeFilter } from '../client-my-exchanges'
import { ClientMyExchanges, ClientMyExchangeResult } from './ClientMyExchanges'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { sourceSharedStrategies, sharedPeriodResult, sharedPeriods, sharedAnalysisRequest, type SharedLocation, type SharedPeriod, type SharedStrategy } from '../client-shared-strategies'
import { delegationQuestions, delegationBudgets } from "../client-delegation-fixtures"
import { evaluateDelegation } from '../client-delegation-engine'
import { sourceTerminalDate, sourceTerminalPrices } from '../client-terminal-source-fixture'
import type { SharedCopyRequest } from '../client-shared-copy'
import type { SharedFollowRecord, SharedFollowStatus } from '../client-shared-follow'
import { useClientPreferences } from '../client-preferences'
import { researchCopy } from '../client-research-copy'
import { sharingCopy, type SharingCopyKey } from '../client-sharing-copy'
import { sharingDetailCopy, type SharingDetailCopyKey } from '../client-sharing-detail-copy'
import { sharedCopyCopy, type SharedCopyCopyKey } from '../client-shared-copy-copy'
import { sharedFollowCopy, type SharedFollowCopyKey } from '../client-shared-follow-copy'
import { ClientSharedStrategyDetail } from './ClientSharedStrategyDetail'
import { ClientSharedFollowList } from './ClientSharedFollowList'
import { useCatalogueCopyAccount } from '../use-catalogue-copy-account'
import { ClientCatalogueCopyManagement, ClientCatalogueCopyHistoryList } from './ClientCatalogueCopyManagement'
import { catalogueCopyLocation } from '../client-shared-navigation'
import { ClientStrategyCreator, type ClientStrategyCreatorProps } from './ClientStrategyCreator'
import { ClientUpgradeSheet } from './ClientUpgradeSheet'
import { ClientStrategyFilters } from './ClientStrategyFilters'
import { ClientStrategyPagination } from './ClientStrategyPagination'
import { paginateSourceStrategies } from '../client-strategy-pagination'
import { ClientStrategyListCard } from './ClientStrategyListCard'
import { strategyListPerformance } from '../client-strategy-list-performance'
import { sharingSortOptions, sharingKindOptions, sharingMarketOptions } from '../client-strategy-filter-options'
import { matchesStrategyClassification, type StrategyKindFilter } from '../client-strategy-classification'
import type { CreatorCandidate, CreatorPublication } from '../client-strategy-creator-store'
import type { SharingPreferences, SharingPreferenceSnapshot } from '../client-sharing-preferences'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import { ClientCopyTrading, ClientCopyDashboard } from './ClientCopyTrading'
import { ClientCopyStorageRecovery } from './ClientCopyStorageRecovery'
import { copyTraderLocation } from '../client-shared-strategies'
import { useCopyPreviewAccount } from '../use-copy-preview-account'
import { copyTradingLabel } from '../client-copy-trading-copy'
import { bindSharingMetricDetails, sharingActionFailed, sharingUnavailable, type SharingServicePresentation } from '../client-sharing-presentation'
import { ClientSharedMetricDetails } from './ClientSharedMetricDetails'
import type { CopyServiceFollowDraft } from '../client-copy-service-data'
import { catalogueStrategies, findCatalogueStrategy } from '../client-catalogue'
import { catalogueIdentity, catalogueAnalysisRequest } from '../client-catalogue-presentation'
import type { CataloguePreviewResult } from '../client-catalogue-preview'
import { useClientCatalogue } from '../use-client-catalogue'
import catalogueCopy from '../client-catalogue-ui-copy.json'
import { lazy, Suspense } from 'react'
import type { CatalogueBacktestUseBinding } from '../client-catalogue-backtest'
const ClientCatalogueBacktest = lazy(() => import('./ClientCatalogueBacktest'))
import { ClientCatalogueStrategyDetail } from './ClientCatalogueStrategyDetail'
import { ClientCatalogueCopySetup } from './ClientCatalogueCopySetup'
import { catalogueCopyScope, type CatalogueCopySetup } from '../client-catalogue-copy-setup'
import '../client-strategy-sharing.css'

const pct = sharedPercent
type CardRow = Pick<SharedStrategy, 'nick' | 'asset' | 'followers' | 'score' | 'me' | 'title' | 'description' | 'kind' | 'market' | 'glyph' | 'venue'> & {
  result: Pick<SharedStrategy['result'], 'ret' | 'mdd' | 'winRate' | 'n'>
  strategy?: SharedStrategy
}
const cardRow = (strategy: SharedStrategy): CardRow => ({ ...strategy, strategy })
type ListingRow = Pick<CardRow, 'nick' | 'asset' | 'followers' | 'me' | 'title' | 'kind' | 'market' | 'glyph' | 'venue' | 'strategy'> & { catalogueId?: string }
const cardRoute = (row: Pick<CardRow, 'nick' | 'me'>) => row.me ? 'me' : row.nick
function creatorCard(value: CreatorCandidate | CreatorPublication, nick: string, description: string, service = false): CardRow {
  const record = 'record' in value ? value.record : value
  const base: CardRow = { nick, asset: record.asset ?? '자산 정보 없음', title: record.name, description, me: true,
    score: record.score, result: { ret: record.ret, mdd: record.mdd, winRate: record.winRate, n: record.n } }
  if (!service && record.parameters) {
    try { const { result } = evaluateDelegation(record.parameters, 1); base.strategy = { ...base, parameters: record.parameters, result } }
    catch { /* Missing or invalid legacy curves are never reconstructed from another strategy. */ }
  }
  return base
}
const definitions = {
  ret: ['검증 수익', '선택한 검증 구간에서 전략 규칙을 그대로 실행했을 때의 누적 수익률이에요. 수수료 0.2%가 반영돼요.'],
  score: ['TETH 점수', '승률, 수익, 낙폭, 거래 활동 4축 가중 합산 점수(0~99)예요. 점수 배지를 누르면 축별 근거를 볼 수 있어요.'],
  mdd: ['최대 낙폭 (MDD)', '검증 구간에서 자산이 고점 대비 가장 많이 하락한 폭이에요. 보유 중 평가액 기준으로 계산해요.'],
  pf: ['손익비 (Profit Factor)', '총이익을 총손실로 나눈 값이에요. 1.5:1 이면 1을 잃는 동안 1.5를 벌었다는 뜻이에요.'],
  hold: ['평균 보유일', '진입부터 청산까지 평균 보유 기간이에요. 25봉이 넘으면 기간 청산 규칙이 실행돼요.'],
  n: ['거래 수', '검증 구간에서 발생한 체결 횟수예요. 표본이 적으면 점수에 페널티가 붙어요.'],
} as const

function SharingDialog({ title, children, onClose, step, trigger, focusKey }: { title: string; children: ReactNode; onClose: () => void; step?: number; trigger?: HTMLElement; focusKey?: string }) {
  const { language } = useClientPreferences()
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useEffect(() => {
    const el = ref.current!, origin = trigger ?? document.activeElement
    const scroll = document.getElementById('research-main')?.style
    const overflow = scroll?.getPropertyValue('overflow-y'), priority = scroll?.getPropertyPriority('overflow-y')
    el.showModal()
    scroll?.setProperty('overflow-y', 'hidden')
    return () => { el.close(); if (scroll) { if (overflow) scroll.setProperty('overflow-y', overflow, priority); else scroll.removeProperty('overflow-y') } if (origin instanceof HTMLElement && origin.isConnected && !origin.closest('[inert],[hidden]')) origin.focus({ preventScroll: true }) }
  }, [trigger])
  useEffect(() => {
    const body = ref.current?.querySelector<HTMLElement>('.ss3-dialog-body')
    if (body) body.scrollTop = 0
    ref.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [focusKey, step])
  return <dialog className="ss3-dialog" ref={ref} aria-labelledby={id} onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose() }} onKeyDown={e => {
    if (e.key === 'Escape' && (e.nativeEvent.isComposing || e.keyCode === 229)) { e.preventDefault(); e.stopPropagation() }
  }} onClick={e => { if (e.target !== e.currentTarget) return; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() }}><header><h2 id={id} tabIndex={-1}>{title}</h2><button type="button" aria-label={sharingDetailCopy(language, '닫기')} onClick={onClose}><X size={20} /></button></header><div className="ss3-dialog-body">{children}</div></dialog>
}

function ScoreDetails({ row, rows }: { row: SharedStrategy; rows: SharedStrategy[] }) {
  const { language } = useClientPreferences()
  const d = (key: SharingDetailCopyKey, values?: Record<string, string | number>) => sharingDetailCopy(language, key, values)
  const axes = [
    ['승률', 'winRate', 35, 60, .30, '%'], ['수익 (CAGR)', 'cagr', 0, 6, .28, '%'],
    ['낙폭 방어', 'mdd', -25, -6, .27, '%'], ['거래 활동', 'tradeVol', 9, 4, .15, ''],
  ] as const
  return <><p>{d('승률, 수익, 낙폭, 거래 활동 4개 축을 가중 합산한 0~99점이에요. 축을 보면 이 점수가 어디서 왔는지 알 수 있어요. 전부 검증 시뮬레이션 실계산 값입니다.')}</p>{axes.map(([label, key, lo, hi, weight, unit]) => {
    const normalize = (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
    // Match the source benchmark: seed strategies only, never the viewer's publication.
    const values = rows.filter(r => !r.me).map(r => r.result[key]).filter(Number.isFinite).sort((a, b) => a - b), mid = Math.floor(values.length / 2)
    const median = values.length ? (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2) : null
    const value = row.result[key], normalized = normalize(value)
    return <div className="ss3-score-axis" key={key}><div><span>{d(label)} {sharedNumber(value, language)}{unit}</span><span>{d('기여')} <b>{sharedNumber(normalized * weight * 100, language)}</b> / {d('{points}점', { points: (weight * 100).toFixed(0) })}</span></div><div className="ss3-score-bar"><i style={{ width: `${normalized * 100}%` }} />{median !== null && <u style={{ left: `${normalize(median) * 100}%` }} title={d('공유 전략 중앙값 {value}', { value: `${sharedNumber(median, language)}${unit}` })} />}</div>{median !== null && <small>{d('공유 전략 중앙값 {value} 대비 {position}', { value: `${sharedNumber(median, language)}${unit}`, position: d(value >= median ? '위' : '아래') })}</small>}</div>
  })}{row.result.n < 6 && <p>{d(row.result.n < 4 ? '표본 4회 미만, 점수 35% 감점' : '표본 6회 미만, 79점 상한')}</p>}<p className="mt2">{d('기준 구간: 승률 35~60%, CAGR 0~6%, 낙폭 -25~-6%. 80점 이상만 실행 자격이 있어요.')}</p></>
}

function Sparkline({ row, indexToDate = sourceTerminalDate }: { row: SharedStrategy; indexToDate?: (index: number) => Date }) {
  const { language } = useClientPreferences()
  const id = useId(), eq = row.result.eq, min = Math.min(...eq.map(e => e.v)), max = Math.max(...eq.map(e => e.v)), last = eq.at(-1)!
  const first = eq[0], width = 528, height = 260
  const y = (v: number) => 6 + 234 - (v - min) / Math.max(max - min, 1e-9) * 234
  const step = Math.max(1, Math.floor(eq.length / 120))
  const samples = eq.filter((_, i) => i % step === 0 || i === eq.length - 1)
  const points = samples.map(e => `${(e.i - first.i) / Math.max(1, last.i - first.i) * width},${y(e.v)}`).join(' ')
  const color = row.result.ret >= 0 ? '#2fb98a' : '#ee766a'
  const month = useMemo(() => new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'short' }), [language])
  if (!eq.length) return <span className="mt2">{sharingCopy(language, '검증 곡선 없음')}</span>
  const date = (i: number) => {
    const d = indexToDate(i)
    if (language === 'ko') return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    const civilDate = new Date(0)
    civilDate.setUTCFullYear(d.getFullYear(), d.getMonth(), d.getDate())
    return month.format(civilDate)
  }
  return <svg className="ss3-eq" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={sharingCopy(language, '{nick} 검증 구간 누적 수익 곡선', { nick: row.nick })}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".15" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs><line className="base" x1="0" x2={width} y1={y(Math.min(Math.max(1, min), max))} y2={y(Math.min(Math.max(1, min), max))} /><path d={`M${points.split(' ').join(' L')} L528,242 L0,242 Z`} fill={`url(#${id})`} /><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" /><text x="522" y="14" textAnchor="end" style={{ fill: color }}>{pct((max - 1) * 100, language)}</text><text x="2" y="256">{date(first.i)}</text><text x="526" y="256" textAnchor="end">{date(last.i)}</text></svg>
}

function CopyPreview({ row, saved, serviceDraft, trigger, onClose, onConfirm, service }: { row?: SharedStrategy; saved?: SharedFollowRecord; serviceDraft?: CopyServiceFollowDraft; trigger?: HTMLElement; onClose: () => void; onConfirm?: (request: SharedCopyRequest, followId?: string) => void | Promise<void>; service?: SharingServicePresentation }) {
  const { language } = useClientPreferences()
  const c = (key: SharedCopyCopyKey, values?: Record<string, string | number>) => sharedCopyCopy(language, key, values)
  const base = useMemo(()=>saved ?? (serviceDraft && row ? {...row,parameters:{...row.parameters,sl:serviceDraft.sl,tp:serviceDraft.tp}} : row!),[saved,serviceDraft,row])
  const submitted = useRef(false), validation = useRef({ alive: false, version: 0, busy: false })
  useEffect(() => { const value = validation.current; value.alive = true; return () => { value.alive = false; value.version++ } }, [])
  const [busy, setBusy] = useState(false)
  const [validated, setValidated] = useState<{ score: number; result: SharedStrategy['result'] } | null>(null)
  // Adapter failures are redacted; source preview errors retain their local wording.
  const [errorState, setError] = useState<string | { service: 'action-failed' } | null>(null)
  const error = errorState && typeof errorState !== 'string' ? sharingActionFailed(language) : errorState
  const confirm = async () => {
    if (submitted.current || !onConfirm) return
    submitted.current = true
    setError(null)
    setBusy(true)
    const version = ++validation.current.version
    try { await onConfirm({ nick: base.nick, budgetIndex: budget, sl, tp, ...(saved ? { expectedFollow: { sessionId: saved.sessionId, parameters: saved.parameters, budgetIndex: saved.budgetIndex } } : {}) }, saved?.id ?? serviceDraft?.id); if (service && validation.current.alive && validation.current.version === version) onClose() }
    catch (error) { if (validation.current.alive && validation.current.version === version) { submitted.current = false; setError(service ? { service: 'action-failed' } : error instanceof Error ? error.message : '') } }
    finally { if (validation.current.alive && validation.current.version === version) setBusy(false) }
  }
  const [step, setStep] = useState(1), [budget, setBudget] = useState(saved?.budgetIndex ?? serviceDraft?.budgetIndex ?? 1), [sl, setSl] = useState(base.parameters.sl), [tp, setTp] = useState<number | null>(saved || serviceDraft ? base.parameters.tp : row!.parameters.tp ?? 8)
  const result = useMemo(() => service ? validated : evaluateDelegation({ ...base.parameters, sl, tp }, delegationBudgets[budget]), [base, sl, tp, budget, service, validated])
  const next = async () => {
    if (!service) { setStep(2); return }
    if (validation.current.busy) return
    setStep(2); setValidated(null); setError(null)
    if (!service.onValidateCopy) return
    const version = ++validation.current.version
    validation.current.busy = true; setBusy(true)
    try { const value = await service.onValidateCopy({ nick: base.nick, budgetIndex: budget, sl, tp }); if (validation.current.alive && validation.current.version === version) setValidated(value) }
    catch { if (validation.current.alive && validation.current.version === version) setError({ service: 'action-failed' }) }
    finally { if (validation.current.alive && validation.current.version === version) { validation.current.busy = false; setBusy(false) } }
  }
  const profitLabel = (value: number | null) => value === null ? c('기간 청산') : `+${sharedNumber(value, language, 'auto')}%`
  const takeProfit = profitLabel(tp)
  // Source tfSSPeriodLabel: configured span, never the detail chart's selected window.
  const span = service ? null : base.parameters.startI == null || base.parameters.endI == null ? null : base.parameters.endI - base.parameters.startI
  const period = span === null ? '검증 구간' : span >= sourceTerminalPrices.length - 62 ? '전체 기간' : span > 700 ? '최근 2년' : '최근 1년'
  const changes = [
    ...(sl !== base.parameters.sl ? [c('손절 {before}% → {after}%', { before: sharedNumber(base.parameters.sl, language, 'auto'), after: sharedNumber(sl, language, 'auto') })] : []),
    ...(tp !== base.parameters.tp ? [c('익절 {before} → {after}', { before: profitLabel(base.parameters.tp), after: takeProfit })] : []),
  ]
  const metrics = [
    ['예상 TETH 점수', result ? c('{score}점', { score: result.score }) : '—', result && result.score < 80 ? 'caution' : ''],
    ['검증 수익', result ? pct(result.result.ret, language) : '—', result ? result.result.ret >= 0 ? 'up' : 'down' : ''],
    ['최대 낙폭', result ? `${sharedNumber(result.result.mdd, language)}%` : '—', ''],
    ['거래 수', result ? c('{count}회', { count: result.result.n }) : '—', ''],
  ] as const
  const summary = [
    ['원본 전략', `${base.nick} (${base.asset})`],
    ['시작 예산', c(delegationQuestions[2].options[budget][0])],
    ['손절 / 익절', `${sharedNumber(sl, language, 'auto')}% / ${takeProfit}`],
    ['검증 구간', c(period)],
  ] as const
  return <SharingDialog title={c(step === 1 ? '전략 따라하기' : '예상 결과 확인')} step={step} trigger={trigger} onClose={onClose}>
    {step === 1 ? <>
      <div className="ss3-copy-source"><h3>{c('{nick} ({asset} 전략)', { nick: base.nick, asset: base.asset })}</h3>
        {row && <p>{c('검증 수익 {return}, TETH {score}점, 최대 낙폭 {mdd}%', { return: pct(row.result.ret, language), score: sharedNumber(row.score, language, 'auto'), mdd: sharedNumber(row.result.mdd, language) })}</p>}
      </div>
      <p className="ss3-copy-note">{c('이 전략의 설정을 복제해 내 조건으로 다시 검증한 뒤 실행해요. 계좌를 실시간으로 미러링하는 방식이 아니라, 검증을 통과해야 실행됩니다.')}</p>
      <label>{c('시작 예산')}<select value={budget} onChange={e => setBudget(Number(e.target.value))}>{delegationQuestions[2].options.map(([v, description], i) => <option key={v} value={i}>{c(v)} ({c(description)})</option>)}</select></label>
      <label>{c('손절선')}<select value={sl} onChange={e => setSl(Number(e.target.value))}>{Array.from(new Set([-3, -5, -8, -12, base.parameters.sl])).map(v => {
        const index = [-3, -5, -8, -12].indexOf(v)
        const option = delegationQuestions[4].options[index]
        return <option key={v} value={v}>{option ? `${c(option[0])} (${c(option[1])})` : `${sharedNumber(v, language, 'auto')}%`}</option>
      })}</select></label>
      <label>{c('익절 목표')}<select value={tp ?? 'none'} onChange={e => setTp(e.target.value === 'none' ? null : Number(e.target.value))}>
        {(saved || serviceDraft) && base.parameters.tp === null && <option value="none">{c('기간 청산')}</option>}
        {Array.from(new Set([8, 10, 12, 15, ...((saved || serviceDraft) && base.parameters.tp != null ? [base.parameters.tp] : [])])).map(v => <option key={v} value={v}>+{sharedNumber(v, language, 'auto')}%</option>)}
      </select></label>
    </> : <>
      <p className="ss3-copy-note">{c('내가 고른 손절 {stop}%, 익절 {takeProfit} 조건으로 원본 규칙을 같은 검증 구간에서 다시 계산한 결과예요. 과거 데이터 시뮬레이션이며, 확정하면 정식 재검증이 한 번 더 실행돼요.', { stop: sharedNumber(sl, language, 'auto'), takeProfit })}</p>
      <div className="ss3-matrix ss3-copy-metrics">{metrics.map(([key, value, tone]) => <div className="mx" key={key}><small>{c(key)}</small><b className={tone}>{result && key === '거래 수' && language !== 'ko' ? <>{result.result.n}<span className="ss3-copy-unit">{value.slice(String(result.result.n).length)}</span></> : value}</b></div>)}</div>
      {result && result.score < 80 && <p className="ss3-copy-warning">{c('이 조건은 예상 점수가 실행 기준(80점)에 못 미쳐요.')} {result.result.n < 6 && <>{c('표본 {count}회가 적어 점수에 페널티가 있어요.', { count: result.result.n })} </>}{c('확정은 가능하지만, 정식 검증에서 조건을 조정하게 될 수 있어요.')}</p>}
      {changes.length > 0 && <p className="ss3-copy-changes">{c('원본과 달라진 조건')}: {changes.join(', ')}</p>}
      <dl className="ss3-copy-summary">{summary.map(([key, value]) => <div key={key}><dt>{c(key)}</dt><dd>{value}</dd></div>)}</dl>
      <p className="ss3-copy-note" role="status">{service ? sharingUnavailable(language) : c(onConfirm ? '원본 합성 데이터로 검증하는 로컬 미리보기입니다. 실제 주문은 실행되지 않습니다.' : '전략 복제·재검증 서비스 연결 전입니다. 현재 조건은 저장되거나 실행되지 않습니다.')}</p>
    </>}
    {error !== null && <p role="alert">{error || c('검증을 시작하지 못했어요. 다시 시도해주세요.')}</p>}
    <p className="mt2">{step} / 3, {c(step === 1 ? '조건 설정' : '예상 결과')}</p>
    <div className="ss3-dacts"><button type="button" className="obtn" onClick={() => { if (step === 1) onClose(); else { validation.current.version++; validation.current.busy = false; submitted.current = false; setBusy(false); setValidated(null); setError(null); setStep(1) } }}>{c(step === 1 ? '취소' : '뒤로')}</button><button type="button" className="wbtn" disabled={busy || (step === 2 && (!onConfirm || (Boolean(service) && !result)))} aria-busy={busy} onClick={() => { void (step === 1 ? next() : confirm()) }}>{c(step === 1 ? '다음: 예상 결과 보기' : '확정하고 검증 시작')}</button></div>
  </SharingDialog>
}

export type SharedFollowSurface = {
  brokerPresentation?: BrokerServicePresentation
  servicePresentation?: SharingServicePresentation
  shouldFocus?: () => boolean
  /** Native shell heading for copy routes; initial/lazy focus remains intent-gated. */
  routeTitleRef?: RefObject<HTMLElement | null>
  onTabChange?: () => void
  noticeContent?: ReactNode
  onHelp?: (trigger: HTMLElement) => void
  /** Explicit public-preview gate only, never a service entitlement or order authority. */
  onPreviewCopyStart?: () => boolean
  onCatalogueCopy?: (strategyId: string) => void
  onCatalogueCopyAuth?: (strategyId: string) => void
  onCatalogueVerify?: (strategyId: string) => void
  onCatalogueBacktestUse?: (signal: AbortSignal, binding: Readonly<CatalogueBacktestUseBinding>) => void | Promise<void>
  /** Guest authentication intent; the host alone binds and consumes it. */
  onWatchAuth?: (strategyId: string) => void
  /** Public Main uses source list-only navigation; service consumers opt in after relocation. */
  routeSections?: boolean
  sectionReturn?: { label: string; onReturn: () => void }
  /** Explicit terminal-origin return, not a replacement for catalogue navigation. */
  copyManagementReturn?: { label: string; onReturn: () => void }
  /** Supplied presentation only; never inferred from login or a paid plan. */
  catalogueCopySetup?: CatalogueCopySetup
  viewPreferences?: { state: SharingPreferenceSnapshot; onChange: (patch: Partial<SharingPreferences>) => void; onQuery: (query: string) => void }
  followIntro?: { required: boolean; onContinue: () => void; onSubscribe?: () => void }
  followRows?: { record: SharedFollowRecord; status: SharedFollowStatus }[]
  onResumeFollow?: (id: string) => void
  onArchiveFollow?: (id: string) => void
  onRemoveFollow?: (id: string) => void
  creator?: Omit<ClientStrategyCreatorProps, 'renderPreview' | 'Dialog' | 'onNew' | 'loggedIn'>
}
type SharingNotice = string | { key: SharedFollowCopyKey } | { service: 'action-failed' | 'unavailable' }
type FollowIntroIntent = { owner: string | null; routeKey: string; href: string; nick: string; followId?: string; name: string; trigger?: HTMLElement; resultRevision: number }

export function ClientStrategySharing({ location, onNavigate, onAsk, onReturn, signedIn, onLogin, owner, mine, onCopy, creator: previewCreator, viewPreferences, brokerPresentation, followIntro, followRows = [], onResumeFollow, onArchiveFollow, onRemoveFollow, onPreviewCopyStart, onCatalogueCopy, onCatalogueCopyAuth, onCatalogueVerify, onCatalogueBacktestUse, onWatchAuth, copyManagementReturn, catalogueCopySetup, routeSections, servicePresentation: service, shouldFocus, routeTitleRef, onTabChange, noticeContent, onHelp }: SharedFollowSurface & { location: SharedLocation; onNavigate: (value: SharedLocation, replace?: boolean) => void; onAsk: (text: string) => void | Promise<void>; onReturn: () => void; signedIn: boolean; onLogin: () => void; owner: string | null; mine?: ReactNode; onCopy?: (request: SharedCopyRequest, followId?: string) => void }) {
  const { language } = useClientPreferences()
  const s = (key: SharingCopyKey, values?: Record<string, string | number>) => sharingCopy(language, key, values)
  const d = (key: SharingDetailCopyKey, values?: Record<string, string | number>) => sharingDetailCopy(language, key, values)
  const f = (key: SharedFollowCopyKey, values?: Record<string, string | number>) => sharedFollowCopy(language, key, values)
  const noticeText = (value: SharingNotice) => typeof value === 'string' ? value : 'key' in value ? f(value.key)
    : value.service === 'action-failed' ? sharingActionFailed(language) : sharingUnavailable(language)
  const serviceMode = Boolean(service)
  const catalogue = useClientCatalogue(!service, owner, location.nick)
  const catalogueSelection = !service && location.nick && !location.view ? findCatalogueStrategy(location.nick) : undefined
  const setupScope = !service && signedIn ? catalogueCopyScope(catalogueCopySetup, owner, catalogueSelection?.id) : null
  const [setupOpen, setSetupOpen] = useState<{ scope: string; trigger?: HTMLElement } | null>(null)
  const [consumedResume, setConsumedResume] = useState<string | null>(null)
  if (setupOpen && setupOpen.scope !== setupScope) setSetupOpen(null)
  const catalogueText = catalogueCopy[language]
  const watchKey = `teth-sharing-watch:${owner === null ? 'guest' : `account:${encodeURIComponent(owner)}`}`
  const [previewSeeds] = useState(() => service ? [] : sourceSharedStrategies()), [localQuery, setLocalQuery] = useState('')
  const seeds = service?.strategies ?? previewSeeds
  const copyAccount = useCopyPreviewAccount(signedIn ? owner : null, JSON.stringify(location), !service)
  const catalogueAccount = useCatalogueCopyAccount(!service && signedIn ? owner : null)
  const [localPreferences, setLocalPreferences] = useState<SharingPreferences>({ tab: 'find', sort: 'pick', dir: 'desc', asset: 'all' })
  const { tab: storedTab, kind = 'all', market = 'all', myExchange = '', sort: storedSort, dir, page: savedPage } = viewPreferences?.state.preferences ?? localPreferences
  const tab = routeSections && !service ? location.section === 'library' ? 'follow' : location.section === 'publishing' ? 'mine' : 'find' : storedTab
  // Legacy choices are preserved in storage but no longer presented as a
  // different sort from the selected source menu. A new choice replaces them.
  const sort = storedSort === 'ret' || storedSort === 'fw' ? storedSort : 'pick'
  const query = viewPreferences?.state.query ?? localQuery
  const changePreferences = (patch: Partial<SharingPreferences>) => {
    const previous = viewPreferences?.state.preferences ?? localPreferences
    const filterChanged = (['sort', 'dir', 'kind', 'market', 'myExchange'] as const).some(key => Object.hasOwn(patch, key) && patch[key] !== previous[key])
    const next = savedPage !== undefined && filterChanged ? { ...patch, page: 1 } : patch
    if (viewPreferences) viewPreferences.onChange(next)
    else setLocalPreferences(previous => ({ ...previous, ...next }))
  }
  const setQuery = (next: string) => { if (next !== query && savedPage !== undefined) changePreferences({ page: 1 }); if (viewPreferences) viewPreferences.onQuery(next); else setLocalQuery(next) }
  const [watch, setWatch] = useState<string[]>(() => { if (service) return []; try { const saved: unknown = JSON.parse(sessionStorage.getItem(watchKey) ?? '[]'); return Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string').slice(0, 1000) : [] } catch { return [] } }), [copy, setCopy] = useState<{ row?: SharedStrategy; saved?: SharedFollowRecord; serviceDraft?: CopyServiceFollowDraft; trigger?: HTMLElement } | null>(null), [metric, setMetric] = useState<keyof typeof definitions | null>(null), [notice, setNotice] = useState<SharingNotice>('')
  const [followGate, setFollowGate] = useState<FollowIntroIntent | null>(null)
  const [metricSnapshot, setMetricSnapshot] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<'market' | 'exchange' | null>(null)
  const creator = useMemo(() => service ? service.creator ?? { candidates: [], publication: null, visible: false, nick: 'TETH', unavailableMessage: sharingUnavailable(language), onPublish: () => { throw new Error(sharingUnavailable(language)) }, onVisibility: () => { throw new Error(sharingUnavailable(language)) } } : previewCreator, [service, previewCreator, language])
  const publication = creator?.publication, creatorNick = creator?.nick ?? '나'
  const own = useMemo(() => publication ? creatorCard(publication, creatorNick, publication.description, Boolean(service)) : null, [publication, creatorNick, service])
  const rows = useMemo(() => own?.strategy && creator?.visible ? [...seeds, own.strategy] : seeds, [seeds, own, creator])
  const listings = useMemo<ListingRow[]>(() => [
    ...(service ? seeds.map(cardRow) : catalogueStrategies.map(strategy => ({ ...catalogueIdentity(strategy), catalogueId: strategy.id }))),
    ...(own && creator?.visible ? [own] : []),
    // The source catalogue replaces discovery, not saved legacy bookmarks.
    // Keep their own evidence/URLs in the explicit library only; unknown IDs
    // remain in storage and must never be assigned another strategy's result.
    ...(!service && tab === 'follow' ? seeds.filter(row => watch.includes(row.nick) && !findCatalogueStrategy(row.nick)).map(cardRow) : []),
  ], [seeds, service, own, creator?.visible, tab, watch])
  const [archive, setArchive] = useState<SharedFollowRecord | null>(null), [archiveError, setArchiveError] = useState<SharingNotice>('')
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const title = useRef<HTMLHeadingElement>(null), routeKey = JSON.stringify(location)
  const routeScope = JSON.stringify([owner, routeKey])
  const [lastRoute, setLastRoute] = useState(routeScope)
  if (lastRoute !== routeScope) { setLastRoute(routeScope); setCopy(null); setSetupOpen(null); setFollowGate(null); setOpenDropdown(null); setMetric(null); setArchive(null); setArchiveError(''); setNotice('') }
  const resumeScope = setupScope && catalogueCopySetup?.resumeId ? JSON.stringify([owner, catalogueSelection?.id, catalogueCopySetup.resumeId]) : null
  if (resumeScope && consumedResume !== resumeScope) { setConsumedResume(resumeScope); setSetupOpen({ scope: setupScope! }) }
  const introLifetime = useRef({ alive: false, version: 0 })
  const editView = useRef(tab)
  useLayoutEffect(()=>{editView.current=tab},[tab])
  const consumedIntro = useRef<FollowIntroIntent | null>(null)
  const latestIntro = useRef({ owner, routeKey, signedIn, followRows, seeds, followIntro, followGate })
  useLayoutEffect(() => { latestIntro.current = { owner, routeKey, signedIn, followRows, seeds, followIntro, followGate } }, [owner, routeKey, signedIn, followRows, seeds, followIntro, followGate])
  useLayoutEffect(() => {
    const lifetime = introLifetime.current
    lifetime.alive = true
    return () => { lifetime.alive = false; lifetime.version++ }
  }, [owner, routeKey])
  const clipboardRequest = useRef({ version: 0 })
  useEffect(() => {
    let href = window.location.href
    const closeDropdown = () => { if (href !== window.location.href) { href = window.location.href; setOpenDropdown(null) } }
    const events = ['hashchange', 'popstate', 'teth:navigate']
    events.forEach(event => window.addEventListener(event, closeDropdown))
    return () => events.forEach(event => window.removeEventListener(event, closeDropdown))
  }, [])
  useEffect(() => { const request = clipboardRequest.current; request.version++; return () => { request.version++ } }, [routeKey])
  const [watchBusyScope, setWatchBusyScope] = useState<string | null>(null)
  const watchBusy = watchBusyScope === routeScope
  const watchRequest = useRef<string | null>(null)
  const watched = signedIn ? service?.watched ?? watch : []
  const libraryWatches = service ? watched : watch
  const library = Boolean(routeSections && !service && location.section === 'library')
  const watchHeadingId = useId()
  const watchedListings = useMemo(() => {
    const ids = new Set(libraryWatches.map(id => findCatalogueStrategy(id)?.id ?? id))
    return listings.filter(row => ids.has(row.nick))
  }, [listings, libraryWatches])
  // Unknown IDs remain stored, but cannot make an empty section count as content.
  // Storage failures are not an empty account; their recovery UI stays mounted.
  const hideFollowEmpty = library && Boolean(watchedListings.length || copyAccount.state?.copies.length || catalogueAccount.state?.copies.length || copyAccount.storageError || catalogueAccount.error)
  const toggleWatch = async (nick: string) => {
    if (!signedIn) {
      const id = !service ? findCatalogueStrategy(nick)?.id : undefined
      if (id && onWatchAuth) onWatchAuth(id)
      else onLogin()
      return
    }
    if (service) {
      if (!service.onWatch || watchRequest.current === routeScope) return
      const version = introLifetime.current.version
      watchRequest.current = routeScope; setWatchBusyScope(routeScope)
      try { await service.onWatch(nick, !watched.includes(nick)) }
      catch { if (introLifetime.current.alive && introLifetime.current.version === version) setNotice({ service: 'action-failed' }) }
      finally { if (watchRequest.current === routeScope) watchRequest.current = null; if (introLifetime.current.alive && introLifetime.current.version === version) setWatchBusyScope(null) }
      return
    }
    const catalogueId = findCatalogueStrategy(nick)?.id
    const matches = (value: string) => catalogueId ? findCatalogueStrategy(value)?.id === catalogueId : value === nick
    const next = watch.some(matches) ? watch.filter(n => !matches(n)) : [...watch, nick]
    setWatch(next)
    try { sessionStorage.setItem(watchKey, JSON.stringify(next)) } catch { setNotice({ key: '관심 전략을 이 브라우저에 저장하지 못했어요. 현재 화면에서는 유지됩니다.' }) }
  }
  const [analysisScope, setAnalysisScope] = useState<string | null>(null)
  const analysisRequest = useRef({ scope: '', version: 0 })
  const analyze = async (strategy: SharedStrategy | CataloguePreviewResult, period: SharedPeriod) => {
    if (!signedIn) { onLogin(); return }
    if ((service && !service.onAnalyze) || analysisRequest.current.scope === routeScope) return
    const version = ++analysisRequest.current.version
    analysisRequest.current.scope = routeScope; setAnalysisScope(routeScope)
    const current = () => introLifetime.current.alive && analysisRequest.current.version === version
      && latestIntro.current.owner === owner && latestIntro.current.routeKey === routeKey
    try { if ('source' in strategy) { if (service) return; await onAsk(catalogueAnalysisRequest(strategy)) } else if (service) await service.onAnalyze?.(strategy, period); else await onAsk(sharedAnalysisRequest(strategy, period)) }
    catch (cause) { if (current()) setNotice(service ? { service: 'action-failed' } : cause instanceof Error ? cause.message : { key: '분석을 시작하지 못했어요. 다시 시도해주세요.' }) }
    finally { if (analysisRequest.current.version === version) analysisRequest.current.scope = ''; if (current()) setAnalysisScope(null) }
  }
  const copyLink = async () => {
    const request = ++clipboardRequest.current.version, href = window.location.href
    const url = service ? service.shareUrl?.(location) : href
    if (!url) { setNotice({ service: 'unavailable' }); return }
    const current = () => request === clipboardRequest.current.version && href === window.location.href
    try { await navigator.clipboard.writeText(url); if (current()) setNotice({ key: '전략 링크를 복사했어요' }) } catch { if (current()) setNotice(url) }
  }
  const row = location.nick === 'me' ? own?.strategy : seeds.find(r => r.nick === location.nick)
  // Preview evaluation is expensive and remains cached. Service getters are
  // synchronous display reads and may expose refreshed data with a stable port.
  const previewResult = useMemo(() => !serviceMode && row ? sharedPeriodResult(row, location.period) : null, [row, location.period, serviceMode])
  const serviceResults: Partial<Record<SharedPeriod, SharedStrategy['result'] | null>> = {}
  if (service && row) for (const period of Object.keys(sharedPeriods) as SharedPeriod[]) {
    try { serviceResults[period] = service.periodResult(row, period) }
    catch { serviceResults[period] = null /* Provider failures are not public copy. */ }
  }
  const result = service ? serviceResults[location.period] ?? null : previewResult
  // Compare only when the supplied result object changes. Equal replacement
  // snapshots retain selection; no synthetic financial revision is inferred.
  const resultFingerprint = useMemo(() => serviceMode ? JSON.stringify(result) : '', [serviceMode, result])
  const [observedResult, setObservedResult] = useState({ fingerprint: resultFingerprint, revision: 0 })
  const resultRevision = observedResult.revision + (observedResult.fingerprint === resultFingerprint ? 0 : 1)
  if (observedResult.fingerprint !== resultFingerprint) {
    setObservedResult({ fingerprint: resultFingerprint, revision: resultRevision })
    if (serviceMode) { setMetric(null); setCopy(null); setFollowGate(null) }
  }
  const currentResultRevision = useRef(resultRevision)
  useLayoutEffect(() => { currentResultRevision.current = resultRevision }, [resultRevision])
  const performanceKey = serviceMode ? JSON.stringify([routeScope, resultRevision]) : routeKey
  const metricPresentation = (() => {
    if (!service?.metricDetails || !row || !result) return null
    try { return bindSharingMetricDetails(service.metricDetails(row, location.period), row, location.period) }
    catch { return null /* Never disclose a provider exception in a definition sheet. */ }
  })()
  const metricScope = JSON.stringify([owner, routeKey, row?.score, resultRevision, metricPresentation])
  if (metric && service && metricSnapshot !== metricScope) setMetric(null)
  const openMetric = (key: keyof typeof definitions) => { setMetricSnapshot(metricScope); setMetric(key) }
  useEffect(() => {
    const target = !location.nick && !location.view ? routeTitleRef?.current : location.view ? routeTitleRef?.current ?? document.getElementById('research-title') : title.current
    if (!shouldFocus || shouldFocus()) target?.focus({ preventScroll: true })
    const main = document.getElementById('research-main')
    main?.scrollTo({ top: 0, behavior: 'instant' })
    // Footer-bearing public pages scroll their shell, not research-main.
    // This effect follows route identity only, not locale/period/data updates.
    main?.closest<HTMLElement>('.client-source-app.has-site-footer')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.nick, location.view, location.copyId, location.section, shouldFocus, serviceMode, routeTitleRef])
  const listingPerformance = useMemo(() => new Map(listings.map(row => [cardRoute(row), row.catalogueId ? catalogue.performance.get(row.catalogueId) ?? null : row.strategy ? strategyListPerformance(row.strategy, !service, service?.indexToDate ?? sourceTerminalDate) : null])), [listings, service, catalogue.performance])
  const exchanges = useMemo(() => connectedMyExchanges(brokerPresentation, owner, signedIn), [brokerPresentation, owner, signedIn])
  const exchangeValue = effectiveMyExchange(myExchange, exchanges)
  const selectedExchanges = useMemo(() => selectedMyExchanges(exchangeValue, exchanges), [exchangeValue, exchanges])
  const exchangeKey = JSON.stringify([owner, signedIn, exchanges.map(exchange => exchange.id)])
  const [exchangeBoundary, setExchangeBoundary] = useState(exchangeKey)
  if (exchangeBoundary !== exchangeKey) { setExchangeBoundary(exchangeKey); setOpenDropdown(null) }
  const chooseExchange = (value: MyExchangeFilter) => { changePreferences({ myExchange: value }); setOpenDropdown(null) }
  const exchangeFilter = exchanges.length ? <ClientMyExchanges exchanges={exchanges} value={exchangeValue} open={openDropdown === 'exchange'}
    onOpenChange={open => setOpenDropdown(open ? 'exchange' : null)} onSelect={chooseExchange} /> : undefined
  const filtered = useMemo(() => {
    const selected = listings.filter(r => matchesStrategyClassification(r, kind, market) && matchesMyExchange(r, selectedExchanges) && `${r.nick} ${r.title ?? ''} ${r.asset}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    if (sort === 'pick') return dir === 'asc' ? selected.reverse() : selected // Provider/source order, not a browser-generated score.
    const value = (row: ListingRow) => sort === 'fw' ? row.followers : listingPerformance.get(cardRoute(row))?.percent
    return selected.sort((a, b) => {
      const av = value(a), bv = value(b)
      const aValid = typeof av === 'number' && Number.isFinite(av), bValid = typeof bv === 'number' && Number.isFinite(bv)
      return aValid && bValid ? dir === 'asc' ? av! - bv! : bv! - av! : aValid ? -1 : bValid ? 1 : 0
    })
  }, [listings, kind, market, query, sort, dir, listingPerformance, selectedExchanges])
  const pageSignature = JSON.stringify([owner, kind, market, query, sort, dir, exchangeValue])
  const [pageState, setPageState] = useState({ signature: pageSignature, page: savedPage ?? 1 })
  if (pageState.signature !== pageSignature) setPageState({ signature: pageSignature, page: 1 })
  const paginated = paginateSourceStrategies(filtered, !service && kind === 'all' && market === 'all' && !query && !selectedExchanges.length,
    pageState.signature === pageSignature ? pageState.page : 1)
  const displayedListings = service ? filtered : paginated.rows
  const changePage = (page: number) => {
    if (!Number.isSafeInteger(page) || page < 1 || page > paginated.pages) return
    setPageState({ signature: pageSignature, page }); changePreferences({ page })
    requestAnimationFrame(() => {
      const grid = document.querySelector<HTMLElement>('.strategy-list-container')
      const shell = grid?.closest<HTMLElement>('.client-source-app.has-site-footer')
      const main = document.getElementById('research-main')
      const scroll = shell ?? main
      if (!grid || !scroll) return
      const top = grid.getBoundingClientRect().top - scroll.getBoundingClientRect().top
      if (top < 0) scroll.scrollTop += top - (window.innerWidth <= 860 ? 148 : 90)
    })
  }
  const chooseTab = (next: SharingPreferences['tab']) => {
    if (next !== tab) onTabChange?.()
    setOpenDropdown(null)
    if (routeSections && !service) onNavigate({ period: 'all', ...(next === 'find' ? {} : { section: next === 'follow' ? 'library' : 'publishing' }) })
    else changePreferences({ tab: next })
  }
  const chooseSort = (next: string) => {
    const option = sharingSortOptions.find(option => option.value === next)
    if (!option) return
    changePreferences({ sort: option.value, dir: option.value !== 'pick' && sort === option.value ? dir === 'asc' ? 'desc' : 'asc' : 'desc' })
    setOpenDropdown(null)
  }
  const chooseMarket = (next: string) => {
    const option = sharingMarketOptions.find(option => option === next)
    if (!option) return
    changePreferences({ market: option })
    setOpenDropdown(null)
  }
  const chooseKind = (next: StrategyKindFilter) => {
    if (!sharingKindOptions.includes(next)) return
    changePreferences({ kind: next }); setOpenDropdown(null)
  }
  const activeFollowCount = service ? service.follows?.state === 'ready' ? service.follows.rows.filter(item=>item.status.active).length : 0 : followRows.filter(item => item.record.owner === owner && item.record.active).length
  const introCurrent = (intent: FollowIntroIntent) => {
    const current = latestIntro.current
    return introLifetime.current.alive && current.signedIn && current.owner === intent.owner
      && current.routeKey === intent.routeKey && window.location.href === intent.href && currentResultRevision.current === intent.resultRevision
  }
  const introError = (message: SharingNotice, intent?: FollowIntroIntent) => {
    if (intent && !introCurrent(intent)) return
    setNotice(message)
    requestAnimationFrame(() => { if (!intent || introCurrent(intent)) noticeRef.current?.focus() })
  }
  const resolveIntro = (intent: FollowIntroIntent) => {
    const current = latestIntro.current
    if (intent.followId !== undefined) {
      const saved = current.followRows.find(item => item.record.id === intent.followId && item.record.owner === intent.owner && item.record.nick === intent.nick)?.record
      return saved ? { saved, row: current.seeds.find(item => item.nick === saved.nick), trigger: intent.trigger } : null
    }
    const source = current.seeds.find(item => item.nick === intent.nick && !item.me)
    return source ? { row: source, trigger: intent.trigger } : null
  }
  const openCopy = (nick: string, followId?: string) => {
    if (!signedIn) { onLogin(); return }
    const intent: FollowIntroIntent = { owner, routeKey, href: window.location.href, nick, followId, name: '', trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined, resultRevision }
    const source = resolveIntro(intent), base = source?.saved ?? source?.row
    if (!source || !base) { introError({ key: '전략을 찾을 수 없어요' }); return }
    intent.name = `${base.nick} (${base.asset})`
    introLifetime.current.version++
    if (followIntro?.required) setFollowGate(intent)
    else setCopy(source)
  }
  const closeIntro = (intent: FollowIntroIntent) => {
    if (latestIntro.current.followGate !== intent) return
    introLifetime.current.version++
    setFollowGate(null)
  }
  const continueIntro = (intent: FollowIntroIntent) => {
    // UpgradeSheet closes immediately before invoking onLater in this same click.
    if (!introCurrent(intent) || latestIntro.current.followGate !== intent || consumedIntro.current === intent) return
    consumedIntro.current = intent
    const version = ++introLifetime.current.version
    try { latestIntro.current.followIntro?.onContinue() }
    catch (cause) { introError(cause instanceof Error ? cause.message : { key: '안내 상태를 저장하지 못했어요. 다시 시도해주세요.' }, intent); return }
    // Parent callbacks may synchronously replace props. Resolve after that commit,
    // without retaining a stale source object or reviving a replaced owner/route.
    queueMicrotask(() => {
      if (version !== introLifetime.current.version || !introCurrent(intent)) return
      const source = resolveIntro(intent)
      if (!source) { introError({ key: '전략 기록이 바뀌었어요. 다시 선택해주세요.' }, intent); return }
      setCopy(source)
    })
  }
  const subscribeIntro = (intent: FollowIntroIntent) => {
    if (!introCurrent(intent) || latestIntro.current.followGate !== intent || consumedIntro.current === intent) return
    consumedIntro.current = intent
    try { latestIntro.current.followIntro?.onSubscribe?.() }
    catch (cause) { introError(cause instanceof Error ? cause.message : { key: '구독 안내를 열지 못했어요. 다시 시도해주세요.' }, intent) }
  }
  const startCopy = (r: SharedStrategy) => {
    if (!signedIn) { onLogin(); return }
    if (r.me) { introError({ key: '내가 공유한 전략이에요' }); return }
    openCopy(r.nick)
  }
  const copyStartGate = () => {
    if (!signedIn || (!service && !owner)) { onLogin(); return false }
    return service ? true : onPreviewCopyStart?.() ?? false
  }
  const openSetup = (r: SharedStrategy) => { if (!r.me && copyStartGate()) onNavigate({ view: 'copy-setup', nick: r.nick, period: 'all' }) }
  const openCopyFollow = () => { chooseTab('follow'); if (!routeSections || service) onNavigate({ period: 'all' }) }
  const followAction = (action: ((id: string) => void) | undefined, id: string, success?: SharedFollowCopyKey) => {
    if (!signedIn || !action) { introError({ key: '로그인 후 다시 시도해주세요.' }); return false }
    try {
      action(id)
      if (success) setNotice({ key: success })
      return true
    } catch (error) { setNotice(error instanceof Error ? error.message : { key: '변경하지 못했어요. 다시 시도해주세요.' }); requestAnimationFrame(() => noticeRef.current?.focus()); return false }
  }
  const editFollow = (id: string) => {
    if (!signedIn) { onLogin(); return }
    const saved = followRows.find(item => item.record.id === id)?.record
    if (!saved) { setNotice({ key: '전략 기록을 다시 확인해주세요.' }); return }
    openCopy(saved.nick, id)
  }
  const editServiceFollow = async (id: string) => {
    if(!service?.follows?.onEdit || !signedIn)throw new Error(sharingUnavailable(language))
    const version=introLifetime.current.version, record=service.follows.rows.find(row=>row.id===id), row=seeds.find(row=>row.nick===record?.nick)
    if(!row)throw new Error(sharingUnavailable(language))
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:undefined
    const draft=await service.follows.onEdit(id)
    if(!introLifetime.current.alive || introLifetime.current.version!==version || editView.current!=='follow')return
    if(draft.id!==id || !Number.isInteger(draft.budgetIndex) || draft.budgetIndex<0 || draft.budgetIndex>3 || !Number.isFinite(draft.sl) || draft.tp!==null&&!Number.isFinite(draft.tp))throw new Error(sharingUnavailable(language))
    setCopy({row,serviceDraft:draft,trigger})
  }
  const archiveFollow = () => {
    if (!archive || !onArchiveFollow || !signedIn) { setArchiveError({ key: '전략 기록을 다시 확인해주세요.' }); return }
    try {
      onArchiveFollow(archive.id); setArchive(null); setArchiveError(''); setNotice({ key: '보관했어요' })
      requestAnimationFrame(() => title.current?.focus({ preventScroll: true }))
    } catch (error) { setArchiveError(error instanceof Error ? error.message : { key: '보관하지 못했어요. 다시 시도해주세요.' }) }
  }
  const listingCard = (r: ListingRow, key: string = cardRoute(r)) => <ClientStrategyListCard key={key} title={r.title ?? r.nick} asset={r.asset} followers={r.followers} own={r.me} kind={r.kind} glyph={r.glyph} venue={r.venue}
    performance={listingPerformance.get(cardRoute(r)) ?? null}
    location={{ nick: cardRoute(r), period: 'all' }} onNavigate={onNavigate}/>
  const card = (r: CardRow, preview = false) => <article className="tfbk-card" key={cardRoute(r)} data-creator-card={r.me || undefined}>
    <div className="cin"><div className="lft">
      <div className="nmrow">{preview ? <span className="nm">{r.title ?? r.nick}</span> : <button type="button" className="nm" onClick={() => onNavigate(r.me ? { nick: 'me', period: 'all' } : copyTraderLocation(r.nick))}>{r.title ?? r.nick}</button>}<span className="bdg">{r.asset}</span></div>
      {r.me && <div className="ss3-owner">by {r.nick} {s('(나)')}</div>}
      <div className="as">{r.description || (service ? '' : s('검증 완료 전략, 거래 비용 0.2% 반영 백테스트'))}</div>
      <div className="rtrow">{[[researchCopy(language, 'score', { score: sharedNumber(r.score, language, 'auto') }), s('TETH 점수')], [sharedNumber(r.result.mdd, language) + '%', s('최대 낙폭')], [r.result.winRate.toFixed(0) + '%', s('승률 ({count}회)', { count: r.result.n })], [r.followers === undefined ? '—' : r.followers.toLocaleString(language) + (language === 'ko' ? '명' : ''), researchCopy(language, 'followers', { count: '' }).trim()]].map(([v, k]) => <span className="ctc" key={k}><b>{v}</b><small>{k}</small></span>)}</div>
      <div className="pr"><b className={r.result.ret >= 0 ? 'up' : 'dn'}>{researchCopy(language, 'returnLabel')} {pct(r.result.ret, language)}</b><small>{s('누적 백테스트 성과')}</small></div>
      {!preview && <div className="bt">{!r.me && r.strategy && <button type="button" className="wbtn" onClick={() => openSetup(r.strategy!)}>{copyTradingLabel(language, '카피하기')}</button>}<button type="button" className="obtn" onClick={() => onNavigate({ nick: cardRoute(r), period: 'all' })}>{s('자세히')}</button></div>}
    </div><div className="lgo">{r.strategy ? <Sparkline row={r.strategy} indexToDate={service?.indexToDate} /> : <span className="mt2">{s('검증 곡선 없음')}</span>}</div></div>
  </article>
  return <div className={`client-strategy-sharing${library ? ' is-library' : ''}`}>
    {!service && <div className="ss3-boundary">{catalogueSelection || location.copyModel === 'catalogue' || !location.nick && !location.view ? catalogueText.boundary : f('클라이언트 원본 미리보기 · 모든 자산은 공통 합성 일봉으로 계산되며 실제 시장 성과가 아닙니다.')}</div>}
    {!service && <ClientCopyStorageRecovery key={owner} owner={owner} account={copyAccount} Dialog={SharingDialog} />}
    {!service && location.view === 'catalogue-backtest' ? signedIn && owner ? <Suspense fallback={<p role="status">{catalogueText.loading}</p>}><ClientCatalogueBacktest key={JSON.stringify([owner, location.nick])} owner={owner} strategyId={location.nick ?? ''} onBack={() => onNavigate({ nick: location.nick, period: 'all' })} onBrowse={() => onNavigate({ period: 'all' })} onUse={onCatalogueBacktestUse}/></Suspense> : <section className="catalogue-loading" data-testid="catalogue-backtest-auth"><p>백테스트를 시작하려면 로그인 또는 회원가입이 필요해요.</p><button type="button" className="wbtn" onClick={() => location.nick && onCatalogueVerify ? onCatalogueVerify(location.nick) : onLogin()}>로그인 또는 회원가입</button><button type="button" className="obtn" onClick={() => onNavigate({ nick: location.nick, period: 'all' })}>뒤로</button></section> : catalogueSelection ? catalogue.detail?.state === 'ready' && catalogue.detail.value ? <ClientCatalogueStrategyDetail key={JSON.stringify([owner, catalogueSelection.id])} value={catalogue.detail.value} location={location} title={title} onNavigate={onNavigate}
      onCopy={() => { if (!signedIn) { if (onCatalogueCopyAuth) onCatalogueCopyAuth(catalogueSelection.id); else onLogin(); return } const existing = !catalogueAccount.error && catalogueAccount.state?.copies.find(c => c.record.status === 'active' && c.record.binding.strategyId === catalogueSelection.id); if (existing) { onNavigate(catalogueCopyLocation(existing.record.id)); return } if (setupScope) { setSetupOpen({ scope: setupScope, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined }); return } if (onCatalogueCopy) onCatalogueCopy(catalogueSelection.id); else setNotice({ service: 'unavailable' }) }}
      onAnalyze={() => { if (catalogue.detail?.value) void analyze(catalogue.detail.value, 'all') }} analyzing={analysisScope === routeScope}
      owner={owner} onVerify={onCatalogueVerify ? signal => { if (!signal.aborted) onCatalogueVerify(catalogueSelection.id) } : undefined}
      onWatch={() => { void toggleWatch(catalogueSelection.id) }} watched={watched.some(id => findCatalogueStrategy(id)?.id === catalogueSelection.id)} onCopyLink={() => { void copyLink() }}/>
      : <div className="catalogue-loading" role="status" aria-busy={catalogue.detail?.state !== 'error'}><span>{catalogue.detail?.state === 'error' ? catalogueText.failed : catalogueText.loading}</span>{catalogue.detail?.state === 'error' && <button type="button" className="obtn" onClick={catalogue.retry}>{catalogueText.retry}</button>}<button type="button" className="obtn" onClick={() => onNavigate({ period: 'all' })}>{researchCopy(language, 'sharing')}</button></div>
      : !service && location.view === 'copy-detail' && location.copyModel === 'catalogue' ? <ClientCatalogueCopyManagement key={JSON.stringify([owner, location.copyId])} account={catalogueAccount} id={location.copyId ?? ''} tab={location.copyTab} navigate={onNavigate} Dialog={SharingDialog} onBack={copyManagementReturn?.onReturn ?? openCopyFollow} backLabel={copyManagementReturn?.label} signedIn={signedIn} onLogin={onLogin} onHelp={onHelp}/> : service && location.copyModel === 'catalogue' ? <p role="status">{sharingUnavailable(language)}</p> : location.view ? <ClientCopyTrading key={JSON.stringify([owner, location.view, location.nick, location.copyId])} servicePresentation={service} location={location} account={copyAccount} sources={seeds} navigate={onNavigate} Dialog={SharingDialog} onStartGate={copyStartGate} onFollow={location.view === 'copy-detail' && copyManagementReturn ? copyManagementReturn.onReturn : openCopyFollow} backLabel={location.view === 'copy-detail' ? copyManagementReturn?.label : undefined} watching={nick => watched.includes(nick)} onWatch={toggleWatch} onAsk={onAsk} signedIn={signedIn} onLogin={onLogin} /> : location.nick === 'me' && own && !own.strategy ? <><nav className="tfbk-bc" aria-label={s('현재 위치')}><button type="button" onClick={() => onNavigate({ period: 'all' })}>{researchCopy(language, 'sharing')}</button><span> / {own.title}</span></nav><div className="tfbk-hero detail"><div className="planet" aria-hidden="true" /><h2 className="ss3-dtitle" ref={title} tabIndex={-1}>{own.title}<span className="bdg">{own.asset}</span></h2><div className="ss3-dsub">{d('작성자 {nick}', { nick: own.nick })} {s('(나)')}</div><div className="ss3-dacts"><span className="ss3-own-badge">{s('내가 공유한 전략')}</span><button type="button" className="obtn" disabled={Boolean(service) && !service?.shareUrl?.(location)} onClick={() => { void copyLink() }}>{s('전략 링크 복사')}</button></div></div><section className="tfbk-card"><div className="cin ss3-blk"><h3>{d('저장된 검증 성과')}</h3><div className="ss3-matrix">{[[d('검증 수익'), pct(own.result.ret, language)], [s('TETH 점수'), d('{points}점', { points: sharedNumber(own.score, language, 'auto') })], [s('최대 낙폭'), sharedNumber(own.result.mdd, language) + '%'], [s('승률 ({count}회)', { count: own.result.n }), own.result.winRate.toFixed(0) + '%']].map(([label, value]) => <div className="mx" key={label}><small>{label}</small><b>{value}</b></div>)}</div><p className="mt2">{d('검증 곡선 없음. 저장된 요약 지표만 표시합니다.')}</p>{own.description && <p>{own.description}</p>}</div></section></> : row && result ? <ClientSharedStrategyDetail row={row} result={result} location={location} title={title} onNavigate={onNavigate} onCopy={() => startCopy(row)} onAnalyze={() => { void analyze(row, location.period) }} onWatch={() => { void toggleWatch(row.nick) }} onCopyLink={() => { void copyLink() }} openMetric={openMetric} analyzing={analysisScope === routeScope} watched={watched.includes(row.nick)} watchBusy={watchBusy} service={service} serviceResults={serviceResults} routeKey={routeKey} performanceKey={performanceKey} />
      : <><ClientStrategyFilters tab={tab} showTabs={!routeSections || Boolean(service)} activeFollowCount={activeFollowCount} sort={sort} kind={kind} market={market} query={query} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} chooseTab={chooseTab} chooseSort={chooseSort} chooseKind={chooseKind} chooseMarket={chooseMarket} setQuery={setQuery} exchangeFilter={exchangeFilter} />{noticeContent}{!service && tab === 'find' && catalogue.state === 'error' && <p role="status">{catalogueText.failed} <button type="button" className="obtn" onClick={catalogue.retry}>{catalogueText.retry}</button></p>}{service && service.state !== 'ready' && tab === 'find' && <p role="status" className="ss3-empty">{service.message || sharingUnavailable(language)}</p>}{location.nick && row && !result && <p role="status">{sharingUnavailable(language)}</p>}{location.nick && !row && <p role="status">{s('전략을 찾을 수 없어요')}</p>}{tab === 'find' ? service && service.state !== 'ready' ? null : filtered.length ? <><ClientMyExchangeResult selected={selectedExchanges} count={filtered.length} onReset={() => chooseExchange('')} /><div className="strategy-list-container"><div className="strategy-list-grid" aria-busy={!service && catalogue.state === 'loading'}>{displayedListings.map((row, index) => listingCard(row, `${cardRoute(row)}:${index}`))}</div>{!service && <ClientStrategyPagination page={paginated.page} pages={paginated.pages} onChange={changePage} />}</div></> : selectedExchanges.length ? <ClientMyExchangeResult selected={selectedExchanges} count={0} onReset={() => chooseExchange('')} /> : <div className="ss3-empty">{s('조건에 맞는 전략이 없어요')}<br /><button type="button" className="obtn" onClick={() => { setQuery(''); changePreferences({ asset: 'all', kind: 'all', market: 'all', myExchange: '' }) }}>{s('필터 초기화')}</button></div> : tab === 'follow' ? <>{!service && <ClientCatalogueCopyHistoryList headingLevel={library ? 2 : 3} account={catalogueAccount} navigate={onNavigate}/>}<ClientCopyDashboard account={copyAccount} sources={seeds} navigate={onNavigate} Dialog={SharingDialog} servicePresentation={service} headingLevel={library ? 2 : 3} showValidationHeading={!library} /><ClientSharedFollowList showHeading={library} hideEmpty={hideFollowEmpty} onEditService={editServiceFollow} renderCurve={source => <Sparkline row={source} indexToDate={service?.indexToDate} />} serviceMode={Boolean(service)} service={service?.follows} sources={seeds} Dialog={SharingDialog} rows={followRows.map(item => { const source = rows.find(r => r.nick === item.record.nick); return { ...item, source, curve: source ? <Sparkline row={source} /> : undefined } })} onDetail={nick => onNavigate({ nick, period: 'all' })} onResume={id => { followAction(onResumeFollow, id) }} onEdit={editFollow} onArchive={id => { setArchive(followRows.find(item => item.record.id === id)?.record ?? null); setArchiveError('') }} onRemove={id => { if (followAction(onRemoveFollow, id, '목록에서 삭제했어요. 대화와 검증 결과, 실행 중인 전략은 유지됩니다.')) requestAnimationFrame(() => (routeTitleRef?.current ?? title.current)?.focus({ preventScroll: true })) }} onFind={() => chooseTab('find')} />{library ? watchedListings.length > 0 && <section className="client-library-watches strategy-list-container" aria-labelledby={watchHeadingId}><h2 id={watchHeadingId}>{s('관심 전략')}</h2>{!signedIn && <p role="note">{{ko: '이전 비회원 기록입니다. 로그인한 계정의 즐겨찾기와 별도로 보관됩니다.', en: 'Previous guest records are kept separately from account favorites.', ja: '以前のゲスト記録です。アカウントのお気に入りとは別に保存されます。', 'zh-CN': '这些是以前的访客记录，与账户收藏分开保存。', 'zh-TW': '這些是以前的訪客記錄，與帳戶收藏分開儲存。', es: 'Los registros de invitado anteriores se conservan separados de los favoritos de la cuenta.', fr: 'Les anciens favoris invités sont conservés séparément des favoris du compte.'}[language]}</p>}<div className="strategy-list-grid">{watchedListings.map(row => listingCard(row))}</div></section> : watched.length > 0 && <><h3>{s('관심 전략')}</h3>{service ? seeds.filter(r => watched.includes(r.nick)).map(r => card(cardRow(r))) : <div className="strategy-list-grid">{watchedListings.map(row => listingCard(row))}</div>}</>}</> : creator ? <><ClientStrategyCreator {...creator} Dialog={SharingDialog} renderPreview={(basis, description) => card(creatorCard(basis, creator.nick, description, Boolean(service)), true)} loggedIn={signedIn} onNew={signedIn ? onReturn : onLogin} />{service && mine}</> : <section className="tfbk-card"><div className="cin ss3-blk"><h3>내 전략을 공유해보세요</h3><p>검증을 통과한 전략을 닉네임으로 공개하면,<br />다른 사용자가 따라할 때마다 이용 요금의 20%가 보상으로 쌓여요.</p><p className="ss3-steps">① 전략 만들기 ② TETH 80점 검증 통과 ③ 공개하고 보상 받기</p>{mine ?? <button type="button" className="wbtn" onClick={onReturn}>채팅에서 전략 만들기</button>}</div></section>}</>}
    {followGate && <ClientUpgradeSheet context="follow" name={followGate.name} trigger={followGate.trigger} onClose={() => closeIntro(followGate)} onLater={() => continueIntro(followGate)} onSubscribe={followIntro?.onSubscribe ? () => subscribeIntro(followGate) : undefined} />}
    {setupOpen && setupScope === setupOpen.scope && catalogueCopySetup && catalogueSelection && <ClientCatalogueCopySetup key={setupScope} strategy={catalogueSelection} setup={catalogueCopySetup} trigger={setupOpen.trigger} onClose={() => setSetupOpen(null)}/>}
    {notice && <p role="status" className="ss3-notice" ref={noticeRef} tabIndex={-1}>{noticeText(notice)}</p>}{copy && <CopyPreview service={service} serviceDraft={copy.serviceDraft} row={copy.row} saved={copy.saved} trigger={copy.trigger} onClose={() => setCopy(null)} onConfirm={service ? service.onCopy : onCopy} />}{archive && <SharingDialog title={f('따라가기 중지')} onClose={() => setArchive(null)}><p>{f('{nick} 전략 따라가기를 중지할까요?', { nick: archive.nick })}</p><p>{f('항목은 보관 처리되고, 이미 실행 중인 전략은 AI 트레이딩에서 계속 관리할 수 있어요.')}</p>{archiveError && <p role="alert">{noticeText(archiveError)}</p>}<div className="ss3-dacts"><button type="button" className="obtn" onClick={() => setArchive(null)}>{sharedCopyCopy(language, '취소')}</button><button type="button" className="obtn ss3-archive-confirm" onClick={archiveFollow}>{f('중지하고 보관')}</button></div></SharingDialog>}{metric && <SharingDialog title={metric === 'score' && row && (!service || metricPresentation?.score) ? d('TETH 점수 {score}점 산출 근거', { score: row.score }) : d(definitions[metric][0])} focusKey={metric} onClose={() => setMetric(null)}>{service ? <ClientSharedMetricDetails metric={metric} data={metricPresentation} /> : metric === 'score' && row ? <ScoreDetails row={row} rows={rows} /> : <p>{d(definitions[metric][1])}</p>}<p>{d('모든 수치는 과거 데이터 검증 시뮬레이션이며 미래 수익을 보장하지 않아요.')}</p></SharingDialog>}
  </div>
}
