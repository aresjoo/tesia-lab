/** Synthetic client b2ee991d bc* preview ONLY (index.html + teth-copy.js billing).
 * No payment, entitlement, service account, network, persistence or implicit clock.
 * Source provisional amounts/30-day windows are retained, not financial policy.
 */
export const billingPreviewConfig = Object.freeze({ WELCOME_CREDIT: 100, UID_CREDIT_CAP: 2000,
  CARD_CREDIT_MONTHLY: 3000, AI_CALL_COST: 10, THRESHOLD_WARN: 0.2, THRESHOLD_STOP: 0,
  GRACE_HOURS: 24, CARD_PLAN_PRICE_USD: 49, DUNNING_RETRY_MAX: 3, DISCOUNT_RESCUE: 0.9, PROMO_AI_CREDIT_USD: 100,
  VOLUME_TO_CREDIT_RATE: Object.freeze({ binance: Object.freeze({ spot: 0.0004, futures: 0.0006 }),
    okx: Object.freeze({ spot: 0.0004, futures: 0.0006 }), woox: Object.freeze({ spot: 0.0005, futures: 0.0007 }) }) })
export const billingPreviewLimits = Object.freeze({ ledger: 2000, events: 2000, coupons: 500 })
export const billingPreviewMonthMs = 30 * 864e5
export type BillingPreviewMode = 'active' | 'grace' | 'watch'
export type BillingPreviewTier = 'FREE' | 'UID' | 'CARD' | 'CARD_UID'
export type BillingPreviewBranch = 'free.out' | 'card.out' | 'uid.novol' | 'carduid.out' | 'uid.heavy' | 'uid.small'
export type BillingPreviewLedgerEntry = { id: string; at: number; type: 'grant' | 'charge' | 'debit' | 'reset' | 'adjust'; reason: string; amt: number; ref: string | null }
export type BillingPreviewCoupon = { id: string; kind: string; rate: number; at: number; usedAt: number | null }
export type BillingPreviewEvent = { at: number; key: string; data: Record<string, string | number | boolean | null> | null }
export type BillingPreviewState = { v: 1; owner: string; uidLinked: boolean; ledger: BillingPreviewLedgerEntry[];
  seen: Record<string, number>; coupons: BillingPreviewCoupon[]; events: BillingPreviewEvent[];
  mode: BillingPreviewMode; graceAt: number | null; cardOn: boolean; cycleAt: number | null; cardFails: number; simPayFail: boolean }
export type BillingPreviewNotification = { key: string; titleKey: string; bodyKey: string; link: '#/plan' | null;
  data: Record<string, string | number | boolean | null> | null }
export type BillingPreviewAction =
  | { kind: 'welcome' | 'promo' | 'tick' | 'blocked' | 'cycle' | 'reconcile' | 'boot' | 'admit' | 'qa-topup' | 'qa-grace' | 'qa-watch' }
  | { kind: 'debit'; reqId: string }
  | { kind: 'volume'; fid: string; exchange: string; market?: 'spot' | 'futures'; notional: number }
  | { kind: 'uid-link'; linked: boolean }
  | { kind: 'card-on' | 'qa-card'; on: boolean }
  | { kind: 'card-charge' | 'reset'; cycleKey: string }
  | { kind: 'after-change'; source: string }
  | { kind: 'coupon'; couponId: string; kindName?: string }
  | { kind: 'qa-drain'; ratio: number }
  | { kind: 'qa-pay-fail'; fail: boolean }
export type BillingPreviewRequest = { owner: string; id: string; now: number; action: BillingPreviewAction }
export type BillingPreviewError = 'owner-mismatch' | 'invalid-input' | 'history-full' | 'id-conflict' | 'arithmetic-overflow'
export type BillingPreviewActionResult = { ok: true; state: BillingPreviewState; notifications: BillingPreviewNotification[]; changed: boolean }
  | { ok: false; state: BillingPreviewState; notifications: []; error: BillingPreviewError }

