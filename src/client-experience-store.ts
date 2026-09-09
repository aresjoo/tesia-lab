/** Local UI projection of tesia-lab acccc7f. NOT a conversation/API contract.
 * Only non-secret conversation fixtures are persisted, never credentials.
 * Source-authored fallback copy is kept separate from future service events.
 */
import { forgetMockResearchPreview, getMockResearchPreview } from './mock-research-preview'
import { parsePercentageEdit } from './client-percentage-input'
import { forgetResearchDocumentMemory } from './client-research-cache'
import { forgetDelegationUiMemory } from './client-delegation-fixtures'

export type ConversationPhase = 'mode' | 'pair' | 'timeframe' | 'risk' | 'take' | 'plan'
export type ConversationViewport = { top: number; spacer: number; follow: boolean; questionKey: string }
export type ClientTurn = {
  id: string; question: string; answer: string; fullAnswer: string
  startedAt: number; finishedAt?: number; status: 'running' | 'done' | 'stopped'
  suggestions: string[]; phase: ConversationPhase
}
export type ClientSession = {
  id: string; title: string; renamed: boolean; idea: string; draft: string
  pair: string; mode: 'dip' | 'trend' | ''; timeframe: string; risk: string; takeProfit: string
  researchStatus: '초안' | '진행 중' | '검토 필요'
  paper?: boolean
  phase: ConversationPhase; turns: ClientTurn[]; updatedAt: number
  workspace: 'conversation' | 'research' | 'delegation'; tradingReady: boolean
  conversationViewport?: ConversationViewport
}
type Snapshot = { sessions: ClientSession[]; currentId: string | null; homeDraft: string; storageError: boolean; recoveryWarning?: boolean }
const KEY = 'teth-client-experience'
const validTurn = (x: unknown): x is ClientTurn => {
  if (!x || typeof x !== 'object') return false
  const t = x as ClientTurn
  return typeof t.id === 'string' && typeof t.question === 'string' && typeof t.answer === 'string' && typeof t.fullAnswer === 'string' && Number.isFinite(t.startedAt) && ['running','done','stopped'].includes(t.status) && Array.isArray(t.suggestions) && t.suggestions.every(s => typeof s === 'string')
}
const validSession = (x: unknown): x is ClientSession => {
  if (!x || typeof x !== 'object') return false
  const s = x as ClientSession
  return ['id','title','idea','draft','pair','mode','phase','timeframe','risk'].every(k => typeof s[k as keyof ClientSession] === 'string') && Array.isArray(s.turns) && ['conversation','research','delegation'].includes(s.workspace) && Number.isFinite(s.updatedAt)
}
function read(): Snapshot {
  try {
    const x = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (x && Array.isArray(x.sessions)) {
      // A damaged record must not discard unrelated conversations or the home draft.
      let recoveryWarning = x.recoveryWarning === true
      const sessions: ClientSession[] = x.sessions.filter(validSession).map((s: ClientSession) => {
        const validTurns = s.turns.filter(validTurn)
        if (validTurns.length !== s.turns.length) recoveryWarning = true
        const turns = validTurns.map((turn, index): ClientTurn => {
          // Only the latest local fixture turn can stream. Preserve incomplete
          // text in inconsistent older records without inventing a completion.
          if (turn.status === 'running' && (index !== validTurns.length - 1 || !turn.fullAnswer)) {
            recoveryWarning = true
            return { ...turn, status: 'stopped', finishedAt: Number.isFinite(turn.finishedAt) ? turn.finishedAt : turn.startedAt }
          }
          return turn
        })
        return { ...s, turns, takeProfit: typeof s.takeProfit === 'string' ? s.takeProfit : '', researchStatus: ['초안','진행 중','검토 필요'].includes(s.researchStatus) ? s.researchStatus : '초안' }
      })
      return { sessions, currentId: typeof x.currentId === 'string' && sessions.some(s => s.id === x.currentId) ? x.currentId : null, homeDraft: typeof x.homeDraft === 'string' ? x.homeDraft : '', storageError: false, recoveryWarning: recoveryWarning || sessions.length !== x.sessions.length }
    }
  } catch { return { sessions: [], currentId: null, homeDraft: '', storageError: true } }
  return { sessions: [], currentId: null, homeDraft: '', storageError: false }
}

