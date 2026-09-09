/* WorkBlock 정규화 모델 — 렌더러(TethWorkBlock)는 이 타입만 받는다.
 * work 는 연출 전용이 아니라 향후 실제 tool use 결과의 그릇이다:
 * 입력원이 무엇이든(태그 스트림, tool 이벤트) 어댑터가 이 형태로 정규화해
 * 갈아끼울 수 있어야 한다. 화면 표시용 투영이며 API 계약이 아니다. */
import type { AiFlowStatus, TethFlowSegment } from './client-experience-store'

export type WorkBlock = {
  id: string
  /** 라우팅 표 검증을 통과한 라벨만. null 이면 role 만 렌더된다(빈 뱃지 금지). */
  model: string | null
  role: string
  items: { id: string; label: string; status: AiFlowStatus }[]
  status: AiFlowStatus
  /** 조사한 소스 행 (제목+도메인만 — 전체 URL·쿼리 비노출 원칙). */
  sources?: { id: string; title: string; domain: string; status: 'reading' | 'done' }[]
}

/** 어댑터 1: say/work 태그 스트림(flow 세그먼트) → WorkBlock. (로드맵 1·2단계) */
export function workBlockFromFlowSegment(segment: Extract<TethFlowSegment, { kind: 'work' }>): WorkBlock {
  return { id: segment.id, model: segment.model, role: segment.role, items: segment.items, status: segment.status, ...(segment.sources ? { sources: segment.sources } : {}) }
}

/** 어댑터 2 (자리만, 미구현): 실제 tool use 이벤트 → WorkBlock. (로드맵 3단계)
 * tool 연동 시 프록시 {tool} 이벤트(+purpose 메타)를 같은 WorkBlock 으로 정규화해
 * 렌더러 수정 없이 실작업 결과가 흐르게 한다. */
export function workBlockFromToolEvents(): WorkBlock {
  throw new Error('workBlockFromToolEvents: 로드맵 3단계(tool use 연동)에서 구현된다')
}
