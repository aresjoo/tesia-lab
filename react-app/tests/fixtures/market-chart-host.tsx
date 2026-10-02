// Synthetic presentation input only. No server/market-data authority.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ClientResponseSequence } from '../../src/components/ClientResponseSequence'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import type { MarketChartPresentation, MarketChartRequest } from '../../src/client-market-chart-presentation'
import { setClientPreference, type ClientLanguage } from '../../src/client-preferences'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-reference.css'

export function mount(initial: MarketChartPresentation, options: { native?: boolean; research?: boolean; connected?: boolean } = {}) {
  const root = createRoot(document.getElementById('fixture')!)
  let presentation = initial, input = '계속 작성하던 질문', owner = 'owner-a', portOwner = 'owner-a'
  let duplicate = false, longAnswer = false
  const requests: { request: MarketChartRequest; signal: AbortSignal; resolve: (value: boolean) => void; reject: () => void }[] = []
  const actions = { request: (request: MarketChartRequest, signal: AbortSignal) => new Promise<boolean>((resolve, reject) => { requests.push({ request, signal, resolve, reject: () => reject(new Error('TEST_ONLY_SUPPLY_FAILURE')) }) }) }
  const render = () => {
    const blocks = [{ id: 'market-chart-a', kind: 'market-chart' as const, presentation }]
    if (duplicate) blocks.push({ id: 'market-chart-b', kind: 'market-chart', presentation })
    const answerBlocks = [...blocks, ...(longAnswer ? [{ id: 'long-answer', kind: 'text' as const, status: 'done' as const, text: Array.from({ length: 40 }, (_, i) => `읽고 있는 문단 ${i + 1}. 이 문단의 화면 위치는 위쪽 시나리오가 도착해도 유지되어야 합니다.`).join('\n\n') }] : [])]
    flushSync(() => root.render(<StrictMode>{options.native ? <ClientServiceExperience
      accountScope={owner} nativeAccounts
      marketChartActions={options.connected === false ? undefined : { scope: portOwner, ...actions }}
      researchPresentation={options.research ? { scope: owner, data: { scopeId: 'research-a', status: 'done' } } : undefined}
      state={{ phase: 'ready', sessionState: 'AUTHENTICATED', title: '시장 대화', source: 'service', input,
        busy: false, inputDisabled: false, recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
        messages: [{ id: 'user-1', role: 'user', text: '가격 흐름을 보여주세요.', ...(options.research ? { researchThread: { scopeId: 'research-a', documentId: 'plan' } } : {}) }, { id: presentation.binding.messageId, role: 'assistant', text: '관측된 가격입니다.', responseBlocks: [{ id: 'answer', kind: 'text', text: '관측된 가격입니다.', status: 'done' }, ...answerBlocks], ...(options.research ? { researchThread: { scopeId: 'research-a', documentId: 'plan' } } : {}) }],
        onInput: value => { input = value; render() }, onSend: async () => {}, onReset: () => false,
      }}/>
      : <main className="client-lab-conversation" style={{ height: 'auto', minHeight: '100dvh', padding: 16, display: 'block' }}><p>검수용 합성 관측값</p><div style={{ maxWidth: 820, margin: 'auto' }}><ClientResponseSequence source="mock" blocks={blocks} chartActions={options.connected === false ? undefined : actions}/></div></main>}</StrictMode>))
  }
  setClientPreference('language', 'ko')
  render()
  return {
    requests,
    update(next: MarketChartPresentation) { presentation = next; render() },
    duplicate() { duplicate = true; render() },
    longAnswer() { longAnswer = true; render() },
    owner(value: string) { owner = value; render() },
    port(value: string) { portOwner = value; render() },
    language(value: ClientLanguage) { flushSync(() => setClientPreference('language', value)) },
    unmount() { root.unmount() },
  }
}
