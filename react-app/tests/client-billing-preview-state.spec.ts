import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import { applyBillingPreviewAction, billingPreviewBalance, billingPreviewBranch, billingPreviewConfig,
  billingPreviewLimits, billingPreviewMonthInflow, billingPreviewMonthMs, billingPreviewMonthSpend, billingPreviewMonthVolume,
  billingPreviewQuote, billingPreviewTier, createBillingPreviewState,
  type BillingPreviewAction, type BillingPreviewState } from '../src/client-billing-preview-state'

const owner = 'billing-preview-owner', now = Date.UTC(2026, 8, 16, 12)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function act(state: BillingPreviewState, action: BillingPreviewAction, id: string, at = now) {
  const result = applyBillingPreviewAction(state, { owner, id, now: at, action })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  return result
}
function funded() { return act(createBillingPreviewState(owner), { kind: 'welcome' }, 'welcome').state }
function uid() { return act(funded(), { kind: 'uid-link', linked: true }, 'uid').state }

// Source b2ee991d index.html:11883–12142 bc* and teth-copy.js billing.
// Direct source formula/control-flow oracle. DOM persistence/notifications are inert
// stubs, IDs omitted from comparisons; Date.now is fixed by the VM input.
const original = `
var b={v:1,ledger:[],seen:{},coupons:[],events:[],mode:'active',graceAt:null,cardOn:false,cycleAt:null,cardFails:0}, uid=false;
function bcInit(){return b;} function bcCfg(){return cfg;} function tfSave(){} function bcRoute(){}
function bcTier(){return b.cardOn&&uid?'CARD_UID':b.cardOn?'CARD':uid?'UID':'FREE';}
function bcBalance(){return b.ledger.reduce(function(a,e){return a+(e.amt||0);},0);}
function bcAppend(type,reason,amt,ref,idemKey){if(idemKey){if(b.seen[idemKey])return false;b.seen[idemKey]=now;}b.ledger.push({at:now,type:type,reason:reason,amt:amt,ref:ref||null});if(b.ledger.length>2000)b.ledger=b.ledger.slice(-2000);return true;}
function bcEvent(key,data){b.events.push({at:now,key:key,data:data||null});if(b.events.length>500)b.events=b.events.slice(-500);}
function bcMonthVol(){var from=b.cycleAt?b.cycleAt-30*864e5:now-30*864e5;return b.ledger.filter(function(e){return e.at>=from&&e.reason==='volume'&&e.amt>0;}).reduce(function(a,e){return a+e.amt;},0);}
function bcMonthSpend(){var from=b.cycleAt?b.cycleAt-30*864e5:now-30*864e5;return -b.ledger.filter(function(e){return e.at>=from&&e.amt<0&&e.type==='debit';}).reduce(function(a,e){return a+e.amt;},0);}
function bcMonthInflow(){var from=b.cycleAt?b.cycleAt-30*864e5:now-30*864e5;return b.ledger.filter(function(e){return e.at>=from&&e.amt>0;}).reduce(function(a,e){return a+e.amt;},0);}
function bcWarnBase(){return Math.max(bcMonthInflow(),cfg.WELCOME_CREDIT||1);}
function bcTick(){var bal=bcBalance();if(b.mode==='grace'&&bal<=(cfg.THRESHOLD_STOP||0)&&b.graceAt&&now-b.graceAt>=(cfg.GRACE_HOURS||24)*36e5){b.mode='watch';bcEvent('watch-enter',{bal:bal,tier:bcTier()});bcRoute('watch');tfSave();}}
function bcAfterChange(src){var bal=bcBalance(),warnAt=bcWarnBase()*(cfg.THRESHOLD_WARN!=null?cfg.THRESHOLD_WARN:0.2),inflow=(src!=='ai');if(b.mode==='watch'&&inflow&&bal>0){b.mode='active';b.graceAt=null;bcEvent('recover',{from:'watch',src:src,bal:bal});bcRoute('recover');}else if(b.mode==='grace'&&bal>warnAt){b.mode='active';b.graceAt=null;bcEvent('recover',{from:'grace',src:src,bal:bal});bcRoute('recover');}if(b.mode==='active'&&bal<=warnAt){b.mode='grace';b.graceAt=now;bcEvent('warn',{bal:bal,warnAt:Math.round(warnAt),tier:bcTier(),src:src});bcRoute('warn');}bcTick();tfSave();}
function bcEnsureWelcome(){var ok=bcAppend('grant','welcome',cfg.WELCOME_CREDIT||0,null,'welcome');if(ok){bcEvent('welcome',{amt:cfg.WELCOME_CREDIT});bcAfterChange('welcome');}return ok;}
function bcAiDebit(reqId){var cost=cfg.AI_CALL_COST||0,bal=bcBalance(),amt=Math.min(cost,Math.max(0,bal));if(amt>0){if(!bcAppend('debit','ai',-amt,reqId,'ai:'+reqId))return;}else if(!bcAppend('debit','ai',0,reqId,'ai:'+reqId))return;bcAfterChange('ai');}
function bcVolumeCharge(fid,ex,market,notional){if(!uid)return 0;var tbl=cfg.VOLUME_TO_CREDIT_RATE||{},rate=(tbl[ex]&&tbl[ex][market||'spot'])||(tbl.binance&&tbl.binance.spot)||0,credit=Math.round(notional*rate);if(credit<=0)return 0;var used=bcMonthVol(),cap=cfg.UID_CREDIT_CAP||Infinity,expire=0;if(used+credit>cap){expire=used+credit-cap;credit=Math.max(0,cap-used);}if(credit>0){if(!bcAppend('charge','volume',credit,fid,'vol:'+fid))return 0;if(expire>0)bcEvent('cap-expire',{fid:fid,expired:expire});bcAfterChange('volume');}else if(expire>0&&bcAppend('charge','volume',0,fid,'vol:'+fid)){bcEvent('cap-expire',{fid:fid,expired:expire});}return credit;}
function bcPromoCardUid(){if(bcTier()!=='CARD_UID')return false;var ok=bcAppend('grant','promo',cfg.PROMO_AI_CREDIT_USD||0,'usd100','promo-carduid');if(ok){bcEvent('promo-carduid',{amt:cfg.PROMO_AI_CREDIT_USD});bcAfterChange('promo');}return ok;}
function bcCardOn(on){b.cardOn=!!on;if(on){if(!b.cycleAt)b.cycleAt=now+30*864e5;bcEvent('card-on',{});bcAfterChange('card');}else{bcEvent('card-off',{});tfSave();}return b.cardOn;}
function bcCardCharged(cycleKey){if(!bcAppend('charge','card',cfg.CARD_CREDIT_MONTHLY||0,cycleKey,'card:'+cycleKey))return false;bcEvent('card-charged',{cycle:cycleKey});bcAfterChange('card');return true;}
function bcBranch(){var tier=bcTier();if(tier==='FREE')return 'free.out';if(tier==='CARD')return 'card.out';var v=bcMonthVol(),u=bcMonthSpend();if(v<=0)return 'uid.novol';if(tier==='CARD_UID')return 'carduid.out';if(u>=(cfg.CARD_CREDIT_MONTHLY||3000)*0.5)return 'uid.heavy';return 'uid.small';}
function bcBillQuote(){var offset=Math.min(1,bcMonthVol()/(cfg.CARD_CREDIT_MONTHLY||1)),gross=cfg.CARD_PLAN_PRICE_USD||0,net=Math.max(0,gross*(1-offset)),cp=null;if(net>0){for(var i=0;i<b.coupons.length;i++){if(!b.coupons[i].usedAt){cp=b.coupons[i];break;}}if(cp)net=Math.max(0,net*(1-(cp.rate||0)));}return{gross:gross,offset:offset,net:Math.round(net*100)/100,coupon:cp?cp.id:null};}
function bcCycleReset(cycleKey){var from=b.cycleAt?b.cycleAt-30*864e5:now-30*864e5,cardIn=b.ledger.filter(function(e){return e.at>=from&&e.reason==='card'&&e.amt>0;}).reduce(function(a,e){return a+e.amt;},0);if(cardIn<=0)return 0;var spend=bcMonthSpend(),vol=bcMonthVol(),cardUsed=Math.max(0,spend-vol),remain=Math.min(bcBalance(),Math.max(0,cardIn-cardUsed));if(remain>0&&bcAppend('reset','cycle',-remain,cycleKey,'reset:'+cycleKey))bcEvent('cycle-reset',{cycle:cycleKey,expired:remain});return remain;}
bcEnsureWelcome();bcEnsureWelcome();
for(var j=0;j<10;j++)bcAiDebit('r'+j);bcAiDebit('r0');bcAiDebit('zero');
now+=24*36e5;bcTick();uid=true;bcAfterChange('uid-link');bcVolumeCharge('f1','binance','spot',12500);bcVolumeCharge('f1','binance','spot',12500);
bcVolumeCharge('f2','woox','futures',3000000);bcVolumeCharge('f3','binance','spot',10000);
bcCardOn(true);bcPromoCardUid();bcCardCharged('initial');bcAiDebit('card-ai');
var quote=bcBillQuote();bcCycleReset('reset-fixture');
({ledger:b.ledger,events:b.events,mode:b.mode,graceAt:b.graceAt,cardOn:b.cardOn,cycleAt:b.cycleAt,balance:bcBalance(),volume:bcMonthVol(),spend:bcMonthSpend(),inflow:bcMonthInflow(),branch:bcBranch(),tier:bcTier(),quote:quote});`

