import { useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import { NativeJobActivity } from '../../src/internal-poc/NativeJobActivity'
import type { NativeJob } from '../../src/internal-poc/native-service-api'
import type { InternalPocPresentation } from '../../src/internal-poc/InternalPocApp'

/** Display-only controlled observations. No HTTP, elapsed-time producer or jobs
 * are started here. The test supplies the existing contract fixture snapshots. */
export function mountConversationGrowth(container: HTMLElement, initialJob: NativeJob) {
  const controls = {
    parentCommits: 0, sends: 0,
    growParent: () => {}, growChild: () => {},
    show: (visible: boolean) => { void visible },
    job: (job: NativeJob) => { void job },
  }
  function Outcome({ parentRows }: { parentRows: number }) {
    const [childRows, setChildRows] = useState(0), [job, setJob] = useState(initialJob)
    controls.growChild = () => setChildRows(value => value + 8)
    controls.job = setJob
    return <div data-growth-outcome>
      <NativeJobActivity job={job} />
      {Array.from({ length: parentRows + childRows }, (_, index) => <p key={index}>명시 공급된 결과 설명 {index + 1}</p>)}
      <p data-growth-tail>공급된 본문 끝</p>
    </div>
  }
  function Shell() {
    const [input, setInput] = useState('보존할 실제 셸 초안'), [rows, setRows] = useState(0), [visible, setVisible] = useState(true)
    useLayoutEffect(() => { controls.parentCommits++ })
    controls.growParent = () => setRows(value => value + 8)
    controls.show = setVisible
    const state: InternalPocPresentation = {
      phase: 'ready', messages: [{ id: 'growth-question', role: 'user', text: '기존 질문' }],
      input, onInput: setInput, busy: false, inputDisabled: false, source: 'service',
      sessionState: 'ANONYMOUS', recovery: null, quickReplies: [], issue: null,
      workflow: <div style={{ height: 1200 }}>높이가 있는 기존 문서 fixture</div>,
      outcome: <Outcome parentRows={rows} />,
      onSend: async () => { controls.sends++ }, onReset: () => {}, onRecover: undefined, onLogout: undefined,
    }
    return <div hidden={!visible} style={{ height: '100dvh' }}><ClientServiceExperience state={state} accountScope="growth-fixture" /></div>
  }
  createRoot(container).render(<Shell />)
  return controls
}
