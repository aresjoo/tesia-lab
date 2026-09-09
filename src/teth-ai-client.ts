/* TETH AI 프록시 소비 레이어. 제품 backend 계약이 아니라 소유자 운영 AI 프록시의
 * SSE 프로토콜(data:{text|think|tool|done|error})만 다룬다. API 키·비밀정보는
 * 절대 다루지 않으며, 프록시 미설정 시 앱은 기존 스크립트 응답으로 동작한다. */

export type TethAiMessage = { role: 'user' | 'assistant'; content: string }

export type TethAiEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'think'; delta: string }
  | { kind: 'tool'; name: string; query: string }
  | { kind: 'done' }
  | { kind: 'error' }

export class TethAiHttpError extends Error {
  constructor(readonly status: number) { super(`teth-ai proxy HTTP ${status}`) }
}

const isHttpOrigin = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\/\S+$/.test(value)

/** 명시 설정이 있을 때만 실 AI가 켜진다. 공개 빌드 기본값은 항상 null(Mock).
 * localStorage 재정의는 DEV 전용 시험 심(seam)이다 — 프로덕션 빌드에서 저장소 키
 * 하나로 Mock 게이트를 우회해 대화가 임의 origin 으로 나가는 일을 막는다. */
export function resolveAiProxyOrigin(): string | null {
  if (import.meta.env.DEV) {
    try {
      const stored = localStorage.getItem('tethAiProxy')
      if (stored === 'off') return null
      if (isHttpOrigin(stored)) return stored.replace(/\/+$/, '')
    } catch { /* 저장소 접근 불가 시 빌드 설정으로 폴백 */ }
  }
  if (import.meta.env.VITE_E2E_FAST === 'true') return null
  const configured = import.meta.env.VITE_TETH_AI_PROXY
  return isHttpOrigin(configured) ? configured.replace(/\/+$/, '') : null
}

/** 스트림이 자연 종료되면 resolve. HTTP 오류·네트워크 단절·abort는 reject.
 * 프록시의 {done}/{error} 신호 수신 여부 판단은 호출자(onEvent) 몫이다. */
export async function streamTethChat(options: {
  origin: string
  messages: TethAiMessage[]
  system: string
  signal: AbortSignal
  /** true = 도구 없는 즉답 경로(로드맵 1단계 본 호출). */
  lite?: boolean
  /** true = 프록시의 초경량 모델 경로(thinking·도구 없음) — ack 병렬 호출용. */
  think?: boolean
  onEvent: (event: TethAiEvent) => void
}): Promise<void> {
  const response = await fetch(`${options.origin}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: options.messages,
      system: options.system,
      ...(options.lite ? { lite: true } : {}),
      ...(options.think ? { think: true } : {}),
    }),
    signal: options.signal,
    cache: 'no-store',
  })
  if (!response.ok || !response.body) throw new TethAiHttpError(response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const handleLine = (line: string) => {
    if (!line.startsWith('data:')) return
    let payload: unknown
    try { payload = JSON.parse(line.slice(5)) } catch { console.warn('[teth-ai] 해석 불가 SSE 라인 무시'); return }
    if (!payload || typeof payload !== 'object') return
    const event = payload as Record<string, unknown>
    if (typeof event.text === 'string') options.onEvent({ kind: 'text', delta: event.text })
    else if (typeof event.think === 'string') options.onEvent({ kind: 'think', delta: event.think })
    else if (event.tool && typeof event.tool === 'object') {
      const tool = event.tool as { name?: unknown; q?: unknown }
      options.onEvent({ kind: 'tool', name: typeof tool.name === 'string' ? tool.name : '', query: typeof tool.q === 'string' ? tool.q : '' })
    }
    else if (event.done === true) options.onEvent({ kind: 'done' })
    else if (event.error === true) options.onEvent({ kind: 'error' })
    // {sres}/{fres}/{tok} 등은 아직 미소비 — 향후 같은 스텝 채널의 입력 후보다.
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    if (done) buffer += decoder.decode()
    buffer = buffer.replace(/\r\n/g, '\n')
    const frames = buffer.split('\n\n')
    // 종료 시에는 미완성 꼬리 프레임도 관대하게 소비한다.
    buffer = done ? '' : (frames.pop() ?? '')
    for (const frame of frames) for (const line of frame.split('\n')) handleLine(line)
    if (done) return
  }
}
