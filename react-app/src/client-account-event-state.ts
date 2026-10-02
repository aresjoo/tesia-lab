/** Client-source preview only. These records are not backend contracts or access rights.
 * Source: index.html tfNFInit/tfNotify/tfNotifGo/tfNotifReadAll/tfEnt at the SHA below.
 * No execution, credit charge/grant, rebate or periodic-report producer is installed here.
 */
export const SOURCE_ACCOUNT_REFERENCE_SHA = '42a0d81f4776681938fb1d08efbabbcaa7f7c67e' as const
export const SOURCE_ACCOUNT_CREDIT = Object.freeze({ version: 1, uidGrant: 1000, costHigh: 10, warnRatio: .8, activityDays: 30, freeQuota: 10 })

export type SourceNotificationPreferences = Readonly<{
  pos: boolean; loss: boolean; review: boolean; rebate: boolean; watch: boolean
  chW: boolean; chK: boolean; chT: boolean; chM: boolean
}>
export type SourceNotificationPreferenceKey = keyof SourceNotificationPreferences
export const SOURCE_NOTIFICATION_DEFAULT_PREFERENCES: SourceNotificationPreferences = Object.freeze({
  pos: true, loss: true, review: true, rebate: true, watch: true, chW: true, chK: false, chT: false, chM: false,
})
export type SourceAccountNotificationType = 'credit' | 'pos' | 'bot' | 'review' | 'rebate' | 'report' | 'bill'
export type SourceAccountNotification = Readonly<{
  id: string; type: SourceAccountNotificationType; key: string; title: string
  body: string; link: string | null; at: number; read: boolean
}>
export type SourceAccountRebate = Readonly<{ fid: string; botId: string; amt: number; at: number; sim: true }>
export type SourceAccountReview = Readonly<{
  id: string; fid: string; botId: string; asset: string; kind: 'sl' | 'tp' | 'time'
  kindL: string; pnl: number; at: number; budget: number
  causes: readonly (readonly [string, string])[]; sim: true
}>
/** pnl is the source's sum of per-trade return ratios, not a portfolio/NAV return. */
export type SourceAccountPeriodic = Readonly<{
  id: string; kind: 'W' | 'M'; label: string; from: number; until: number
  n: number; wins: number; pnl: number; rebate: number; sim: true; at: number
}>
export type SourceAccountFill = Readonly<{
  fid: string; botId: string; side: 'b' | 's'; label: string; pnl: number
  kind: 'sl' | 'tp' | 'time'; sim: true; at: number
}>
export type SourceAccountEventState = Readonly<{
  source: 'client-source-preview'; sourceSha: typeof SOURCE_ACCOUNT_REFERENCE_SHA
  creditBal: number; creditGrants: Readonly<Record<string, number>>; creditReqs: readonly string[]
  notifs: readonly SourceAccountNotification[]; rebates: readonly SourceAccountRebate[]
  reviews: readonly SourceAccountReview[]; periodics: readonly SourceAccountPeriodic[]
  notifPrefs: SourceNotificationPreferences; uidLinked: boolean; freeUsed: number
  creditSeen: Readonly<Record<string, 1>>; notifKeys: Readonly<Record<string, 1>>
  reviewKeys: Readonly<Record<string, 1>>; fillLog: readonly SourceAccountFill[]
  payDone: boolean; tradeActiveUntil: number | null
}>

/** Typed fixture/caller input only, not an untrusted persistence decoder.
 * Copy every owned collection so later caller mutations cannot rewrite the preview.
 */
export function createSourceAccountEventState(input: Partial<SourceAccountEventState> = {}): SourceAccountEventState {
  return Object.freeze({
    source: 'client-source-preview', sourceSha: SOURCE_ACCOUNT_REFERENCE_SHA,
    creditBal: input.creditBal ?? 0, creditGrants: Object.freeze({ ...input.creditGrants }),
    creditReqs: Object.freeze([...(input.creditReqs ?? [])]),
    notifs: Object.freeze((input.notifs ?? []).map(row => Object.freeze({ ...row }))),
    rebates: Object.freeze((input.rebates ?? []).map(row => Object.freeze({ ...row }))),
    reviews: Object.freeze((input.reviews ?? []).map(row => Object.freeze({ ...row, causes: Object.freeze(row.causes.map(cause => Object.freeze([cause[0], cause[1]] as const))) }))),
    periodics: Object.freeze((input.periodics ?? []).map(row => Object.freeze({ ...row }))),
    notifPrefs: Object.freeze({ ...SOURCE_NOTIFICATION_DEFAULT_PREFERENCES, ...input.notifPrefs, chW: true }),
    uidLinked: input.uidLinked ?? false, freeUsed: input.freeUsed ?? 0,
    creditSeen: Object.freeze({ ...input.creditSeen }), notifKeys: Object.freeze({ ...input.notifKeys }),
    reviewKeys: Object.freeze({ ...input.reviewKeys }),
    fillLog: Object.freeze((input.fillLog ?? []).map(row => Object.freeze({ ...row }))),
    payDone: input.payDone ?? false, tradeActiveUntil: input.tradeActiveUntil ?? null,
  })
}

export type SourceNotificationInput = Readonly<{
  id: string; type: SourceAccountNotificationType; key: string; title: string
  body?: string; link?: string | null; at: number
}>

