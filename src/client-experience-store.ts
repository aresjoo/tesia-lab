/** Local UI projection of tesia-lab acccc7f. NOT a conversation/API contract.
 * Only non-secret conversation fixtures are persisted, never credentials.
 * Source-authored fallback copy is kept separate from future service events.
 */
import { forgetMockResearchPreview, getMockResearchPreview } from './mock-research-preview'
import { parsePercentageEdit } from './client-percentage-input'
import { forgetResearchDocumentMemory } from './client-research-cache'
import { forgetDelegationUiMemory } from './client-delegation-fixtures'
import { isTethActionChip, validateProb, type TethActionChip } from './teth-chips-schema'
import { validateWorkModel } from './teth-model-routing'
import type { TethAiMessage } from './teth-ai-client'

export type ConversationPhase = 'mode' | 'pair' | 'timeframe' | 'risk' | 'take' | 'plan'
export type ConversationViewport = { top: number; spacer: number; follow: boolean; questionKey: string }
/** 실 AI 턴의 사고 패널 스텝(번역된 tool 활동 포함). 서버 권위 상태가 아니라 스트림 관찰의 투영이다. */
export type AiTraceStep = { id: string; title: string; status: 'running' | 'done' | 'stopped'; detail?: string }
export type AiFlowStatus = 'running' | 'done' | 'stopped'
/** say/work 인터리브 답변의 순서 있는 세그먼트. work 는 연출 전용이 아니라
 * 향후 실제 tool use 결과의 그릇이다(어댑터 교체 전제 — PR2 WorkBlock 참조). */
export type TethFlowSegment =
  | { kind: 'say'; id: string; text: string; ack?: true }
  | { kind: 'work'; id: string; model: string | null; role: string; items: { id: string; label: string; status: AiFlowStatus }[]; status: AiFlowStatus }
  | { kind: 'prob'; id: string; up: number; down: number }