const own = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key)
const validKey = (value: string) => typeof value === 'string' && value.trim().length > 0 && value.length <= 240
export function createBillingPreviewState(owner: string): BillingPreviewState {
  if (!validKey(owner)) throw new RangeError('미리보기 소유자가 필요해요.')
  return { v: 1, owner, uidLinked: false, ledger: [], seen: {}, coupons: [], events: [], mode: 'active',
    graceAt: null, cardOn: false, cycleAt: null, cardFails: 0, simPayFail: false }
}
export function billingPreviewTier(state: BillingPreviewState): BillingPreviewTier {
  return state.cardOn ? state.uidLinked ? 'CARD_UID' : 'CARD' : state.uidLinked ? 'UID' : 'FREE'
}
export function billingPreviewBalance(state: BillingPreviewState): number { return state.ledger.reduce((sum, entry) => sum + entry.amt, 0) }
const monthFrom = (state: BillingPreviewState, now: number) => (state.cycleAt ?? now) - billingPreviewMonthMs
export function billingPreviewMonthVolume(state: BillingPreviewState, now: number): number {
  return state.ledger.filter(entry => entry.at >= monthFrom(state, now) && entry.reason === 'volume' && entry.amt > 0).reduce((sum, entry) => sum + entry.amt, 0)
}
export function billingPreviewMonthSpend(state: BillingPreviewState, now: number): number {
  return -state.ledger.filter(entry => entry.at >= monthFrom(state, now) && entry.type === 'debit' && entry.amt < 0).reduce((sum, entry) => sum + entry.amt, 0)
}
export function billingPreviewMonthInflow(state: BillingPreviewState, now: number): number {
  return state.ledger.filter(entry => entry.at >= monthFrom(state, now) && entry.amt > 0).reduce((sum, entry) => sum + entry.amt, 0)
}
export function billingPreviewWarnBase(state: BillingPreviewState, now: number): number {
  return Math.max(billingPreviewMonthInflow(state, now), billingPreviewConfig.WELCOME_CREDIT)
}
export function billingPreviewBranch(state: BillingPreviewState, now: number): BillingPreviewBranch {
  const tier = billingPreviewTier(state)
  if (tier === 'FREE') return 'free.out'
  if (tier === 'CARD') return 'card.out'
  if (billingPreviewMonthVolume(state, now) <= 0) return 'uid.novol'
  if (tier === 'CARD_UID') return 'carduid.out'
  return billingPreviewMonthSpend(state, now) >= billingPreviewConfig.CARD_CREDIT_MONTHLY * 0.5 ? 'uid.heavy' : 'uid.small'
}
export function billingPreviewQuote(state: BillingPreviewState, now: number) {
  const offset = Math.min(1, billingPreviewMonthVolume(state, now) / billingPreviewConfig.CARD_CREDIT_MONTHLY)
  const gross = billingPreviewConfig.CARD_PLAN_PRICE_USD
  let net = Math.max(0, gross * (1 - offset))
  const coupon = net > 0 ? state.coupons.find(item => item.usedAt === null) : undefined
  if (coupon) net = Math.max(0, net * (1 - coupon.rate))
  return { gross, offset, net: Math.round(net * 100) / 100, coupon: coupon?.id ?? null }
}
class BillingFailure extends Error { constructor(readonly code: BillingPreviewError) { super(code) } }

/** A transaction clones before modification and rolls back ALL work on limits/errors.
 * `seen` uses own-property membership, including timestamp zero and prototype-like keys.
 * Request IDs deduplicate whole actions; domain keys deduplicate fills/AI/cycles separately.
 */
