/* 실 AI 턴 오케스트레이션: 프록시 SSE → (채널1) thinking 프로즈, (채널2) 태그 파서
 * → 스토어 패치. 화면 표시용 투영이며 서버 권위 상태가 아니다. 스토어의 running
 * 가드와 이 모듈의 종료 플래그가 중복 방어한다 — 이벤트 순서를 신뢰하지 않는다. */
import { createTethStreamParser } from './teth-stream-parser'
import { parseChipsJson, validateProb } from './teth-chips-schema'
import { streamTethChat, type TethAiMessage } from './teth-ai-client'
import type { AiTraceStep, ClientTurn } from './client-experience-store'

type AiTurnPatch = Partial<Pick<ClientTurn, 'thinking' | 'answer' | 'trace' | 'prob' | 'actions' | 'suggestions'>>

export type AiStorePort = {
  patchAiTurn(sessionId: string, turnId: string, patch: AiTurnPatch): void
  finishAiTurn(sessionId: string, turnId: string): void
  failAiTurn(sessionId: string, turnId: string, failMode: 'fallback' | 'stop'): void
}

const PATCH_FLUSH_MS = 80    // 토큰마다 스토어 전체 커밋을 만들지 않기 위한 표시 스로틀
const IDLE_LIMIT_MS = 60_000 // 이벤트가 이만큼 끊기면 스트림이 죽은 것으로 본다

const active = new Map<string, { controller: AbortController; sessionId: string }>()

export function abortAiTurns(sessionId?: string) {
  for (const [turnId, entry] of active) {
    if (sessionId && entry.sessionId !== sessionId) continue
    entry.controller.abort()
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
  active.set(turnId, { controller, sessionId })

  const parser = createTethStreamParser()
  let answer = ''
  let thinking = ''
  let steps: AiTraceStep[] = []
  let stepSeq = 0
  let prob: ClientTurn['prob']
  let chipsDone = false
  let sawError = false
  let finished = false
  let watchdogFired = false

  // 모든 표시 패치는 하나의 트레일링 타이머로 합쳐진다 — SSE 이벤트당 스토어
  // 커밋/리렌더/강제 레이아웃을 만들지 않는다.
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

  let watchdog: number | undefined
  const armWatchdog = () => {
    window.clearTimeout(watchdog)
    watchdog = window.setTimeout(() => { watchdogFired = true; controller.abort() }, IDLE_LIMIT_MS)
  }

  const settleSteps = () => { steps = steps.map(step => step.status === 'running' ? { ...step, status: 'done' as const } : step) }
  const appendStep = (title: string) => {
    settleSteps()
    steps = [...steps, { id: `step-${++stepSeq}`, title, status: 'running' }]
  }

  const applyParseEvents = (events: ReturnType<typeof parser.push>) => {
    for (const event of events) {
      switch (event.kind) {
        case 'trace-step':
          appendStep(event.label)
          queuePatch({ trace: steps })
          break
        case 'answer-open':
          settleSteps()
          queuePatch({ trace: steps })
          break
        case 'answer-delta':
          answer += event.text
          queuePatch({ answer })
          break
        case 'answer-close':
          break
        case 'prob-raw': {
          if (prob) { console.warn('[teth-ai] 중복 <prob/> 무시'); break }
          const valid = validateProb(event.up, event.down)
          if (!valid) { console.warn('[teth-ai] 무효 <prob/> 제외:', event.up, event.down); break }
          prob = { ...valid, offset: answer.length }
          queuePatch({ prob })
          break
        }
        case 'chips-raw': {
          if (chipsDone) { console.warn('[teth-ai] 중복 <chips> 무시'); break }
          const allowTwoActions = Boolean(prob && prob.up > 0 && prob.down > 0)
          const result = parseChipsJson(event.raw, { allowTwoActions })
          if (result.kind === 'invalid') { console.warn('[teth-ai] 무효 <chips> 제외:', result.reason, event.raw.slice(0, 200)); break }
          chipsDone = true
          queuePatch({ suggestions: result.chips.suggest, ...(result.chips.actions.length ? { actions: result.chips.actions } : {}) })
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
    active.delete(turnId)
    if (outcome === 'fallback') store.failAiTurn(sessionId, turnId, 'fallback')
    else if (outcome === 'stop') store.failAiTurn(sessionId, turnId, 'stop') // 이미 중지된 턴이면 no-op
    else store.finishAiTurn(sessionId, turnId)
  }

  void (async () => {
    armWatchdog()
    try {
      await streamTethChat({
        origin: args.origin,
        messages: args.messages,
        system: args.system,
        signal: controller.signal,
        onEvent: event => {
          if (finished) return
          armWatchdog()
          if (event.kind === 'text') applyParseEvents(parser.push(event.delta))
          else if (event.kind === 'think') { thinking += event.delta; queuePatch({ thinking }) }
          else if (event.kind === 'tool') {
            appendStep(event.name === 'web_search' ? `웹 검색: ${event.query}` : event.name === 'web_fetch' ? `페이지 확인: ${event.query}` : event.name === 'code_execution' ? '데이터 확인 중' : `${event.name || '도구'} 실행`)
            queuePatch({ trace: steps })
          }
          else if (event.kind === 'error') sawError = true
          // {done} 은 스트림 자연 종료와 구분할 필요가 없어 소비하지 않는다.
        },
      })
      if (finished) return
      applyParseEvents(parser.finish())
      if (!answer.trim()) { finalize('fallback'); return }
      settleSteps()
      queuePatch({ trace: steps })
      // 프록시가 {error:true} 로 끝냈다면 잘린 답변이다 — '완료'가 아니라 '중지'로
      // 정직하게 표시하고 부분 텍스트를 보존한다.
      finalize(sawError ? 'stop' : 'finish')
    } catch (error) {
      if (finished) return
      if (controller.signal.aborted) {
        // 사용자 중지(no-op) / pagehide·bfcache / 유휴 워치독 — 모두 '중지'로 정리.
        // 단 워치독이 첫 토큰 전에 발화했다면 스크립트 폴백이 낫다.
        finalize(watchdogFired && !answer.trim() ? 'fallback' : 'stop')
        return
      }
      // 중간 단절: 일부라도 답이 있으면 그대로 마무리, 아니면 폴백.
      if (answer.trim()) {
        applyParseEvents(parser.finish())
        settleSteps()
        queuePatch({ trace: steps })
        finalize('finish')
      } else {
        console.warn('[teth-ai] 프록시 연결 실패, 스크립트 응답으로 폴백:', error instanceof Error ? error.message : error)
        finalize('fallback')
      }
    }
  })()
}