// Source gConvInterpret → gAskMode/gAskPair/gAskTf/gAskRisk/gMakePlan.
function sourceReply(s: ClientSession, question: string): { answer: string; suggestions: string[]; phase: ConversationPhase } {
  if (/이더|eth/i.test(question)) s.pair = 'ETH/USDT'
  else if (/비트|btc/i.test(question)) s.pair = 'BTC/USDT'
  if (/떨어|하락|급락|반등|저가|눌림|물타|내려/.test(question)) s.mode = 'dip'
  else if (/오르|추세|상승|돌파/.test(question)) s.mode = 'trend'
  if (/하루|일봉/.test(question)) s.timeframe = '일봉'
  else if (/1시간|한 시간/.test(question)) s.timeframe = '1시간봉'
  // Source fixture choices stay 2/3/5%; never extract the "2%" tail of "12%".
  const risk = parsePercentageEdit(question === '−3% (표준)' ? '−3%' : question)
  if (s.phase === 'risk' && risk.kind === 'value' && [2, 3, 5].includes(Math.abs(risk.value))) s.risk = `−${Math.abs(risk.value)}%`
  if (s.phase === 'take' && question === '익절 없이 진행') s.takeProfit = '미설정'
  else if (s.phase === 'take' && question === '익절 +8% 설정') s.takeProfit = '+8%'
  let lead = s.turns.length ? '' : `아이디어를 확인했습니다.${s.pair ? ` 대상은 ${s.pair}로 이해했습니다.` : ''} 검증 가능한 조건으로 만들기 위해 몇 가지를 확인합니다.\n\n`
  if (/차이 설명/.test(question)) lead = '반등 매수는 과매도 후 회복을 노립니다, 거래가 적고 느립니다. 추세 진입은 상승 확인 후 따라갑니다, 거래가 잦고 빠릅니다.\n\n'
  if (!s.mode) return { answer: lead + '진입 방식을 선택하세요.', suggestions: ['내려왔을 때 반등 매수', '오르는 흐름에 진입', '차이 설명'], phase: 'mode' }
  if (!s.pair) return { answer: lead + '대상 자산을 선택하세요.', suggestions: ['BTC/USDT', 'ETH/USDT'], phase: 'pair' }
  if (!s.timeframe) return { answer: lead + '확인 주기를 선택하세요. 짧을수록 거래가 잦아집니다.', suggestions: ['1시간', '하루 1회'], phase: 'timeframe' }
  if (!s.risk) return { answer: '1회 거래의 손실 한도를 선택하세요. 이 선에서 자동 손절합니다.', suggestions: ['−2%', '−3% (표준)', '−5%'], phase: 'risk' }
  if (!s.takeProfit) return { answer: '익절 기준이 없습니다. 수익 확정 지점이 없으면 낙폭이 커질 수 있습니다.', suggestions: ['익절 +8% 설정', '익절 없이 진행'], phase: 'take' }
  return { answer: '조건을 정리했습니다. 연구 계획을 생성했습니다, 검토 후 연구를 시작하세요.', suggestions: [], phase: 'plan' }
}

