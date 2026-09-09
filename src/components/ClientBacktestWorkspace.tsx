import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Crosshair, MessageSquare, X } from 'lucide-react'
import { ClientLogo } from './ClientChrome'
import { ClientChartThread } from './ClientChartThread'
import { ClientProfessionalPriceChart, type ProfessionalChartControl } from './ClientProfessionalPriceChart'
import { priceChartIssue, type PriceChartView, type PriceFill } from '../chart/price-chart-view'
import '../client-backtest-workspace.css'

type Props = {
  view: PriceChartView | null
  title: string
  draft: string
  thread: ReactNode
  onDraftChange: (text: string) => void
  onAsk: (text: string, fill: PriceFill | null) => void | Promise<void>
  busy?: boolean
  onClose: () => void
  autoReplay?: boolean
}
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const formatPrice = (price: number) => price.toLocaleString('ko-KR', { maximumFractionDigits: 12 })

const FillRow = memo(function FillRow({ fill, selected, onSelect }: { fill: PriceFill; selected: boolean; onSelect: (fill: PriceFill) => void }) {
  const time = dateFormat.format(fill.time * 1000), price = formatPrice(fill.price)
  return <button type="button" aria-pressed={selected} onClick={() => onSelect(fill)} aria-label={`${fill.side} ${time} UTC, 체결가 ${price}, 거래 ${fill.tradeId}`}><b data-side={fill.side}>{fill.side}</b><time dateTime={new Date(fill.time * 1000).toISOString()}>{time}</time><span>{price}</span><small>{fill.tradeId}</small></button>
})

/** Presentation only. No API, result manufacture, server job or chat engine.
 * The owner supplies a bound view and the original conversation callbacks.
 */
export function ClientBacktestWorkspace(props: Props) {
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const sendLock = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const send = async (text: string, fill: PriceFill | null) => {
    if (!text.trim() || text.length > 4000 || props.busy || sendLock.current) return
    sendLock.current = true; setSending(true); setSendError(false)
    try { await props.onAsk(text, fill) }
    catch { if (mounted.current) setSendError(true) }
    finally { sendLock.current = false; if (mounted.current) setSending(false) }
  }
  return <Workspace key={props.view?.identity ?? 'no-price-view'} {...props} sending={sending} sendError={sendError} send={send} />
}

