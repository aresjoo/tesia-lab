/* 실 AI 턴 오케스트레이션: 프록시 SSE → (채널1) thinking 프로즈, (채널2) say/work
 * 태그 파서 → flow 세그먼트 → 스토어 패치. ack 초경량 병렬 호출이 첫 반응 문장을
 * 먼저 흘린다. 화면 표시용 투영이며 서버 권위 상태가 아니다. 스토어의 running
 * 가드와 이 모듈의 종료 플래그가 중복 방어한다 — 이벤트 순서를 신뢰하지 않는다.
 *
 * 로드맵: 1단계(현재)=본 호출 lite(도구 없음), work 는 연출 + 추론 행위 라벨 한정 /
 * 2단계=실 멀티모델 라우팅과 model 라벨 1:1 / 3단계=tool use 연동으로 tool 이벤트가
 * WorkBlock 어댑터를 통해 같은 flow 채널에 합류(수량·데이터 영수증 해금). */
import { createTethStreamParser } from './teth-stream-parser'
import { parseAskJson, parseChipsJson, validateProb } from './teth-chips-schema'
import { validateWorkModel } from './teth-model-routing'
import { aggregateToolActivity, describeToolEvent } from './teth-tool-display'
import { TETH_ACK_PROMPT } from './prompts/teth-system'
import { streamTethChat, type TethAiMessage } from './teth-ai-client'
import type { ClientTurn, TethFlowSegment } from './client-experience-store'

type AiTurnPatch = Partial<Pick<ClientTurn, 'thinking' | 'answer' | 'flow' | 'trace' | 'prob' | 'actions' | 'suggestions'>>

export type AiStorePort = {
  patchAiTurn(sessionId: string, turnId: string, patch: AiTurnPatch): void
  finishAiTurn(sessionId: string, turnId: string): void
  failAiTurn(sessionId: string, turnId: string, failMode: 'fallback' | 'stop'): void
}

const PATCH_FLUSH_MS = 80    // 토큰마다 스토어 전체 커밋을 만들지 않기 위한 표시 스로틀
const IDLE_LIMIT_MS = 60_000 // 이벤트가 이만큼 끊기면 스트림이 죽은 것으로 본다

const active = new Map<string, { controller: AbortController; ackController: AbortController; sessionId: string }>()

/** ack 첫 델타까지의 레이턴시(ms) 기록 — dev 계측용. getAckLatencyStats() 로 p50/p95. */
const ackLatencies: number[] = []
export function getAckLatencyStats() {
  const sorted = [...ackLatencies].sort((a, b) => a - b)
  const pick = (q: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null
  return { samples: sorted.length, p50: pick(0.5), p95: pick(0.95), all: sorted }
}
declare global { interface Window { __tethAckStats?: typeof getAckLatencyStats } }
if (typeof window !== 'undefined' && import.meta.env.DEV) window.__tethAckStats = getAckLatencyStats

export function abortAiTurns(sessionId?: string) {
  for (const [turnId, entry] of active) {
    if (sessionId && entry.sessionId !== sessionId) continue
    entry.controller.abort()
    entry.ackController.abort()
    active.delete(turnId)
  }
}

// 리로드/이탈로 죽는 fetch 를 "프록시 실패"로 오인해 mock 폴백을 저장하면 안 된다.
// pagehide 에서 abort 로 전환하면 abort 경로가 턴을 '중지'로 정리한다(아래 finalize).
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => abortAiTurns())

