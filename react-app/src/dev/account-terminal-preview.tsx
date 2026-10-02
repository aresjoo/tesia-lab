import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '../client-restored-research.css'
import { ClientAccountTerminal, type ClientAccountTerminalEntry } from '../components/ClientAccountTerminal'
import { fixture } from './chart-workspace-fixture'
import './account-terminal-preview.css'
import { terminalMarketFixture } from './terminal-market-fixture'
import { marketPeriods, type TerminalMarketPresentation } from '../client-terminal-market'

// Development-only interaction fixture. Not in either public/internal build input.
const entries: readonly ClientAccountTerminalEntry[] = [
  { strategy: { id: 'fixture:btc', name: 'BTC 돌파 추종', symbol: 'BTC/USDT', market: '현물', version: 'v3.4', status: 'live', exchange: { id: 'binance', name: 'Binance', color: '#f0b90b', foreground: '#181a20' }, capitalLabel: '—' }, chart: fixture,
    context: <span>렌더러 검수용 합성 입력 · 실제 시세·백테스트 미연결</span>,
    agent: <p>선택한 전략의 공개 판단 기록을 받는 영역입니다. 현재 검수 입력에는 판단 기록이 없습니다.</p>,
    dashboard: <p>검증된 성과 지표를 받는 영역입니다. 값이 제공되지 않으면 수익률을 만들지 않습니다.</p>,
    completed: <p>차트에는 렌더러 검수용 BUY 2건·SELL 1건만 전달했습니다. 손익이나 완료 거래를 추정하지 않습니다.</p>,
  },
  { strategy: { id: 'fixture:eth', name: 'ETH 추세 추종', symbol: 'ETH/USDT', market: '현물', version: 'v2.1', status: 'off', exchange: { id: 'okx', name: 'OKX', color: '#e3e3e3', foreground: '#181a20' }, capitalLabel: '—' }, chart: null,
    context: <span>데이터 미공급 상태 검수</span>, agent: <p>ETH 전략의 판단 기록이 제공되지 않았습니다.</p>, dashboard: <p>ETH 전략의 성과 지표가 제공되지 않았습니다.</p>, completed: <p>ETH 전략의 체결 기록이 제공되지 않았습니다.</p>,
  },
]
export function Preview() {
  const [message, setMessage] = useState('')
  const marketCase = new URLSearchParams(location.search).get('market')
  const marketView: TerminalMarketPresentation = marketCase === 'stale' ? { ...terminalMarketFixture, binding: { ...terminalMarketFixture.binding, id: 'other-owner-strategy' } }
    : marketCase === 'loading' || marketCase === 'error' ? { ...terminalMarketFixture, quote: { state: marketCase }, info: { state: marketCase }, data: Object.fromEntries(marketPeriods.map(period => [period, { state: marketCase }])) }
    : marketCase === 'partial' ? { ...terminalMarketFixture, data: { '5m': terminalMarketFixture.data!['5m'] } } : terminalMarketFixture
  const shownEntries = marketCase !== null ? entries.map((entry, index) => index ? entry : { ...entry, strategy: { ...entry.strategy, market: '무기한' }, marketPresentation: marketView }) : entries
  return <main className="client-restored-research account-terminal-preview">
    <aside className="atp-notice">로컬 UI 검수 · 실제 계정·거래소/API 미연결 · 원본 구조를 순서대로 이식 중</aside>
    <ClientAccountTerminal entries={shownEntries} onNew={() => setMessage('새 전략 진입 콜백 확인')} onSelectionChange={() => setMessage('')}
      onFillSelect={(strategyId, fillId) => setMessage(`선택한 체결: ${strategyId} / ${fillId}`)}
      railFooter="실행 상태·전략 이름은 화면 검수용 예시입니다. 계정 잔액과 수익률은 생성하지 않습니다."
      renderBottom={(selected, scope) => [
        { id: 'fills', label: '체결 내역', content: <div className="atp-records">{(scope === 'all' || selected === 'fixture:btc') ? <table><caption>렌더러 검수용 입력</caption><thead><tr><th>체결 ID</th><th>방향</th><th>입력 가격</th></tr></thead><tbody>{fixture.fills.map(fill => <tr key={fill.id}><td>{fill.id}</td><td>{fill.side}</td><td>{fill.price}</td></tr>)}</tbody></table> : <p>이 전략의 체결 데이터는 제공되지 않았습니다.</p>}</div> },
        { id: 'source', label: '출처', content: <p className="atp-records">TEST_ONLY_PRICE_VIEW · 선택 {selected ?? '없음'} · 범위 {scope}</p> },
      ]} />
    {message && <p className="atp-feedback" role="status">{message}</p>}
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
