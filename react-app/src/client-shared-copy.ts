/** Source 501053b tfSS3CopyGo intake/pendingP mapping. PUBLIC PREVIEW ONLY.
 * Resolves the current source row; never trusts a caller's score, price or row.
 * No storage, clock access, timers, transport, account state or execution rights.
 */
import { delegationQuestions, type DelegationAnswers, type DelegationUiSnapshot } from './client-delegation-fixtures'
import { sourceSharedStrategies, type SharedStrategy } from './client-shared-strategies'
import { normalizeSourceTerminalParameters, type NormalizedSourceTerminalParameters } from './client-terminal-source-fixture'
import { decodeSharedFollow, type SharedFollowRecord } from './client-shared-follow'

export type SharedCopyRequest = {
  nick: string; budgetIndex: number; sl: number; tp: number | null
  /** Confirmation snapshot only; the store compares it, never uses it as input. */
  expectedFollow?: { sessionId: string; parameters: NormalizedSourceTerminalParameters; budgetIndex: number }
}
type CopySource = Pick<SharedStrategy, 'nick' | 'asset' | 'parameters'>

export function prepareSharedCopy(request: SharedCopyRequest, now: number): { row: SharedStrategy; ui: DelegationUiSnapshot }
export function prepareSharedCopy(request: SharedCopyRequest, now: number, saved: SharedFollowRecord): { row: CopySource; ui: DelegationUiSnapshot }
export function prepareSharedCopy(request: SharedCopyRequest, now: number, saved?: SharedFollowRecord): { row: CopySource; ui: DelegationUiSnapshot } {
  const base = saved === undefined ? undefined : decodeSharedFollow(saved)
  if (saved !== undefined && !base) throw new RangeError('저장된 복제 설정을 다시 확인해주세요.')
  if (!request || typeof request !== 'object' || typeof request.nick !== 'string'
    || !Number.isInteger(request.budgetIndex) || request.budgetIndex < 0 || request.budgetIndex > 3
    || !Number.isFinite(request.sl) || ![-3, -5, -8, -12].includes(request.sl) && request.sl !== base?.parameters.sl
    || !(typeof request.tp === 'number' && Number.isFinite(request.tp) && [8, 10, 12, 15].includes(request.tp)) && (!base || request.tp !== base.parameters.tp)
    || !Number.isFinite(now)) throw new RangeError('복제할 전략 설정을 다시 확인해주세요.')
  if (base && base.nick !== request.nick) throw new RangeError('저장된 전략과 복제 대상이 달라요.')
  const row = base ? { nick: base.nick, asset: base.asset, parameters: base.parameters }
    : sourceSharedStrategies().find(candidate => candidate.nick === request.nick)
  if (!row) throw new RangeError('공유 전략을 다시 확인해주세요.')
  const assetIndex = delegationQuestions[0].options.findIndex(([label]) => label === row.asset)
  if (assetIndex < 0) throw new RangeError('이 자산은 현재 위임 화면에서 확인할 수 없어요.')
  // Detail's selected chart window is intentionally not an input. Keep the
  // source strategy's full configured interval and non-editable entry rules.
  const parameters = normalizeSourceTerminalParameters({ ...row.parameters, sl: request.sl, tp: request.tp })
  // Saved source parameters can include a recommendation outside the intake
  // menu. The preserved parameters are authoritative; the UI shows them directly.
  const indices = [assetIndex, 1, request.budgetIndex, parameters.startI > 61 ? 1 : 2, Math.max(0, [-3, -5, -8, -12].indexOf(request.sl))]
  const answers: DelegationAnswers = {}
  delegationQuestions.forEach((question, index) => {
    const answerIndex = indices[index]
    answers[question.key] = { index: answerIndex, label: question.options[answerIndex][0], recommended: false }
  })
  return { row, ui: { page: 'backtest', answers, questionIndex: 5, attempt: 0, workStep: 0, workStartedAt: now,
    expert: false, chartInterval: '1D', parameters, pendingParameters: { ...parameters } } }
}