test('고정시각 원본VM welcome·소진·24시간·복구·cap·카드·promo·reset golden과 일치한다', () => {
  const expected = clone(runInNewContext(original, { cfg: billingPreviewConfig, now }, { timeout: 1000 }))
  let state = funded(), seq = 0
  const run = (action: BillingPreviewAction, at = now) => { state = act(freeze(state), action, `gold-${seq++}`, at).state }
  run({ kind: 'welcome' })
  for (let i = 0; i < 10; i++) run({ kind: 'debit', reqId: `r${i}` })
  run({ kind: 'debit', reqId: 'r0' }); run({ kind: 'debit', reqId: 'zero' })
  const later = now + 24 * 36e5
  run({ kind: 'tick' }, later); run({ kind: 'uid-link', linked: true }, later)
  for (let i = 0; i < 2; i++) run({ kind: 'volume', fid: 'f1', exchange: 'binance', market: 'spot', notional: 12500 }, later)
  run({ kind: 'volume', fid: 'f2', exchange: 'woox', market: 'futures', notional: 3000000 }, later)
  run({ kind: 'volume', fid: 'f3', exchange: 'binance', market: 'spot', notional: 10000 }, later)
  run({ kind: 'card-on', on: true }, later); run({ kind: 'promo' }, later)
  run({ kind: 'card-charge', cycleKey: 'initial' }, later); run({ kind: 'debit', reqId: 'card-ai' }, later)
  const quote = billingPreviewQuote(state, later)
  run({ kind: 'reset', cycleKey: 'reset-fixture' }, later)
  expect({ ledger: state.ledger.map(({ at, type, reason, amt, ref }) => ({ at, type, reason, amt, ref })), events: state.events,
    mode: state.mode, graceAt: state.graceAt, cardOn: state.cardOn, cycleAt: state.cycleAt, balance: billingPreviewBalance(state),
    volume: billingPreviewMonthVolume(state, later), spend: billingPreviewMonthSpend(state, later), inflow: billingPreviewMonthInflow(state, later),
    branch: billingPreviewBranch(state, later), tier: billingPreviewTier(state), quote }).toEqual(expected)
})

