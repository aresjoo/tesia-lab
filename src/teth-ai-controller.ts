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

const active = new Map<string, { controller: AbortController; sessionId: string }>()

export function abortAiTurns(sessionId?: string) {
  for (const [turnId, entry] of active) {
    if (sessionId && entry.sessionId !== sessionId) continue
    entry.controller.abort()
    active.delete(turnId)
  }
}

// 리로드/이탈로 죽는 fetch 를 "프록시 실패"로 오인해 mock 폴백을 저장하면 안 된다.
// pagehide 에서 전부 abort 로 전환하면 복원 경로(read 의 stopped 강등)가 턴을 이어받는다.
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
  let suggestions: string[] = []
  let actions: ClientTurn['actions']
  let sawDone = false
  let sawError = false
  let finished = false
  let thinkTimer: number | undefined

  const patch = (fields: AiTurnPatch) => { if (!finished) store.patchAiTurn(sessionId, turnId, fields) }
  const flushThinking = () => { window.clearTimeout(thinkTimer); thinkTimer = undefined; patch({ thinking }) }
  const settleSteps = (status: 'done') => { steps = steps.map(step => step.status === 'running' ? { ...step, status } : step) }
  const appendStep = (title: string) => {
    settleSteps('done')
    steps = [...steps, { id: `step-${++stepSeq}`, title, status: 'running' }]
  }

  const applyParseEvents = (events: ReturnType<typeof parser.push>) => {
    let touched: AiTurnPatch | null = null
    const touch = (fields: AiTurnPatch) => { touched = { ...(touched ?? {}), ...fields } }
    for (const event of events) {
      switch (event.kind) {
        case 'trace-step':
          appendStep(event.label)
          touch({ trace: steps })
          break
        case 'answer-open':
          settleSteps('done')
          touch({ trace: steps })
          break
        case 'answer-delta':
          answer += event.text
          touch({ answer })
          break
        case 'answer-close':
          break
        case 'prob-raw': {
          if (prob) { console.warn('[teth-ai] 중복 <prob/> 무시'); break }
          const valid = validateProb(event.up, event.down)
          if (!valid) { console.warn('[teth-ai] 무효 <prob/> 제외:', event.up, event.down); break }
          prob = { ...valid, offset: answer.length }
          touch({ prob })
          break
        }
        case 'chips-raw': {
          if (chipsDone) { console.warn('[teth-ai] 중복 <chips> 무시'); break }
          const allowTwoActions = Boolean(prob && prob.up > 0 && prob.down > 0)
          const result = parseChipsJson(event.raw, { allowTwoActions })
          if (result.kind === 'invalid') { console.warn('[teth-ai] 무효 <chips> 제외:', result.reason, event.raw.slice(0, 200)); break }
          chipsDone = true
          suggestions = result.chips.suggest
          actions = result.chips.actions.length ? result.chips.actions : undefined
          touch({ suggestions, ...(actions ? { actions } : {}) })
          break
        }
        case 'drop':
          console.warn('[teth-ai] 블록 제외:', event.reason)
          break
      }
    }
    if (touched) patch(touched)
  }

  const finalize = (outcome: 'finish' | 'fallback' | 'abort') => {
    if (finished) return
    finished = true
    window.clearTimeout(thinkTimer)
    active.delete(turnId)
    if (outcome === 'abort') return // store.stop() 이 이미 턴을 중지 상태로 만들었다
    if (outcome === 'fallback') { store.failAiTurn(sessionId, turnId, 'fallback'); return }
    store.finishAiTurn(sessionId, turnId)
  }

  void (async () => {
    try {
      await streamTethChat({
        origin: args.origin,
        messages: args.messages,
        system: args.system,
        signal: controller.signal,
        onEvent: event => {
          if (finished) return
          if (event.kind === 'text') applyParseEvents(parser.push(event.delta))
          else if (event.kind === 'think') {
            thinking += event.delta
            // 토큰마다 스토어를 두드리지 않게 표시만 가볍게 스로틀한다.
            if (thinkTimer === undefined) thinkTimer = window.setTimeout(flushThinking, 80)
          }
          else if (event.kind === 'tool') {
            appendStep(event.name === 'web_search' ? `웹 검색: ${event.query}` : event.name === 'web_fetch' ? `페이지 확인: ${event.query}` : event.name === 'code_execution' ? '데이터 확인 중' : `${event.name || '도구'} 실행`)
            patch({ trace: steps })
          }
          else if (event.kind === 'done') sawDone = true
          else if (event.kind === 'error') sawError = true
        },
      })
      if (finished) return
      applyParseEvents(parser.finish())
      flushThinking()
      // 답변 텍스트가 전혀 없으면(프록시 오류 포함) 스크립트 응답으로 폴백한다.
      if (!answer.trim() && (sawError || !sawDone)) { finalize('fallback'); return }
      if (!answer.trim()) { finalize('fallback'); return }
      settleSteps('done')
      patch({ trace: steps })
      finalize('finish')
    } catch (error) {
      if (finished) return
      if (controller.signal.aborted) { finalize('abort'); return }
      // 중간 단절: 일부라도 답이 있으면 그대로 마무리, 아니면 폴백.
      if (answer.trim()) {
        applyParseEvents(parser.finish())
        flushThinking()
        settleSteps('done')
        patch({ trace: steps })
        finalize('finish')
      } else {
        console.warn('[teth-ai] 프록시 연결 실패, 스크립트 응답으로 폴백:', error instanceof Error ? error.message : error)
        finalize('fallback')
      }
    }
  })()
}