export function createClientExperienceStore() {
  let snapshot = read()
  const viewports = new Map<string, ConversationViewport>()
  for (const session of snapshot.sessions) {
    const view = session.conversationViewport
    if (view && Number.isFinite(view.top) && view.top >= 0 && Number.isFinite(view.spacer) && view.spacer >= 0 && typeof view.follow === 'boolean' && typeof view.questionKey === 'string') viewports.set(session.id, view)
  }
  const listeners = new Set<() => void>()
  let saveTimer: number | undefined
  function persist() {
    window.clearTimeout(saveTimer)
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...snapshot, sessions: snapshot.sessions.map(s => ({ ...s, conversationViewport: viewports.get(s.id) })), storageError: false }))
      if (snapshot.storageError) { snapshot = { ...snapshot, storageError: false }; listeners.forEach(fn => fn()) }
    }
    catch { if (!snapshot.storageError) { snapshot = { ...snapshot, storageError: true }; listeners.forEach(fn => fn()) } }
  }
  function emit(next: Snapshot, immediate = false) {
    snapshot = next
    listeners.forEach(fn => fn())
    window.clearTimeout(saveTimer)
    if (immediate) persist()
    else saveTimer = window.setTimeout(persist, 250)
  }
  function update(id: string, fn: (s: ClientSession) => ClientSession, immediate = false) {
    emit({ ...snapshot, sessions: snapshot.sessions.map(s => s.id === id ? fn(s) : s) }, immediate)
  }
  const store = {
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    getSnapshot: () => snapshot,
    flush: persist,
    dismissRecovery: () => emit({ ...snapshot, recoveryWarning: false }, true),
    conversationViewport: (id: string) => viewports.get(id),
    saveConversationViewport: (id: string, view: ConversationViewport) => {
      if (!snapshot.sessions.some(s => s.id === id)) return
      viewports.set(id, view)
      // Scroll changes do not rerender the conversation or write on every frame.
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(persist, 250)
    },
    home: () => emit({ ...snapshot, currentId: null }, true),
    select: (id: string) => { if (snapshot.sessions.some(s => s.id === id)) emit({ ...snapshot, currentId: id }, true) },
    draft: (text: string) => snapshot.currentId ? update(snapshot.currentId, s => ({ ...s, draft: text })) : emit({ ...snapshot, homeDraft: text }),
    rename: (id: string, title: string) => { if (title.trim()) update(id, s => ({ ...s, title: title.trim().slice(0, 120), renamed: true }), true) },
    remove: (id: string) => {
      if (!snapshot.sessions.some(s => s.id === id)) return false
      viewports.delete(id)
      forgetResearchDocumentMemory(id)
      forgetDelegationUiMemory(id)
      forgetMockResearchPreview(id)
      forgetMockResearchPreview(`restored:${id}`)
      let cleaned = true
      try {
        for (const prefix of ['teth-client-research-documents:', 'teth-research-preview:', 'teth-research-preview:restored:', 'teth:client-delegation:']) sessionStorage.removeItem(prefix + id)
      } catch { cleaned = false }
      emit({ ...snapshot, sessions: snapshot.sessions.filter(s => s.id !== id), currentId: snapshot.currentId === id ? null : snapshot.currentId }, true)
      return cleaned && !snapshot.storageError
    },
    researchStatus: (id: string, researchStatus: ClientSession['researchStatus']) => { if (snapshot.sessions.find(s => s.id === id)?.researchStatus !== researchStatus) update(id, s => ({ ...s, researchStatus }), true) },
    paper: (id: string, paper: boolean) => { if (Boolean(snapshot.sessions.find(s => s.id === id)?.paper) !== paper) update(id, s => ({ ...s, paper }), true) },
    workspace: (id: string, workspace: ClientSession['workspace']) => update(id, s => ({ ...s, workspace }), true),
    tradingReady: (id: string) => update(id, s => ({ ...s, tradingReady: true }), true),
    stop: (id: string) => update(id, s => ({ ...s, turns: s.turns.map(t => t.status === 'running' ? { ...t, status: 'stopped', finishedAt: Date.now() } : t) }), true),
    send: (question: string) => {
      const text = question.trim()
      if (!text) return
      let session = snapshot.sessions.find(s => s.id === snapshot.currentId)
      if (session?.turns.some(t => t.status === 'running')) return
      if (!session) {
        session = { id: crypto.randomUUID(), title: '새 전략', renamed: false, idea: text, draft: '', pair: '', mode: '', timeframe: '', risk: '', takeProfit: '', researchStatus: '초안', phase: 'mode', turns: [], updatedAt: Date.now(), workspace: 'conversation', tradingReady: false }
        snapshot = { ...snapshot, sessions: [session, ...snapshot.sessions], currentId: session.id, homeDraft: '' }
      }
      const next = { ...session, draft: '', updatedAt: Date.now() }
      const reply = sourceReply(next, text)
      next.phase = reply.phase
      next.turns = [...session.turns, { id: crypto.randomUUID(), question: text, answer: '', fullAnswer: reply.answer, suggestions: reply.suggestions, phase: reply.phase, status: 'running', startedAt: Date.now() }]
      update(next.id, () => next, true)
    },
    tick: (now: number) => {
      let changed = false
      let settled = false
      const sessions = snapshot.sessions.map(s => {
        // Keep the research list current even while its document is unmounted.
        if (s.researchStatus === '진행 중') {
          const research = getMockResearchPreview(`restored:${s.id}`)
          research.tick(now)
          if (research.getSnapshot().status === 'completed') { s = { ...s, researchStatus: '검토 필요' }; changed = true; settled = true }
        }
        const turn = s.turns.at(-1)
        if (!turn || turn.status !== 'running') return s
        const length = Math.max(0, Math.floor((now - turn.startedAt - 1800) / 26))
        const answer = turn.fullAnswer.slice(0, length)
        const done = answer === turn.fullAnswer
        if (answer === turn.answer && !done) return s
        changed = true
        settled ||= done
        // Auto titles follow confirmed conditions; user-renamed titles stay untouched.
        const title = !s.renamed && done ? (s.pair && s.mode ? `${s.pair.startsWith('ETH') ? 'ETH' : 'BTC'} ${s.mode === 'trend' ? 'Trend' : 'Pullback'} Strategy` : s.idea.slice(0, 40)) : s.title
        return { ...s, title, turns: s.turns.map(t => t.id === turn.id ? { ...t, answer, status: done ? 'done' as const : 'running' as const, finishedAt: done ? t.startedAt + 1800 + t.fullAnswer.length * 26 : undefined } : t) }
      })
      // Terminal transitions are durable immediately; only streaming is batched.
      if (changed) emit({ ...snapshot, sessions }, settled)
    },
  }
  return store
}