test('owner·입력경계·프로토타입형req/fid·timestamp0 멱등성 및 불변성을 지킨다', () => {
  const state = freeze(createBillingPreviewState(owner))
  const first = act(state, { kind: 'welcome' }, '__proto__', 0)
  expect(billingPreviewBalance(first.state)).toBe(100)
  expect(act(first.state, { kind: 'welcome' }, 'constructor', 0).changed).toBe(false)
  expect(state.ledger).toEqual([])
  expect(act(first.state, { kind: 'welcome' }, '__proto__', 0).state).toBe(first.state)
  const rejected = applyBillingPreviewAction(first.state, { owner: 'other', id: 'x', now, action: { kind: 'welcome' } })
  expect(rejected).toMatchObject({ ok: false, state: first.state, error: 'owner-mismatch' })
  for (const at of [-1, NaN, Infinity, 1.5]) expect(applyBillingPreviewAction(state, { owner, id: 'bad', now: at, action: { kind: 'welcome' } })).toMatchObject({ ok: false, error: 'invalid-input' })
  let linked = act(first.state, { kind: 'uid-link', linked: true }, 'link', 0).state
  for (const fid of ['__proto__', 'constructor', 'toString']) {
    linked = act(linked, { kind: 'volume', fid, exchange: '__proto__', notional: 25000 }, `first-${fid}`, 0).state
    const repeat = act(linked, { kind: 'volume', fid, exchange: 'binance', notional: 25000 }, `again-${fid}`, 0)
    expect(repeat.changed).toBe(false)
  }
  expect(billingPreviewMonthVolume(linked, 0)).toBe(30)
  expect(Object.getPrototypeOf(linked.seen)).toBe(Object.prototype)
})