export type ClientTurn = {
  id: string; question: string; answer: string; fullAnswer: string
  startedAt: number; finishedAt?: number; status: 'running' | 'done' | 'stopped'
  suggestions: string[]; phase: ConversationPhase
  /** 'ai' = 실 스트리밍 턴. 없으면 기존 스크립트(mock) 턴 — tick 리빌 경로를 탄다. */
  source?: 'ai'
  thinking?: string
  /** say/work 인터리브 턴의 렌더 정본. 없으면 구( trace/answer/prob.offset ) 렌더 경로. */
  flow?: TethFlowSegment[]
  trace?: AiTraceStep[]
  prob?: { up: number; down: number; offset: number }
  actions?: TethActionChip[]
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
const stopTrace = (trace?: AiTraceStep[]) => trace?.map(step => step.status === 'running' ? { ...step, status: 'stopped' as const } : step)

/** flow 의 running 상태를 일괄 정착시킨다 (완료=done, 중지=stopped). */
const settleFlow = (flow: TethFlowSegment[] | undefined, to: 'done' | 'stopped') => flow?.map(segment =>
  segment.kind === 'work'
    ? { ...segment, status: segment.status === 'running' ? to : segment.status, items: segment.items.map(item => item.status === 'running' ? { ...item, status: to } : item) }
    : segment)

function sanitizeFlow(flow: unknown): TethFlowSegment[] | undefined {
  if (!Array.isArray(flow)) return undefined
  const statuses = ['running', 'done', 'stopped']
  const clean: TethFlowSegment[] = []
  for (const segment of flow) {
    if (!segment || typeof segment !== 'object' || typeof segment.id !== 'string') continue
    if (segment.kind === 'say' && typeof segment.text === 'string') {
      clean.push({ kind: 'say', id: segment.id, text: segment.text, ...(segment.ack === true ? { ack: true as const } : {}) })
    } else if (segment.kind === 'prob') {
      const prob = validateProb(segment.up, segment.down)
      if (prob) clean.push({ kind: 'prob', id: segment.id, ...prob })
    } else if (segment.kind === 'work' && typeof segment.role === 'string' && Array.isArray(segment.items) && statuses.includes(segment.status)) {
      clean.push({
        kind: 'work', id: segment.id, role: segment.role.slice(0, 40), status: segment.status,
        model: validateWorkModel(segment.model),
        items: segment.items.filter((item: unknown): item is { id: string; label: string; status: AiFlowStatus } => {
          const step = item as { id?: unknown; label?: unknown; status?: unknown }
          return Boolean(step) && typeof step.id === 'string' && typeof step.label === 'string' && statuses.includes(step.status as string)
        }),
      })
    }
  }
  return clean.length ? clean : undefined
}

/** 복원 스냅샷의 AI 필드는 거부 대신 정화한다 — 변조·구버전 값이 렌더로 새지 않게. */
function sanitizeAiFields(turn: ClientTurn): ClientTurn {
  const clean = { ...turn }
  if (clean.source !== 'ai') {
    delete clean.source; delete clean.thinking; delete clean.trace; delete clean.prob; delete clean.actions
    return clean
  }
  if (typeof clean.thinking !== 'string') delete clean.thinking
  const flow = sanitizeFlow(clean.flow)
  if (flow) clean.flow = flow
  else delete clean.flow
  clean.trace = Array.isArray(clean.trace)
    ? clean.trace.filter(step => step && typeof step === 'object' && typeof step.id === 'string' && typeof step.title === 'string' && ['running', 'done', 'stopped'].includes(step.status))
    : []
  const prob = clean.prob && typeof clean.prob === 'object' ? validateProb(clean.prob.up, clean.prob.down) : null
  if (prob && Number.isFinite(clean.prob?.offset) && (clean.prob?.offset ?? -1) >= 0) clean.prob = { ...prob, offset: Math.min(Math.floor(clean.prob!.offset), clean.answer.length) }
  else delete clean.prob
  const actions = Array.isArray(clean.actions) ? clean.actions.filter(isTethActionChip).slice(0, 2) : []
  if (actions.length) clean.actions = actions
  else delete clean.actions
  return clean
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
        const turns = validTurns.map((rawTurn, index): ClientTurn => {
          const turn = sanitizeAiFields(rawTurn)
          // Only the latest local fixture turn can stream. Preserve incomplete
          // text in inconsistent older records without inventing a completion.
          // A real AI stream can never resume after reload — demote it silently
          // (expected teardown, not corruption), keeping partial answer/thinking.
          if (turn.status === 'running' && (turn.source === 'ai' || index !== validTurns.length - 1 || !turn.fullAnswer)) {
            if (turn.source !== 'ai') recoveryWarning = true
            return { ...turn, status: 'stopped', finishedAt: Number.isFinite(turn.finishedAt) ? turn.finishedAt : turn.startedAt, trace: stopTrace(turn.trace), flow: settleFlow(turn.flow, 'stopped'), fullAnswer: turn.source === 'ai' ? turn.answer : turn.fullAnswer }
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

// Auto titles follow confirmed conditions; user-renamed titles stay untouched.
function autoTitle(s: ClientSession): string {
  if (s.renamed) return s.title
  return s.pair && s.mode ? `${s.pair.startsWith('ETH') ? 'ETH' : 'BTC'} ${s.mode === 'trend' ? 'Trend' : 'Pullback'} Strategy` : (s.idea.slice(0, 40) || s.title)
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
  let lastPersist = Date.now()
  function persist() {
    window.clearTimeout(saveTimer)
    lastPersist = Date.now()
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
    // 스트리밍처럼 250ms 안에 계속 갱신되는 구간에서도 디바운스가 영원히 굶지 않게
    // 2초를 넘기면 강제로 한 번 내려쓴다 — 탭 크래시 시 유실 창을 상한한다.
    if (immediate || Date.now() - lastPersist > 2000) persist()
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
    stop: (id: string) => update(id, s => ({ ...s, turns: s.turns.map(t => t.status === 'running' ? { ...t, status: 'stopped', finishedAt: Date.now(), trace: stopTrace(t.trace), flow: settleFlow(t.flow, 'stopped'), fullAnswer: t.source === 'ai' ? t.answer : t.fullAnswer } : t) }), true),
    send: (question: string, options?: { ai?: boolean }): { sessionId: string; turnId: string; messages: TethAiMessage[] } | null => {
      const text = question.trim()
      if (!text) return null
      let session = snapshot.sessions.find(s => s.id === snapshot.currentId)
      if (session?.turns.some(t => t.status === 'running')) return null
      if (!session) {
        session = { id: crypto.randomUUID(), title: '새 전략', renamed: false, idea: text, draft: '', pair: '', mode: '', timeframe: '', risk: '', takeProfit: '', researchStatus: '초안', phase: 'mode', turns: [], updatedAt: Date.now(), workspace: 'conversation', tradingReady: false }
        snapshot = { ...snapshot, sessions: [session, ...snapshot.sessions], currentId: session.id, homeDraft: '' }
      }
      const next = { ...session, draft: '', updatedAt: Date.now() }
      if (options?.ai) {
        // 실 AI 턴: 스크립트 응답·퍼널 단계 진행 없이 빈 턴을 만들고, 요청 재료를 돌려준다.
        const turnId = crypto.randomUUID()
        next.turns = [...session.turns, { id: turnId, question: text, answer: '', fullAnswer: '', suggestions: [], phase: session.phase, status: 'running', startedAt: Date.now(), source: 'ai', thinking: '', flow: [] }]
        update(next.id, () => next, true)
        const messages: TethAiMessage[] = []
        for (const turn of session.turns) {
          // 답이 빈 턴(응답 전 중지·리로드 강등)은 질문째 제외한다 — user 역할이
          // 연속되면 API가 400으로 거부해 세션 전체가 폴백으로 강등되기 때문이다.
          if (!turn.answer) continue
          // 저장된 answer 는 파서를 거친 태그 제거 본문뿐이라 재전송해도 안전하다.
          messages.push({ role: 'user', content: turn.question })
          messages.push({ role: 'assistant', content: turn.answer })
        }
        messages.push({ role: 'user', content: text })
        return { sessionId: next.id, turnId, messages }
      }
      const reply = sourceReply(next, text)
      next.phase = reply.phase
      next.turns = [...session.turns, { id: crypto.randomUUID(), question: text, answer: '', fullAnswer: reply.answer, suggestions: reply.suggestions, phase: reply.phase, status: 'running', startedAt: Date.now() }]
      update(next.id, () => next, true)
      return null
    },
    // 아래 세 메서드는 실 AI 턴 전용이다. running 가드가 중지/삭제 뒤 늦게 도착한
    // 스트림 이벤트를 무해화한다 — 이벤트 순서를 신뢰하지 않는다.
    patchAiTurn: (sessionId: string, turnId: string, patch: Partial<Pick<ClientTurn, 'thinking' | 'answer' | 'flow' | 'trace' | 'prob' | 'actions' | 'suggestions'>>) => {
      const turn = snapshot.sessions.find(s => s.id === sessionId)?.turns.find(t => t.id === turnId)
      if (!turn || turn.source !== 'ai' || turn.status !== 'running') return
      update(sessionId, s => ({ ...s, updatedAt: Date.now(), turns: s.turns.map(t => t.id === turnId ? { ...t, ...patch } : t) }))
    },
    finishAiTurn: (sessionId: string, turnId: string) => {
      const turn = snapshot.sessions.find(s => s.id === sessionId)?.turns.find(t => t.id === turnId)
      if (!turn || turn.source !== 'ai' || turn.status !== 'running') return
      update(sessionId, s => ({
        ...s, title: autoTitle(s), updatedAt: Date.now(),
        turns: s.turns.map(t => t.id === turnId ? { ...t, status: 'done' as const, finishedAt: Date.now(), fullAnswer: t.answer, flow: settleFlow(t.flow, 'done'), trace: t.trace?.map(step => step.status === 'running' ? { ...step, status: 'done' as const } : step) } : t),
      }), true)
    },
    failAiTurn: (sessionId: string, turnId: string, failMode: 'fallback' | 'stop') => {
      const session = snapshot.sessions.find(s => s.id === sessionId)
      const turn = session?.turns.find(t => t.id === turnId)
      if (!session || !turn || turn.source !== 'ai' || turn.status !== 'running') return
      if (failMode === 'stop') {
        update(sessionId, s => ({ ...s, turns: s.turns.map(t => t.id === turnId ? { ...t, status: 'stopped' as const, finishedAt: Date.now(), trace: stopTrace(t.trace), flow: settleFlow(t.flow, 'stopped'), fullAnswer: t.answer } : t) }), true)
        return
      }
      // 프록시 미연결/실패: 같은 질문을 스크립트 응답으로 대체하고 tick 리빌에 넘긴다.
      // 실패한 AI 턴을 제외한 뒤 sourceReply 를 불러야 mock send 시점과 turns.length 가
      // 같아져 첫 턴의 인트로 리드 문장이 보존된다.
      const next = { ...session, updatedAt: Date.now(), turns: session.turns.filter(t => t.id !== turnId) }
      const reply = sourceReply(next, turn.question)
      next.phase = reply.phase
      next.turns = [...next.turns, { id: turn.id, question: turn.question, answer: '', fullAnswer: reply.answer, suggestions: reply.suggestions, phase: reply.phase, status: 'running' as const, startedAt: Date.now() }]
      update(sessionId, () => next, true)
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
        // 실 AI 턴은 스트림이 답을 채운다 — 산술 리빌이 델타를 덮어쓰지 않게 건너뛴다.
        if (!turn || turn.status !== 'running' || turn.source === 'ai') return s
        const length = Math.max(0, Math.floor((now - turn.startedAt - 1800) / 26))
        const answer = turn.fullAnswer.slice(0, length)
        const done = answer === turn.fullAnswer
        if (answer === turn.answer && !done) return s
        changed = true
        settled ||= done
        const title = done ? autoTitle(s) : s.title
        return { ...s, title, turns: s.turns.map(t => t.id === turn.id ? { ...t, answer, status: done ? 'done' as const : 'running' as const, finishedAt: done ? t.startedAt + 1800 + t.fullAnswer.length * 26 : undefined } : t) }
      })
      // Terminal transitions are durable immediately; only streaming is batched.
      if (changed) emit({ ...snapshot, sessions }, settled)
    },
  }
  return store
}
