import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, BatteryFull, ChevronLeft, ChevronRight, Menu, MoreHorizontal, Pause, Play, Signal, Wifi } from 'lucide-react'
import { InternalLink } from './InternalLink'
import { useClientPreferences } from '../client-preferences'
import publicCopy from '../client-public-copy.json'

// Read-only presentations of the client's three screenshots, not a live app or engine.
const screens = [
  { id: 'chat', title: '대화', heading: '이더리움 추세 분석', before: '그거 지금 진입해도 괜찮아?', after: '손익비까지 계산해서 판단을 도와드려요' },
  { id: 'report', title: '검증 리포트', heading: 'BTC Pullback Strategy', before: '과거 3년 데이터로 검증했어요', after: 'Holdout +9.9%, 낙폭까지 정직하게' },
  { id: 'live', title: '모니터링', heading: 'BTC Pullback Strategy', before: '포지션을 24시간 지켜보고 있어요', after: '왜 벌고 잃었는지 말로 설명해드려요' },
] as const

function ChatScreen() {
  return <>
    <p className="phone-user">그거 지금 진입해도 괜찮아?</p>
    <p>솔직히 말하면, 지금 <strong>2,489</strong>는 진입하기 애매한 자리입니다.</p>
    <h3>판단 근거</h3>
    <ul className="phone-reasons">
      <li>지지 <strong>2,452</strong>와 저항 <strong>2,505~2,523</strong>의 딱 중간이라, 여기서 사면 손절까지 -1.5%인데 1차 저항까지 +1.3%로 <strong>손익비가 1도 안 됩니다</strong></li>
      <li>최근 3봉 연속 양봉(2,460→2,477→2,490)으로 모멘텀은 좋지만, 2,523은 한 번 거부당한 자리라 저항 직전 진입은 물릴 확률이 높은 패턴입니다</li>
    </ul>
    <h3>대안</h3>
    <p><strong>공격형:</strong> 4시간봉 종가 2,505 돌파 확인 후 진입 → 목표 2,566, 손절 2,452</p>
  </>
}
function ReportScreen() {
  return <>
    <p className="phone-meta">BTC/USDT, 1시간봉, Research v1, MOCK</p>
    <span className="phone-tag warning">조건부 권장</span>
    <p className="phone-lead">수익성은 확인됐지만 일부 조건에서 약점이 있어요. 아래 근거를 확인하고 판단하세요.</p>
    <dl className="phone-metrics">
      <div><dt>Research 수익</dt><dd className="positive">+8.3%</dd></div><div><dt>Holdout 수익</dt><dd className="positive">+9.9%</dd></div>
      <div><dt>최대 낙폭</dt><dd className="negative">-12.4%</dd></div><div><dt>수익 팩터</dt><dd>1.23</dd></div>
    </dl>
    <h3>근거</h3>
    <ul className="phone-findings"><li>✓ 가설 확인, 2023년 +6.1%</li><li>✓ Holdout 통과</li><li>✓ 파라미터 안정 (±2 유지)</li><li className="warning">! 2024년 성과 약화 (+1.9%)</li><li>? 급격한 시장 구조 변화, 검증되지 않음</li></ul>
    <h3>의견 불일치</h3>
    <p className="phone-muted">Strategy Architect, Pass, Quant Validator, Caution, Risk Reviewer, Caution, Market Context, Pass</p>
    <p className="phone-muted">수익성 판단은 일치하나 Quant Validator는 수치 우위와 표본 측면에서 보류. 다수결로 덮지 않습니다.</p>
  </>
}
function LiveScreen() {
  return <>
    <p className="phone-meta"><span className="phone-tag positive">Paper, 가상 체결</span> Binance, 시작 후 21일</p>
    <dl className="phone-metrics three"><div><dt>시작 후</dt><dd className="positive">+3.2%</dd></div><div><dt>오늘</dt><dd className="positive">+0.4%</dd></div><div><dt>거래</dt><dd>9회</dd></div></dl>
    <p className="phone-muted">현재 포지션</p><p className="phone-position">BTC 롱 +0.8%</p>
    <h3>최근 활동</h3>
    <table className="phone-trades"><caption className="phone-sr-only">가상 체결 예시</caption><thead><tr><th>시각</th><th>주문</th><th>가격</th><th>손익</th></tr></thead><tbody>
      <tr><td>08.25 14:00</td><td>매도 (익절)</td><td>$65,470</td><td className="positive">+2.1%</td></tr>
      <tr><td>08.24 09:00</td><td>매수</td><td>$64,120</td><td>—</td></tr>
      <tr><td>08.21 16:00</td><td>매도 (손절)</td><td>$63,890</td><td className="negative">-0.9%</td></tr>
      <tr><td>08.20 11:00</td><td>매수</td><td>$64,470</td><td>—</td></tr>
    </tbody></table>
    <h3>Reality Check <small>MOCK</small></h3>
    <dl className="phone-checks"><div><dt>슬리피지</dt><dd>0.05% → 0.07% <span className="warning">주의</span></dd></div><div><dt>신호 빈도</dt><dd>월 3–5회 → 4회 <span className="positive">일치</span></dd></div></dl>
  </>
}

