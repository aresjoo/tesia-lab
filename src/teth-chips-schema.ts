/* TETH 모델 출력값 검증 — 프롬프트를 신뢰하지 않는다. 화면 투영용이며 API 계약이 아니다.
 * 위반 블록은 조용히 제외하고 로깅한다. 검증 실패가 답변 렌더를 막아서는 안 된다.
 * 같은 함수가 sessionStorage 복원 스냅샷 정화에도 쓰인다. */

export const TETH_ACTION_TYPES = ['backtest', 'alert', 'delegate', 'auto'] as const
export type TethActionType = (typeof TETH_ACTION_TYPES)[number]
export type TethActionChip = { type: TethActionType; label: string }

export type TethChips = { suggest: string[]; actions: TethActionChip[] }

const MAX_SUGGESTIONS = 5
const MAX_LABEL = 80

export function isTethActionChip(value: unknown): value is TethActionChip {
  if (!value || typeof value !== 'object') return false
  const chip = value as { type?: unknown; label?: unknown }
  return typeof chip.type === 'string' && (TETH_ACTION_TYPES as readonly string[]).includes(chip.type)
    && typeof chip.label === 'string' && chip.label.trim().length > 0
}

/** chips JSON 원문을 검증한다. 액션은 기본 1개, 매수/매도 판단이 갈릴 때만 최대 2개. */
export function parseChipsJson(raw: string, context: { allowTwoActions: boolean }):
  { kind: 'ok'; chips: TethChips } | { kind: 'invalid'; reason: string } {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { kind: 'invalid', reason: 'broken-json' } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { kind: 'invalid', reason: 'not-an-object' }
  const body = parsed as { suggest?: unknown; action?: unknown }
  const suggest: string[] = []
  if (Array.isArray(body.suggest)) {
    for (const item of body.suggest) {
      if (typeof item !== 'string') continue
      const text = item.trim().slice(0, 120)
      if (text && !suggest.includes(text)) suggest.push(text)
      if (suggest.length >= MAX_SUGGESTIONS) break
    }
  }
  const actions: TethActionChip[] = []
  if (Array.isArray(body.action)) {
    for (const item of body.action) {
      if (!isTethActionChip(item)) continue
      actions.push({ type: item.type, label: item.label.trim().slice(0, MAX_LABEL) })
      if (actions.length >= (context.allowTwoActions ? 2 : 1)) break
    }
  }
  return { kind: 'ok', chips: { suggest, actions } }
}

// ── <ask> 질문 폼 검증 — 프롬프트를 신뢰하지 않는다 ──

export type TethAskOption = { label: string; desc?: string }
export type TethAskQuestion = { title: string; hint?: string; options: TethAskOption[]; allowCustom: boolean }

/** ask JSON 검증: 질문 1~4개, 각 선택지 2~5개. 무효 질문은 건너뛰고 전부 무효면 invalid. */
export function parseAskJson(raw: string): { kind: 'ok'; questions: TethAskQuestion[] } | { kind: 'invalid'; reason: string } {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { kind: 'invalid', reason: 'broken-json' } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { kind: 'invalid', reason: 'not-an-object' }
  const body = parsed as { questions?: unknown }
  if (!Array.isArray(body.questions)) return { kind: 'invalid', reason: 'no-questions' }
  const questions: TethAskQuestion[] = []
  for (const item of body.questions) {
    if (!item || typeof item !== 'object') continue
    const question = item as { title?: unknown; hint?: unknown; options?: unknown; allowCustom?: unknown }
    if (typeof question.title !== 'string' || !question.title.trim() || !Array.isArray(question.options)) continue
    const options: TethAskOption[] = []
    for (const opt of question.options) {
      const option = opt as { label?: unknown; desc?: unknown }
      if (!option || typeof option.label !== 'string' || !option.label.trim()) continue
      options.push({ label: option.label.trim().slice(0, 60), ...(typeof option.desc === 'string' && option.desc.trim() ? { desc: option.desc.trim().slice(0, 90) } : {}) })
      if (options.length >= 5) break
    }
    if (options.length < 2) continue
    questions.push({
      title: question.title.trim().slice(0, 120),
      ...(typeof question.hint === 'string' && question.hint.trim() ? { hint: question.hint.trim().slice(0, 160) } : {}),
      options,
      allowCustom: question.allowCustom !== false,
    })
    if (questions.length >= 4) break
  }
  if (!questions.length) return { kind: 'invalid', reason: 'no-valid-questions' }
  return { kind: 'ok', questions }
}

/** up+down=100, 각 0~100 의 유한수일 때만 확률로 인정한다. 아니면 null. */
export function validateProb(up: unknown, down: unknown): { up: number; down: number } | null {
  const parse = (value: unknown): number | null => {
    const num = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    if (!Number.isFinite(num) || num < 0 || num > 100) return null
    return Math.round(num)
  }
  const upValue = parse(up)
  const downValue = parse(down)
  if (upValue === null || downValue === null || upValue + downValue !== 100) return null
  return { up: upValue, down: downValue }
}