/** Caller supplies event identity/time; this does not derive events from chart trades.
 * The processed-key ledger is deliberately independent of the 100-row display cap.
 */
export function appendSourceNotification(state: SourceAccountEventState, input: SourceNotificationInput): SourceAccountEventState {
  if (Object.prototype.hasOwnProperty.call(state.notifKeys, input.key)) return state
  if (!input.id || !input.key || !Number.isFinite(input.at) || input.at < 0 || input.at > 8.64e15) throw new RangeError('Invalid source notification identity or timestamp')
  // Source random IDs could collide; explicit caller IDs must be unique for React/read targeting.
  if (state.notifs.some(row => row.id === input.id)) throw new RangeError('Duplicate source notification id')
  const notification: SourceAccountNotification = Object.freeze({
    id: input.id, type: input.type, key: input.key, title: input.title,
    body: input.body || '', link: input.link || null, at: input.at, read: false,
  })
  return Object.freeze({ ...state,
    notifs: Object.freeze([notification, ...state.notifs].slice(0, 100)),
    notifKeys: Object.freeze({ ...state.notifKeys, [input.key]: 1 as const }),
  })
}

/** Navigation remains the caller's responsibility; link and all other fields are preserved. */
export function readSourceNotification(state: SourceAccountEventState, id: string): SourceAccountEventState {
  if (!state.notifs.some(row => row.id === id && !row.read)) return state
  return Object.freeze({ ...state, notifs: Object.freeze(state.notifs.map(row => row.id === id ? Object.freeze({ ...row, read: true }) : row)) })
}

export function readAllSourceNotifications(state: SourceAccountEventState): SourceAccountEventState {
  if (state.notifs.every(row => row.read)) return state
  return Object.freeze({ ...state, notifs: Object.freeze(state.notifs.map(row => row.read ? row : Object.freeze({ ...row, read: true }))) })
}

export function setSourceNotificationPreference(state: SourceAccountEventState, key: SourceNotificationPreferenceKey, value: boolean): SourceAccountEventState {
  if (!Object.prototype.hasOwnProperty.call(SOURCE_NOTIFICATION_DEFAULT_PREFERENCES, key) || typeof value !== 'boolean') throw new TypeError('Invalid source notification preference')
  const next = key === 'chW' ? true : value
  if (state.notifPrefs[key] === next) return state
  return Object.freeze({ ...state, notifPrefs: Object.freeze({ ...state.notifPrefs, [key]: next }) })
}

export type SourceAccountEntitlement = Readonly<{
  kind: 'ready'; tier: 'low' | 'high'; why: 'guest' | 'paid' | 'trade' | 'credit' | 'free' | 'free-out'
  label: string; bal: number | null; freeLeft?: number
}> | Readonly<{ kind: 'unsupported'; reason: string }>

/** PLAN presentation only: never use this preview projection to authorize an AI/order request. */
export function projectSourceEntitlement(state: SourceAccountEventState, signedIn: boolean, now: number): SourceAccountEntitlement {
  if (state.source !== 'client-source-preview' || state.sourceSha !== SOURCE_ACCOUNT_REFERENCE_SHA || typeof signedIn !== 'boolean' || !Number.isFinite(now) || now < 0 || now > 8.64e15) return { kind: 'unsupported', reason: '원본 체험 상태 또는 기준 시간을 확인할 수 없어요.' }
  if (!signedIn) return { kind: 'ready', tier: 'low', why: 'guest', label: '기본 분석', bal: null }
  // Unlike the coercive original, malformed flags/counters never imply a higher tier.
  if (typeof state.payDone !== 'boolean' || typeof state.uidLinked !== 'boolean'
    || !Number.isSafeInteger(state.creditBal) || state.creditBal < 0
    || !Number.isSafeInteger(state.freeUsed) || state.freeUsed < 0
    || (state.tradeActiveUntil !== null && (!Number.isFinite(state.tradeActiveUntil) || state.tradeActiveUntil < 0 || state.tradeActiveUntil > 8.64e15))) return { kind: 'unsupported', reason: '플랜 표시를 위한 체험 수치가 유효하지 않아요.' }
  if (state.payDone) return { kind: 'ready', tier: 'high', why: 'paid', label: 'PRO, 구독', bal: null }
  if (state.uidLinked && state.tradeActiveUntil !== null && now < state.tradeActiveUntil) return { kind: 'ready', tier: 'high', why: 'trade', label: 'PRO, 파트너 거래 활성', bal: null }
  if (state.uidLinked && state.creditBal >= SOURCE_ACCOUNT_CREDIT.costHigh) return { kind: 'ready', tier: 'high', why: 'credit', label: 'PRO 크레딧', bal: state.creditBal }
  if (state.freeUsed < SOURCE_ACCOUNT_CREDIT.freeQuota) return { kind: 'ready', tier: 'high', why: 'free', label: '무료 체험', bal: state.uidLinked ? state.creditBal : null, freeLeft: SOURCE_ACCOUNT_CREDIT.freeQuota - state.freeUsed }
  return { kind: 'ready', tier: 'low', why: 'free-out', label: '업그레이드 필요', bal: state.uidLinked ? state.creditBal : null }
}