test('grace정확24시간·0timestamp·양의잔고유예·watch회복후새유예를 구분한다', () => {
  let state = createBillingPreviewState(owner)
  state = act(state, { kind: 'after-change', source: 'ai' }, 'warn', 0).state
  expect(state).toMatchObject({ mode: 'grace', graceAt: 0 })
  expect(act(state, { kind: 'tick' }, 'early', 24 * 36e5 - 1).state.mode).toBe('grace')
  state = act(state, { kind: 'tick' }, 'boundary', 24 * 36e5).state
  expect(state.mode).toBe('watch')
  state = act(state, { kind: 'uid-link', linked: true }, 'uid', 24 * 36e5).state
  const recovery = act(state, { kind: 'volume', fid: 'small', exchange: 'binance', notional: 2500 }, 'recover', 24 * 36e5)
  expect(recovery.state).toMatchObject({ mode: 'grace', graceAt: 24 * 36e5 })
  expect(recovery.state.events.slice(-2).map(event => event.key)).toEqual(['recover', 'warn'])
  expect(recovery.notifications.some(intent => intent.titleKey === 'bill.recover.t')).toBe(true)
  expect(act(recovery.state, { kind: 'tick' }, 'positive', 100 * 36e5).state.mode).toBe('grace')
})

test('AI부분차감은0하한이며차감요청과관망알림이중복되지않는다', () => {
  let state = act(funded(), { kind: 'qa-drain', ratio: 0.05 }, 'five').state
  state = act(state, { kind: 'debit', reqId: 'partial' }, 'partial-action').state
  expect(state.ledger.at(-1)?.amt).toBe(-5)
  expect(billingPreviewBalance(state)).toBe(0)
  const zero = act(state, { kind: 'debit', reqId: 'zero' }, 'zero-action')
  expect(zero.state.ledger.at(-1)?.amt).toBe(0)
  expect(act(zero.state, { kind: 'debit', reqId: 'zero' }, 'zero-retry').changed).toBe(false)
  const first = act(zero.state, { kind: 'blocked' }, 'notice'), repeat = act(first.state, { kind: 'blocked' }, 'notice-again')
  // The day/branch warning emitted by the drain already owns this notification.
  expect(first.notifications).toEqual([])
  expect(repeat.notifications).toEqual([])
})

test('volume가드·거래소율·월2000cap·초과0원장멱등성을 보존한다', () => {
  const volume = { kind: 'volume', fid: 'f', exchange: 'woox', market: 'futures', notional: 10000 } as const
  expect(act(funded(), volume, 'unlinked').changed).toBe(false)
  let state = act(uid(), volume, 'linked').state
  expect(state.ledger.at(-1)?.amt).toBe(7)
  state = act(state, { ...volume, fid: 'cap', notional: 10000000 }, 'cap').state
  expect(billingPreviewMonthVolume(state, now)).toBe(2000)
  state = act(state, { ...volume, fid: 'expire' }, 'expire').state
  expect(state.ledger.at(-1)?.amt).toBe(0)
  expect(state.events.at(-1)).toMatchObject({ key: 'cap-expire', data: { fid: 'expire', expired: 7 } })
  expect(act(state, { ...volume, fid: 'expire' }, 'expire-retry').changed).toBe(false)
  for (const notional of [-1, NaN, Infinity]) expect(applyBillingPreviewAction(state, { owner, id: 'invalid', now, action: { ...volume, notional } })).toMatchObject({ ok: false, error: 'invalid-input' })
})