export function DownloadPreview() {
  const { language } = useClientPreferences()
  const languageIndex = Math.max(0, ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].indexOf(language))
  const captions = [[publicCopy.download.s1f1, publicCopy.download.s1f2], [publicCopy.download.s2f1, publicCopy.download.s2f2], [publicCopy.download.s3f1, publicCopy.download.s3f2]]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const [visible, setVisible] = useState(() => !document.hidden)
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const root = useRef<HTMLElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const restoreContentFocus = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduceMotion(query.matches)
    const visibility = () => setVisible(!document.hidden)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 })
    if (root.current) observer.observe(root.current)
    query.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); query.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  const auto = !paused && !hovered && !focused && !reduceMotion && visible && inView
  useEffect(() => {
    if (!auto) return
    const timer = window.setInterval(() => setIndex(value => (value + 1) % screens.length), 6000)
    return () => window.clearInterval(timer)
  }, [auto])
  useLayoutEffect(() => {
    const content = root.current?.querySelector<HTMLElement>('.slide.on .phone-content')
    if (content) content.scrollTop = 0
    if (restoreContentFocus.current) content?.focus({ preventScroll: true })
    restoreContentFocus.current = false
  }, [index])
  const select = (offset: number) => {
    restoreContentFocus.current = Boolean(root.current?.querySelector('.phone-content:focus'))
    setIndex(value => (value + offset + screens.length) % screens.length)
  }
  return <section ref={root} className="visual phone-preview" aria-label="TETH 모바일 앱 미리보기" aria-roledescription="캐러셀"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    onKeyDown={event => {
      if (!(event.target as Element).closest('.preview-controls')) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); select(event.key === 'ArrowRight' ? 1 : -1) }
    }}>
    <div className="stage" onPointerDown={event => {
      if (event.pointerType === 'touch' && !(event.target as Element).closest('a,button')) {
        pointer.current = { x: event.clientX, y: event.clientY }
        if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId)
      }
    }} onPointerCancel={() => { pointer.current = null }} onPointerUp={event => {
      const start = pointer.current; pointer.current = null
      if (!start) return
      const dx = event.clientX - start.x, dy = event.clientY - start.y
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) select(dx < 0 ? 1 : -1)
    }}>
      <div className="dev">
        <div className="phone-side-buttons" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="phone-display">
          <div className="phone-status" aria-hidden="true"><span>9:41</span><div className="cam"><i /></div><span className="phone-status-icons"><Signal /><Wifi /><BatteryFull /></span></div>
          <div className="phone-scene-stack">{screens.map((screen, i) => <div className={'slide' + (index === i ? ' on' : '')} data-screen={screen.id} key={screen.id} aria-hidden={index !== i} inert={index !== i}>
            <div className="phone-toolbar"><Menu aria-hidden="true" /><span>{screen.heading}</span><MoreHorizontal aria-hidden="true" /></div>
            <div className="phone-content" tabIndex={index === i ? 0 : -1} role="region" aria-label={screen.title + ' 데모 내용'}>
              {screen.id === 'chat' ? <ChatScreen /> : screen.id === 'report' ? <ReportScreen /> : <LiveScreen />}
            </div>
          </div>)}</div>
          <div className="phone-composer-area"><span className="phone-context">{screens[index].title} <span>· MOCK</span></span><InternalLink className="phone-composer" href="/" aria-label="웹에서 TETH와 대화 시작"><span>시장에 대해 무엇이든 물어보세요</span><i aria-hidden="true"><ArrowUp size={13} /></i></InternalLink></div>
          <div className="phone-home" aria-hidden="true"><i /></div>
        </div>
      </div>
      <div className="phone-caption"><span className="phone-caption-title">{captions[index][0][languageIndex]}</span><span>{captions[index][1][languageIndex]}</span></div>
    </div>
    <div className="pager"><div className="preview-controls">
      <button className="preview-arrow" type="button" aria-label="이전 앱 화면" onClick={() => select(-1)}><ChevronLeft size={17} /></button>
      <div className="dots">{screens.map((screen, i) => <button type="button" key={screen.id} aria-label={screen.title + ' 화면 보기'} aria-pressed={index === i} onClick={() => setIndex(i)}><i className={i === index ? 'on' : ''} /></button>)}</div>
      <span className="count" aria-live={auto ? 'off' : 'polite'}>{index + 1} / 3</span>
      <button className="preview-arrow" type="button" aria-label="다음 앱 화면" onClick={() => select(1)}><ChevronRight size={17} /></button>
      {!reduceMotion && <button className="preview-pause" type="button" aria-label={paused ? '자동 재생 시작' : '자동 재생 일시 정지'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
    </div><span className="cap">{publicCopy.download.cap[languageIndex]}</span></div>
  </section>
}
