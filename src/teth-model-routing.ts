/* work 태그 model 라벨 라우팅 표 — 화면 연출용 상수(로드맵 1단계). 교체 가능하게 분리.
 * 표 밖 라벨은 검증에서 드랍되어 role 만 렌더된다(빈 뱃지 금지).
 * 2단계: 실 멀티모델 라우팅 도입 시 이 표의 라벨이 실호출과 1:1 이 된다.
 * 라우팅 멘트는 "이 작업에는 ○○를 사용합니다" 톤만 허용, 성능 단정 금지. */

export const TETH_MODEL_ROUTING = {
  'claude-fable-5': '작업 구조 설계·종합 판단',
  'gemini-agy-flash': '차트 흐름·수치 검토',
  'gpt-sol': '뉴스·심리 검토',
  'claude-opus-5': '전략 조건 설계',
  'claude-fable-5-1': '리포트 작성',
} as const

export type TethRoutedModel = keyof typeof TETH_MODEL_ROUTING

/** 라우팅 표 검증 — 표 밖 모델명은 null(role 만 렌더). 드랍 로깅은 호출자 몫. */
export function validateWorkModel(label: unknown): TethRoutedModel | null {
  return typeof label === 'string' && Object.prototype.hasOwnProperty.call(TETH_MODEL_ROUTING, label)
    ? label as TethRoutedModel
    : null
}
