/** Public source preview follow records, not subscriptions or execution rights.
 * The caller owns owner/session matching for a supplied registration.
 * No storage, transport, timer or wall-clock inference belongs here.
 */
import { delegationBudgets, delegationQuestions, type DelegationUiSnapshot } from './client-delegation-fixtures'
import { evaluateDelegation } from './client-delegation-engine'
import { sourceTerminalPrices, type NormalizedSourceTerminalParameters } from './client-terminal-source-fixture'
import { decodeSourceUserStrategyParameters, SOURCE_USER_STRATEGY_PASS_SCORE } from './client-user-strategy'

export type SharedFollowRecord = {
  id: string; owner: string; nick: string; asset: string
  parameters: NormalizedSourceTerminalParameters; budgetIndex: number
  confirmedAt: number; sessionId: string; active: boolean
}
export type SharedFollowDescription = { label: string; active: boolean; running: boolean }
export type SharedFollowStatus = SharedFollowDescription

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, limit: number): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= limit && value.trim() === value
  && Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
function parameters(value: unknown): NormalizedSourceTerminalParameters | undefined {
  const p = decodeSourceUserStrategyParameters(value)
  return p && typeof p.startI === 'number' && typeof p.endI === 'number'
    && p.startI >= 61 && p.startI <= p.endI && p.endI < sourceTerminalPrices.length
    ? { sl: p.sl, tp: p.tp, rsiTh: p.rsiTh, trendFilter: p.trendFilter, startI: p.startI, endI: p.endI } : undefined
}

/** Allow-list projection; unknown fields (including secret-looking keys) vanish. */
export function decodeSharedFollow(value: unknown): SharedFollowRecord | undefined {
  if (!object(value) || !text(value.id, 200) || !text(value.owner, 320) || !text(value.nick, 120)
    || !text(value.asset, 120) || !text(value.sessionId, 200) || typeof value.active !== 'boolean'
    || typeof value.budgetIndex !== 'number' || !Number.isInteger(value.budgetIndex) || value.budgetIndex < 0 || value.budgetIndex > 3
    || typeof value.confirmedAt !== 'number' || !Number.isSafeInteger(value.confirmedAt) || value.confirmedAt < 0 || value.confirmedAt > 8.64e15) return
  const p = parameters(value.parameters)
  if (!p) return
  return { id: value.id, owner: value.owner, nick: value.nick, asset: value.asset, parameters: p,
    budgetIndex: value.budgetIndex, confirmedAt: value.confirmedAt, sessionId: value.sessionId, active: value.active }
}

/** active = current follow assignment; running = registered preview strategy live.
 * A verification animation is never an executing strategy. Missing UI does not
 * deactivate the saved follow, and its old parameters never fill missing results.
 */
export function describeSharedFollow(record: SharedFollowRecord, ui: DelegationUiSnapshot | undefined, registration?: { status: string }): SharedFollowDescription {
  const decoded = decodeSharedFollow(record)
  const show = (label: string, running = false): SharedFollowDescription => ({ label, active: decoded?.active === true, running })
  if (!decoded) return show('검증 확인 필요')
  if (!decoded.active) return show('보관됨')
  if (registration !== undefined) {
    if (registration?.status === 'live') return show('실행 중', true)
    if (registration?.status === 'off') return show('실행 꺼짐')
    if (registration?.status === 'ready') return show('실행 준비')
    if (registration?.status === 'err' || registration?.status === 'error') return show('실행 오류')
    return show('실행 상태 확인 필요')
  }
  if (!ui || ui.recoveryRequired || !['intake', 'backtest', 'report', 'connect'].includes(ui.page)
    || !Number.isInteger(ui.workStep) || ui.workStep < 0 || ui.workStep > 5) return show('검증 확인 필요')
  if (ui.page === 'intake') return show('조건 입력 중')
  if (ui.questionIndex !== 5 || !ui.answers || delegationQuestions.some(question => {
    const index = ui.answers[question.key]?.index
    return !Number.isInteger(index) || index === undefined || !question.options[index]
  })) return show('검증 확인 필요')
  const applied = ui.parameters === undefined ? undefined : parameters(ui.parameters)
  const pending = ui.pendingParameters === undefined ? undefined : parameters(ui.pendingParameters)
  if (ui.parameters !== undefined && !applied || ui.pendingParameters !== undefined && !pending) return show('검증 확인 필요')
  const current = pending ?? applied
  if (!current) return show('검증 확인 필요')
  if (ui.workStep < 5) return ui.page === 'backtest' && Number.isFinite(ui.workStartedAt) ? show('검증 중') : show('검증 확인 필요')
  try {
    const score = evaluateDelegation(current, delegationBudgets[ui.answers.budget!.index]).score
    if (score < SOURCE_USER_STRATEGY_PASS_SCORE) return show('조정 중')
    if (ui.page === 'report') return show('리포트 확인')
    if (ui.page === 'connect') return show('연결 단계')
    return show('검증 통과')
  } catch { return show('검증 확인 필요') }
}
