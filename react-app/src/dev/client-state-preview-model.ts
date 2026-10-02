/** DEV-only source QA state. Never an authentication, payment or execution port.
 * Source: aresjoo/tesia-lab b2ee991 TF_DEV_ROWS / tfDevTgl / tfDevReset.
 * No storage or transport. Pass results come from the existing source simulator.
 */
import { createSourceAccountEventState, SOURCE_ACCOUNT_CREDIT, type SourceAccountEventState } from '../client-account-event-state'
import { applyBillingPreviewAction, createBillingPreviewState, type BillingPreviewAction, type BillingPreviewState } from '../client-billing-preview-state'
import { delegationRecommendedParameters, evaluateDelegation, type DelegationEvaluation } from '../client-delegation-engine'
import { SOURCE_USER_STRATEGY_PASS_SCORE } from '../client-user-strategy'

export const SOURCE_QA_ROWS = [
  ['login', '로그인'], ['uid', 'UID 연동'], ['pay', '구독 결제'],
  ['api', '거래소 연결 (Binance)'], ['free', '무료 분석 소진'], ['strat', '검증 통과 전략'],
  ['card', '카드 등록 (월 충전)'], ['bwarn', '크레딧 임계 경고'], ['bwatch', '크레딧 관망 모드'],
] as const
export type SourceQaKey = typeof SOURCE_QA_ROWS[number][0]
export type SourceQaUserEvent = Readonly<{ id: string; now: number }>
export type SourceQaState = Readonly<{
  generation: number
  user: Readonly<{ name: string; email: string }> | null
  uid: string | null
  api: Readonly<{ ex: 'binance'; uid: string }> | null
  plan: 'paid' | null
  account: SourceAccountEventState
  billing: BillingPreviewState
  verified: DelegationEvaluation | null
}>
const user = Object.freeze({ name: '김도현', email: 'demo@teth.ai' })
const uid = '38291042'
const billingOwner = user.email
export function createSourceQaState(generation = 0): SourceQaState {
  return { generation, user: null, uid: null, api: null, plan: null, account: createSourceAccountEventState(),
    billing: createBillingPreviewState(billingOwner), verified: null }
}
export function sourceQaEnabled(state: SourceQaState, key: SourceQaKey): boolean {
  switch (key) {
    case 'login': return state.user !== null
    case 'uid': return state.account.uidLinked
    case 'pay': return state.account.payDone
    case 'api': return state.api !== null
    case 'free': return state.account.freeUsed >= SOURCE_ACCOUNT_CREDIT.freeQuota
    case 'strat': return state.verified !== null && state.verified.score >= SOURCE_USER_STRATEGY_PASS_SCORE
    case 'card': return state.billing.cardOn
    case 'bwarn': return state.billing.mode === 'grace'
    case 'bwatch': return state.billing.mode === 'watch'
  }
}
export function resetSourceQaState(state: SourceQaState): SourceQaState {
  return createSourceQaState(state.generation + 1)
}
/** Fixture badge state, never service connection authority. */
export function sourceQaBrokerState(state: SourceQaState, brokerId: string, supported: boolean): 'SOON' | 'GUEST' | 'CONNECTED' | 'NEEDS_LINK' | 'NEEDS_PLAN' {
  if (!supported) return 'SOON'
  if (!state.user) return 'GUEST'
  if (state.api?.ex === brokerId) return 'CONNECTED'
  return state.account.uidLinked || state.account.payDone ? 'NEEDS_LINK' : 'NEEDS_PLAN'
}
function applyBillingFixture(state: SourceQaState, event: SourceQaUserEvent, action: BillingPreviewAction): SourceQaState {
  const current = ensureQaUser(state, event)
  const result = applyBillingPreviewAction(current.billing, { owner: billingOwner, id: `${event.id}:toggle`, now: event.now, action })
  if (!result.ok) throw new RangeError(`과금 미리보기 상태 전환 실패: ${result.error}`)
  return { ...current, billing: result.state }
}
function ensureQaUser(state: SourceQaState, event: SourceQaUserEvent): SourceQaState {
  if (state.user) return state
  // Source authSyncUI runs bcBoot whenever QA creates its local demo user.
  const boot = applyBillingPreviewAction(state.billing, { owner: billingOwner, id: `${event.id}:boot`, now: event.now, action: { kind: 'boot' } })
  if (!boot.ok) throw new RangeError(`과금 미리보기 초기화 실패: ${boot.error}`)
  return { ...state, user, billing: boot.state }
}
export function toggleSourceQaState(state: SourceQaState, key: SourceQaKey, event: SourceQaUserEvent): SourceQaState {
  const on = sourceQaEnabled(state, key)
  switch (key) {
    // Source logout clears the complete old user's in-memory state and views.
    case 'login': return on ? resetSourceQaState(state) : ensureQaUser(state, event)
    // Source QA changes this flag directly; unlike real linking it grants no promo.
    case 'uid': return { ...state, uid: on ? null : uid, account: createSourceAccountEventState({ ...state.account, uidLinked: !on }), billing: { ...state.billing, uidLinked: !on } }
    case 'pay': return { ...state, plan: on ? null : 'paid', account: createSourceAccountEventState({ ...state.account, payDone: !on }) }
    case 'api': return { ...(on ? state : ensureQaUser(state, event)), api: on ? null : { ex: 'binance', uid } }
    case 'free': return { ...state, account: createSourceAccountEventState({ ...state.account, freeUsed: on ? 0 : SOURCE_ACCOUNT_CREDIT.freeQuota }) }
    case 'strat': return { ...state, verified: on ? null : evaluateDelegation(delegationRecommendedParameters(), 5_000_000) }
    case 'card': return applyBillingFixture(state, event, { kind: 'qa-card', on: !on })
    case 'bwarn': return applyBillingFixture(state, event, { kind: on ? 'qa-topup' : 'qa-grace' })
    case 'bwatch': return applyBillingFixture(state, event, { kind: on ? 'qa-topup' : 'qa-watch' })
  }
}
