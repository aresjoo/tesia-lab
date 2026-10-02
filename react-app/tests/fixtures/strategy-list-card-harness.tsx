/* Isolated Playwright mount; extreme presentation values are test-only. */
import { createRoot } from 'react-dom/client'
import { ClientStrategyListCard } from '../../src/components/ClientStrategyListCard'
import '../../src/client-strategy-sharing.css'

export function mountListCards() {
  document.getElementById('root')?.remove()
  const root = document.createElement('main'); root.id = 'list-card-test-root'
  root.className = 'client-strategy-sharing'; document.body.append(root)
  const series = [[1, 1, .9, .85, 1, 1, 1.3], [1, .95, 1.1, .8], [1, 1, 1], null]
  createRoot(root).render(<div className="strategy-list-container"><div className="strategy-list-grid">{series.map((values, index) => <ClientStrategyListCard
    key={index} title={`사용자 입력 아주 긴 전략 이름 <script> ${index} ${'길게 이어지는 원문'.repeat(8)}`}
    asset="BTC / USDT" followers={index === 3 ? undefined : 123456789}
    performance={values ? { values, percent: index === 0 ? 123456.78 : index === 1 ? -20 : 0, start: 0, end: 30 } : null}
    location={{ nick: String(index), period: 'all' }} onNavigate={() => {}}
  />)}</div></div>)
}
