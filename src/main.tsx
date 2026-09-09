import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Command,
  Copy,
  Eye,
  KeyRound,
  LineChart,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import './funnel-v2.css'
import './mock-strategy-flow.css'
import {
  CHART_TIMEFRAMES,
  getMaxDrawdown,
  getMockBacktestMeta,
  getMockMarketCandles,
  getSeriesMetrics,
  normalizeChartTimeframe,
  parseChartTimeframe,
  type BacktestResultMode,
  type ChartTimeframe,
} from './backtest-data'
import { EquityResultCanvas, ImaginationCanvas, type ReplayMarketFrame } from './components/SignalCanvas'
import { MockStrategyJourney } from './components/MockStrategyJourney'

type Period = '3M' | '6M' | '1Y'

function expandMockSeries(keyframes: number[], count: number) {
  return Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * (keyframes.length - 1)
    const left = Math.floor(position)
    const right = Math.min(keyframes.length - 1, left + 1)
    const mix = position - left
    const base = keyframes[left] + (keyframes[right] - keyframes[left]) * mix
    const texture = Math.sin(index * 1.73) * .28 + Math.sin(index * .41) * .18
    if (index === 0 || index === count - 1) return keyframes[index === 0 ? 0 : keyframes.length - 1]
    return Number((base + texture).toFixed(2))
  })
}

const tickers = [
  { symbol: 'BTC/USDT', price: '67,842.10', change: '+2.84%', up: true },
  { symbol: 'ETH/USDT', price: '3,486.72', change: '+1.12%', up: true },
  { symbol: 'SOL/USDT', price: '148.36', change: '-0.48%', up: false },
  { symbol: 'BNB/USDT', price: '592.40', change: '+0.36%', up: true },
]

const markets = [
  { symbol: 'BTC', name: 'Bitcoin', price: '$67,842', change: '+2.84', trend: [7, 11, 9, 13, 12, 18, 21] },
  { symbol: 'ETH', name: 'Ethereum', price: '$3,486', change: '+1.12', trend: [9, 8, 11, 10, 13, 12, 15] },
  { symbol: 'SOL', name: 'Solana', price: '$148.36', change: '-0.48', trend: [16, 15, 16, 12, 13, 10, 9] },
  { symbol: 'XRP', name: 'XRP', price: '$0.5482', change: '+0.24', trend: [8, 9, 8, 10, 9, 10, 11] },
]

const questions = [
  '비트코인 상승이 거래량으로 확인되나요?',
  '이번 주 변동성이 커진 자산은?',
  '현재 현금 비중을 높일 신호가 있나요?',
]

const periodData: Record<Period, { winRate: string; trades: string; benchmark: string; values: number[] }> = {
  '3M': { winRate: '59.2%', trades: '38', benchmark: '+5.1%', values: expandMockSeries([0, 1.2, 3.8, 2.7, 5.2, 4.4, 7.1, 5.9, 8.6], 61) },
  '6M': { winRate: '61.8%', trades: '84', benchmark: '+9.4%', values: expandMockSeries([0, 1.5, 5.1, 3.8, 8.4, 5.6, 11.8, 7.2, 14.2], 91) },
  '1Y': { winRate: '58.6%', trades: '167', benchmark: '+13.1%', values: expandMockSeries([0, 2.4, 6.1, 3, 9.8, 4.2, 13.8, 6.4, 16.3, 12.1, 19.5, 14.3, 21.7], 121) },
}

const BACKTEST_DAYS = '2,190'
const DASHBOARD_TURNS_KEY = 'tesia-dashboard-turns-v1'

const preferredScrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

const formatMarketPrice = (value: number) => value.toLocaleString('en-US', {
  minimumFractionDigits: value < 1_000 ? 2 : 1,
  maximumFractionDigits: value < 1_000 ? 2 : 1,
})

const formatMarketVolume = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString('en-US')
}

const formatReplayTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  const twoDigits = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}.${twoDigits(date.getUTCMonth() + 1)}.${twoDigits(date.getUTCDate())}`
}

function BacktestReplayTerminal({
  market,
  timeframe,
  mode,
  professional,
  replayDuration,
  onRevealComplete,
}: {
  market: string
  timeframe: ChartTimeframe
  mode: BacktestResultMode
  professional: boolean
  replayDuration: number
  onRevealComplete: () => void
}) {
  const initialFrame = useMemo<ReplayMarketFrame>(() => {
    const candles = getMockMarketCandles(market, timeframe)
    const candle = candles[0]
    return {
      index: 0,
      total: candles.length,
      candle,
      changePercent: candle.open === 0 ? 0 : ((candle.close - candle.open) / candle.open) * 100,
    }
  }, [market, timeframe])
  const quoteRef = useRef<HTMLDivElement>(null)
  const timestampRef = useRef<HTMLElement>(null)
  const openRef = useRef<HTMLDataElement>(null)
  const highRef = useRef<HTMLDataElement>(null)
  const lowRef = useRef<HTMLDataElement>(null)
  const closeRef = useRef<HTMLDataElement>(null)
  const volumeRef = useRef<HTMLDataElement>(null)
  const changeRef = useRef<HTMLElement>(null)
  const symbol = market.replace('/', '')
  const timeframeInfo = CHART_TIMEFRAMES[timeframe]

  const updateQuote = useCallback((nextFrame: ReplayMarketFrame) => {
    const { candle, changePercent } = nextFrame
    if (quoteRef.current) {
      quoteRef.current.dataset.candleIndex = String(nextFrame.index)
      quoteRef.current.dataset.candleTotal = String(nextFrame.total)
      quoteRef.current.dataset.candleOpen = String(candle.open)
      quoteRef.current.dataset.candleHigh = String(candle.high)
      quoteRef.current.dataset.candleLow = String(candle.low)
      quoteRef.current.dataset.candleClose = String(candle.close)
      quoteRef.current.dataset.candleVolume = String(candle.volume)
      quoteRef.current.dataset.candleChange = changePercent.toFixed(6)
    }
    if (timestampRef.current) timestampRef.current.textContent = `${timeframeInfo.label} · 표본 ${formatReplayTimestamp(candle.timestamp)}`
    if (openRef.current) openRef.current.textContent = formatMarketPrice(candle.open)
    if (highRef.current) highRef.current.textContent = formatMarketPrice(candle.high)
    if (lowRef.current) lowRef.current.textContent = formatMarketPrice(candle.low)
    if (closeRef.current) closeRef.current.textContent = formatMarketPrice(candle.close)
    if (volumeRef.current) volumeRef.current.textContent = formatMarketVolume(candle.volume)
    if (changeRef.current) {
      changeRef.current.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
      changeRef.current.className = changePercent < 0 ? 'negative' : 'positive'
    }
  }, [timeframeInfo.label])

  return (
    <div className="replay-terminal" role="region" aria-label={`${market} ${timeframeInfo.label} 백테스트 차트`}>
      {professional && (
        <div className="trade-toolbar" aria-hidden="true">
          <span className="trade-symbol">{symbol}</span><b>Perpetual</b><span className="active-timeframe">{timeframeInfo.shortLabel}</span><span>Indicators</span><span>Replay</span><em>Mock market data</em>
        </div>
      )}
      <div
        ref={quoteRef}
        className="replay-quote-line"
        data-candle-index={initialFrame.index}
        data-candle-total={initialFrame.total}
        data-candle-open={initialFrame.candle.open}
        data-candle-high={initialFrame.candle.high}
        data-candle-low={initialFrame.candle.low}
        data-candle-close={initialFrame.candle.close}
        data-candle-volume={initialFrame.candle.volume}
        data-candle-change={initialFrame.changePercent.toFixed(6)}
      >
        <div>
          <span className="market-pair">{market}</span>
          <small ref={timestampRef}>{timeframeInfo.label} · 표본 {formatReplayTimestamp(initialFrame.candle.timestamp)}</small>
        </div>
        <div className="mock-ohlc" aria-hidden="true">
          <span><i>O</i><data ref={openRef}>{formatMarketPrice(initialFrame.candle.open)}</data></span>
          <span><i>H</i><data ref={highRef}>{formatMarketPrice(initialFrame.candle.high)}</data></span>
          <span><i>L</i><data ref={lowRef}>{formatMarketPrice(initialFrame.candle.low)}</data></span>
          <strong><i>C</i><data ref={closeRef}>{formatMarketPrice(initialFrame.candle.close)}</data></strong>
          <span className="mock-volume"><i>V</i><data ref={volumeRef}>{formatMarketVolume(initialFrame.candle.volume)}</data></span>
          <b ref={changeRef} className={initialFrame.changePercent < 0 ? 'negative' : 'positive'}>{initialFrame.changePercent >= 0 ? '+' : ''}{initialFrame.changePercent.toFixed(2)}%</b>
        </div>
      </div>
      <div className="replay-chart-stage">
        <EquityResultCanvas
          mode={mode}
          interactive={false}
          presentation="cinematic"
          professional={professional}
          timeframe={timeframe}
          market={market}
          replayDuration={replayDuration}
          onReplayFrame={updateQuote}
          onRevealComplete={onRevealComplete}
        />
      </div>
    </div>
  )
}

type StrategyAnswers = { market: string; timeframe: string; risk: string }
type PolicyKind = 'risk' | 'privacy' | 'help'
type AgentPhase = 'idle' | 'thinking' | 'streaming' | 'ready'
type DashboardAnalysis = {
  lead: string
  detail: string
  signals: string[][]
}
type DashboardTurn = DashboardAnalysis & { id: number; question: string }
type EarlyChatView = Extract<FunnelView, 'landing' | 'briefing' | 'build'>
type MarketChatTurn = {
  id: number
  question: string
  title: string
  body: string
}

const isEarlyChatView = (value: FunnelView): value is EarlyChatView =>
  value === 'landing' || value === 'briefing' || value === 'build'

function ThinkingIndicator({ label = '질문을 살펴보고 있어요' }: { label?: string }) {
  return (
    <div className="thinking-row" role="status" aria-label={`TETH가 ${label}`}>
      <span className="message-avatar tesia-agent-avatar is-thinking"><TesiaGlyph /></span>
      <div className="thinking-bubble">
        <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
        <small>{label}</small>
      </div>
    </div>
  )
}

function TesiaGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`tesia-glyph ${className}`.trim()}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.75">
        <ellipse cx="16" cy="16" rx="4.2" ry="9" />
        <ellipse cx="16" cy="16" rx="4.2" ry="9" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="4.2" ry="9" transform="rotate(120 16 16)" />
      </g>
      <circle cx="16" cy="16" r="1.55" fill="currentColor" />
    </svg>
  )
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <TesiaGlyph />
    </span>
  )
}

function MiniTrend({ values, down = false }: { values: number[]; down?: boolean }) {
  const points = values.map((value, index) => `${index * 9},${24 - value}`).join(' ')
  return (
    <svg className={`mini-trend ${down ? 'negative' : 'positive'}`} viewBox="0 0 54 24" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function getDashboardAnalysis(question: string): DashboardAnalysis {
  const normalized = question.toLowerCase()
  if (normalized.includes('eth')) return {
    lead: 'ETH 거래량은 20일 평균보다 6.2% 많았습니다.',
    detail: 'BTC의 +18.4%보다 회복 속도가 느려, 두 자산의 동시 진입보다 BTC 신호를 먼저 확인하는 편이 안정적이었습니다.',
    signals: [['거래량', '+6.2%'], ['상대 강도', 'BTC 우위'], ['변동성', '중간']],
  }
  if (normalized.includes('sol')) return {
    lead: 'SOL 거래량은 7일 평균보다 9.1% 적었습니다.',
    detail: '가격 반등에 비해 체결 강도가 약해, 거래량이 평균을 회복하기 전 진입한 구간의 손실 폭이 더 컸습니다.',
    signals: [['거래량', '-9.1%'], ['추세 확인', '대기'], ['변동성', '높음']],
  }
  if (normalized.includes('xrp')) return {
    lead: 'XRP 거래량은 20일 평균보다 1.7% 많았습니다.',
    detail: '가격과 거래량이 모두 방향성을 만들지 못해, 돌파 확인 전에는 포지션 크기를 줄인 구간의 손실 폭이 더 작았습니다.',
    signals: [['거래량', '+1.7%'], ['추세 확인', '대기'], ['변동성', '낮음']],
  }
  if (normalized.includes('현금')) return {
    lead: '위험 선호 지수는 68 / 100입니다.',
    detail: '현금 비중 확대 신호는 강하지 않지만, 알트코인 거래량이 회복되기 전까지 신규 진입 규모를 줄이는 편이 유리했습니다.',
    signals: [['위험 선호', '68 / 100'], ['현금 비중', '유지'], ['신규 진입', '축소']],
  }
  if (normalized.includes('주요 자산') || normalized.includes('전체 시장') || (normalized.includes('비교') && !normalized.includes('eth'))) return {
    lead: '주요 자산 중에는 BTC의 거래량 회복이 가장 뚜렷했습니다.',
    detail: '20일 평균 대비 BTC는 +18.4%, ETH는 +6.2%, SOL은 -9.1%로 나타나 시장 전반보다 BTC에 유동성이 집중된 mock 국면입니다.',
    signals: [['BTC 거래량', '+18.4%'], ['ETH 거래량', '+6.2%'], ['SOL 거래량', '-9.1%']],
  }
  if (normalized.includes('btc')) return {
    lead: 'BTC 거래량은 20일 평균보다 18.4% 많았습니다.',
    detail: '현재 변동성은 중간 구간입니다. 지금 추격하기보다 $66.8K를 다시 확인한 뒤 진입했을 때 과거 손실 폭이 더 작았습니다.',
    signals: [['거래량', '+18.4%'], ['변동성', '중간'], ['신뢰도', '72%']],
  }
  if (normalized.includes('변동성')) return {
    lead: '이번 주에는 SOL의 변동성 확대가 가장 컸습니다.',
    detail: 'BTC와 ETH는 중간 구간을 유지했지만 SOL의 일중 변동 폭은 20일 중앙값보다 23% 높았습니다.',
    signals: [['SOL 변동성', '+23%'], ['BTC', '중간'], ['ETH', '중간']],
  }
  if (normalized.includes('무효') || normalized.includes('가격')) return {
    lead: 'BTC가 $64.9K를 종가로 이탈하면 현재 신호가 약해집니다.',
    detail: '최근 90일 mock 구간에서 이 가격 아래의 거래량 반등은 다음 3일 상승으로 이어진 비율이 41%에 그쳤습니다.',
    signals: [['무효화', '$64.9K'], ['반등 지속', '41%'], ['확인 주기', '일봉']],
  }
  return {
    lead: 'BTC 거래량은 20일 평균보다 18.4% 많았습니다.',
    detail: '지금 추격하기보다 $66.8K를 다시 확인한 뒤 진입했을 때 과거 손실 폭이 더 작았습니다.',
    signals: [['거래량', '+18.4%'], ['변동성', '중간'], ['신뢰도', '72%']],
  }
}

function PolicyDialog({ kind, onClose }: { kind: PolicyKind; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const copy = {
    risk: { eyebrow: 'RISK DISCLOSURE', title: '과거 결과는 미래 수익을 보장하지 않습니다.', body: 'TETH의 가격, 백테스트, 신호와 주문 흐름은 모두 mock 데이터입니다. 실제 투자 판단과 주문 전에는 거래소 정보와 위험을 직접 확인해야 합니다.' },
    privacy: { eyebrow: 'PRIVACY', title: '이 시연은 개인 정보를 서버에 저장하지 않습니다.', body: '질문과 전략 진행 상태는 새로고침 복구를 위해 이 탭의 sessionStorage에만 보관되며 탭을 닫으면 지워집니다. 체험용 API 키는 메모리에만 머물고 외부로 전송되지 않습니다.' },
    help: { eyebrow: '24H MOCK SUPPORT', title: '전략 조건부터 실행 화면까지 안내합니다.', body: '시장 질문, 전략 조건, 백테스트 결과 읽기와 mock API 연결 흐름을 이 화면에서 확인할 수 있습니다. 실제 계정이나 주문은 연결되지 않습니다.' },
  }[kind]

  useEffect(() => {
    const dialog = dialogRef.current
    if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const closeDialog = () => {
    const returnFocus = returnFocusRef.current
    dialogRef.current?.close()
    onClose()
    window.setTimeout(() => returnFocus?.focus(), 0)
  }

  return (
    <dialog ref={dialogRef} className="policy-dialog" aria-labelledby="policy-title" onCancel={(event) => { event.preventDefault(); closeDialog() }} onClick={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
      <div>
        <span>{copy.eyebrow}</span>
        <h2 id="policy-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <button type="button" onClick={closeDialog}>확인</button>
      </div>
    </dialog>
  )
}

function Dashboard({ onHome, strategyTitle, strategyEntry, answers, announcement, exchangeName }: {
  onHome: () => void
  strategyTitle: string
  strategyEntry: string
  answers: StrategyAnswers
  announcement: string
  exchangeName: 'Binance' | 'Gate' | 'Alpaca'
}) {
  const [period, setPeriod] = useState<Period>('6M')
  const [prompt, setPrompt] = useState('')
  const [promptError, setPromptError] = useState('')
  const [analysis, setAnalysis] = useState(false)
  const [dashboardPhase, setDashboardPhase] = useState<AgentPhase>('idle')
  const [dashboardReply, setDashboardReply] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState('')
  const [dashboardTurns, setDashboardTurns] = useState<DashboardTurn[]>(() => {
    try {
      const saved = window.sessionStorage.getItem(DASHBOARD_TURNS_KEY)
      return saved === null ? [] : JSON.parse(saved)
    } catch {
      return []
    }
  })
  const [dashboardRequestId, setDashboardRequestId] = useState(0)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [dashboardPointIndex, setDashboardPointIndex] = useState<number | null>(null)
  const [policyOpen, setPolicyOpen] = useState<PolicyKind | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const dashboardConversationRef = useRef<HTMLElement>(null)
  const dashboardInputMethodRef = useRef<'keyboard' | 'pointer'>('pointer')
  const dashboardHandoffReadyRef = useRef(window.sessionStorage.getItem(DASHBOARD_TURNS_KEY) !== null)
  const drawerRef = useRef<HTMLElement>(null)
  const drawerCloseRef = useRef<HTMLButtonElement>(null)
  const drawerTriggerRef = useRef<HTMLElement | null>(null)
  const apiKeyRef = useRef<HTMLInputElement>(null)
  const apiSecretRef = useRef<HTMLInputElement>(null)
  const activeData = periodData[period]
  const chartWidth = 640
  const chartHeight = 240
  const chartTop = 16
  const chartBottom = 220
  const chartX = (index: number) => 8 + (index / (activeData.values.length - 1)) * (chartWidth - 16)
  const chartY = (value: number) => chartBottom - (value / 24) * (chartBottom - chartTop)
  const dashboardChartPoints = activeData.values
    .map((value, index) => `${chartX(index)},${chartY(value)}`)
    .join(' ')
  const dashboardBenchmark = Number.parseFloat(activeData.benchmark.replace('%', ''))
  const dashboardBenchmarkPoints = activeData.values
    .map((_, index) => {
      const progress = index / (activeData.values.length - 1)
      const value = dashboardBenchmark * progress + Math.sin(index * .22) * .16
      return `${chartX(index)},${chartY(value)}`
    })
    .join(' ')
  const dashboardReturn = activeData.values.at(-1) ?? 0
  const dashboardDrawdown = getMaxDrawdown(activeData.values)
  const dashboardPointDate = dashboardPointIndex === null ? '' : (() => {
    const months = period === '3M' ? 3 : period === '6M' ? 6 : 12
    const end = Date.UTC(2026, 7, 25)
    const start = new Date(end)
    start.setUTCMonth(start.getUTCMonth() - months)
    const progress = dashboardPointIndex / (activeData.values.length - 1)
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(start.getTime() + (end - start.getTime()) * progress))
  })()
  const selectDashboardPoint = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect()
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)))
    setDashboardPointIndex(Math.round(progress * (activeData.values.length - 1)))
  }
  const strategyAsset = (answers.market || 'BTC/USDT').split('/')[0]
  const dashboardSummary = useMemo(() => {
    if (strategyAsset === 'ETH') return { title: 'ETH 거래량은 회복 중이고,', emphasis: '변동성은 중간입니다.', stat: '20일 평균 대비 +6.2%' }
    if (strategyAsset === 'SOL') return { title: 'SOL 거래량은 평균 아래고,', emphasis: '변동성은 높습니다.', stat: '7일 평균 대비 -9.1%' }
    if (strategyAsset === 'XRP') return { title: 'XRP 거래량은 보합이고,', emphasis: '변동성은 낮습니다.', stat: '20일 평균 대비 +1.7%' }
    return { title: 'BTC 거래량은 늘고,', emphasis: '변동성은 낮습니다.', stat: '20일 평균 대비 +18.4%' }
  }, [strategyAsset])

  useEffect(() => {
    if (dashboardHandoffReadyRef.current) return
    dashboardHandoffReadyRef.current = true
    const handoff: DashboardTurn = {
      id: -1,
      question: '이전 대화와 검증 결과를 이어서 보여줘',
      lead: `${strategyTitle} 기준을 대시보드로 이어받았습니다.`,
      detail: `${answers.market || 'BTC/USDT'} · ${answers.timeframe || '4시간봉'} · ${exchangeName} mock 실행 조건이며, 6개월 누적 수익률 +14.2%와 최대 낙폭 ${getMaxDrawdown(periodData['6M'].values).toFixed(1)}%를 함께 추적할 수 있습니다.`,
      signals: [['전략', '준비됨'], ['검증', '+14.2%'], ['실행', exchangeName]],
    }
    setDashboardTurns([handoff])
    window.sessionStorage.setItem(DASHBOARD_TURNS_KEY, JSON.stringify([handoff]))
  }, [answers.market, answers.timeframe, exchangeName, strategyTitle])

  useEffect(() => {
    if (!dashboardHandoffReadyRef.current) return
    window.sessionStorage.setItem(DASHBOARD_TURNS_KEY, JSON.stringify(dashboardTurns))
  }, [dashboardTurns])

  const currentQuestion = submittedQuestion || `${strategyAsset} 상승이 거래량으로 확인되나요?`
  const analysisContent = useMemo(() => getDashboardAnalysis(currentQuestion), [currentQuestion])

  const focusQuestion = () => {
    promptRef.current?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' })
    window.setTimeout(() => promptRef.current?.focus(), preferredScrollBehavior() === 'auto' ? 0 : 180)
  }

  const runDashboardQuestion = (question: string, inputMethod: 'keyboard' | 'pointer' = 'pointer') => {
    if (analysis) return
    const nextQuestion = question.trim()
    if (!nextQuestion) {
      setPromptError('분석할 시장 질문을 입력해주세요.')
      focusQuestion()
      return
    }
    setPromptError('')
    setPrompt('')
    setSubmittedQuestion(nextQuestion)
    setAnalysis(true)
    setDashboardPhase('thinking')
    setDashboardReply('')
    dashboardInputMethodRef.current = inputMethod
    setDashboardRequestId((value) => value + 1)
    window.setTimeout(() => document.querySelector('#dashboard-conversation')?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'nearest' }), 80)
  }

  const submitPrompt = (inputMethod: 'keyboard' | 'pointer' = 'pointer') => runDashboardQuestion(prompt, inputMethod)

  const askQuestion = (question: string) => {
    runDashboardQuestion(question)
  }

  useEffect(() => {
    if (!dashboardRequestId || dashboardPhase !== 'thinking') return
    const timer = window.setTimeout(() => setDashboardPhase('streaming'), 720)
    return () => window.clearTimeout(timer)
  }, [dashboardRequestId, dashboardPhase])

  useEffect(() => {
    if (dashboardPhase !== 'streaming') return
    const fullReply = `${analysisContent.lead} ${analysisContent.detail}`
    let cursor = 0
    const timer = window.setInterval(() => {
      cursor = Math.min(fullReply.length, cursor + 3)
      setDashboardReply(fullReply.slice(0, cursor))
      if (cursor >= fullReply.length) {
        window.clearInterval(timer)
        setDashboardTurns((turns) => [...turns, { id: Date.now(), question: currentQuestion, ...analysisContent }])
        setDashboardPhase('ready')
        setAnalysis(false)
        window.requestAnimationFrame(() => {
          if (dashboardInputMethodRef.current === 'keyboard') promptRef.current?.focus({ preventScroll: true })
          else dashboardConversationRef.current?.focus({ preventScroll: true })
        })
      }
    }, 16)
    return () => window.clearInterval(timer)
  }, [dashboardPhase, analysisContent, currentQuestion])

  const connectExchange = (event: React.FormEvent) => {
    event.preventDefault()
    if (!apiKey || !apiSecret) {
      setConnectionError('API Key와 Secret Key를 모두 입력해주세요.')
      window.requestAnimationFrame(() => (apiKey ? apiSecretRef.current : apiKeyRef.current)?.focus())
      return
    }
    setConnectionError('')
    setConnected(true)
    setApiKey('')
    setApiSecret('')
  }

  useEffect(() => {
    if (connectionOpen) {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && !drawerRef.current?.contains(activeElement)) {
        drawerTriggerRef.current = activeElement
      }
      window.requestAnimationFrame(() => drawerCloseRef.current?.focus())
      return
    }
    const trigger = drawerTriggerRef.current
    if (trigger) {
      window.requestAnimationFrame(() => trigger.focus())
      drawerTriggerRef.current = null
    }
  }, [connectionOpen])

  const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      setConnectionOpen(false)
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], textarea:not([disabled])') ?? [],
    )
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">본문으로 바로가기</a>
      <div className="analysis-announcer" role="status" aria-live="polite">{announcement}</div>
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={onHome} aria-label="TETH AI 홈">
          <BrandMark />
          <span>TETH</span>
          <sup>AI</sup>
        </button>
        <nav className="desktop-nav workspace-nav" aria-label="워크스페이스 바로가기">
          <span className="workspace-now"><span /> AI 워크스페이스</span>
          <button type="button" onClick={focusQuestion}>새 질문</button>
          <a href="#performance">성과 보기</a>
        </nav>
        <div className="top-actions">
          <span className="mock-badge"><span /> MOCK MODE</span>
          <button className="icon-button desktop-only" aria-label="TETH에게 질문" onClick={focusQuestion}><Search size={18} /></button>
          <button
            className="connect-button"
            aria-label={connected ? `${exchangeName} 연결됨` : 'API 연결'}
            aria-expanded={connectionOpen}
            aria-controls="connection-drawer"
            onClick={() => setConnectionOpen(true)}
          >
            {connected ? <Check size={16} /> : <KeyRound size={16} />}
            <span>{connected ? `${exchangeName} 연결됨` : 'API 연결'}</span>
          </button>
        </div>
      </header>

      <div className="ticker-strip" role="group" aria-label="주요 시세">
        <span className="live-indicator"><span /> LIVE MOCK</span>
        {tickers.map((ticker) => (
          <div className="ticker" key={ticker.symbol}>
            <strong>{ticker.symbol}</strong>
            <span>{ticker.price}</span>
            <em className={ticker.up ? 'positive' : 'negative'}>{ticker.change}</em>
          </div>
        ))}
        <span className="market-time">UTC 12:34:08</span>
      </div>

      <aside className="rail" aria-label="도구 메뉴">
        <a className="rail-item active" href="#overview" aria-label="홈" aria-current="page"><LayoutDashboard /></a>
        <button className="rail-item" aria-label="TETH에게 질문" onClick={focusQuestion}><MessageSquareText /></button>
        <a className="rail-item" href="#performance" aria-label="성과 보기"><ChartNoAxesCombined /></a>
        <span className="rail-spacer" />
        <button className="rail-item" aria-label="질문 도움말" onClick={() => { setPrompt('이 화면의 지표를 간단히 설명해줘'); focusQuestion() }}><CircleHelp /></button>
        <button className="rail-item" aria-label="연결 설정" aria-expanded={connectionOpen} aria-controls="connection-drawer" onClick={() => setConnectionOpen(true)}><Settings2 /></button>
      </aside>

      <main id="main" tabIndex={-1}>
        <section id="overview" className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> 2026.08.25 · 서울</div>
            <h1 id="hero-title">{dashboardSummary.title} <span>{dashboardSummary.emphasis}</span></h1>
            <p className="hero-signal-line"><span><strong>{dashboardSummary.stat}</strong> 거래량</span><span>변동성 낮음</span><span>위험 선호 68 / 100</span></p>
          </div>
          <div className="market-regime" aria-label="현재 시장 국면">
            <span className="regime-label">현재 국면</span>
            <strong>완만한 위험 선호</strong>
            <span className="regime-score">68 <small>/ 100</small></span>
            <div className="regime-track" role="progressbar" aria-label="위험 선호 점수" aria-valuemin={0} aria-valuemax={100} aria-valuenow={68}><span style={{ width: '68%' }} /></div>
            <p>거래량과 스테이블코인 유입이 동시에 개선 중</p>
          </div>
        </section>

        <section className="ask-zone" aria-label="TETH AI 대화 입력">
          <div className="ask-glass">
            <div className="ask-header">
              <span className="ask-icon tesia-agent-avatar" aria-hidden="true"><TesiaGlyph /></span>
              <label htmlFor="market-question">TETH에게 무엇이든 물어보세요</label>
              <span className="ask-mode"><span /> MOCK DATA</span>
            </div>
            <div className="ask-input-row">
              <textarea
                id="market-question"
                ref={promptRef}
                value={prompt}
                disabled={analysis}
                onChange={(event) => { setPrompt(event.target.value); if (promptError) setPromptError('') }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submitPrompt('keyboard')
                  }
                }}
                placeholder={`${strategyAsset} 상승이 거래량으로 확인되는지 분석해줘`}
                rows={1}
              />
              <button className="send-button" disabled={analysis} onClick={() => submitPrompt('pointer')} aria-label="질문 보내기"><ArrowRight size={20} /></button>
            </div>
            <div className="ask-footer">
              {promptError ? <span className="ask-error" role="alert">{promptError}</span> : <span className="desktop-hint">Enter 전송 · Shift+Enter 줄바꿈</span>}
              <span>실시간 시세·투자 조언 아님</span>
            </div>
          </div>
        </section>

        {(dashboardTurns.length > 0 || analysis) && (
          <section ref={dashboardConversationRef} id="dashboard-conversation" className="dashboard-conversation" aria-label="TETH와의 대화" aria-busy={dashboardPhase === 'thinking' || dashboardPhase === 'streaming'} tabIndex={-1}>
            <div className="dashboard-thread-head">
              <span><span /> 이어지는 대화</span>
              <button type="button" onClick={() => { setDashboardTurns([]); setAnalysis(false); setDashboardPhase('idle'); setDashboardReply(''); window.requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: true })) }}>대화 비우기</button>
            </div>
            <div className="dashboard-chat-thread">
              {dashboardTurns.map((turn) => (
                <div className="dashboard-chat-turn" key={turn.id}>
                  <article className="dashboard-user-message"><span>나</span><p>{turn.question}</p></article>
                  <article className="dashboard-ai-message">
                    <span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span>
                    <div>
                      <span className="dashboard-ai-label">TETH · MOCK 분석</span>
                      <p><strong>{turn.lead}</strong> {turn.detail}</p>
                      <div className="signal-row">
                        {turn.signals.map(([label, value], index) => (
                          <span key={label}>{index === 0 ? <TrendingUp size={15} /> : index === 1 ? <Activity size={15} /> : <ShieldCheck size={15} />}{label} <strong>{value}</strong></span>
                        ))}
                      </div>
                    </div>
                  </article>
                </div>
              ))}
              {analysis && (
                <div className="dashboard-chat-turn active">
                  <article className="dashboard-user-message"><span>나</span><p>{currentQuestion}</p></article>
                  {dashboardPhase === 'thinking' ? (
                    <ThinkingIndicator label="가격 흐름과 거래량을 함께 보고 있어요" />
                  ) : (
                    <article className="dashboard-ai-message streaming-message" data-phase="streaming">
                      <span className="message-avatar tesia-agent-avatar is-streaming"><TesiaGlyph /></span>
                      <div><span className="dashboard-ai-label">TETH · 답변 중</span><p>{dashboardReply}<span className="stream-caret" aria-hidden="true" /></p></div>
                    </article>
                  )}
                </div>
              )}
              {dashboardTurns.length > 0 && !analysis && (
                <div className="dashboard-followups" aria-label="이어서 물어보기">
                  <span>이어서 물어보기</span>
                  <button type="button" onClick={() => askQuestion('이 신호가 무효화되는 가격은?')}>어디서 흐름이 깨져?</button>
                  <button type="button" onClick={() => askQuestion('같은 조건을 ETH에 적용하면?')}>ETH와 비교해줘</button>
                  <button type="button" onClick={() => askQuestion('지금 신규 진입한다면 무엇을 조심해야 해?')}>지금 주의할 점은?</button>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="suggestions" aria-labelledby="suggestions-title">
          <div className="section-heading compact">
            <h2 id="suggestions-title">바로 확인할 질문</h2>
            <span>추천 질문</span>
          </div>
          <div className="question-list">
            {questions.map((question, index) => (
              <button key={question} disabled={analysis} onClick={() => askQuestion(question)}>
                <span>0{index + 1}</span>
                <strong>{question}</strong>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </section>

        <div className="analysis-announcer" aria-live="polite">{dashboardPhase === 'thinking' ? 'TETH가 질문을 살펴보고 있습니다.' : dashboardPhase === 'streaming' ? 'TETH가 답변하고 있습니다.' : dashboardTurns.length ? 'TETH의 답변이 완료되었습니다.' : ''}</div>

        <div id="performance" className="content-grid">
          <section className="strategy-panel" aria-labelledby="strategy-title">
            <div className="panel-topline">
              <div>
                <span className="kicker">STRATEGY 01</span>
                <h2 id="strategy-title">{strategyTitle}</h2>
                <p>{strategyEntry}</p>
              </div>
            </div>

            <div className="backtest-toolbar">
              <div className="period-tabs" role="group" aria-label="백테스트 기간">
                {(Object.keys(periodData) as Period[]).map((item) => (
                  <button key={item} className={period === item ? 'active' : ''} aria-pressed={period === item} onClick={() => { setPeriod(item); setDashboardPointIndex(null) }}>{item}</button>
                ))}
              </div>
              <span>{answers.market || 'BTC/USDT'} · {answers.timeframe || '4시간봉'} · {answers.risk || '리스크 미설정'}</span>
            </div>

            <div className="metric-grid">
              <div className="primary-metric"><span>누적 수익률</span><strong className="positive">+{dashboardReturn.toFixed(1)}%</strong><small>vs. 보유 {activeData.benchmark}</small></div>
              <div><span>승률</span><strong>{activeData.winRate}</strong><small>손익비 1.84</small></div>
              <div><span>최대 낙폭</span><strong className="negative">{dashboardDrawdown.toFixed(1)}%</strong><small>21일 회복</small></div>
              <div><span>총 거래</span><strong>{activeData.trades}</strong><small>월 14회 평균</small></div>
            </div>

            <div className="equity-chart">
              <div className="chart-legend"><span className="strategy-legend"><i /> 내 기준</span><span className="benchmark-legend"><i /> BTC 보유</span><em>MOCK PERFORMANCE</em></div>
              <div className="chart-axis"><span>+24%</span><span>+18%</span><span>+12%</span><span>+6%</span><span>0%</span></div>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                role="img"
                tabIndex={0}
                aria-label={`${period} 백테스트 누적 수익 차트. 좌우 방향키로 ${activeData.values.length}개 시점의 수익률을 확인할 수 있습니다.`}
                onPointerMove={(event) => { if (event.pointerType === 'mouse') selectDashboardPoint(event.clientX, event.currentTarget) }}
                onPointerDown={(event) => selectDashboardPoint(event.clientX, event.currentTarget)}
                onPointerLeave={(event) => { if (event.pointerType === 'mouse' && document.activeElement !== event.currentTarget) setDashboardPointIndex(null) }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    setDashboardPointIndex((current) => current === null ? 0 : Math.min(activeData.values.length - 1, current + 1))
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    setDashboardPointIndex((current) => current === null ? activeData.values.length - 1 : Math.max(0, current - 1))
                  } else if (event.key === 'Home') {
                    event.preventDefault()
                    setDashboardPointIndex(0)
                  } else if (event.key === 'End') {
                    event.preventDefault()
                    setDashboardPointIndex(activeData.values.length - 1)
                  } else if (event.key === 'Escape') {
                    setDashboardPointIndex(null)
                  }
                }}
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[16, 67, 118, 169, 220].map((y, index) => <line key={y} x1="8" y1={y} x2="632" y2={y} className={index === 4 ? 'zero-line' : 'chart-grid-line'} />)}
                <polygon points={`8,${chartBottom} ${dashboardChartPoints} 632,${chartBottom}`} fill="url(#chartFill)" />
                <polyline className="benchmark-line" points={dashboardBenchmarkPoints} fill="none" vectorEffect="non-scaling-stroke" />
                <polyline className="strategy-line" points={dashboardChartPoints} fill="none" vectorEffect="non-scaling-stroke" />
                {dashboardPointIndex !== null && <>
                  <line className="chart-crosshair" x1={chartX(dashboardPointIndex)} y1="16" x2={chartX(dashboardPointIndex)} y2="220" />
                  <circle className="chart-focus-dot" cx={chartX(dashboardPointIndex)} cy={chartY(activeData.values[dashboardPointIndex])} r="5" />
                </>}
                <circle className="chart-end-dot" cx="632" cy={chartY(dashboardReturn)} r="4" />
              </svg>
              <span className="chart-end-badge" style={{ top: `${Math.max(18, Math.min(76, (chartY(dashboardReturn) / chartHeight) * 100))}%` }}>+{dashboardReturn.toFixed(1)}%</span>
              {dashboardPointIndex !== null && (
                <div className="dashboard-chart-tooltip" role="status" aria-live="polite" style={{ left: `${Math.max(18, Math.min(82, (chartX(dashboardPointIndex) / chartWidth) * 100))}%` }}>
                  <span>{dashboardPointDate}</span>
                  <strong>전략 {activeData.values[dashboardPointIndex] > 0 ? '+' : ''}{activeData.values[dashboardPointIndex].toFixed(1)}%</strong>
                  <small>BTC 보유 +{((dashboardPointIndex / (activeData.values.length - 1)) * dashboardBenchmark).toFixed(1)}%</small>
                </div>
              )}
              <div className="chart-dates"><span>{period === '3M' ? '6월' : period === '6M' ? '3월' : '2025.08'}</span><span>2026.08</span></div>
            </div>

            <div className="strategy-footer">
              <div><ShieldCheck size={16} /><span>과거 성과는 미래 수익을 보장하지 않습니다.</span></div>
              <button aria-expanded={connectionOpen} aria-controls="connection-drawer" onClick={() => setConnectionOpen(true)}><Play size={15} fill="currentColor" /> Mock 실행</button>
            </div>
          </section>

          <aside className="market-panel" aria-labelledby="market-title">
            <div className="panel-topline market-title-row">
              <div><span className="kicker">MARKET PULSE</span><h2 id="market-title">TETH가 읽은 시장</h2></div>
            </div>
            <div className="market-column-labels"><span>자산</span><span>가격 / 24H</span></div>
            <div className="market-list">
              {markets.map((market) => {
                const down = market.change.startsWith('-')
                return (
                  <button key={market.symbol} className="market-row" disabled={analysis} onClick={() => askQuestion(`${market.symbol}의 거래량과 변동성 변화를 분석해줘`)}>
                    <span className="coin-icon">{market.symbol.slice(0, 1)}</span>
                    <span className="coin-name"><strong>{market.symbol}</strong><small>{market.name}</small></span>
                    <MiniTrend values={market.trend} down={down} />
                    <span className="coin-price"><strong>{market.price}</strong><small className={down ? 'negative' : 'positive'}>{market.change}%</small></span>
                  </button>
                )
              })}
            </div>
            <button className="market-more" disabled={analysis} onClick={() => askQuestion('주요 자산의 거래량과 변동성을 비교해줘')}>전체 시장 비교 <ArrowRight size={15} /></button>

            <div className="brief-divider" />
            <div className="market-note">
              <div className="note-icon"><Zap size={16} /></div>
              <div><span>시장 관찰</span><p>BTC 점유율은 유지되지만, 소형주 거래량은 7일 평균 아래입니다.</p></div>
            </div>
          </aside>
        </div>

        <section className="strategy-ops" aria-labelledby="strategy-ops-title">
          <div>
            <span className="kicker">WORKSPACE STATUS</span>
            <h2 id="strategy-ops-title">실행 준비 현황</h2>
          </div>
          <dl>
            <div><dt>최근 검증</dt><dd>6분 전</dd></div>
            <div><dt>다음 리포트</dt><dd>3일 후</dd></div>
            <div><dt>API 연결</dt><dd>{connected ? `${exchangeName} 연결됨` : '연결 전'}</dd></div>
          </dl>
        </section>

        <footer className="page-footer">
          <span>© 2026 TETH AI</span>
          <span>본 화면의 모든 가격과 성과는 mock 데이터입니다.</span>
          <div><button type="button" onClick={() => setPolicyOpen('risk')}>위험 고지</button><button type="button" onClick={() => setPolicyOpen('privacy')}>개인정보</button></div>
        </footer>
      </main>

      {policyOpen && <PolicyDialog kind={policyOpen} onClose={() => setPolicyOpen(null)} />}

      <div className={`drawer-scrim ${connectionOpen ? 'visible' : ''}`} onClick={() => setConnectionOpen(false)} aria-hidden="true" />
      <aside
        ref={drawerRef}
        id="connection-drawer"
        className={`connection-drawer ${connectionOpen ? 'open' : ''}`}
        aria-labelledby="connection-title"
        aria-hidden={!connectionOpen}
        aria-modal={connectionOpen ? true : undefined}
        role={connectionOpen ? 'dialog' : undefined}
        inert={!connectionOpen}
        onKeyDown={handleDrawerKeyDown}
      >
        <div className="drawer-header">
          <div><span className="kicker">EXECUTION</span><h2 id="connection-title">{exchangeName} 연결</h2></div>
          <button ref={drawerCloseRef} onClick={() => setConnectionOpen(false)} aria-label="연결 패널 닫기"><X /></button>
        </div>
        {connected ? (
          <div className="connected-state">
            <div className="connected-seal"><ShieldCheck /></div>
            <h3>{exchangeName} Mock가<br />연결되었습니다.</h3>
            <p>API 키는 저장되지 않았으며 실제 주문은 전송되지 않습니다.</p>
            <div className="permission-list"><span><Eye size={16} /> 잔고 조회 · 시연</span><span><ChartNoAxesCombined size={16} /> 전략 실행 · Mock</span></div>
            <button className="drawer-primary" onClick={() => setConnectionOpen(false)}>대시보드로 돌아가기</button>
            <button className="drawer-text" onClick={() => setConnected(false)}>연결 해제</button>
          </div>
        ) : (
          <form onSubmit={connectExchange} noValidate>
            <p className="drawer-lead">잔고를 확인하고 mock 주문 흐름을 시험합니다. 입력 값은 현재 브라우저 메모리에만 머물며 전송되지 않습니다.</p>
            <p className="drawer-field-label">실행 환경</p>
            <div id="exchange" className="select-field" aria-label={`선택된 실행 환경 ${exchangeName}`}><span><strong className="binance-symbol">◇</strong> {exchangeName}</span><small>고정</small></div>
            <label htmlFor="api-key">API Key</label>
            <button
              type="button"
              className="sample-key-action"
              onClick={() => { setApiKey('TETH-MOCK-DEMO'); setApiSecret('mock-secret-not-sent'); setConnectionError('') }}
            >
              <Plus size={14} /> 체험용 샘플 키 자동 입력
            </button>
            <input ref={apiKeyRef} id="api-key" autoComplete="off" autoCapitalize="none" spellCheck={false} value={apiKey} aria-invalid={Boolean(connectionError && !apiKey)} aria-describedby={connectionError ? 'connection-error' : undefined} onChange={(event) => { setApiKey(event.target.value); if (connectionError) setConnectionError('') }} placeholder="Mock API Key" required />
            <label htmlFor="api-secret">Secret Key</label>
            <input ref={apiSecretRef} id="api-secret" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} value={apiSecret} aria-invalid={Boolean(connectionError && !apiSecret)} aria-describedby={connectionError ? 'connection-error' : undefined} onChange={(event) => { setApiSecret(event.target.value); if (connectionError) setConnectionError('') }} placeholder="Mock Secret Key" required />
            {connectionError && <p id="connection-error" className="drawer-error" role="alert">{connectionError}</p>}
            <div className="security-note"><ShieldCheck size={17} /><span><strong>출금 권한은 필요하지 않습니다.</strong>실제 거래 연결 전에는 별도 보안 검토가 필요합니다.</span></div>
            <button className="drawer-primary" type="submit"><KeyRound size={16} /> Mock 연결 확인</button>
          </form>
        )}
      </aside>

      <nav className="bottom-nav" aria-label="모바일 도구 메뉴">
        <a className="active" href="#overview" aria-current="page"><LayoutDashboard /><span>홈</span></a>
        <button onClick={focusQuestion}><MessageSquareText /><span>질문</span></button>
        <a href="#performance"><ChartNoAxesCombined /><span>성과</span></a>
        <button aria-expanded={connectionOpen} aria-controls="connection-drawer" onClick={() => setConnectionOpen(true)}><WalletCards /><span>연결</span></button>
      </nav>
    </div>
  )
}

type FunnelView = 'landing' | 'briefing' | 'build' | 'signup' | 'testing' | 'result' | 'recommend' | 'match' | 'onboarding' | 'dashboard'
type ExecutionPath = 'partner' | 'direct'
type BriefingVariant = 'overview' | 'invalidation' | 'comparison'
type BuildSlot = 'market' | 'timeframe' | 'risk' | 'entry'

const funnelViews: FunnelView[] = ['landing', 'briefing', 'build', 'signup', 'testing', 'result', 'recommend', 'match', 'onboarding', 'dashboard']
const FUNNEL_SESSION_KEY = 'tesia-funnel-session-v1'

type FunnelSession = {
  view: FunnelView
  idea: string
  ideaSource: 'user' | 'suggested'
  suggestedCondition: string
  entryRule: string
  briefingVariant: BriefingVariant
  buildStep: number
  answers: StrategyAnswers
  resultMode: BacktestResultMode
  selectedRepair: Exclude<BacktestResultMode, 'base' | 'stress'> | null
  selectedBroker: string
  executionPath: ExecutionPath
  signedIn: boolean
  retryCount: number
  repairBaseline: { idea: string; suggestedCondition: string; risk: string } | null
}

function readFunnelSession(): Partial<FunnelSession> | null {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(FUNNEL_SESSION_KEY) ?? 'null') as Partial<FunnelSession> | null
    const savedTimeframe = session?.answers?.timeframe
    if (session?.answers && savedTimeframe && !parseChartTimeframe(savedTimeframe)) {
      return {
        ...session,
        view: 'build',
        buildStep: 1,
        answers: { ...session.answers, timeframe: '' },
      }
    }
    return session
  } catch {
    return null
  }
}

function getInitialFunnelView(session: Partial<FunnelSession> | null): FunnelView {
  const hashView = window.location.hash.replace(/^#\//, '')
  if (hashView === 'dashboard') return 'dashboard'
  if (session?.view === 'testing' && (hashView === 'build' || hashView === 'signup')) return 'testing'
  if (session?.view && funnelViews.includes(session.view) && hashView === session.view) return session.view
  return 'landing'
}

const starterIdeas = [
  '지금 시장이 위험한지 먼저 알려줘',
  '내 매수 생각이 괜찮은지 봐줘',
]

const flowSteps = [
  { key: 'research', label: '리서치', caption: '시장 가설' },
  { key: 'build', label: '전략 생성', caption: '조건 구조화' },
  { key: 'backtest', label: '백테스트', caption: '과거 검증' },
  { key: 'execute', label: '실행', caption: '연결·관리' },
]

const mockTraderReviews = [
  {
    id: 'kj',
    name: '김O진',
    role: '선물 트레이더 2년차',
    quoteParts: ['머릿속에만 있던', '물타기 전략,', '10분 만에', '백테스트까지 봤습니다.', '결과가 안 좋다고', '솔직하게 말해주는 게', '오히려 신뢰가 갔어요.'],
  },
  {
    id: 'ps',
    name: '박O수',
    role: '직장인 투자자',
    quoteParts: ['코딩 몰라도 됩니다.', '대화하다 보면', 'AI가 알아서', '빈 부분을 물어봐요.', '거래쌍, 레버리지,', '손절까지.'],
  },
  {
    id: 'lh',
    name: '이O현',
    role: 'BTC·ETH 현물',
    quoteParts: ['레퍼럴로 가입하니까', '진짜 무료.', '왜 무료인지', '구조까지 설명해줘서', '찝찝함이 없었습니다.'],
  },
  {
    id: 'cw',
    name: '최O원',
    role: '주말마다 매매하는 직장인',
    quoteParts: ['제가 말한 조건이 애매하면', '그냥 넘어가지 않고,', '몇 분봉인지', '손절은 어디인지', '먼저 물어봐요.', '그래서 놓친 조건을', '금방 찾았습니다.'],
  },
  {
    id: 'jh',
    name: '정O훈',
    role: 'BTC 현물 중심 투자자',
    quoteParts: ['수익률만 보여주는 줄 알았는데', '최대 낙폭이랑', '거래 횟수도', '같이 나오더라고요.', '실제로 버틸 수 있는', '전략인지', '판단하기 편했습니다.'],
  },
  {
    id: 'hs',
    name: '한O서',
    role: '퀀트 입문 6개월',
    quoteParts: ['시장 얘기부터', '편하게 물어봤는데,', '대화 끝에는', '제 진입 기준이', '정리돼 있었어요.', '화면을 옮겨 다니지 않는 게', '특히 좋았습니다.'],
  },
] as const

function TraderReviewQuote({ parts }: { parts: readonly string[] }) {
  return (
    <blockquote>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          <span className="proof-phrase">{part}</span>
          {index < parts.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </blockquote>
  )
}

const REVIEW_ROTATION_MS = 7600
const REVIEW_TRANSITION_MS = 520

function TesiaBrand({ onClick }: { onClick: () => void }) {
  return (
    <button className="tesia-brand" type="button" onClick={onClick} aria-label="TETH AI 홈">
      <BrandMark />
      <span>TETH</span>
      <sup>AI</sup>
    </button>
  )
}

function FunnelProgress({ view }: { view: FunnelView }) {
  const currentIndex = view === 'briefing'
    ? 0
    : view === 'build'
      ? 1
      : view === 'signup' || view === 'testing' || view === 'result' || view === 'recommend'
        ? 2
        : 3
  return (
    <ol className="funnel-progress" aria-label="전략 생성 진행 단계">
      {flowSteps.map((step, index) => (
        <li key={step.key} className={index === currentIndex ? 'current' : index < currentIndex ? 'done' : ''} aria-current={index === currentIndex ? 'step' : undefined}>
          <span className="step-index">{index < currentIndex ? <Check size={12} /> : index + 1}</span>
          <span className="step-copy"><strong>{step.label}</strong><small>{step.caption}</small></span>
        </li>
      ))}
    </ol>
  )
}

function TesiaApp() {
  // The professional chart is the promoted product presentation. The data
  // source remains an explicit Mock boundary until a real provider is wired.
  const professionalChart = true
  const [initialSession] = useState(readFunnelSession)
  const [view, setView] = useState<FunnelView>(() => getInitialFunnelView(initialSession))
  const [idea, setIdea] = useState(initialSession?.idea ?? '')
  const [ideaSource, setIdeaSource] = useState<'user' | 'suggested'>(initialSession?.ideaSource ?? 'user')
  const [suggestedCondition, setSuggestedCondition] = useState(initialSession?.suggestedCondition ?? '')
  const [entryRule, setEntryRule] = useState(initialSession?.entryRule ?? '')
  const [briefingVariant, setBriefingVariant] = useState<BriefingVariant>(initialSession?.briefingVariant ?? 'overview')
  const [draftMessage, setDraftMessage] = useState('')
  const [buildError, setBuildError] = useState('')
  const [buildStep, setBuildStep] = useState(initialSession?.buildStep ?? 0)
  const [answers, setAnswers] = useState(initialSession?.answers ?? { market: '', timeframe: '', risk: '' })
  const [testProgress, setTestProgress] = useState(0)
  const [backtestExiting, setBacktestExiting] = useState(false)
  const [resultMode, setResultMode] = useState<BacktestResultMode>(initialSession?.resultMode ?? 'base')
  const [selectedRepair, setSelectedRepair] = useState<Exclude<BacktestResultMode, 'base' | 'stress'> | null>(initialSession?.selectedRepair ?? null)
  const [selectedBroker, setSelectedBroker] = useState(initialSession?.selectedBroker ?? 'binance')
  const [executionPath, setExecutionPath] = useState<ExecutionPath>(initialSession?.executionPath ?? 'partner')
  const [signedIn, setSignedIn] = useState(initialSession?.signedIn ?? false)
  const [retryCount, setRetryCount] = useState(initialSession?.retryCount ?? 0)
  const [repairBaseline, setRepairBaseline] = useState(initialSession?.repairBaseline ?? null)
  const [ideaError, setIdeaError] = useState('')
  const [strategyCopied, setStrategyCopied] = useState(false)
  const [strategyCopyError, setStrategyCopyError] = useState(false)
  const [policyOpen, setPolicyOpen] = useState<PolicyKind | null>(null)
  const [viewAnnouncement, setViewAnnouncement] = useState('')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [previousReviewIndex, setPreviousReviewIndex] = useState<number | null>(null)
  const [reviewInteracting, setReviewInteracting] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [introResolved, setIntroResolved] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle')
  const [pendingPrompt, setPendingPrompt] = useState('')
  const [pendingView, setPendingView] = useState<Exclude<EarlyChatView, 'landing'> | null>(null)
  const [requestId, setRequestId] = useState(0)
  const [streamedReply, setStreamedReply] = useState('')
  const [marketTurns, setMarketTurns] = useState<MarketChatTurn[]>([])
  const [buildReplyPhase, setBuildReplyPhase] = useState<'idle' | 'thinking'>('idle')
  const [pendingBuildAnswer, setPendingBuildAnswer] = useState('')
  const landingInputRef = useRef<HTMLTextAreaElement>(null)
  const buildStatusRef = useRef<HTMLElement>(null)
  const chatThreadRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const buildReplyTimerRef = useRef<number | null>(null)
  const reviewTransitionTimerRef = useRef<number | null>(null)
  const backtestExitTimerRef = useRef<number | null>(null)
  const previousViewRef = useRef<FunnelView>(view)
  const lastHistoryViewRef = useRef<FunnelView>(view)
  const historyNavigationRef = useRef(false)
  const initialViewRef = useRef(view)
  const backtestCompletionRef = useRef(false)

  useEffect(() => () => {
    if (buildReplyTimerRef.current !== null) window.clearTimeout(buildReplyTimerRef.current)
    if (reviewTransitionTimerRef.current !== null) window.clearTimeout(reviewTransitionTimerRef.current)
    if (backtestExitTimerRef.current !== null) window.clearTimeout(backtestExitTimerRef.current)
  }, [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches)
      if (event.matches) setIntroResolved(true)
    }
    preference.addEventListener('change', onChange)
    return () => preference.removeEventListener('change', onChange)
  }, [])

  const reviewPaused = reviewInteracting || reduceMotion
  const currentReview = mockTraderReviews[reviewIndex]
  const previousReview = previousReviewIndex === null ? null : mockTraderReviews[previousReviewIndex]
  const isConversationView = view !== 'dashboard'

  useEffect(() => {
    if (view !== 'landing' || reviewPaused) return
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setPreviousReviewIndex(reviewIndex)
        setReviewIndex((reviewIndex + 1) % mockTraderReviews.length)
        if (reviewTransitionTimerRef.current !== null) window.clearTimeout(reviewTransitionTimerRef.current)
        reviewTransitionTimerRef.current = window.setTimeout(() => {
          setPreviousReviewIndex(null)
          reviewTransitionTimerRef.current = null
        }, REVIEW_TRANSITION_MS)
      }
    }, REVIEW_ROTATION_MS)
    return () => window.clearInterval(timer)
  }, [reviewIndex, reviewPaused, view])

  useEffect(() => {
    const initialView = initialViewRef.current
    const initialHash = initialView === 'landing' ? '#/' : `#/${initialView}`
    window.history.replaceState({ tesiaView: initialView }, '', `${window.location.pathname}${window.location.search}${initialHash}`)
    const handlePopState = (event: PopStateEvent) => {
      const nextView = event.state?.tesiaView as FunnelView | undefined
      if (!nextView) return
      historyNavigationRef.current = true
      setAgentPhase('idle')
      setPendingPrompt('')
      setPendingView(null)
      setStreamedReply('')
      setBuildReplyPhase('idle')
      setPendingBuildAnswer('')
      if (buildReplyTimerRef.current !== null) {
        window.clearTimeout(buildReplyTimerRef.current)
        buildReplyTimerRef.current = null
      }
      setView(nextView)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (historyNavigationRef.current) {
      historyNavigationRef.current = false
      lastHistoryViewRef.current = view
      return
    }
    if (lastHistoryViewRef.current === view) return
    const previousHistoryView = lastHistoryViewRef.current
    lastHistoryViewRef.current = view
    if (view === 'testing') return
    if (isEarlyChatView(previousHistoryView) && isEarlyChatView(view)) {
      window.history.replaceState({ tesiaView: view }, '', `${window.location.pathname}${window.location.search}#/`)
      return
    }
    window.history.pushState({ tesiaView: view }, '', view === 'landing' ? '#/' : `#/${view}`)
  }, [view])

  useEffect(() => {
    const session: FunnelSession = {
      view, idea, ideaSource, suggestedCondition, entryRule, briefingVariant, buildStep, answers,
      resultMode, selectedRepair, selectedBroker, executionPath, signedIn, retryCount, repairBaseline,
    }
    try {
      window.sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(session))
    } catch {
      // Session recovery is optional; the active in-memory flow remains fully usable.
    }
  }, [answers, briefingVariant, buildStep, entryRule, executionPath, idea, ideaSource, repairBaseline, resultMode, retryCount, selectedBroker, selectedRepair, signedIn, suggestedCondition, view])

  useEffect(() => {
    if (previousViewRef.current === view) return
    const previousView = previousViewRef.current
    previousViewRef.current = view
    const labels: Record<FunnelView, string> = {
      landing: '새 대화', briefing: '시장 답변', build: '투자 기준 정리', signup: '대화 저장 안내',
      testing: '지난 데이터 확인', result: '분석 결과', recommend: '개선 제안', match: '실행 방법 안내',
      onboarding: '연결 안내', dashboard: '전략 대시보드',
    }
    setViewAnnouncement(view === 'dashboard' ? `${labels[view]} 화면이 열렸습니다.` : `TETH의 ${labels[view]} 내용이 대화에 추가되었습니다.`)
    window.requestAnimationFrame(() => {
      if (isEarlyChatView(previousView) && isEarlyChatView(view)) {
        const chatMain = document.querySelector<HTMLElement>('#tesia-main')
        chatMain?.focus({ preventScroll: true })
        window.setTimeout(() => chatMain?.focus({ preventScroll: true }), 0)
        return
      }
      const nextMain = document.querySelector<HTMLElement>('#tesia-main, #main')
      if (!nextMain) return
      nextMain.tabIndex = -1
      nextMain.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }, [view])

  const effectiveIdea = ideaSource === 'suggested' ? suggestedCondition : idea
  const hasExplicitVolumeRule = /거래량.{0,28}(\d+(?:\.\d+)?\s*배|\d+일\s*평균|평균.{0,10}(넘|상회|이상|초과))/i.test(effectiveIdea)
    || /(?:\d+일\s*평균|평균)\s*거래량.{0,12}(넘|상회|이상|초과)/i.test(effectiveIdea)
  const needsVolumeClarification = /거래량/i.test(effectiveIdea) && !hasExplicitVolumeRule
  const hasExplicitEntrySignal = /(rsi|과매도|돌파|이동평균|\bma\b|교차|전고점|오르면|내리면)/i.test(effectiveIdea)
    || /(?:가격|종가|btc|eth|sol|xrp).{0,16}(이하|이상|아래|위에서|넘으면)/i.test(effectiveIdea)
    || hasExplicitVolumeRule
  const requiresEntryClarification = needsVolumeClarification || !hasExplicitEntrySignal
  const totalBuildSteps = requiresEntryClarification ? 4 : 3
  const structuredIdea = entryRule ? `${effectiveIdea} + ${entryRule}` : effectiveIdea

  const strategyProfile = useMemo(() => {
    const normalized = structuredIdea.toLowerCase()
    const entry: string[] = []
    const code: string[] = []
    const rsiThreshold = normalized.match(/rsi[^0-9]{0,12}(\d{1,2})/)?.[1]
    if (normalized.includes('rsi') || normalized.includes('과매도')) {
      entry.push(rsiThreshold ? `RSI ${rsiThreshold} 이하` : 'RSI 임계값 확인 필요')
      code.push(rsiThreshold ? `IF   rsi(14) < ${rsiThreshold}` : 'IF   rsi(14) < user_threshold')
    }
    if (normalized.includes('거래량')) {
      const hasMultiplier = normalized.match(/(\d+(?:\.\d+)?)\s*배/)
      if (hasMultiplier) {
        entry.push(`거래량이 평소의 ${hasMultiplier[1]}배 이상일 때`)
        code.push(`${code.length ? 'AND ' : 'IF  '} volume > user_volume_baseline * ${hasMultiplier[1]}`)
      } else if (normalized.includes('평균') || /늘(?:어|면|고|었|어난)|증가|상회/.test(normalized)) {
        entry.push('거래량이 정한 평균보다 많을 때')
        code.push(`${code.length ? 'AND ' : 'IF  '} volume > user_volume_baseline`)
      } else {
        entry.push('거래량이 얼마나 늘어야 하는지 확인 필요')
        code.push(`${code.length ? 'AND ' : 'IF  '} volume_spike >= user_threshold`)
      }
    }
    if (/위험\s*(수준|지수)?.{0,8}40\s*(아래|이하)/.test(normalized)) {
      entry.push('시장 주의 정도 40 이하')
      code.push(`${code.length ? 'AND ' : 'IF  '} market_risk <= 40`)
    }
    if (/200\s*ma|200일\s*이동평균/.test(normalized)) {
      entry.push('BTC가 200일 평균 가격 위일 때')
      code.push(`${code.length ? 'AND ' : 'IF  '} btc_close > sma(btc_close, 200)`)
    }
    if (/6\s*시간.{0,8}(재진입|진입\s*금지)/.test(normalized)) {
      entry.push('손절 뒤 6시간 쉬기')
      code.push(`${code.length ? 'AND ' : 'IF  '} hours_since_stop >= 6`)
    }
    if (normalized.includes('전고점')) {
      entry.push('이전 최고 가격을 넘어설 때')
      code.push(`${code.length ? 'AND ' : 'IF  '} close > prior_high`)
    }
    if (/레버리지|\d+배/.test(normalized) && !normalized.includes('거래량')) {
      const leverage = normalized.match(/(\d+)\s*배/)?.[1] ?? '사용자 지정'
      entry.push(`레버리지 ${leverage}배`)
      code.push(`${code.length ? 'AND ' : 'IF  '} leverage = ${leverage}`)
    }
    const title = normalized.includes('rsi') || normalized.includes('과매도')
      ? normalized.includes('거래량') ? 'RSI · 거래량 확인형' : 'RSI 과매도 진입형'
      : normalized.includes('위험') && normalized.includes('거래량')
        ? '거래량 · 위험 필터형'
        : normalized.includes('거래량')
          ? '거래량 조건 진입형'
          : '사용자 조건 기반 전략'
    return {
      title,
      entry: entry.length ? entry.join(' + ') : requiresEntryClarification && !entryRule ? '진입 신호 확인 중' : structuredIdea || '사용자 조건을 해석하는 중',
      exit: /손절|익절|청산/.test(normalized) ? '사용자가 말한 청산 조건 적용' : '청산 기준 확인 필요',
      code: [...(code.length ? code : [requiresEntryClarification && !entryRule ? 'IF   entry_signal == pending_confirmation' : 'IF   user_condition == confirmed']), 'THEN enter_long()'],
    }
  }, [entryRule, requiresEntryClarification, structuredIdea])

  const resolvedExit = strategyProfile.exit === '청산 기준 확인 필요' && answers.risk
    ? `${answers.risk} 손실 한도 도달`
    : strategyProfile.exit
  const riskPercent = answers.risk.match(/(\d+(?:\.\d+)?)%/)?.[1]
  const atrMultiplier = answers.risk.match(/ATR\s*(\d+(?:\.\d+)?)\s*배/i)?.[1]
  const executionRules = [
    ...(riskPercent ? [`RISK max_loss = ${riskPercent}% equity`] : []),
    ...(atrMultiplier ? [`STOP atr(14) * ${atrMultiplier}`] : []),
  ]
  const resolvedCode = executionRules.length
    ? [...strategyProfile.code.slice(0, -1), ...executionRules, strategyProfile.code.at(-1)!]
    : strategyProfile.code
  const buildComplete = buildStep >= totalBuildSteps
  const completionPercent = buildComplete ? 100 : Math.round(35 + buildStep * (65 / totalBuildSteps))

  useEffect(() => {
    if (view !== 'build' || buildStep === 0) return
    const frame = window.requestAnimationFrame(() => {
      buildStatusRef.current?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [buildComplete, buildStep, view])

  const briefingCopy = useMemo(() => {
    const asksAboutRsi = /rsi/i.test(idea) && /(뭐|뜻|설명|어떻게|초보)/.test(idea)
    const asksForInvalidation = /(무효|어디서.{0,10}조심|조심해야|깨지는 가격)/.test(idea)
    const asksForComparison = /(eth|이더리움).{0,14}비교|비교.{0,14}(eth|이더리움)/i.test(idea)
    if (asksAboutRsi) return {
      question: idea,
      title: 'RSI는 가격이 너무 빠르게 올랐는지, 내렸는지 보여줘요.',
      body: '0부터 100 사이 숫자로 보며, 보통 30 아래면 최근 하락이 과했다는 신호로 참고합니다. 다만 RSI 하나만 보고 바로 사기보다 거래량과 시장 흐름을 함께 보는 편이 안전합니다.',
    }
    if (briefingVariant === 'invalidation' || asksForInvalidation) return {
      question: '이 신호가 무효화되는 가격은?',
      title: '$64.9K 아래로 내려가면 지금의 회복 흐름이 약해질 수 있어요.',
      body: '최근 90일 mock 구간에서는 BTC가 이 가격 아래에서 하루를 마치면, 거래량이 늘어도 반등이 이어진 경우가 41%로 낮아졌습니다.',
    }
    if (briefingVariant === 'comparison' || asksForComparison) return {
      question: 'ETH와 비교해줘',
      title: '지금은 이더리움보다 비트코인 쪽에 관심이 더 모이고 있어요.',
      body: '비트코인 거래량은 평소보다 18.4%, 이더리움은 6.2% 많습니다. 둘 다 가격 움직임은 과하게 크지 않은 편입니다.',
    }
    return {
      question: idea,
      title: '사람들이 다시 시장을 살피고 있지만, 아직 서두를 단계는 아니에요.',
      body: '비트코인 거래량은 평소보다 18.4% 늘었습니다. 시장으로 들어오는 자금도 조금씩 늘고 있지만, 여러 코인이 함께 오르는 흐름은 아직 약합니다.',
    }
  }, [briefingVariant, idea])

  const buildIntroText = requiresEntryClarification
    ? needsVolumeClarification
      ? '좋아요. “거래량이 늘 때”가 어느 정도인지 정하면 지난 결과를 확인할 수 있어요. 필요한 것만 짧게 물어볼게요.'
      : '좋아요. 언제 사고 싶은지만 조금 더 알려주세요. 나머지는 쉬운 질문으로 함께 정리할게요.'
    : '생각하신 매수 기준을 이해했어요. 지난 데이터로 확인하려면 세 가지만 더 정하면 됩니다.'

  const visibleMarketTurns = marketTurns.length
    ? marketTurns
    : view === 'briefing' && agentPhase === 'idle' && idea.trim()
      ? [{ id: 0, question: briefingCopy.question, title: briefingCopy.title, body: briefingCopy.body }]
      : []

  useEffect(() => {
    if (agentPhase !== 'thinking' || !pendingView || !pendingPrompt) return
    const timer = window.setTimeout(() => {
      setStreamedReply('')
      setAgentPhase('streaming')
    }, reduceMotion ? 0 : 720)
    return () => window.clearTimeout(timer)
  }, [agentPhase, pendingPrompt, pendingView, reduceMotion, requestId])

  useEffect(() => {
    if (agentPhase !== 'streaming' || !pendingView || !pendingPrompt) return
    const fullReply = pendingView === 'briefing' ? briefingCopy.body : buildIntroText
    const finish = () => {
      setStreamedReply(fullReply)
      if (pendingView === 'briefing') {
        setMarketTurns((turns) => [
          ...turns.filter((turn) => turn.id !== requestId),
          { id: requestId, question: pendingPrompt, title: briefingCopy.title, body: fullReply },
        ])
      }
      setAgentPhase('ready')
      setPendingView(null)
      setViewAnnouncement('TETH의 답변이 완료되었습니다. 이어서 질문할 수 있습니다.')
    }
    if (reduceMotion) {
      finish()
      return
    }
    let cursor = 0
    const chunkSize = Math.max(1, Math.ceil(fullReply.length / 48))
    const timer = window.setInterval(() => {
      cursor = Math.min(fullReply.length, cursor + chunkSize)
      setStreamedReply(fullReply.slice(0, cursor))
      if (cursor >= fullReply.length) {
        window.clearInterval(timer)
        finish()
      }
    }, 24)
    return () => window.clearInterval(timer)
  }, [agentPhase, briefingCopy.body, briefingCopy.title, buildIntroText, pendingPrompt, pendingView, reduceMotion, requestId])

  useEffect(() => {
    if (agentPhase !== 'thinking' && agentPhase !== 'streaming' && buildReplyPhase !== 'thinking') return
    const thread = chatThreadRef.current
    if (!thread) return
    if (buildReplyPhase === 'thinking') {
      thread.scrollTo({ top: thread.scrollHeight, behavior: preferredScrollBehavior() })
      return
    }
    const isFirstExchange = view === 'briefing'
      ? marketTurns.length === 0
      : buildStep === 0 && !answers.market && !answers.timeframe && !answers.risk
    if (isFirstExchange) return
    const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 140
    if (!nearBottom) return
    thread.scrollTo({ top: thread.scrollHeight, behavior: 'auto' })
  }, [agentPhase, answers.market, answers.risk, answers.timeframe, buildReplyPhase, buildStep, marketTurns.length, streamedReply, view])

  const chartTimeframe = normalizeChartTimeframe(answers.timeframe)
  const chartTimeframeInfo = CHART_TIMEFRAMES[chartTimeframe]
  const chartMarket = answers.market || 'BTC/USDT'
  const chartMarketSymbol = chartMarket.split('/')[0] || 'BTC'
  const candleCount = chartTimeframeInfo.candleCount

  const runBacktest = () => {
    backtestCompletionRef.current = false
    setBacktestExiting(false)
    setTestProgress(9)
    setView('testing')
  }

  const completeBacktest = useCallback(() => {
    if (backtestCompletionRef.current) return
    backtestCompletionRef.current = true
    setTestProgress(100)
    setBacktestExiting(true)
    backtestExitTimerRef.current = window.setTimeout(() => {
      const shouldFail = retryCount === 0 && (answers.risk.includes('3%') || /레버리지|10배|20배/.test(structuredIdea))
      setResultMode(shouldFail ? 'stress' : selectedRepair ?? 'base')
      setView('result')
      setBacktestExiting(false)
      window.scrollTo({ top: 0, behavior: preferredScrollBehavior() })
    }, reduceMotion ? 0 : 440)
  }, [answers.risk, reduceMotion, retryCount, selectedRepair, structuredIdea])

  useEffect(() => {
    if (view !== 'testing') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') completeBacktest()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [completeBacktest, view])

  const startIdea = (value?: string) => {
    const nextIdea = (value ?? idea).trim()
    if (agentPhase === 'thinking' || agentPhase === 'streaming') return
    if (!nextIdea) {
      setIdeaError('검증할 전략이나 시장 질문을 입력해주세요.')
      landingInputRef.current?.focus()
      return
    }
    if (view === 'briefing' && marketTurns.length === 0 && idea.trim()) {
      setMarketTurns([{ id: 0, question: briefingCopy.question, title: briefingCopy.title, body: briefingCopy.body }])
    }
    setIdeaError('')
    setIdea(nextIdea)
    setBuildStep(0)
    setAnswers({ market: '', timeframe: '', risk: '' })
    setDraftMessage('')
    setBuildError('')
    setTestProgress(0)
    setResultMode('base')
    setSelectedRepair(null)
    setRetryCount(0)
    setRepairBaseline(null)
    setSelectedBroker('binance')
    setExecutionPath('partner')
    setStrategyCopied(false)
    setStrategyCopyError(false)
    setIdeaSource('user')
    setSuggestedCondition('')
    setEntryRule('')
    setBriefingVariant('overview')
    const hasActionIntent = /(전략|매매법|매수|매도|사고|팔고|진입|청산|돌파|손절|익절|레버리지|백테스트|조건|때|라면|경우|되면|넘으면|아래면|위면|교차)/i.test(nextIdea)
    const asksForExplanation = /(뭐야|뭔가요|무슨 뜻|설명|왜\s*(오르|내리)|어떻게 봐|알려줘|비교|조심|어디서|초보|처음|괜찮을까)/i.test(nextIdea)
    const asksAboutMarket = asksForExplanation || (/(시장|위험|뉴스|상황|전망|비트코인|이더리움|\bBTC\b|\bETH\b|가격|거래량|RSI)/i.test(nextIdea) && !hasActionIntent)
    const nextView: Exclude<EarlyChatView, 'landing'> = asksAboutMarket ? 'briefing' : 'build'
    setPendingPrompt(nextIdea)
    setPendingView(nextView)
    setStreamedReply('')
    setAgentPhase('thinking')
    setRequestId((current) => current + 1)
    const transitionDocument = document as Document & {
      startViewTransition?: (update: () => void) => unknown
    }
    if (view === 'landing' && !reduceMotion && transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(() => setView(nextView)))
    } else {
      setView(nextView)
    }
  }

  const startNewConversation = () => {
    if (view !== 'landing') setIntroResolved(false)
    setView('landing')
    setIdea('')
    setDraftMessage('')
    setIdeaError('')
    setBuildError('')
    setBuildStep(0)
    setAnswers({ market: '', timeframe: '', risk: '' })
    setEntryRule('')
    setSuggestedCondition('')
    setIdeaSource('user')
    setAgentPhase('idle')
    setPendingPrompt('')
    setPendingView(null)
    setStreamedReply('')
    setMarketTurns([])
    setBuildReplyPhase('idle')
    setPendingBuildAnswer('')
    if (buildReplyTimerRef.current !== null) window.clearTimeout(buildReplyTimerRef.current)
    window.requestAnimationFrame(() => landingInputRef.current?.focus())
  }

  const openDashboard = () => {
    setView('dashboard')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const submitBriefingFollowup = () => {
    const nextQuestion = draftMessage.trim()
    if (!nextQuestion) return
    setDraftMessage('')
    setBriefingVariant('overview')
    startIdea(nextQuestion)
  }

  const signUpAndTest = () => {
    setSignedIn(true)
    runBacktest()
  }

  const applyRepairAndRetest = () => {
    if (!repairBaseline) setRepairBaseline({ idea, suggestedCondition, risk: answers.risk })
    const alreadyUsesAtr = /ATR|동적/.test(answers.risk)
    if (alreadyUsesAtr) {
      setSelectedRepair('cooldown')
      if (ideaSource === 'suggested') setSuggestedCondition((current) => current.includes('6시간 재진입') ? current : `${current} + 6시간 재진입 금지`)
      else setIdea((current) => current.includes('6시간 재진입') ? current : `${current} + 6시간 재진입 금지`)
    } else {
      setAnswers((current) => ({ ...current, risk: '자산의 1% · ATR 1.6배' }))
      setSelectedRepair('atr')
    }
    setRetryCount((current) => current + 1)
    runBacktest()
  }

  const applyBuildAnswer = (value: string, forcedSlot?: BuildSlot) => {
    const nextValue = value.trim()
    if (!nextValue) return
    const timeframeMatch = nextValue.match(/(\d+\s*분봉|\d+\s*시간봉|일봉|주봉)/i)
    const expectsTimeframe = forcedSlot === 'timeframe' || (!forcedSlot && buildStep === 1)
    const parsedTimeframe = parseChartTimeframe(timeframeMatch?.[1] ?? (expectsTimeframe ? nextValue : undefined))
    if ((expectsTimeframe || timeframeMatch) && !parsedTimeframe) {
      setBuildError('현재 Mock에서는 15분봉, 1시간봉, 2시간봉, 4시간봉, 일봉을 지원해요.')
      setViewAnnouncement('지원하는 확인 간격을 다시 선택해주세요.')
      return
    }
    setBuildError('')

    const moveToNextMissing = (nextAnswers: StrategyAnswers, nextEntryRule: string) => {
      setBuildStep(!nextAnswers.market ? 0 : !nextAnswers.timeframe ? 1 : !nextAnswers.risk ? 2 : requiresEntryClarification && !nextEntryRule ? 3 : totalBuildSteps)
    }

    if (forcedSlot) {
      if (forcedSlot === 'entry') {
        setEntryRule(nextValue)
        moveToNextMissing(answers, nextValue)
        return
      }
      const nextAnswers = {
        ...answers,
        [forcedSlot]: forcedSlot === 'timeframe' && parsedTimeframe ? CHART_TIMEFRAMES[parsedTimeframe].label : nextValue,
      }
      setAnswers(nextAnswers)
      moveToNextMissing(nextAnswers, entryRule)
      return
    }

    const marketMatch = nextValue.match(/\b(BTC|ETH|SOL|XRP)(?:\s*\/\s*USDT)?\b/i)
    const hasRisk = /%|손절|익절|리스크|위험|자산|atr/i.test(nextValue)
    const hasEntry = /rsi|거래량|돌파|이동평균|교차|전고점|매수|매도|진입/i.test(nextValue)
    const percentRiskMatch = nextValue.match(/(?:자산(?:의)?\s*)?(\d+(?:\.\d+)?)\s*%/i)
    const atrRiskMatch = nextValue.match(/atr\s*(\d+(?:\.\d+)?)\s*배/i)
    const normalizedRisk = [
      percentRiskMatch ? `자산의 ${percentRiskMatch[1]}%` : '',
      atrRiskMatch ? `ATR ${atrRiskMatch[1]}배` : '',
    ].filter(Boolean).join(' · ') || nextValue
    const detectedMultipleSlots = Number(Boolean(marketMatch)) + Number(Boolean(timeframeMatch)) + Number(hasRisk) + Number(hasEntry) > 1

    if (detectedMultipleSlots) {
      const nextAnswers = {
        ...answers,
        ...(marketMatch ? { market: `${marketMatch[1].toUpperCase()}/USDT` } : {}),
        ...(parsedTimeframe ? { timeframe: CHART_TIMEFRAMES[parsedTimeframe].label } : {}),
        ...(hasRisk ? { risk: normalizedRisk } : {}),
      }
      const nextEntryRule = hasEntry ? nextValue : entryRule
      setAnswers(nextAnswers)
      if (hasEntry) setEntryRule(nextEntryRule)
      moveToNextMissing(nextAnswers, nextEntryRule)
      return
    }

    const inferredSlot = hasRisk
      ? 'risk'
      : timeframeMatch
        ? 'timeframe'
        : marketMatch || /usdt|코인|종목|거래쌍|시장/i.test(nextValue)
          ? 'market'
          : hasEntry
            ? 'entry'
            : (['market', 'timeframe', 'risk', 'entry'] as const)[buildStep]

    if (!inferredSlot) return
    if (inferredSlot === 'entry') {
      setEntryRule(nextValue)
      moveToNextMissing(answers, nextValue)
      return
    }
    const normalizedValue = inferredSlot === 'market' && marketMatch
      ? `${marketMatch[1].toUpperCase()}/USDT`
      : inferredSlot === 'timeframe' && parsedTimeframe
        ? CHART_TIMEFRAMES[parsedTimeframe].label
        : inferredSlot === 'risk'
          ? normalizedRisk
          : nextValue
    const nextAnswers = { ...answers, [inferredSlot]: normalizedValue }
    setAnswers(nextAnswers)
    moveToNextMissing(nextAnswers, entryRule)
  }

  const answerBuildQuestion = (value: string) => {
    if (buildReplyPhase === 'thinking') return
    const slot = (['market', 'timeframe', 'risk', 'entry'] as const)[buildStep]
    setPendingBuildAnswer(value)
    setBuildReplyPhase('thinking')
    buildReplyTimerRef.current = window.setTimeout(() => {
      applyBuildAnswer(value, slot)
      setPendingBuildAnswer('')
      setBuildReplyPhase('idle')
      buildReplyTimerRef.current = null
      window.requestAnimationFrame(() => buildStatusRef.current?.focus({ preventScroll: true }))
    }, reduceMotion ? 0 : 560)
  }

  const submitDraftAnswer = () => {
    const nextAnswer = draftMessage.trim()
    if (!nextAnswer || buildReplyPhase === 'thinking') return
    setPendingBuildAnswer(nextAnswer)
    setBuildReplyPhase('thinking')
    setDraftMessage('')
    buildReplyTimerRef.current = window.setTimeout(() => {
      applyBuildAnswer(nextAnswer)
      setPendingBuildAnswer('')
      setBuildReplyPhase('idle')
      buildReplyTimerRef.current = null
      window.requestAnimationFrame(() => buildStatusRef.current?.focus({ preventScroll: true }))
    }, reduceMotion ? 0 : 560)
  }

  const copyStrategy = async () => {
    const strategyText = [
      strategyProfile.title,
      `시장: ${answers.market || '미설정'}`,
      `타임프레임: ${answers.timeframe || '미설정'}`,
      `진입: ${strategyProfile.entry}`,
      `청산: ${resolvedExit}`,
      `리스크: ${answers.risk || '미설정'}`,
      '',
      ...resolvedCode,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(strategyText)
      setStrategyCopied(true)
      setStrategyCopyError(false)
      window.setTimeout(() => setStrategyCopied(false), 1600)
    } catch {
      setStrategyCopied(false)
      setStrategyCopyError(true)
      window.setTimeout(() => setStrategyCopyError(false), 2400)
    }
  }

  if (view === 'dashboard') {
    return <Dashboard
      onHome={() => setView('landing')}
      strategyTitle={strategyProfile.title}
      strategyEntry={strategyProfile.entry}
      answers={answers}
      announcement={viewAnnouncement}
      exchangeName={selectedBroker === 'gate' ? 'Gate' : selectedBroker === 'alpaca' ? 'Alpaca' : 'Binance'}
    />
  }

  const seriesMetrics = getSeriesMetrics(resultMode, chartTimeframe)
  const resultProfile = getMockBacktestMeta(resultMode, chartTimeframe)
  const result = {
    ...resultProfile,
    returnRate: `${seriesMetrics.returnRate > 0 ? '+' : ''}${seriesMetrics.returnRate.toFixed(1)}%`,
    drawdown: `${seriesMetrics.drawdown.toFixed(1)}%`,
    benchmark: `+${seriesMetrics.benchmark.toFixed(1)}%`,
    excessReturn: (seriesMetrics.returnRate - seriesMetrics.benchmark).toFixed(1),
  }
  const successfulResult = resultMode !== 'stress'
  const usesDynamicRisk = /ATR|동적/.test(answers.risk)
  const repairTargetMode = usesDynamicRisk ? 'cooldown' : 'atr'
  const repairTarget = getSeriesMetrics(repairTargetMode, chartTimeframe).drawdown.toFixed(1)
  const stressDrawdown = getSeriesMetrics('stress', chartTimeframe).drawdown.toFixed(1)
  const landingTimeframe = idea.match(/(\d+\s*분봉|\d+\s*시간봉|일봉|주봉)/i)?.[1]?.replace(/\s+/g, '')
  const landingIntentTags = [
    { show: /btc/i.test(idea), label: 'BTC' },
    { show: /eth/i.test(idea), label: 'ETH' },
    { show: Boolean(landingTimeframe), label: landingTimeframe ?? '' },
    { show: /손절|리스크|최대 손실|위험|%|atr/i.test(idea), label: '위험 관리' },
    { show: /rsi/i.test(idea), label: 'RSI' },
    { show: /거래량/.test(idea), label: '거래량' },
    { show: /시장|뉴스|전망|상황/.test(idea), label: '시장 리서치' },
    { show: /매수|진입|돌파/.test(idea), label: '진입 조건' },
  ].filter((tag) => tag.show).slice(0, 4)
  const buildSuggestions = buildStep === 0
    ? ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
    : buildStep === 1
      ? ['15분봉', '1시간봉', '2시간봉', '4시간봉', '일봉']
      : buildStep === 2
        ? ['자산의 1%', '자산의 2%', '자산의 3%']
        : needsVolumeClarification
          ? ['거래량 20일 평균 상회', '거래량 5일 평균 1.5배', '거래량 10일 평균 상회']
          : ['RSI 30 이하', '거래량 20일 평균 상회', '20일 고점 돌파']
  const buildInputPlaceholder = buildStep === 0
    ? '예: BTC와 ETH를 함께 비교하고 싶어요'
    : buildStep === 1
      ? '예: 1시간봉으로 보고 4시간봉에서 확인해줘'
      : buildStep === 2
        ? '예: 거래당 1%, ATR 1.5배 손절로 제한해줘'
        : '예: RSI 30 아래이고 거래량이 평균보다 높을 때 진입'
  const brokerMarket = answers.market || 'BTC/USDT'
  const brokerTimeframe = answers.timeframe
    ? answers.timeframe.replace('시간봉', 'H').replace('일봉', '1D').replace('분봉', 'm')
    : '4H'
  const brokerOptions = [
    { id: 'binance', type: '거래소', name: 'Binance', match: '96%', detail: `${brokerMarket} · ${brokerTimeframe} · 낮은 수수료`, price: '파트너 ₩0', note: '직접 연결 ₩9,900/월', recommended: true },
    { id: 'gate', type: '거래소', name: 'Gate', match: '89%', detail: `${brokerMarket} · ${brokerTimeframe} · 다양한 마켓`, price: '파트너 ₩0', note: '직접 연결 ₩9,900/월', recommended: false },
    { id: 'alpaca', type: '증권사', name: 'Alpaca', match: '72%', detail: '미국 주식 대체 전략 · 현물', price: '₩29,000/월', note: '카드 결제', recommended: false },
  ]
  const chooseBroker = (brokerId: string) => {
    setSelectedBroker(brokerId)
    setExecutionPath(brokerId === 'alpaca' ? 'direct' : 'partner')
  }
  const handleBrokerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const keyDirection = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : 0
    let nextIndex: number
    if (keyDirection) nextIndex = (currentIndex + keyDirection + brokerOptions.length) % brokerOptions.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = brokerOptions.length - 1
    else return
    event.preventDefault()
    const nextBroker = brokerOptions[nextIndex]
    chooseBroker(nextBroker.id)
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-broker-id="${nextBroker.id}"]`)?.focus())
  }

  return (
    <div className={`tesia-shell view-${view}${view === 'landing' ? introResolved ? ' intro-resolved' : ' intro-dreaming' : ''}`}>
      <a href="#tesia-main" className="skip-link">본문으로 바로가기</a>
      <div className="analysis-announcer" role="status" aria-live="polite">{viewAnnouncement}</div>
      <header className="tesia-header">
        <TesiaBrand onClick={startNewConversation} />
        {isConversationView ? (
          <nav className={`landing-nav conversation-nav ${view !== 'landing' ? 'active' : ''}`} aria-label="TETH 대화 메뉴">
            {view === 'landing' ? <a href="#what-tesia-does">무엇을 물어볼 수 있나요</a> : <span className="conversation-live"><span /> TETH와 대화 중</span>}
            <button type="button" onClick={openDashboard}>대시보드 미리보기</button>
            {view !== 'landing' && <button className="new-chat-button" type="button" onClick={startNewConversation}><Plus size={14} /> 새 대화</button>}
          </nav>
        ) : (
          <FunnelProgress view={view} />
        )}
        <div className="tesia-header-actions">
          {!signedIn && !isConversationView && <span className="free-label"><span /> 결제 필요 없음</span>}
          {signedIn ? (
            <button className="account-button" type="button" aria-label="내 전략 대시보드 열기" onClick={openDashboard}><span>TS</span><strong>내 전략</strong><LayoutDashboard size={14} /></button>
          ) : (
            <button className="login-button" type="button" aria-label="Mock 계정으로 로그인" onClick={() => setSignedIn(true)}><LogIn size={15} /><span>로그인</span></button>
          )}
        </div>
      </header>

      {isEarlyChatView(view) && (
        <main id="tesia-main" className={`agent-chat-stage stage-${view}`} tabIndex={-1}>
      {view === 'landing' && (
        <div className="landing-main">
          <section className="landing-hero" aria-labelledby="landing-title">
            <ImaginationCanvas onImpact={() => setIntroResolved(true)} />
            <div className="landing-kicker"><span className="market-live-dot" /> MARKET INTELLIGENCE IN MOTION</div>
            <h1 id="landing-title">
              <span className="imagination-line">
                <span className="title-reveal dream">상상이</span>
                <span className="title-reveal instant">즉시</span>
                <span className="title-reveal real">현실이 되는</span>
              </span>
              <span className="execution-line"><span className="title-reveal trade">거래를 위한</span> <strong className="title-reveal ai">AI</strong></span>
            </h1>
            <p>머릿속 투자 아이디어를 편한 말로 들려주세요.<br />TETH가 당신의 상상을 현실에 구현해줍니다.</p>
            <div className="hero-capabilities" aria-label="TETH 핵심 기능">
              <span>아이디어 이해</span><i aria-hidden="true" /><span>전략 생성</span><i aria-hidden="true" /><span>지난 데이터 검증</span><i aria-hidden="true" /><span>실행 준비</span>
            </div>
            <div className="live-activity" aria-label="TETH mock 실시간 활동">
              <span className="live-activity-label"><i /> MOCK LIVE</span>
              <span aria-label="이번 주 12,847개 전략이 백테스트 되었습니다"><small>이번 주 백테스트</small><strong>12,847</strong><em>전략</em></span>
              <span aria-label="오늘 342명이 실행 준비를 마쳤습니다"><small>오늘 실행 준비</small><strong>342</strong><em>명</em></span>
              <span className="free-access"><ShieldCheck size={14} /> 결제 없이 시작</span>
            </div>
            <section className={`landing-composer ${idea.trim() ? 'has-input' : ''}`} aria-label="TETH AI에게 아이디어 말하기">
              <div className="composer-head">
                <span className="tesia-orb tesia-agent-avatar"><TesiaGlyph /></span>
                <div className="agent-intro">
                  <span>TETH AGENT</span>
                  <label htmlFor="strategy-idea">생각을 입력하면 시장의 언어로 바뀝니다</label>
                  <small>시장 질문부터 매매 아이디어까지 한 번에</small>
                </div>
                <span className={`online-state ${idea.trim() ? 'listening' : ''}`}><span /> {idea.trim() ? 'LISTENING' : 'READY'}</span>
              </div>
              <div className="composer-body">
                <textarea
                  id="strategy-idea"
                  ref={landingInputRef}
                  aria-label="시장이나 전략에 대해 물어보세요"
                  value={idea}
                  disabled={agentPhase !== 'idle'}
                  onChange={(event) => { setIdea(event.target.value); if (ideaError) setIdeaError('') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      startIdea()
                    }
                  }}
                  placeholder="예: 요즘 비트코인은 왜 오르는 거야?"
                  rows={2}
                />
                <button type="button" disabled={agentPhase !== 'idle'} aria-label="대화 시작" onClick={() => startIdea()}><Send size={19} /></button>
              </div>
              {ideaError && <p className="composer-error" role="alert">{ideaError}</p>}
              <div className="composer-foot">
                <div className="composer-intents" aria-label="TETH가 이해한 입력 요소">
                  {landingIntentTags.length ? <><span><Sparkles size={12} /> 이해한 내용</span>{landingIntentTags.map((tag) => <em key={tag.label}>{tag.label}</em>)}</> : <span><Command size={13} /> Enter로 전송 · Shift+Enter 줄바꿈</span>}
                </div>
                <span>결제수단 없음 · 질문과 전략 생성 무료 · MOCK</span>
              </div>
            </section>

            <div className="starter-ideas" aria-label="시작 아이디어">
              <span>이렇게 물어보세요</span>
              {starterIdeas.map((item) => (
                <button key={item} type="button" onClick={() => startIdea(item)}>{item}<ArrowRight size={14} /></button>
              ))}
            </div>

            <div className="investing-scope" aria-label="TETH AI가 도와주는 영역">
              <span><Activity size={14} /> 오늘의 시장</span>
              <span><CircleHelp size={14} /> 투자 기초</span>
              <span><Sparkles size={14} /> 아이디어 점검</span>
              <span><LineChart size={14} /> 지난 결과 확인</span>
            </div>
          </section>

          {agentPhase === 'idle' && <section id="what-tesia-does" className="trust-runway" aria-label="TETH가 도와주는 방식">
            <div
              className="landing-proof"
              aria-label="베타 트레이더 목업 후기"
              tabIndex={0}
              onPointerEnter={() => setReviewInteracting(true)}
              onPointerLeave={() => setReviewInteracting(false)}
              onFocus={() => setReviewInteracting(true)}
              onBlur={() => setReviewInteracting(false)}
            >
              <div className="proof-viewport" aria-live="off" aria-atomic="true">
                {previousReview && previousReview.id !== currentReview.id && (
                  <article className="proof-slide is-previous" aria-hidden="true">
                    <div className="proof-quote"><TraderReviewQuote parts={previousReview.quoteParts} /></div>
                    <footer className="proof-meta"><span className="proof-count">{String(previousReviewIndex! + 1).padStart(2, '0')} / {String(mockTraderReviews.length).padStart(2, '0')}</span><div className="proof-person"><strong>{previousReview.name}</strong><small>{previousReview.role}</small><em>BETA TESTER · MOCK REVIEW</em></div></footer>
                  </article>
                )}
                <article className="proof-slide is-current" key={currentReview.id}>
                  <div className="proof-quote"><TraderReviewQuote parts={currentReview.quoteParts} /></div>
                  <footer className="proof-meta"><span className="proof-count">{String(reviewIndex + 1).padStart(2, '0')} / {String(mockTraderReviews.length).padStart(2, '0')}</span><div className="proof-person"><strong>{currentReview.name}</strong><small>{currentReview.role}</small><em>BETA TESTER · MOCK REVIEW</em></div></footer>
                </article>
              </div>
            </div>
            <div className="how-flow">
              <div><span>01</span><strong>편하게 질문</strong><p>어려운 형식 없이 평소 말투로 질문</p></div>
              <ArrowRight aria-hidden="true" />
              <div><span>02</span><strong>쉽게 이해</strong><p>시장 흐름과 투자 용어를 쉬운 말로 설명</p></div>
              <ArrowRight aria-hidden="true" />
              <div><span>03</span><strong>내 생각 점검</strong><p>막연한 매수 생각을 분명한 기준으로 정리</p></div>
              <ArrowRight aria-hidden="true" />
              <div><span>04</span><strong>지난 결과 확인</strong><p>과거에 통했는지 수익과 손실로 확인</p></div>
            </div>
          </section>}
        </div>
      )}

      {(view === 'briefing' || view === 'build') && (
        <div className={`unified-chat-workspace mode-${view}`}>
          <section className="unified-chat-column" aria-label="TETH AI 대화">
            <div className="unified-chat-heading">
              <button type="button" onClick={startNewConversation} aria-label="새 대화 시작"><ChevronLeft size={17} /></button>
              <div><span>TETH AI</span><h1 aria-label={view === 'build' ? '전략 조건 설정' : '대화'}>대화</h1></div>
              <span className="unified-agent-status"><i /> TETH와 대화 중</span>
            </div>

            <div ref={chatThreadRef} className="unified-chat-thread" aria-busy={agentPhase === 'thinking' || agentPhase === 'streaming' || buildReplyPhase === 'thinking'}>
              {(view === 'briefing' ? visibleMarketTurns : marketTurns).map((turn) => (
                <div className="unified-turn" key={`${view}-${turn.id}`}>
                  <article className="unified-user-bubble"><span>나</span><p>{turn.question}</p></article>
                  <article className="unified-ai-bubble">
                    <span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span>
                    <div>
                      <span className="unified-ai-label">TETH MARKET BRIEF · MOCK</span>
                      <h2>{turn.title}</h2>
                      <p>{turn.body}</p>
                      <div className="unified-signal-strip">
                        <span><small>관심도</small><strong>평소보다 높음</strong></span>
                        <span><small>가격 움직임</small><strong>보통</strong></span>
                        <span><small>주의 정도</small><strong>32 / 100</strong></span>
                      </div>
                      <small className="unified-boundary"><ShieldCheck size={13} /> 이해를 돕기 위한 mock 분석이며 투자 조언이 아닙니다.</small>
                    </div>
                  </article>
                </div>
              ))}

              {view === 'briefing' && agentPhase === 'thinking' && pendingPrompt && (
                <div className="unified-turn active-turn"><article className="unified-user-bubble"><span>나</span><p>{pendingPrompt}</p></article><ThinkingIndicator label="시장 흐름과 관련 데이터를 살펴보고 있어요" /></div>
              )}
              {view === 'briefing' && agentPhase === 'streaming' && pendingView === 'briefing' && (
                <div className="unified-turn active-turn">
                  <article className="unified-user-bubble"><span>나</span><p>{pendingPrompt}</p></article>
                  <article className="unified-ai-bubble streaming-message" data-phase="streaming"><span className="message-avatar tesia-agent-avatar is-streaming"><TesiaGlyph /></span><div><span className="unified-ai-label">TETH · 답변 중</span><h2>{briefingCopy.title}</h2><p>{streamedReply}<span className="stream-caret" aria-hidden="true" /></p></div></article>
                </div>
              )}

              {view === 'briefing' && visibleMarketTurns.length > 0 && agentPhase === 'ready' && (
                <div className="unified-next-actions" aria-label="이어서 할 수 있는 작업">
                  <span>이어서 물어보거나 내 기준으로 만들 수 있어요</span>
                  <button type="button" aria-label="무효화 가격 확인" aria-pressed={briefingVariant === 'invalidation'} onClick={() => { startIdea('이 흐름은 어디서 조심해야 해?'); setBriefingVariant('invalidation') }}>어디서 조심해야 해?</button>
                  <button type="button" aria-label="ETH와 비교" aria-pressed={briefingVariant === 'comparison'} onClick={() => { startIdea('같은 시점의 ETH와 비교해줘'); setBriefingVariant('comparison') }}>ETH와 비교해줘</button>
                  <button className="primary" type="button" aria-label="조건 초안 검토" onClick={() => {
                    if (marketTurns.length === 0 && visibleMarketTurns.length) setMarketTurns(visibleMarketTurns)
                    const latestQuestion = visibleMarketTurns.at(-1)?.question.toUpperCase() || ''
                    const latestAsset = latestQuestion.includes('ETH') ? 'ETH' : latestQuestion.includes('SOL') ? 'SOL' : latestQuestion.includes('XRP') ? 'XRP' : 'BTC'
                    setSuggestedCondition(`거래량이 평균을 넘고 위험 수준이 40 아래일 때만 ${latestAsset}에 진입`)
                    setAnswers((current) => ({ ...current, market: `${latestAsset}/USDT` }))
                    setBuildStep(1)
                    setIdeaSource('suggested')
                    setPendingPrompt('이 흐름을 내 투자 기준으로 만들어줘')
                    setPendingView('build')
                    setStreamedReply('')
                    setAgentPhase('thinking')
                    setRequestId((current) => current + 1)
                    setView('build')
                  }}><Sparkles size={15} /> 이 흐름을 내 기준으로 만들기</button>
                </div>
              )}

              {view === 'build' && (
                <>
                  {agentPhase === 'thinking' ? (
                    <div className="unified-turn active-turn"><article className="unified-user-bubble"><span>나</span><p>{pendingPrompt}</p></article><ThinkingIndicator label="말씀하신 생각을 매매 기준으로 정리하고 있어요" /></div>
                  ) : (
                    <>
                      <article className="unified-user-bubble"><span>나</span><p>{ideaSource === 'suggested' ? (pendingPrompt || '이 흐름을 내 투자 기준으로 만들어줘') : effectiveIdea}</p></article>
                      <article className={`unified-ai-bubble ${agentPhase === 'streaming' ? 'streaming-message' : ''}`} data-phase={agentPhase === 'streaming' ? 'streaming' : 'done'}>
                        <span className={`message-avatar tesia-agent-avatar ${agentPhase === 'streaming' ? 'is-streaming' : ''}`}><TesiaGlyph /></span><div><span className="unified-ai-label">TETH · {agentPhase === 'streaming' ? '답변 중' : '이해한 내용'}</span><p>{agentPhase === 'streaming' ? streamedReply : buildIntroText}{agentPhase === 'streaming' && <span className="stream-caret" aria-hidden="true" />}</p></div>
                      </article>
                    </>
                  )}

                  {answers.market && <div className="unified-answer-pair"><article className="unified-ai-bubble compact"><span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span><div><span className="unified-ai-label">조건 1/{totalBuildSteps}</span><p>어떤 코인인가요?</p></div></article><article className="unified-user-bubble"><span>나</span><p>{answers.market}</p></article></div>}
                  {answers.timeframe && <div className="unified-answer-pair"><article className="unified-ai-bubble compact"><span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span><div><span className="unified-ai-label">조건 2/{totalBuildSteps}</span><p>얼마나 자주 확인할까요?</p></div></article><article className="unified-user-bubble"><span>나</span><p>{answers.timeframe}</p></article></div>}
                  {answers.risk && <div className="unified-answer-pair"><article className="unified-ai-bubble compact"><span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span><div><span className="unified-ai-label">조건 3/{totalBuildSteps}</span><p>한 번에 감당할 손실은?</p></div></article><article className="unified-user-bubble"><span>나</span><p>{answers.risk}</p></article></div>}
                  {requiresEntryClarification && entryRule && <div className="unified-answer-pair"><article className="unified-ai-bubble compact"><span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span><div><span className="unified-ai-label">조건 4/4</span><p>언제 사고 싶나요?</p></div></article><article className="unified-user-bubble"><span>나</span><p>{entryRule}</p></article></div>}

                  {agentPhase !== 'thinking' && agentPhase !== 'streaming' && !buildComplete && (
                    <article ref={buildStatusRef} className="unified-ai-bubble unified-question-card" tabIndex={-1}>
                      <span className="message-avatar tesia-agent-avatar"><TesiaGlyph /></span>
                      <div><span className="unified-ai-label">TETH · 질문 {buildStep + 1}/{totalBuildSteps}</span><h2>{buildStep === 0 ? '어떤 코인으로 해볼까요?' : buildStep === 1 ? '얼마나 자주 확인할까요?' : buildStep === 2 ? '한 번에 얼마나 잃어도 괜찮을까요?' : '언제 사고 싶나요?'}</h2><p>{buildStep === 0 ? '비트코인처럼 편한 이름으로 말해도 이해해요.' : buildStep === 1 ? '15분마다, 하루에 한 번처럼 말해주세요.' : buildStep === 2 ? '처음이라면 전체 돈의 1%처럼 작게 시작할 수 있어요.' : '가격이나 거래량처럼 생각해둔 기준을 그대로 말해주세요.'}</p><div className="unified-choice-row">{buildSuggestions.map((option) => <button key={option} type="button" disabled={buildReplyPhase === 'thinking'} onClick={() => answerBuildQuestion(option)}>{option}</button>)}</div></div>
                    </article>
                  )}
                  {agentPhase !== 'thinking' && agentPhase !== 'streaming' && buildComplete && (
                    <article ref={buildStatusRef} className="unified-ai-bubble unified-ready-message" tabIndex={-1}><span className="message-avatar tesia-agent-avatar is-complete"><TesiaGlyph /></span><div><span className="unified-ai-label">TETH · 준비 완료</span><h2>지난 결과를 확인할 준비가 됐어요.</h2><p>정리한 기준을 최근 {BACKTEST_DAYS}일 데이터에 적용해볼게요.</p></div></article>
                  )}
                  {buildReplyPhase === 'thinking' && pendingBuildAnswer && <div className="unified-turn active-turn"><article className="unified-user-bubble"><span>나</span><p>{pendingBuildAnswer}</p></article><ThinkingIndicator label="답변을 기준에 반영하고 있어요" /></div>}

                  {agentPhase !== 'thinking' && agentPhase !== 'streaming' && <article className={`inline-strategy-card ${buildComplete ? 'complete' : ''}`} aria-labelledby="inline-strategy-title">
                    <div className="inline-strategy-head"><div><span>대화에서 정리 중</span><h2 id="inline-strategy-title">내 투자 기준</h2></div><button type="button" aria-label={strategyCopied ? '전략 복사 완료' : strategyCopyError ? '전략 복사 실패, 다시 시도' : '전략 복사'} onClick={copyStrategy}>{strategyCopied ? <Check size={16} /> : <Copy size={16} />}</button></div>
                    <div className="inline-progress"><span><strong>{completionPercent}%</strong> 완성</span><div role="progressbar" aria-label="전략 조건 완성도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}><i style={{ width: `${completionPercent}%` }} /></div></div>
                    <dl><div><dt>자산</dt><dd>{answers.market || '대화로 확인'}</dd></div><div><dt>확인 간격</dt><dd>{answers.timeframe || '대화로 확인'}</dd></div><div><dt>진입</dt><dd>{strategyProfile.entry}</dd></div><div><dt>손실 한도</dt><dd>{answers.risk || '대화로 확인'}</dd></div></dl>
                    <details className="inline-rule-details"><summary>정리된 규칙 보기</summary><pre aria-label="전략 규칙 미리보기" tabIndex={0}><code>{resolvedCode.join('\n')}</code></pre></details>
                    {buildComplete ? <button className="inline-backtest-cta" type="button" aria-label={`백테스트 시작, 지난 ${BACKTEST_DAYS}일 결과 확인`} onClick={() => { if (signedIn) runBacktest(); else setView('signup'); window.scrollTo({ top: 0 }) }}><LineChart size={17} /><span><strong>지난 {BACKTEST_DAYS}일로 확인하기</strong><small>수익과 손실을 함께 계산합니다</small></span><ArrowRight size={17} /></button> : <p className="inline-waiting"><span /> 대화를 마치면 바로 지난 결과를 확인할 수 있어요.</p>}
                    <div className={`copy-feedback ${strategyCopyError ? 'error' : ''}`} role="status" aria-live="polite">{strategyCopied ? '전략 규칙을 클립보드에 복사했습니다.' : strategyCopyError ? '복사 권한을 확인한 뒤 다시 시도해주세요.' : ''}</div>
                  </article>}
                </>
              )}
              <div className="chat-end-anchor" ref={chatEndRef} aria-hidden="true" />
            </div>

            {(view === 'briefing' || !buildComplete) && (
              <div className={`unified-composer-shell ${draftMessage.trim() ? 'has-input' : ''}`}>
                <div className="unified-composer-meta"><span><span /> {agentPhase === 'thinking' || agentPhase === 'streaming' || buildReplyPhase === 'thinking' ? 'TETH가 생각하고 있어요' : '평소 말투로 편하게 이어가세요'}</span><small>Enter 전송</small></div>
                <div className="unified-composer"><textarea aria-label={view === 'briefing' ? 'TETH에게 이어서 질문' : '선택지 외 조건 직접 입력'} disabled={agentPhase === 'thinking' || agentPhase === 'streaming' || buildReplyPhase === 'thinking'} value={draftMessage} onChange={(event) => { setDraftMessage(event.target.value); if (buildError) setBuildError('') }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (view === 'briefing') submitBriefingFollowup(); else submitDraftAnswer() } }} placeholder={view === 'briefing' ? '예: 지금 들어가면 무엇을 조심해야 해?' : buildInputPlaceholder} rows={1} /><button type="button" disabled={!draftMessage.trim() || agentPhase === 'thinking' || agentPhase === 'streaming' || buildReplyPhase === 'thinking'} onClick={view === 'briefing' ? submitBriefingFollowup : submitDraftAnswer} aria-label={view === 'briefing' ? '이어서 질문 보내기' : '답변 보내기'}><Send size={17} /></button></div>
                {view === 'build' && buildError && <p className="composer-error build-error" role="alert">{buildError}</p>}
              </div>
            )}
          </section>
        </div>
      )}
        </main>
      )}

      {view === 'signup' && (
        <main id="tesia-main" className="gate-main" tabIndex={-1}>
          <section className="gate-context">
            <button className="back-link" type="button" onClick={() => setView('build')}><ChevronLeft size={16} /> 전략으로 돌아가기</button>
            <span className="gate-kicker"><CheckCircle2 size={14} /> STRATEGY READY</span>
            <h1>가입하면 바로 백테스트가 시작됩니다.</h1>
            <p>{BACKTEST_DAYS}일의 가격 데이터, {candleCount}개 캔들에서 수익률과 최대 낙폭을 계산합니다.</p>
            <div className="gate-strategy-line">
              <span>01</span><strong>{strategyProfile.title}</strong><em>{answers.market} · {answers.timeframe} · 리스크 {answers.risk}</em>
            </div>
            <dl className="gate-spec-preview">
              <div><dt>진입</dt><dd>{strategyProfile.entry}</dd></div>
              <div><dt>청산</dt><dd>{resolvedExit}</dd></div>
              <div><dt>리스크</dt><dd>{answers.risk}</dd></div>
            </dl>
            <div className="gate-data-points">
              <span><strong>{candleCount}</strong><small>분석 캔들</small></span>
              <span><strong>5</strong><small>시장 국면</small></span>
              <span><strong>0</strong><small>실제 주문 · 안전</small></span>
            </div>
            <div className="signup-report-preview" aria-hidden="true">
              <div className="preview-head"><span>BACKTEST REPORT</span><strong>잠금 해제 후 결과 표시</strong></div>
              <EquityResultCanvas mode="base" interactive={false} />
              <div className="preview-lock"><LockKeyhole size={18} /><span>가입 후 즉시 열립니다</span></div>
            </div>
          </section>
          <section className="signup-panel" aria-labelledby="signup-title">
            <div className="signup-lock"><LockKeyhole size={20} /></div>
            <span>STEP 2 · SAVE & TEST</span>
            <h2 id="signup-title">보고서를 저장할 계정이 필요합니다.</h2>
            <p>가입이 끝나면 이 화면에서 바로 계산을 시작합니다. 결제 정보는 받지 않습니다.</p>
            <button className="social-signup google" type="button" onClick={signUpAndTest}><span>G</span> Google로 계속</button>
            <button className="social-signup email" type="button" onClick={signUpAndTest}><span>@</span> 이메일로 계속</button>
            <div className="signup-divider"><span>가입 후 즉시 실행</span></div>
            <ul>
              <li><Check size={14} /> 현재 대화와 전략 자동 저장</li>
              <li><Check size={14} /> 백테스트 결과로 바로 복귀</li>
              <li><Check size={14} /> 카드 없음, 취소할 구독 없음</li>
            </ul>
            <small className="legal-copy">계속하면 이용약관과 개인정보 처리방침에 동의하게 됩니다. 본 화면은 mock입니다.</small>
          </section>
        </main>
      )}

      {view === 'testing' && (
        <main id="tesia-main" className={`testing-main cinematic-backtest ${professionalChart ? 'professional' : ''} ${backtestExiting ? 'is-collapsing' : ''}`} tabIndex={-1}>
          <section className="replay-surface" aria-labelledby="replay-title">
            <header className="replay-header">
              <div>
                <span className="testing-kicker">BACKTEST IN PROGRESS · MOCK</span>
                <h1 id="replay-title">전략이 과거 시장을 통과하고 있습니다.</h1>
                <p>가격·거래량·체결 비용을 시간순으로 반영합니다.</p>
              </div>
              <button className="replay-skip" type="button" onClick={completeBacktest} aria-label="백테스트 재생 건너뛰기">Skip <kbd>ESC</kbd></button>
            </header>

            <BacktestReplayTerminal
              market={chartMarket}
              timeframe={chartTimeframe}
              mode={retryCount === 0 && (answers.risk.includes('3%') || /레버리지|10배|20배/.test(structuredIdea)) ? 'stress' : selectedRepair ?? 'base'}
              professional={professionalChart}
              replayDuration={import.meta.env.VITE_E2E_FAST === 'true' ? 900 : 5200}
              onRevealComplete={completeBacktest}
            />

            <footer className="replay-footer">
              <div className="testing-progress" role="progressbar" aria-label="백테스트 계산 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={testProgress}><i style={{ width: `${testProgress}%` }} /></div>
              <div className="testing-meta"><strong>{backtestExiting ? '100' : 'LIVE'}{backtestExiting && <small>%</small>}</strong><span>{candleCount} candles · fees & slippage included</span></div>
            </footer>
          </section>
        </main>
      )}

      {view === 'result' && (
        <main id="tesia-main" className="result-main" tabIndex={-1}>
          <button className="back-link" type="button" onClick={() => setView('build')}><ChevronLeft size={16} /> 조건 다시 보기</button>
          <div className="result-heading">
            <div><span>BACKTEST REPORT · 2020–2025 · MOCK</span><h1>{result.title}</h1></div>
            <div className="result-mode" role="group" aria-label="백테스트 시나리오">
              <button className={successfulResult ? 'active' : ''} aria-pressed={successfulResult} type="button" onClick={() => setResultMode(selectedRepair ?? 'base')}>{selectedRepair ? '수정 시나리오' : '기본 시나리오'}</button>
              <button className={resultMode === 'stress' ? 'active' : ''} aria-pressed={resultMode === 'stress'} type="button" onClick={() => setResultMode('stress')}>스트레스 테스트</button>
            </div>
          </div>

          <section className={`result-board ${successfulResult ? 'base' : 'stress'}`}>
            <div className="result-score">
              <span>검증 점수</span>
              <strong>{result.score}</strong>
              <small>/ 100</small>
              <div role="progressbar" aria-label="전략 검증 점수" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.score}><i style={{ width: `${result.score}%` }} /></div>
              <p>{successfulResult ? '검증 기준에서 실행 가능' : '수정 후 재검증 권장'}</p>
            </div>
            <div className="result-metrics">
              <div><span>누적 수익률</span><strong className={successfulResult ? 'positive' : 'negative'}>{result.returnRate}</strong><small>{chartMarketSymbol} 보유 {result.benchmark}</small></div>
              <div><span>승률</span><strong>{result.winRate}</strong><small className="metric-ratio">손익비 <b>{successfulResult ? '1.84' : '0.91'}</b></small></div>
              <div><span>최대 낙폭</span><strong className="negative">{result.drawdown}</strong><small>{result.recovery} 회복</small></div>
              <div><span>총 거래</span><strong>{result.trades}</strong><small>수수료 반영</small></div>
            </div>
            <div className={`result-chart ${professionalChart ? 'professional' : ''}`}>
              {professionalChart && <div className="trade-toolbar compact" aria-hidden="true"><span className="trade-symbol">{chartMarket.replace('/', '')}</span><b>Perpetual</b><span className="active-timeframe">{chartTimeframeInfo.shortLabel}</span><span>Indicators</span><em>Mock market data</em></div>}
              <div className="chart-legend"><div><strong>누적 수익률</strong><small>{chartTimeframeInfo.label} · 수수료·슬리피지 반영</small></div><span><i /> TETH 전략</span><span><i /> {chartMarketSymbol} 보유</span></div>
              <EquityResultCanvas mode={resultMode} professional={professionalChart} timeframe={chartTimeframe} market={chartMarket} replayDuration={1} />
            </div>
          </section>

          <section className={`ai-verdict ${successfulResult ? 'base' : 'stress'}`}>
            <span className="verdict-icon">{successfulResult ? <CheckCircle2 /> : <RefreshCw />}</span>
            <div>
              <span>RESULT NOTE</span>
              <h2>{successfulResult
                ? resultMode === 'atr'
                  ? 'ATR 동적 손절을 적용해 하락 구간의 거래 횟수가 줄었습니다.'
                  : resultMode === 'filter'
                    ? 'BTC 200MA 필터가 하락 국면의 진입을 걸러냈습니다.'
                    : resultMode === 'cooldown'
                      ? '6시간 재진입 제한이 연속 손실을 줄였습니다.'
                      : '하락 구간의 거래 횟수가 줄어 낙폭을 제한했습니다.'
                : usesDynamicRisk
                  ? '고변동성 구간에서는 재진입 간격을 넓혀야 합니다.'
                  : '고정 손절을 변동성 기준으로 바꿔야 합니다.'}</h2>
              <p>{successfulResult
                ? `${chartMarketSymbol} 단순 보유보다 수익률은 ${result.excessReturn}%p 높았습니다. 누적 수익률 ${result.returnRate}, 최대 낙폭 ${result.drawdown}은 위 차트와 같은 ${chartTimeframeInfo.label} 시계열에서 계산했습니다.`
                : usesDynamicRisk
                  ? `ATR 손절은 유지하고 손절 후 6시간 재진입 제한을 더하면 mock 낙폭이 ${stressDrawdown}%에서 ${getSeriesMetrics('cooldown', chartTimeframe).drawdown.toFixed(1)}%로 줄어듭니다.`
                  : `ATR 1.6배 손절을 적용하면 mock 낙폭이 ${stressDrawdown}%에서 ${getSeriesMetrics('atr', chartTimeframe).drawdown.toFixed(1)}%로 줄어듭니다.`}</p>
            </div>
            {successfulResult ? (
              <button type="button" onClick={() => { setView('match'); window.scrollTo({ top: 0 }) }}><Rocket size={17} /><span><strong>실행 환경 선택</strong><small>거래소·증권사 조건 비교</small></span><ArrowRight size={17} /></button>
            ) : (
              <div className="repair-actions"><div className="repair-diff"><span><small>현재 낙폭</small><strong>{stressDrawdown}%</strong></span><ArrowRight size={15} /><span><small>수정 예상</small><strong>{repairTarget}%</strong></span></div><button type="button" onClick={applyRepairAndRetest}><Sparkles size={16} /> 수정안 적용 후 재검증</button><button type="button" onClick={() => { setView('recommend'); window.scrollTo({ top: 0 }) }}>추천 전략 비교</button></div>
            )}
          </section>
          <p className="result-disclaimer"><ShieldCheck size={14} /> 과거 성과는 미래 수익을 보장하지 않으며 모든 결과는 mock 데이터입니다.</p>
        </main>
      )}

      {view === 'recommend' && (
        <main id="tesia-main" className="recommend-main" tabIndex={-1}>
          <section className="recommend-heading">
            <button className="back-link" type="button" onClick={() => setView('result')}><ChevronLeft size={16} /> 결과로 돌아가기</button>
            <span>PARAMETER RECOVERY · MOCK</span>
            <h1>원래 조건을 유지하며 낙폭을 줄이는 세 가지 방법</h1>
            <p>{answers.market} · {answers.timeframe} 조건에서 수정 효과가 큰 순서입니다.</p>
          </section>
          <section className="recommend-list" aria-label="수정 전략 비교">
            {[
              { rank: '01', title: 'ATR 동적 손절', change: '고정 손절 → ATR 1.6배', drawdown: `${getSeriesMetrics('atr', chartTimeframe).drawdown.toFixed(1)}%`, returnRate: `+${getSeriesMetrics('atr', chartTimeframe).returnRate.toFixed(1)}%`, fit: '92%' },
              { rank: '02', title: '하락장 필터', change: 'BTC 200MA 위에서만 진입', drawdown: `${getSeriesMetrics('filter', chartTimeframe).drawdown.toFixed(1)}%`, returnRate: `+${getSeriesMetrics('filter', chartTimeframe).returnRate.toFixed(1)}%`, fit: '88%' },
              { rank: '03', title: '재진입 쿨다운', change: '손절 후 6시간 진입 금지', drawdown: `${getSeriesMetrics('cooldown', chartTimeframe).drawdown.toFixed(1)}%`, returnRate: `+${getSeriesMetrics('cooldown', chartTimeframe).returnRate.toFixed(1)}%`, fit: '81%' },
            ].map((item, index) => (
              <button key={item.rank} type="button" onClick={() => {
                const baseline = repairBaseline ?? { idea, suggestedCondition, risk: answers.risk }
                if (!repairBaseline) setRepairBaseline(baseline)
                setIdea(baseline.idea)
                setSuggestedCondition(baseline.suggestedCondition)
                setAnswers((current) => ({ ...current, risk: baseline.risk }))
                if (index === 0) {
                  setSelectedRepair('atr')
                  setAnswers((current) => ({ ...current, risk: '자산의 1% · ATR 1.6배' }))
                }
                if (index === 1) {
                  setSelectedRepair('filter')
                  if (ideaSource === 'suggested') setSuggestedCondition(`${baseline.suggestedCondition} + BTC 200MA 상단 필터`)
                  else setIdea(`${baseline.idea} + BTC 200MA 상단 필터`)
                }
                if (index === 2) {
                  setSelectedRepair('cooldown')
                  if (ideaSource === 'suggested') setSuggestedCondition(`${baseline.suggestedCondition} + 6시간 재진입 금지`)
                  else setIdea(`${baseline.idea} + 6시간 재진입 금지`)
                }
                setRetryCount((current) => current + 1)
                runBacktest()
              }}>
                <span className="recommend-rank">{item.rank}</span>
                <span className="recommend-copy"><strong>{item.title}</strong><small>{item.change}</small></span>
                <span><small>예상 낙폭</small><strong className="negative">{item.drawdown}</strong></span>
                <span><small>예상 수익</small><strong className="positive">{item.returnRate}</strong></span>
                <span><small>아이디어 적합도</small><strong>{item.fit}</strong></span>
                <ArrowRight size={17} />
              </button>
            ))}
          </section>
          <p className="recommend-note"><ShieldCheck size={14} /> 예상 수치는 mock 데이터에서 계산한 비교값이며 미래 성과를 보장하지 않습니다.</p>
        </main>
      )}

      {view === 'match' && (
        <main id="tesia-main" className="match-main" tabIndex={-1}>
          <button className="back-link" type="button" onClick={() => setView('result')}><ChevronLeft size={16} /> 결과로 돌아가기</button>
          <section className="match-heading">
            <span>FINAL STEP · MOCK EXECUTION</span>
            <h1>전략에 맞는 실행 환경을 선택하세요.</h1>
            <p>{answers.market} · {answers.timeframe} · 리스크 {answers.risk} 조건을 기준으로 비교했습니다.</p>
          </section>
          <section className="broker-matcher" role="radiogroup" aria-labelledby="broker-title">
            <div className="matcher-intro"><span><SlidersHorizontal size={16} /> MATCH SCORE</span><h2 id="broker-title">조건이 맞는 순서</h2></div>
            {brokerOptions.map((broker, index) => (
              <button
                key={broker.id}
                data-broker-id={broker.id}
                className={`broker-row ${selectedBroker === broker.id ? 'selected' : ''}`}
                role="radio"
                aria-checked={selectedBroker === broker.id}
                tabIndex={selectedBroker === broker.id ? 0 : -1}
                type="button"
                onClick={() => chooseBroker(broker.id)}
                onKeyDown={(event) => handleBrokerKeyDown(event, index)}
              >
                <span className="broker-radio"><i /></span>
                <span className="broker-identity"><small>{broker.type}</small><strong>{broker.name}</strong></span>
                <span className="broker-detail">{broker.detail}</span>
                <span className="broker-match"><strong>{broker.match}</strong><small>MATCH</small></span>
                <span className="broker-price"><strong>{broker.price}</strong><small>{broker.note}</small></span>
                {broker.recommended && <span className="recommended-label"><BadgeCheck size={13} /> BEST</span>}
              </button>
            ))}
            <div className="matching-note"><ShieldCheck size={16} /><p><strong>가격과 수익 구조를 함께 표시합니다.</strong>거래소 파트너 경로는 사용자 요금이 없고, TETH는 거래 수수료 일부를 받을 수 있습니다. 직접 연결은 월 구독입니다.</p></div>
            <button className="matcher-cta" type="button" onClick={() => { setView('onboarding'); window.scrollTo({ top: 0 }) }}>
              <span><Rocket size={17} /><strong>{selectedBroker === 'binance' ? 'Binance 무료 경로 확인' : selectedBroker === 'gate' ? 'Gate 무료 경로 확인' : 'Alpaca 월간 구독 확인'}</strong></span><ArrowRight size={18} />
            </button>
            <p className="matcher-disclaimer">API 키는 이 시연에서 저장·전송되지 않으며 실제 주문을 생성하지 않습니다.</p>
          </section>
        </main>
      )}

      {view === 'onboarding' && (
        <main id="tesia-main" className="onboarding-main" tabIndex={-1}>
          <section className="onboarding-summary">
            <button className="back-link" type="button" onClick={() => setView('match')}><ChevronLeft size={16} /> 다른 환경 보기</button>
            <span>{selectedBroker === 'alpaca' || executionPath === 'direct' ? 'SUBSCRIPTION · MOCK' : 'PARTNER ACCESS · MOCK'}</span>
            <h1>{selectedBroker === 'alpaca' ? 'Alpaca 월간 실행 계획' : `${selectedBroker === 'binance' ? 'Binance' : 'Gate'} 연결 방식`}</h1>
            {selectedBroker !== 'alpaca' && <div className="onboarding-paths" role="group" aria-label="거래소 연결 요금 선택"><button className={executionPath === 'partner' ? 'active' : ''} aria-pressed={executionPath === 'partner'} type="button" onClick={() => setExecutionPath('partner')}><strong>파트너 경로</strong><span>₩0 · 카드 불필요</span></button><button className={executionPath === 'direct' ? 'active' : ''} aria-pressed={executionPath === 'direct'} type="button" onClick={() => setExecutionPath('direct')}><strong>직접 연결</strong><span>₩9,900 / 월</span></button></div>}
            <p>{selectedBroker === 'alpaca' ? '주식 전략 실행과 월간 성과 보고서가 포함된 mock 구독입니다.' : executionPath === 'partner' ? '파트너 가입을 이용하면 TETH 사용료가 없습니다.' : '기존 거래소 계정을 유지하고 TETH 구독으로 직접 연결합니다.'}</p>
            <div className="onboarding-price"><span>{selectedBroker === 'alpaca' ? '₩29,000' : executionPath === 'partner' ? '₩0' : '₩9,900'}</span><small>{selectedBroker === 'alpaca' || executionPath === 'direct' ? '/ 월 · 언제든 취소' : '카드 불필요'}</small></div>
            <div className="onboarding-disclosure"><BadgeCheck size={16} /><span><strong>수익 구조</strong>{selectedBroker === 'alpaca' || executionPath === 'direct' ? '월 구독료로 운영됩니다.' : '거래 수수료 일부를 TETH가 받을 수 있으며 추가 사용자 요금은 없습니다.'}</span></div>
          </section>
          <section className="onboarding-steps" aria-labelledby="onboarding-title">
            <span>24H GUIDED SETUP</span>
            <h2 id="onboarding-title">세 단계 후 mock 실행을 시작합니다.</h2>
            <ol>
              <li><span>1</span><div><strong>{selectedBroker === 'alpaca' || executionPath === 'direct' ? '구독 계획 확인' : '파트너 계정 준비'}</strong><p>{selectedBroker === 'alpaca' || executionPath === 'direct' ? '실제 카드를 받지 않는 mock 결제 화면입니다.' : '시연에서는 외부 가입 페이지로 이동하지 않습니다.'}</p></div><Check size={16} /></li>
              <li><span>2</span><div><strong>KYC·입금 가이드</strong><p>현재 단계와 남은 시간을 보여주고 24시간 도움을 제공합니다.</p></div><span className="step-time">약 5분</span></li>
              <li><span>3</span><div><strong>API 권한 확인</strong><p>조회·mock 실행만 사용하며 출금 권한은 요청하지 않습니다.</p></div><ShieldCheck size={16} /></li>
            </ol>
            <button type="button" onClick={openDashboard}><span>{selectedBroker === 'alpaca' || executionPath === 'direct' ? 'Mock 구독 확인' : 'Mock 가입 가이드 시작'}</span><ArrowRight size={18} /></button>
            <div className="onboarding-proof"><span>저장됨</span><p>현재 단계는 이 브라우저 탭에 자동 저장되어 언제든 이어갈 수 있습니다.</p><small>예상 5분 · 출금 권한 요청 없음</small></div>
            <div className="support-line"><CircleHelp size={15} /><span>설정 지원</span><strong>24시간 CS 연결</strong></div>
          </section>
        </main>
      )}

      {view !== 'briefing' && view !== 'build' && <footer className="tesia-footer">
        <span>© 2026 TETH AI</span>
        <span>MOCK PRODUCT · 투자 조언 아님</span>
        <div><button type="button" onClick={() => setPolicyOpen('help')}>24시간 도움말</button><button type="button" onClick={() => setPolicyOpen('risk')}>위험 고지</button><button type="button" onClick={() => setPolicyOpen('privacy')}>개인정보</button></div>
      </footer>}
      {policyOpen && <PolicyDialog kind={policyOpen} onClose={() => setPolicyOpen(null)} />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.hash === '#/mock-strategy-flow' ? <MockStrategyJourney /> : <TesiaApp />}
  </StrictMode>,
)