test('월집계는원본30일경계포함·결제앵커·수정분과reset소비제외를 보존한다', () => {
  const state = createBillingPreviewState(owner), from = now - billingPreviewMonthMs
  state.ledger = [
    { id: 'old', at: from - 1, type: 'charge', reason: 'volume', amt: 99, ref: 'old' },
    { id: 'v', at: from, type: 'charge', reason: 'volume', amt: 20, ref: 'v' },
    { id: 'd', at: now, type: 'debit', reason: 'ai', amt: -10, ref: 'd' },
    { id: 'r', at: now, type: 'reset', reason: 'cycle', amt: -5, ref: 'r' },
    { id: 'a', at: now, type: 'adjust', reason: 'recon-negbal', amt: 2, ref: null },
  ]
  expect(billingPreviewMonthVolume(state, now)).toBe(20)
  expect(billingPreviewMonthSpend(state, now)).toBe(10)
  expect(billingPreviewMonthInflow(state, now)).toBe(22)
  expect(billingPreviewBalance(state)).toBe(106)
  state.cycleAt = now + billingPreviewMonthMs
  expect(billingPreviewMonthVolume(state, now)).toBe(0)
  expect(billingPreviewMonthInflow(state, now)).toBe(2)
})

test('FREE·UID·CARD·CARD_UID분기와과다소비카드제안경계를 원본대로 구분한다', () => {
  let state = funded()
  expect(billingPreviewBranch(state, now)).toBe('free.out')
  state = act(state, { kind: 'uid-link', linked: true }, 'uid').state
  expect(billingPreviewBranch(state, now)).toBe('uid.novol')
  state = act(state, { kind: 'volume', fid: 'v', exchange: 'binance', notional: 5000000 }, 'volume').state
  expect(billingPreviewBranch(state, now)).toBe('uid.small')
  state = act(state, { kind: 'qa-drain', ratio: 0 }, 'drain').state
  expect(billingPreviewBranch(state, now)).toBe('uid.heavy')
  state = act(state, { kind: 'card-on', on: true }, 'card').state
  expect(billingPreviewBranch(state, now)).toBe('carduid.out')
  state = act(state, { kind: 'uid-link', linked: false }, 'unlink').state
  expect(billingPreviewBranch(state, now)).toBe('card.out')
})

test('성공월사이클은카드잔여만reset하고쿠폰1개소모·앵커이동·재충전한다', () => {
  let state = act(funded(), { kind: 'qa-card', on: true }, 'card').state
  state = act(state, { kind: 'coupon', couponId: '__proto__' }, 'coupon1').state
  state = act(state, { kind: 'coupon', couponId: 'coupon2' }, 'coupon2').state
  expect(billingPreviewQuote(state, now)).toEqual({ gross: 49, offset: 0, net: 4.9, coupon: '__proto__' })
  const due = state.cycleAt!
  expect(act(state, { kind: 'cycle' }, 'early', due - 1).changed).toBe(false)
  const result = act(freeze(state), { kind: 'cycle' }, 'due', due)
  expect(result.state.ledger.slice(-2).map(entry => [entry.type, entry.amt])).toEqual([['reset', -3000], ['charge', 3000]])
  expect(billingPreviewBalance(result.state)).toBe(3100)
  expect(result.state.cycleAt).toBe(due + billingPreviewMonthMs)
  expect(result.state.coupons.map(coupon => coupon.usedAt)).toEqual([due, null])
  expect(result.notifications.some(intent => intent.titleKey === 'bill.card.cross.t')).toBe(true)
  expect(act(result.state, { kind: 'cycle' }, 'due', due).changed).toBe(false)
  expect(state.coupons.every(coupon => coupon.usedAt === null)).toBe(true)
})

test('청구0은쿠폰을보존하고이미소진된timestamp0쿠폰은재사용하지않는다', () => {
  const state = uid()
  state.coupons = [{ id: 'used', kind: 'rescue90', rate: 0.9, at: 0, usedAt: 0 }, { id: 'free', kind: 'rescue90', rate: 0.9, at: 0, usedAt: null }]
  expect(billingPreviewQuote(state, now).coupon).toBe('free')
  // Source aggregate can exceed the current grant cap in an imported/reconciled fixture.
  state.ledger.push({ id: 'import', at: now, type: 'charge', reason: 'volume', amt: 3000, ref: 'v' })
  expect(billingPreviewQuote(state, now)).toEqual({ gross: 49, offset: 1, net: 0, coupon: null })
})