export function startAiTurn(args: {
  origin: string
  system: string
  store: AiStorePort
  sessionId: string
  turnId: string
  messages: TethAiMessage[]
}): void {
  const { store, sessionId, turnId } = args
  const controller = new AbortController()
  const ackController = new AbortController()
  active.set(turnId, { controller, ackController, sessionId })

  const parser = createTethStreamParser()
  let flow: TethFlowSegment[] = []
  let thinking = ''
  let segSeq = 0
  let probSeen = false
  let chipsDone = false
  let askSeen = false
  let sawError = false
  let finished = false
  let watchdogFired = false
  let mainSayStarted = false
  let ackStarted = false
  let toolLabels: string[] = []
  const startedAt = performance.now()

  const nextId = (prefix: string) => `${prefix}-${++segSeq}`
  const answerText = () => flow.filter(s => s.kind === 'say' && s.text.trim()).map(s => (s as { text: string }).text.trim()).join('\n\n')

  // ── flow 조립 (copy-on-write: 스토어/React 가 참조 동일성으로 갱신을 본다) ──
  const currentSay = () => { const last = flow.at(-1); return last?.kind === 'say' ? last : null }
  const currentWork = () => { const last = flow.at(-1); return last?.kind === 'work' ? last : null }
  const replaceLast = (segment: TethFlowSegment) => { flow = [...flow.slice(0, -1), segment] }
  const pushSeg = (segment: TethFlowSegment) => { flow = [...flow, segment] }
  const settleAll = (to: 'done') => {
    flow = flow.map(s => s.kind === 'work' && s.status === 'running'
      ? { ...s, status: to, items: s.items.map(item => item.status === 'running' ? { ...item, status: to } : item), ...(s.sources ? { sources: s.sources.map(source => source.status === 'reading' ? { ...source, status: 'done' as const } : source) } : {}) }
      : s)
  }
  /** 소스 행을 붙일 work 세그먼트 — 진행 중 work 가 없으면 '자료 조사' work 를 암시 생성. */
  const ensureSourceWork = (): Extract<TethFlowSegment, { kind: 'work' }> => {
    const work = currentWork()
    if (work && work.status === 'running') return work
    const created: Extract<TethFlowSegment, { kind: 'work' }> = { kind: 'work', id: nextId('work'), model: null, role: '자료 조사', items: [], status: 'running' }
    pushSeg(created)
    return created
  }
  const patchSources = (mutate: (sources: { id: string; title: string; domain: string; status: 'reading' | 'done' }[]) => { id: string; title: string; domain: string; status: 'reading' | 'done' }[]) => {
    const work = ensureSourceWork()
    replaceLast({ ...work, sources: mutate([...(work.sources ?? [])]) })
    queueFlow()
  }

  // ── 스로틀 배치 패치 (버그 클래스 ③: 델타당 전체 커밋 금지) ──
  let pending: AiTurnPatch | null = null
  let flushTimer: number | undefined
  const flushPatch = () => {
    window.clearTimeout(flushTimer)
    flushTimer = undefined
    if (!pending || finished) { pending = null; return }
    const patch = pending
    pending = null
    store.patchAiTurn(sessionId, turnId, patch)
  }
  const queuePatch = (fields: AiTurnPatch) => {
    pending = { ...(pending ?? {}), ...fields }
    if (flushTimer === undefined) flushTimer = window.setTimeout(flushPatch, PATCH_FLUSH_MS)
  }
  const queueFlow = () => queuePatch({ flow, answer: answerText() })

  let watchdog: number | undefined
  const armWatchdog = () => {
    window.clearTimeout(watchdog)
    watchdog = window.setTimeout(() => { watchdogFired = true; controller.abort(); ackController.abort() }, IDLE_LIMIT_MS)
  }

  const applyParseEvents = (events: ReturnType<typeof parser.push>) => {
    for (const event of events) {
      switch (event.kind) {
        case 'say-open':
          pushSeg({ kind: 'say', id: nextId('say'), text: '' })
          break
        case 'say-delta': {
          if (!mainSayStarted) {
            mainSayStarted = true
            ackController.abort()
            // 본 호출의 첫 say 도착: ack 는 대기 시간을 가리는 자리표시자였으므로
            // 본 say 가 그 자리를 대체한다 — 도입부가 두 줄로 겹치지 않는다.
            flow = flow.filter(segment => !(segment.kind === 'say' && segment.ack))
          }
          const say = currentSay()
          if (say && !say.ack) replaceLast({ ...say, text: say.text + event.text })
          else pushSeg({ kind: 'say', id: nextId('say'), text: event.text })
          queueFlow()
          break
        }
        case 'say-close':
          break
        case 'work-open': {
          const model = validateWorkModel(event.model)
          if (event.model && !model) console.warn('[teth-ai] 라우팅 표 밖 model 드랍:', event.model)
          pushSeg({ kind: 'work', id: nextId('work'), model, role: event.role.trim().slice(0, 40) || '검토 작업', items: [], status: 'running' })
          queueFlow()
          break
        }
        case 'item': {
          const work = currentWork()
          if (!work) break // work 밖 item 은 파서가 리터럴 처리하므로 도달하지 않는 방어선
          const items = work.items.map(item => item.status === 'running' ? { ...item, status: 'done' as const } : item)
          replaceLast({ ...work, items: [...items, { id: nextId('item'), label: event.label, status: 'running' as const }] })
          queueFlow()
          break
        }
        case 'work-close': {
          const work = currentWork()
          if (work) replaceLast({ ...work, status: 'done', items: work.items.map(item => item.status === 'running' ? { ...item, status: 'done' as const } : item) })
          queueFlow()
          break
        }
        case 'prob-raw': {
          if (probSeen) { console.warn('[teth-ai] 중복 <prob/> 무시'); break }
          const valid = validateProb(event.up, event.down)
          if (!valid) { console.warn('[teth-ai] 무효 <prob/> 제외:', event.up, event.down); break }
          probSeen = true
          // say 중간이라면 세그먼트를 갈라 제자리에 끼운다 (offset 부기 없음).
          const say = currentSay()
          pushSeg({ kind: 'prob', id: nextId('prob'), ...valid })
          if (say) pushSeg({ kind: 'say', id: nextId('say'), text: '' })
          queueFlow()
          break
        }
        case 'chips-raw': {
          if (chipsDone) { console.warn('[teth-ai] 중복 <chips> 무시'); break }
          const allowTwoActions = probSeen && flow.some(s => s.kind === 'prob' && s.up > 0 && s.down > 0)
          const result = parseChipsJson(event.raw, { allowTwoActions })
          if (result.kind === 'invalid') { console.warn('[teth-ai] 무효 <chips> 제외:', result.reason, event.raw.slice(0, 200)); break }
          chipsDone = true
          queuePatch({ suggestions: result.chips.suggest, ...(result.chips.actions.length ? { actions: result.chips.actions } : {}) })
          break
        }
        case 'ask-raw': {
          if (askSeen) { console.warn('[teth-ai] 중복 <ask> 무시'); break }
          const result = parseAskJson(event.raw)
          if (result.kind === 'invalid') { console.warn('[teth-ai] 무효 <ask> 제외:', result.reason, event.raw.slice(0, 200)); break }
          askSeen = true
          pushSeg({ kind: 'ask', id: nextId('ask'), questions: result.questions })
          queueFlow()
          break
        }
        case 'drop':
          console.warn('[teth-ai] 블록 제외:', event.reason)
          break
      }
    }
  }

  const finalize = (outcome: 'finish' | 'fallback' | 'stop') => {
    if (finished) return
    flushPatch() // 마지막 상태를 running 가드가 살아있을 때 반영한다
    finished = true
    window.clearTimeout(flushTimer)
    window.clearTimeout(watchdog)
    ackController.abort()
    active.delete(turnId)
    if (outcome === 'fallback') store.failAiTurn(sessionId, turnId, 'fallback')
    else if (outcome === 'stop') store.failAiTurn(sessionId, turnId, 'stop') // 이미 중지된 턴이면 no-op
    else store.finishAiTurn(sessionId, turnId)
  }

  // ── ack 병렬 호출: thinking 이 응답 앞에 생성되어 첫 say 가 늦는 것을 가린다 ──
  void (async () => {
    try {
      const lastQuestion = args.messages.at(-1)
      if (!lastQuestion) return
      await streamTethChat({
        origin: args.origin,
        messages: [lastQuestion],
        system: TETH_ACK_PROMPT,
        think: true,
        signal: ackController.signal,
        onEvent: event => {
          if (finished || event.kind !== 'text') return
          // 본 say 가 이미 흐르기 시작한 뒤 도착한 ack 잔여분은 버린다.
          if (mainSayStarted && !ackStarted) return
          if (!ackStarted) {
            ackStarted = true
            const ms = Math.round(performance.now() - startedAt)
            ackLatencies.push(ms)
            console.info('[teth-ai] ack 첫 델타:', ms + 'ms')
            flow = [{ kind: 'say', id: nextId('ack'), text: '', ack: true }, ...flow]
          }
          const ack = flow[0]
          if (ack?.kind === 'say' && ack.ack) {
            flow = [{ ...ack, text: ack.text + event.delta }, ...flow.slice(1)]
            queueFlow()
          }
        },
      })
    } catch { /* ack 는 장식이다 — 실패는 조용히 무시하고 본 호출이 화면을 채운다 */ }
  })()

  // ── 본 호출 (lite: 도구 없음 — 로드맵 1단계) ──
  void (async () => {
    armWatchdog()
    try {
      await streamTethChat({
        origin: args.origin,
        messages: args.messages,
        system: args.system,
        lite: true,
        signal: controller.signal,
        onEvent: event => {
          if (finished) return
          armWatchdog()
          if (event.kind === 'text') applyParseEvents(parser.push(event.delta))
          else if (event.kind === 'think') { thinking += event.delta; queuePatch({ thinking }) }
          else if (event.kind === 'tool') {
            // 사고 패널의 tool 활동: 번역·집계 레이어를 거쳐 스텝으로 표시.
            // (1단계 lite 에선 발생하지 않지만, tool 이 켜지는 즉시 이 경로가 받는다.
            //  3단계에서 WorkBlock 어댑터로 승격 예정.)
            toolLabels = [...toolLabels, describeToolEvent(event)]
            queuePatch({ trace: aggregateToolActivity(toolLabels, true) })
            if (event.name === 'web_fetch') {
              const domain = (() => { try { return new URL(event.query).hostname.replace(/^www\./, '') } catch { return '' } })()
              if (domain) patchSources(sources => [...sources, { id: nextId('src'), title: '페이지 확인', domain, status: 'reading' }])
            }
          }
          else if (event.kind === 'sources') {
            // 검색이 확보한 소스 목록 — work 카드에 행으로 표시 (제목+도메인만).
            patchSources(sources => [...sources, ...event.results.slice(0, 6).map(result => ({ id: nextId('src'), title: result.title || result.domain, domain: result.domain, status: 'done' as const }))])
          }
          else if (event.kind === 'source-read') {
            patchSources(sources => {
              for (let index = sources.length - 1; index >= 0; index--) {
                if (sources[index].domain === event.domain && sources[index].status === 'reading') {
                  return sources.map((source, sourceIndex) => sourceIndex === index ? { ...source, status: 'done' as const } : source)
                }
              }
              return sources
            })
          }
          else if (event.kind === 'error') sawError = true
        },
      })
      if (finished) return
      applyParseEvents(parser.finish())
      if (!answerText().trim()) { finalize('fallback'); return }
      settleAll('done')
      queueFlow()
      // 프록시가 {error:true} 로 끝냈어도 chips(종결 블록)까지 받았다면 내용은 완결이다.
      // 그 외의 말미 오류는 잘린 답변 — '완료'가 아니라 '중지'로 정직하게 표시한다.
      if (sawError && !chipsDone) console.warn('[teth-ai] 스트림 말미 오류 — 부분 응답으로 중지 처리')
      finalize(sawError && !chipsDone ? 'stop' : 'finish')
    } catch (error) {
      if (finished) return
      if (controller.signal.aborted) {
        finalize(watchdogFired && !answerText().trim() ? 'fallback' : 'stop')
        return
      }
      if (answerText().trim()) {
        applyParseEvents(parser.finish())
        settleAll('done')
        queueFlow()
        finalize('finish')
      } else {
        console.warn('[teth-ai] 프록시 연결 실패, 스크립트 응답으로 폴백:', error instanceof Error ? error.message : error)
        finalize('fallback')
      }
    }
  })()
}