export function applyBillingPreviewAction(state: BillingPreviewState, request: BillingPreviewRequest): BillingPreviewActionResult {
  const failure = (error: BillingPreviewError): BillingPreviewActionResult => ({ ok: false, state, notifications: [], error })
  if (!validKey(request.owner) || state.owner !== request.owner) return failure('owner-mismatch')
  if (!validKey(request.id) || !Number.isSafeInteger(request.now) || request.now < 0 || request.now > 8640000000000000 - billingPreviewMonthMs) return failure('invalid-input')
  const actionKey = `action:${request.id}`
  if (own(state.seen, actionKey)) return { ok: true, state, notifications: [], changed: false }
  const b: BillingPreviewState = { ...state, ledger: [...state.ledger], seen: { ...state.seen },
    coupons: state.coupons.map(item => ({ ...item })), events: [...state.events] }
  const notifications: BillingPreviewNotification[] = [], cfg = billingPreviewConfig, now = request.now
  let serial = 0, touched = false
  const seen = (key: string) => own(b.seen, key)
  const mark = (key: string) => { Object.defineProperty(b.seen, key, { value: now, enumerable: true, configurable: true, writable: true }); touched = true }
  const event = (key: string, data: BillingPreviewEvent['data'] = null) => {
    if (b.events.length >= billingPreviewLimits.events) throw new BillingFailure('history-full')
    b.events.push({ at: now, key, data }); touched = true
  }
  const append = (type: BillingPreviewLedgerEntry['type'], reason: string, amt: number, ref: string | null, key: string) => {
    if (seen(key)) return false
    if (!Number.isFinite(amt) || !Number.isFinite(billingPreviewBalance(b) + amt)) throw new BillingFailure('arithmetic-overflow')
    if (b.ledger.length >= billingPreviewLimits.ledger) throw new BillingFailure('history-full')
    const id = `${request.id}:L${serial++}`
    if (b.ledger.some(entry => entry.id === id)) throw new BillingFailure('id-conflict')
    mark(key); b.ledger.push({ id, at: now, type, reason, amt, ref }); return true
  }
  const notify = (key: string, base: string, link: '#/plan' | null = '#/plan') => {
    if (seen(`notice:${key}`)) return
    mark(`notice:${key}`)
    notifications.push({ key, titleKey: `${base}.t`, bodyKey: `${base}.b`, link, data: null })
  }
  const route = (trigger: 'recover' | 'warn' | 'watch' | 'blocked') => {
    const day = Math.floor(now / 864e5)
    if (trigger === 'recover') { notify(`bill.recover:${day}`, 'bill.recover', null); return }
    if (trigger === 'watch') notify(`bill.watch:${day}`, 'bill.watch')
    const branch = billingPreviewBranch(b, now)
    notify(`bill.${branch}:${day}`, `bill.${branch}`)
    if (branch === 'uid.heavy') event('rescue-offer', { day })
  }
  const tick = () => {
    if (b.mode === 'grace' && billingPreviewBalance(b) <= cfg.THRESHOLD_STOP && b.graceAt !== null
      && now - b.graceAt >= cfg.GRACE_HOURS * 36e5) {
      b.mode = 'watch'; event('watch-enter', { bal: billingPreviewBalance(b), tier: billingPreviewTier(b) }); route('watch')
    }
  }
  const after = (src: string) => {
    const bal = billingPreviewBalance(b), warnAt = billingPreviewWarnBase(b, now) * cfg.THRESHOLD_WARN
    if (b.mode === 'watch' && src !== 'ai' && bal > 0) {
      b.mode = 'active'; b.graceAt = null; event('recover', { from: 'watch', src, bal }); route('recover')
    } else if (b.mode === 'grace' && bal > warnAt) {
      b.mode = 'active'; b.graceAt = null; event('recover', { from: 'grace', src, bal }); route('recover')
    }
    if (b.mode === 'active' && bal <= warnAt) {
      b.mode = 'grace'; b.graceAt = now; event('warn', { bal, warnAt: Math.round(warnAt), tier: billingPreviewTier(b), src }); route('warn')
    }
    tick()
  }
  const welcome = () => {
    if (append('grant', 'welcome', cfg.WELCOME_CREDIT, null, 'welcome')) { event('welcome', { amt: cfg.WELCOME_CREDIT }); after('welcome') }
  }
  const promo = () => {
    if (billingPreviewTier(b) === 'CARD_UID' && append('grant', 'promo', cfg.PROMO_AI_CREDIT_USD, 'usd100', 'promo-carduid')) {
      event('promo-carduid', { amt: cfg.PROMO_AI_CREDIT_USD }); after('promo')
    }
  }
  const cardOn = (on: boolean) => {
    b.cardOn = on; touched = true
    if (on) { b.cycleAt ??= now + billingPreviewMonthMs; event('card-on', {}); after('card') }
    else event('card-off', {})
  }
  const cardCharge = (cycleKey: string) => {
    if (!append('charge', 'card', cfg.CARD_CREDIT_MONTHLY, cycleKey, `card:${cycleKey}`)) return
    event('card-charged', { cycle: cycleKey })
    if (!b.uidLinked) notify(`bill.card.cross:${cycleKey}`, 'bill.card.cross')
    after('card')
  }
  const reset = (cycleKey: string) => {
    const cardIn = b.ledger.filter(entry => entry.at >= monthFrom(b, now) && entry.reason === 'card' && entry.amt > 0).reduce((sum, entry) => sum + entry.amt, 0)
    if (cardIn <= 0) return
    const cardUsed = Math.max(0, billingPreviewMonthSpend(b, now) - billingPreviewMonthVolume(b, now))
    const remain = Math.min(billingPreviewBalance(b), Math.max(0, cardIn - cardUsed))
    if (remain > 0 && append('reset', 'cycle', -remain, cycleKey, `reset:${cycleKey}`)) event('cycle-reset', { cycle: cycleKey, expired: remain })
  }
  const cycle = (): boolean => {
    if (!b.cardOn || b.cycleAt === null || now < b.cycleAt) return false
    const cycleKey = `cy${b.cycleAt}`, q = billingPreviewQuote(b, now)
    if (!b.simPayFail) {
      event('card-bill', { cycle: cycleKey, gross: q.gross, offset: Math.round(q.offset * 100) / 100, net: q.net, coupon: q.coupon })
      if (q.coupon) { b.coupons = b.coupons.map(item => item.id === q.coupon ? { ...item, usedAt: now } : item); event('coupon-use', { id: q.coupon }) }
      reset(cycleKey); b.cycleAt += billingPreviewMonthMs; b.cardFails = 0; cardCharge(cycleKey); return true
    }
    b.cardFails++; event('pay-fail', { cycle: cycleKey, tries: b.cardFails })
    if (b.cardFails >= cfg.DUNNING_RETRY_MAX && b.mode !== 'watch') {
      b.mode = 'watch'; b.graceAt = null; event('watch-enter', { reason: 'dunning', tries: b.cardFails })
      notify(`bill.dunning:${Math.floor(now / 864e5)}`, 'bill.dunning'); route('watch')
    }
    return false
  }
  const reconcile = () => {
    const day = Math.floor(now / 864e5)
    if (seen(`recon:${day}`)) return
    mark(`recon:${day}`)
    let fixed = 0
    const byFid = new Map<string, BillingPreviewLedgerEntry[]>()
    for (const entry of b.ledger) if (entry.reason === 'volume' && entry.ref) {
      const entries = byFid.get(entry.ref) ?? []; entries.push(entry); byFid.set(entry.ref, entries)
    }
    for (const [fid, entries] of byFid) if (entries.length > 1) {
      const duplicate = entries.slice(1).reduce((sum, entry) => sum + entry.amt, 0)
      if (duplicate !== 0 && append('adjust', 'recon-dupfid', -duplicate, fid, `adj:${fid}`)) fixed -= duplicate
    }
    const bal = billingPreviewBalance(b)
    if (bal < 0 && append('adjust', 'recon-negbal', -bal, null, `adjneg:${day}`)) fixed -= bal
    event('recon', { day, fixed, bal: billingPreviewBalance(b) })
  }
  const qaGrant = () => { append('charge', 'qa', Math.ceil(billingPreviewWarnBase(b, now) * 0.5) + 50, null, `qa:${request.id}:grant`); after('qa') }
  const qaDrain = (target: number) => {
    const amount = billingPreviewBalance(b) - target
    if (amount > 0) { append('debit', 'qa', -amount, null, `qa:${request.id}:drain`); after('ai') }
  }
  try {
    const action = request.action
    switch (action.kind) {
      case 'welcome': welcome(); break
      // Same source gate order, one preview transaction/read rather than three.
      case 'admit': welcome(); tick(); if (b.mode === 'watch') route('blocked'); break
      case 'debit': {
        if (!validKey(action.reqId)) throw new BillingFailure('invalid-input')
        const amount = Math.min(cfg.AI_CALL_COST, Math.max(0, billingPreviewBalance(b)))
        if (append('debit', 'ai', amount === 0 ? 0 : -amount, action.reqId, `ai:${action.reqId}`)) after('ai')
        break
      }
      case 'volume': {
        if (!validKey(action.fid) || !validKey(action.exchange) || !Number.isFinite(action.notional) || action.notional < 0
          || (action.market !== undefined && action.market !== 'spot' && action.market !== 'futures')) throw new BillingFailure('invalid-input')
        if (!b.uidLinked) break
        const table = cfg.VOLUME_TO_CREDIT_RATE
        const rate = own(table, action.exchange) ? table[action.exchange as keyof typeof table][action.market ?? 'spot'] : table.binance.spot
        const raw = Math.round(action.notional * rate)
        if (!Number.isSafeInteger(raw)) throw new BillingFailure('arithmetic-overflow')
        if (raw <= 0) break
        const used = billingPreviewMonthVolume(b, now), credit = Math.max(0, Math.min(raw, cfg.UID_CREDIT_CAP - used)), expired = raw - credit
        if (append('charge', 'volume', credit, action.fid, `vol:${action.fid}`)) {
          if (expired > 0) event('cap-expire', { fid: action.fid, expired })
          if (credit > 0) after('volume')
        }
        break
      }
      case 'promo': promo(); break
      case 'uid-link':
        if (typeof action.linked !== 'boolean') throw new BillingFailure('invalid-input')
        b.uidLinked = action.linked; touched = true
        if (action.linked) { promo(); after('uid-link') }
        break
      case 'card-on': case 'qa-card':
        if (typeof action.on !== 'boolean') throw new BillingFailure('invalid-input')
        cardOn(action.on)
        if (action.kind === 'qa-card' && action.on) cardCharge(`cyqa${request.id}`)
        break
      case 'card-charge': case 'reset':
        if (!validKey(action.cycleKey)) throw new BillingFailure('invalid-input')
        if (action.kind === 'card-charge') cardCharge(action.cycleKey); else reset(action.cycleKey)
        break
      case 'after-change':
        if (!validKey(action.source)) throw new BillingFailure('invalid-input')
        after(action.source); break
      case 'tick': tick(); break
      case 'blocked': route('blocked'); break
      case 'coupon': {
        if (!validKey(action.couponId) || (action.kindName !== undefined && !validKey(action.kindName))) throw new BillingFailure('invalid-input')
        if (b.coupons.some(item => item.id === action.couponId)) break
        if (b.coupons.length >= billingPreviewLimits.coupons) throw new BillingFailure('history-full')
        const coupon = { id: action.couponId, kind: action.kindName ?? 'rescue90', rate: cfg.DISCOUNT_RESCUE, at: now, usedAt: null }
        b.coupons.push(coupon); event('coupon-grant', { id: coupon.id, kind: coupon.kind }); break
      }
      case 'cycle': cycle(); break
      case 'reconcile': reconcile(); break
      case 'boot': { welcome(); tick(); let guard = 0; while (cycle() && ++guard < 24) { /* Source catch-up limit. */ } reconcile(); break }
      case 'qa-topup': qaGrant(); break
      case 'qa-drain':
        if (!Number.isFinite(action.ratio) || action.ratio < 0 || action.ratio > 1) throw new BillingFailure('invalid-input')
        qaDrain(billingPreviewWarnBase(b, now) * action.ratio); break
      case 'qa-grace': {
        if (b.mode === 'watch') qaGrant()
        const target = Math.floor(billingPreviewWarnBase(b, now) * cfg.THRESHOLD_WARN)
        if (billingPreviewBalance(b) <= target) qaGrant()
        qaDrain(Math.max(0, target)); break
      }
      case 'qa-watch':
        qaDrain(0); after('ai'); b.graceAt = now - (cfg.GRACE_HOURS + 1) * 36e5; touched = true; tick(); break
      case 'qa-pay-fail':
        if (typeof action.fail !== 'boolean') throw new BillingFailure('invalid-input')
        b.simPayFail = action.fail; touched = true; break
      default: throw new BillingFailure('invalid-input')
    }
    if (!Number.isFinite(billingPreviewBalance(b)) || (b.cycleAt !== null && !Number.isSafeInteger(b.cycleAt))) throw new BillingFailure('arithmetic-overflow')
    if (!touched) return { ok: true, state, notifications: [], changed: false }
    mark(actionKey)
    return { ok: true, state: b, notifications, changed: true }
  } catch (error) {
    if (error instanceof BillingFailure) return failure(error.code)
    throw error
  }
}
