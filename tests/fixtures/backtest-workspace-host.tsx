import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientBacktestWorkspace } from '../../src/components/ClientBacktestWorkspace'
import type { PriceChartView } from '../../src/chart/price-chart-view'
import '../../src/client-restored-research.css'
import '../../src/dev/chart-workspace-preview.css'

export function mount(view: PriceChartView | null, options: { asyncSend?: boolean } = {}) {
  let calls = 0
  let settle: ((fail: boolean) => void) | null = null
  function Consumer({ view, messages }: { view: PriceChartView | null; messages: string[] }) {
    const [draft, setDraft] = useState('확인할 조건')
    return <ClientBacktestWorkspace view={view} title="매우 긴 전략 이름도 빠짐없이 확인할 수 있는 연구 기록" draft={draft} onDraftChange={setDraft} thread={<><p>보존되는 원래 대화</p>{messages.map((text, index) => <p key={index}>{text}</p>)}</>} onAsk={async text => {
      calls++
      if (options.asyncSend) await new Promise<void>((resolve, reject) => { settle = fail => fail ? reject(new Error('TEST_ONLY_PRIVATE_ERROR')) : resolve() })
      setDraft(value => value === text ? '' : value)
    }} onClose={() => {}} />
  }
  const app = document.getElementById('root')!
  app.hidden = true
  const host = document.createElement('main')
  host.className = 'client-restored-research bw-preview'
  host.style.zIndex = '9999'
  document.body.append(host)
  const root = createRoot(host)
  const render = (next: PriceChartView | null, messages: string[] = []) => root.render(<StrictMode><Consumer view={next} messages={messages} /></StrictMode>)
  render(view)
  return { render, get calls() { return calls }, settle: (fail: boolean) => { settle?.(fail) }, unmount: () => { root.unmount(); host.remove(); app.hidden = false } }
}