test('결제실패3회는관망이고실패중쿠폰·원장은유지되며후속성공으로회복한다', () => {
  let state = act(funded(), { kind: 'qa-card', on: true }, 'card').state
  state = act(state, { kind: 'coupon', couponId: 'rescue' }, 'coupon').state
  state = act(state, { kind: 'qa-pay-fail', fail: true }, 'fail').state
  const originalLedger = clone(state.ledger), due = state.cycleAt!
  for (let i = 1; i <= 3; i++) {
    const attempt = act(state, { kind: 'cycle' }, `try${i}`, due)
    state = attempt.state
    expect(state.cardFails).toBe(i)
    expect(state.ledger).toEqual(originalLedger)
    expect(state.coupons[0].usedAt).toBeNull()
    expect(state.mode).toBe(i === 3 ? 'watch' : 'active')
    if (i === 3) expect(attempt.notifications.map(intent => intent.titleKey)).toContain('bill.dunning.t')
  }
  state = act(state, { kind: 'qa-pay-fail', fail: false }, 'success-mode', due).state
  state = act(state, { kind: 'cycle' }, 'success', due).state
  expect(state).toMatchObject({ mode: 'active', cardFails: 0, graceAt: null })
  expect(state.coupons[0].usedAt).toBe(due)
})

test('reconcile은prototype형fid중복을append보정하고음수잔액을복구한다', () => {
  const state = createBillingPreviewState(owner)
  state.ledger = [
    { id: 'a', at: now, type: 'charge', reason: 'volume', amt: 10, ref: '__proto__' },
    { id: 'b', at: now, type: 'charge', reason: 'volume', amt: 10, ref: '__proto__' },
    { id: 'c', at: now, type: 'debit', reason: 'ai', amt: -30, ref: 'request' },
  ]
  const before = clone(state), after = act(freeze(state), { kind: 'reconcile' }, 'recon').state
  expect(after.ledger.slice(0, 3)).toEqual(before.ledger)
  expect(after.ledger.slice(3).map(entry => [entry.reason, entry.amt])).toEqual([['recon-dupfid', -10], ['recon-negbal', 20]])
  expect(billingPreviewBalance(after)).toBe(0)
  expect(act(after, { kind: 'reconcile' }, 'recon-again').changed).toBe(false)
  expect(act(after, { kind: 'reconcile' }, 'tomorrow', now + 864e5).state.ledger).toEqual(after.ledger)
})

test('최대한도실패는원장FIFO삭제없이원자적으로거절하고재시도를소비하지않는다', () => {
  const state = funded()
  state.ledger = Array.from({ length: billingPreviewLimits.ledger }, (_, i) => ({ id: `entry${i}`, at: now, type: 'charge', reason: 'qa', amt: 1, ref: null }))
  const request = { owner, id: 'full', now, action: { kind: 'qa-card', on: true } as const }
  const result = applyBillingPreviewAction(freeze(state), request)
  expect(result).toEqual({ ok: false, state, notifications: [], error: 'history-full' })
  expect(state.cardOn).toBe(false)
  expect(state.seen).not.toHaveProperty('action:full')
  expect(billingPreviewBalance(state)).toBe(2000)
  const eventFull = funded()
  eventFull.events = Array.from({ length: billingPreviewLimits.events }, () => ({ at: now, key: 'fixture', data: null }))
  const coupon = applyBillingPreviewAction(freeze(eventFull), { owner, id: 'coupon', now, action: { kind: 'coupon', couponId: 'new' } })
  expect(coupon).toMatchObject({ ok: false, state: eventFull, error: 'history-full' })
  expect(eventFull.coupons).toEqual([])
})

test('QA grace/watch/card와boot는명시행동만수행하고모든기존원장을보존한다', () => {
  let state = funded()
  state = act(state, { kind: 'qa-grace' }, 'grace').state
  expect(state.mode).toBe('grace')
  state = act(state, { kind: 'qa-watch' }, 'watch').state
  expect(state.mode).toBe('watch')
  state = act(state, { kind: 'qa-topup' }, 'topup').state
  expect(state.mode).toBe('active')
  const rows = clone(state.ledger)
  state = act(state, { kind: 'qa-card', on: true }, 'card').state
  state = act(state, { kind: 'qa-card', on: false }, 'off').state
  expect(state.cardOn).toBe(false)
  expect(state.ledger.slice(0, rows.length)).toEqual(rows)
  const boot = act(createBillingPreviewState(owner), { kind: 'boot' }, 'boot').state
  expect(boot.events.map(event => event.key)).toEqual(['welcome', 'recon'])
  expect(act(boot, { kind: 'boot' }, 'boot-again').changed).toBe(false)
})