function Workspace({ view, title, draft, thread, onDraftChange, onClose, autoReplay = true, busy = false, sending, sendError, send }: Props & { sending: boolean; sendError: boolean; send: (text: string, fill: PriceFill | null) => Promise<void> }) {
  const valid = useMemo(() => view !== null && priceChartIssue(view) === null, [view])
  const [replaying, setPlaying] = useState(() => valid && autoReplay && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const playing = valid && replaying
  const [panel, setPanel] = useState<'chart' | 'chat'>('chart')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const inFlight = busy || sending
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [search, setSearch] = useState('')
  const chartControl = useRef<ProfessionalChartControl>(null)
  const chartPanel = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const skip = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const previousBox = useRef<DOMRect | null>(null)
  const flip = useRef<Animation | null>(null)
  const previousPlaying = useRef(playing)
  const initialPlaying = useRef(playing)
  const pendingFocus = useRef<number | null>(null)
  const ledger = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const fills = useMemo(() => valid && view ? [...view.fills].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)) : [], [view, valid])
  const selected = fills.find(fill => fill.id === selectedId) ?? null
  const visibleFills = useMemo(() => fills.filter(fill => (filter === 'ALL' || fill.side === filter) && (!search.trim() || fill.tradeId.toLowerCase().includes(search.trim().toLowerCase()) || fill.id.toLowerCase().includes(search.trim().toLowerCase()))), [fills, filter, search])
  const pages = Math.max(1, Math.ceil(visibleFills.length / 50))
  const currentPage = Math.min(page, pages - 1)

  const replayChange = useCallback((next: boolean) => {
    previousBox.current = chartPanel.current?.getBoundingClientRect() ?? null
    setPlaying(next)
    if (next) setPanel('chart')
  }, [])
  useLayoutEffect(() => {
    if (previousPlaying.current === playing) return
    previousPlaying.current = playing
    flip.current?.cancel()
    const node = chartPanel.current, before = previousBox.current
    if (node && before && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const after = node.getBoundingClientRect()
      if (before.width && before.height && after.width && after.height) flip.current = node.animate([
        { transform: `translate(${before.x - after.x}px,${before.y - after.y}px) scale(${before.width / after.width},${before.height / after.height})` },
        { transform: 'none' },
      ], { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' })
    }
    if (playing) skip.current?.focus({ preventScroll: true })
    else if (document.activeElement === document.body || !root.current?.contains(document.activeElement) || document.activeElement === skip.current) close.current?.focus({ preventScroll: true })
    return () => flip.current?.cancel()
  }, [playing])
  useLayoutEffect(() => {
    if (initialPlaying.current) skip.current?.focus({ preventScroll: true }); else root.current?.focus({ preventScroll: true })
    return () => { if (pendingFocus.current !== null) cancelAnimationFrame(pendingFocus.current) }
  }, [])
  useLayoutEffect(() => { if (ledger.current) ledger.current.scrollTop = 0 }, [currentPage, filter, search])
  useLayoutEffect(() => {
    if (!selectedId || playing) return
    const row = ledger.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (row && ledger.current) ledger.current.scrollTop = Math.max(0, row.offsetTop - 40)
  }, [selectedId, currentPage, playing])
  useLayoutEffect(() => {
    const input = field.current
    if (!input) return
    input.style.height = 'auto'; input.style.height = `${Math.min(132, Math.max(44, input.scrollHeight))}px`
  }, [draft, panel, playing])
  const chooseFill = useCallback((fill: PriceFill, reveal = false) => {
    setSelectedId(fill.id)
    if (reveal) {
      setFilter('ALL'); setSearch('')
      setPage(Math.floor(Math.max(0, fills.findIndex(item => item.id === fill.id)) / 50))
    }
    chartControl.current?.selectFill(fill.id)
  }, [fills])
  const chooseChartFill = useCallback((fill: PriceFill) => chooseFill(fill, true), [chooseFill])
  const askAboutFill = () => {
    setPanel('chat')
    if (pendingFocus.current !== null) cancelAnimationFrame(pendingFocus.current)
    pendingFocus.current = requestAnimationFrame(() => { pendingFocus.current = null; field.current?.focus({ preventScroll: true }) })
  }
  const submit = () => send(draft, selected)

  return <section ref={root} tabIndex={-1} className={`bw-workspace ${playing ? 'is-replaying' : ''}`} data-panel={panel} aria-label={`${title} 차트 작업 공간`} onFocusCapture={event => {
    if (event.target instanceof Element && event.target.closest('.bw-conversation')) setPanel('chat')
    else if (event.target instanceof Element && event.target.closest('.bw-market')) setPanel('chart')
  }} onKeyDown={event => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault(); if (playing) chartControl.current?.skip(); else onClose()
    }
  }}>
    <header className="bw-header"><button ref={close} type="button" onClick={onClose}><ArrowLeft size={16} /><span>{title}로 돌아가기</span></button><strong>{title}</strong>{playing && <button ref={skip} className="bw-skip" type="button" onClick={() => chartControl.current?.skip()}>Skip · 결과 보기</button>}</header>
    <nav className="bw-mobile-nav" aria-label="분석 화면 선택" hidden={playing}><button type="button" aria-pressed={panel === 'chart'} onClick={() => setPanel('chart')}>차트·체결</button><button type="button" aria-pressed={panel === 'chat'} onClick={() => setPanel('chat')}>대화 이어가기</button></nav>
    <div className="bw-layout">
      <div className="bw-market">
        <div ref={chartPanel} className="bw-chart-panel"><ClientProfessionalPriceChart view={view} onFillSelect={chooseChartFill} autoReplay={autoReplay} onReplayChange={replayChange} controlRef={chartControl} externalSkip /></div>
        <section className="bw-ledger-section" hidden={playing} aria-label="체결 기록">
          <div className="bw-ledger-header"><h2>체결 기록 <span>{fills.length.toLocaleString('ko-KR')}</span></h2>{selected && <button type="button" className="bw-discuss" onClick={askAboutFill}><MessageSquare size={15} />선택한 체결에 질문하기</button>}</div>
          <div className="bw-ledger-tools"><div role="group" aria-label="체결 방향">{(['ALL', 'BUY', 'SELL'] as const).map(side => <button key={side} type="button" aria-pressed={side === filter} onClick={() => { setFilter(side); setPage(0) }}>{side === 'ALL' ? '전체' : side}</button>)}</div><label><span className="bw-sr">체결 ID 또는 거래 ID 검색</span><input type="search" value={search} placeholder="체결·거래 ID 검색" onChange={event => { setSearch(event.target.value); setPage(0) }} /></label></div>
          <div ref={ledger} className="bw-ledger" role="group" aria-label="체결 선택"><div className="bw-ledger-labels"><span>구분</span><span>체결 시각 · UTC</span><span>체결가</span><span>거래 ID</span></div>{visibleFills.slice(currentPage * 50, (currentPage + 1) * 50).map(fill => <FillRow key={fill.id} fill={fill} selected={fill.id === selectedId} onSelect={chooseFill} />)}</div>
          {!visibleFills.length && <p className="bw-empty">{fills.length ? '검색 조건에 맞는 체결이 없습니다.' : '표시할 체결 기록이 없습니다.'}</p>}
          {pages > 1 && <nav className="bw-pagination" aria-label="체결 페이지"><button type="button" aria-label="체결 첫 페이지" disabled={currentPage === 0} onClick={() => setPage(0)}><ChevronsLeft size={16} /></button><button type="button" aria-label="체결 이전 페이지" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><span role="status">{currentPage * 50 + 1}–{Math.min((currentPage + 1) * 50, visibleFills.length)} / {visibleFills.length.toLocaleString('ko-KR')}</span><button type="button" aria-label="체결 다음 페이지" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button><button type="button" aria-label="체결 마지막 페이지" disabled={currentPage === pages - 1} onClick={() => setPage(pages - 1)}><ChevronsRight size={16} /></button></nav>}
        </section>
      </div>
      <aside className="bw-conversation" hidden={playing} aria-label="연구 대화 이어가기">
        <div className="bw-conversation-heading"><ClientLogo /><strong>TETH</strong><span>{title}</span></div>
        <ClientChartThread title={title}>{thread}</ClientChartThread>
        <div className="bw-compose-area">{selected && <div className="bw-reference"><Crosshair size={15} /><span>{selected.side} · <span className="bw-reference-price">{formatPrice(selected.price)}</span> · {selected.tradeId}</span><button type="button" aria-label="체결 참고대상 해제" onClick={() => setSelectedId(null)}><X size={15} /></button></div>}
          <form className="bw-composer" aria-busy={inFlight} onSubmit={event => { event.preventDefault(); void submit() }}><label className="bw-sr" htmlFor={inputId}>{title}에 질문</label><textarea ref={field} id={inputId} rows={2} readOnly={sending} value={draft} maxLength={4000} placeholder="이 결과에 대해 이어서 물어보세요" onChange={event => onDraftChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } }} /><button type="submit" disabled={!draft.trim() || inFlight} aria-label="차트 질문 보내기"><ArrowUp size={17} /></button></form>{sending && <p className="bw-send-status" role="status">전송 중…</p>}{sendError && <p className="bw-send-error" role="alert">질문을 보내지 못했습니다. 입력 내용은 유지됩니다. 다시 전송해주세요.</p>}
        </div>
      </aside>
    </div>
  </section>
}
