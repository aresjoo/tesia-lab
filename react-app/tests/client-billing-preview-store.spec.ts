import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import { billingPreviewStorageKey, createBillingPreviewStore } from '../src/client-billing-preview-store'
import { applyBillingPreviewAction, billingPreviewBalance, billingPreviewLimits, createBillingPreviewState, type BillingPreviewAction } from '../src/client-billing-preview-state'

const owner = 'account@example.test', key = billingPreviewStorageKey(owner)
function storageFixture() {
  const data = new Map<string, string>(), writes: [string, string][] = [], reads: string[] = []
  const fail = { get: false, set: false, afterSet: false, readback: false, drop: false, corrupt: false }
  let wrote = false
  return { data, writes, reads, fail, port: {
    getItem(key: string) { reads.push(key); if (fail.get || fail.readback && wrote) throw new Error('read fixture'); return data.get(key) ?? null },
    setItem(key: string, value: string) {
      if (fail.set) throw new Error('write fixture')
      writes.push([key, value]); wrote = true
      if (!fail.drop) data.set(key, fail.corrupt ? '{}' : value)
      if (fail.afterSet) throw new Error('persisted then threw')
    },
  } }
}
function fixture() {
  const f = storageFixture(), store = createBillingPreviewStore(owner, f.port)
  return { ...f, store }
}
function prepared() {
  const f = fixture()
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'welcome').ok).toBe(true)
  expect(f.store.dispatch({ kind: 'blocked' }, 1001, 'notice').ok).toBe(true)
  return f
}
type Saved = { v: 1; owner: string; state: ReturnType<typeof createBillingPreviewState>; notifications: ReturnType<ReturnType<typeof createBillingPreviewStore>['getSnapshot']>['notifications'] }
const saved = (f: ReturnType<typeof prepared>): Saved => JSON.parse(f.data.get(key)!)

test('hydrate는 빈 owner 상태만 읽고 welcome·boot·알림·쓰기·guest 자금을 만들지 않는다', () => {
  const f = fixture()
  expect(f.store.getSnapshot()).toEqual({ state: createBillingPreviewState(owner), error: null, notifications: [] })
  expect(f.writes).toEqual([])
  const reads = f.reads.length, guest = createBillingPreviewStore(null, f.port)
  expect(guest.getSnapshot()).toEqual({ state: null, error: null, notifications: [] })
  expect(guest.dispatch({ kind: 'welcome' }, 1000, 'guest')).toMatchObject({ ok: false, error: 'owner-required', state: null, notifications: [] })
  expect(guest.readAll()).toBe(false); expect(guest.retry()).toBe(true)
  expect(f.reads).toHaveLength(reads); expect(f.writes).toEqual([])
})

test('explicit boot·welcome은 atomic 저장되고 reload/중복ID 후 추가 지급되지 않는다', () => {
  const f = fixture(), result = f.store.dispatch({ kind: 'boot' }, 1000, 'boot')
  expect(result.ok).toBe(true)
  expect(billingPreviewBalance(f.store.getSnapshot().state!)).toBe(100)
  const reload = createBillingPreviewStore(owner, f.port), writes = f.writes.length
  expect(reload.getSnapshot()).toEqual(f.store.getSnapshot())
  expect(reload.dispatch({ kind: 'boot' }, 1000, 'boot')).toMatchObject({ ok: true, changed: false, notifications: [] })
  expect(reload.dispatch({ kind: 'welcome' }, 1001, 'another')).toMatchObject({ ok: true, changed: false })
  expect(f.writes).toHaveLength(writes)
  expect(reload.getSnapshot().state!.ledger).toHaveLength(1)
})

test('동일 raw의 무변경 dispatch·retry·read는 snapshot identity와 구독0·쓰기0을 유지하되 저장소는 다시 읽는다', () => {
  const f = fixture(), before = f.store.getSnapshot(), notifications: string[] = []
  f.store.subscribe(() => notifications.push('changed'))
  const reads = f.reads.length
  for (let i = 0; i < 5; i++) {
    expect(f.store.dispatch({ kind: 'tick' }, 1000 + i, `tick-${i}`)).toMatchObject({ ok: true, changed: false })
    expect(f.store.getSnapshot()).toBe(before)
  }
  expect(f.store.retry()).toBe(true)
  expect(f.store.readAll()).toBe(true)
  expect(f.store.read('missing')).toBe(true)
  expect(f.store.getSnapshot()).toBe(before)
  expect(f.reads.length - reads).toBe(8)
  expect(f.writes).toEqual([]); expect(notifications).toEqual([])
  expect(f.store.dispatch({ kind: 'welcome' }, 1010, 'welcome').ok).toBe(true)
  const committed = f.store.getSnapshot(), writes = f.writes.length
  expect(f.store.dispatch({ kind: 'welcome' }, 1010, 'welcome')).toMatchObject({ ok: true, changed: false })
  expect(f.store.getSnapshot()).toBe(committed)
  expect(notifications).toEqual(['changed']); expect(f.writes).toHaveLength(writes)
})

test('검증된 동일 bytes는 decode cache를 재사용하고 외부 변경·읽기오류 뒤 retry는 재검증한다', () => {
  const f = fixture()
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'welcome').ok).toBe(true)
  let parses = 0
  const exports: Record<string, typeof createBillingPreviewStore> = {}
  const context = { exports, TextEncoder,
    JSON: { parse: (raw: string) => { parses++; return JSON.parse(raw) }, stringify: JSON.stringify },
    require: () => ({ applyBillingPreviewAction, billingPreviewLimits, createBillingPreviewState }) }
  const compiled = ts.transpileModule(readFileSync('src/client-billing-preview-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 1000 })
  const store = exports.createBillingPreviewStore(owner, f.port), before = store.getSnapshot(), notices: string[] = []
  store.subscribe(() => notices.push('changed'))
  expect(parses).toBe(1)
  expect(store.dispatch({ kind: 'tick' }, 1001, 'tick').ok).toBe(true)
  expect(store.retry()).toBe(true); expect(store.readAll()).toBe(true)
  expect(parses).toBe(1); expect(store.getSnapshot()).toBe(before); expect(notices).toEqual([])

  expect(f.store.dispatch({ kind: 'debit', reqId: 'external' }, 1002, 'external').ok).toBe(true)
  expect(store.dispatch({ kind: 'tick' }, 1003, 'refresh')).toMatchObject({ ok: true, changed: false })
  expect(parses).toBe(2); expect(store.getSnapshot()).not.toBe(before)
  expect(billingPreviewBalance(store.getSnapshot().state!)).toBe(90)
  expect(notices).toEqual(['changed'])
  const refreshed = store.getSnapshot()
  expect(store.retry()).toBe(true); expect(parses).toBe(2); expect(store.getSnapshot()).toBe(refreshed)

  f.fail.get = true
  expect(store.retry()).toBe(false)
  expect(store.getSnapshot().state).toBe(refreshed.state)
  f.fail.get = false
  expect(store.retry()).toBe(true)
  expect(parses).toBe(3)
  expect(store.getSnapshot()).toEqual(refreshed)
  expect(store.getSnapshot()).not.toBe(refreshed)
  expect(notices).toEqual(['changed', 'changed', 'changed'])
})

test('cache가 있더라도 외부 손상 bytes를 발견하면 차단하고 예전 정상 bytes 복구도 retry에서 검증한다', () => {
  const f = prepared(), valid = f.data.get(key)!, before = f.store.getSnapshot()
  f.data.set(key, '{broken')
  expect(f.store.dispatch({ kind: 'tick' }, 1002, 'check')).toMatchObject({ ok: false, error: 'invalid-state' })
  expect(f.store.getSnapshot().state).toBe(before.state)
  f.data.set(key, valid)
  expect(f.store.dispatch({ kind: 'tick' }, 1002, 'check')).toMatchObject({ ok: false, error: 'retry-required' })
  expect(f.store.retry()).toBe(true)
  const recovered = f.store.getSnapshot()
  expect(recovered).toEqual(before)
  expect(f.store.dispatch({ kind: 'tick' }, 1002, 'check')).toMatchObject({ ok: true, changed: false })
  expect(f.store.getSnapshot()).toBe(recovered)
})

test('admit는 welcome·tick·blocked를 하나의 요청과 저장으로 처리하고 같은ID 재시도는 무변경이다', () => {
  const f = fixture()
  expect(f.store.dispatch({ kind: 'admit' }, 1000, 'admit')).toMatchObject({ ok: true, changed: true })
  expect(f.writes).toHaveLength(1)
  expect(billingPreviewBalance(f.store.getSnapshot().state!)).toBe(100)
  const first = f.store.getSnapshot()
  expect(f.store.dispatch({ kind: 'admit' }, 1000, 'admit')).toMatchObject({ ok: true, changed: false, notifications: [] })
  expect(f.store.getSnapshot()).toBe(first); expect(f.writes).toHaveLength(1)
  expect(f.store.dispatch({ kind: 'qa-watch' }, 1001, 'watch').ok).toBe(true)
  const writes = f.writes.length, notices: string[] = []
  f.store.subscribe(() => notices.push('changed'))
  const nextDay = 864e5 + 1000
  expect(f.store.dispatch({ kind: 'admit' }, nextDay, 'blocked-admit')).toMatchObject({ ok: true, changed: true })
  expect(f.writes).toHaveLength(writes + 1)
  expect(f.store.getSnapshot().state?.mode).toBe('watch')
  expect(f.store.getSnapshot().notifications.at(-1)?.intent.key).toBe('bill.free.out:1')
  expect(notices).toEqual(['changed'])
  const blocked = f.store.getSnapshot()
  expect(f.store.dispatch({ kind: 'admit' }, nextDay, 'blocked-admit')).toMatchObject({ ok: true, changed: false })
  expect(f.store.getSnapshot()).toBe(blocked); expect(notices).toEqual(['changed'])
})

test('두 store가 오래된 snapshot을 가져도 매 dispatch 최신 wrapper를 읽어 원장을 합친다', () => {
  const f = fixture(), second = createBillingPreviewStore(owner, f.port)
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'welcome').ok).toBe(true)
  expect(second.dispatch({ kind: 'debit', reqId: 'r1' }, 1001, 'd1').ok).toBe(true)
  expect(f.store.dispatch({ kind: 'debit', reqId: 'r2' }, 1002, 'd2').ok).toBe(true)
  expect(billingPreviewBalance(f.store.getSnapshot().state!)).toBe(80)
  expect(f.store.getSnapshot().state!.ledger.map(entry => entry.ref)).toEqual([null, 'r1', 'r2'])
  const writes = f.writes.length
  expect(second.dispatch({ kind: 'welcome' }, 1000, 'welcome')).toMatchObject({ ok: true, changed: false })
  expect(f.writes).toHaveLength(writes)
})

test('알림은 engine key/seen과 함께 저장하며 reload·read·readAll은 같은 owner에 영속된다', () => {
  const f = prepared(), notification = f.store.getSnapshot().notifications[0]
  expect(notification).toMatchObject({ id: 'billing:notice:0', at: 1001, read: false, intent: { key: 'bill.free.out:0', titleKey: 'bill.free.out.t', bodyKey: 'bill.free.out.b', link: '#/plan', data: null } })
  const reload = createBillingPreviewStore(owner, f.port)
  expect(reload.getSnapshot().notifications).toEqual([notification])
  expect(reload.read(notification.id)).toBe(true)
  expect(createBillingPreviewStore(owner, f.port).getSnapshot().notifications[0].read).toBe(true)
  expect(f.store.dispatch({ kind: 'qa-watch' }, 1002, 'watch').ok).toBe(true)
  expect(f.store.getSnapshot().notifications).toHaveLength(2)
  expect(f.store.getSnapshot().notifications[0].read).toBe(true)
  expect(f.store.readAll()).toBe(true)
  expect(createBillingPreviewStore(owner, f.port).getSnapshot().notifications.every(item => item.read)).toBe(true)
  const writes = f.writes.length
  expect(f.store.readAll()).toBe(true); expect(f.store.read('missing')).toBe(true)
  expect(f.writes).toHaveLength(writes)
})

test('알림은 오래된순 FIFO 100개를 보존하며 seen을 삭제하지 않는다', () => {
  const f = fixture()
  for (let day = 0; day < 102; day++) expect(f.store.dispatch({ kind: 'blocked' }, day * 864e5, `day-${day}`).ok).toBe(true)
  const snapshot = createBillingPreviewStore(owner, f.port).getSnapshot()
  expect(snapshot.notifications).toHaveLength(100)
  expect(snapshot.notifications[0].intent.key).toBe('bill.free.out:2')
  expect(snapshot.notifications.at(-1)!.intent.key).toBe('bill.free.out:101')
  expect(Object.hasOwn(snapshot.state!.seen, 'notice:bill.free.out:0')).toBe(true)
})

test('owner 키 분리·payload owner mismatch·잘못된 owner는 다른 계정 state를 반환하지 않는다', () => {
  const f = prepared()
  for (const candidate of ['a/b', 'a%2Fb', '한글']) {
    const store = createBillingPreviewStore(candidate, f.port)
    expect(store.dispatch({ kind: 'welcome' }, 1000, 'same-id').ok).toBe(true)
    expect(store.getSnapshot().state?.owner).toBe(candidate)
  }
  expect(f.data.size).toBe(4)
  f.data.set(billingPreviewStorageKey('another'), f.data.get(key)!)
  const other = createBillingPreviewStore('another', f.port)
  expect(other.getSnapshot()).toEqual({ state: null, error: 'owner-mismatch', notifications: [] })
  for (const invalid of ['', ' owner', 'line\nbreak', 'a'.repeat(241), '\ud800']) {
    const reads = f.reads.length, store = createBillingPreviewStore(invalid, f.port)
    expect(store.getSnapshot()).toEqual({ state: null, error: 'invalid-owner', notifications: [] })
    expect(store.dispatch({ kind: 'welcome' }, 1000, 'id').ok).toBe(false)
    expect(f.reads).toHaveLength(reads)
  }
})

test('손상 bytes는 보존하고 dispatch/읽음 처리를 잠그며 explicit retry만 오류를 해제한다', () => {
  const f = fixture(), raw = '{bad'
  f.data.set(key, raw)
  expect(f.store.retry()).toBe(false)
  const before = f.store.getSnapshot(), reads = f.reads.length
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'id')).toMatchObject({ ok: false, error: 'retry-required', notifications: [] })
  expect(f.store.readAll()).toBe(false)
  expect(f.reads).toHaveLength(reads)
  expect(f.store.getSnapshot()).toBe(before); expect(f.data.get(key)).toBe(raw); expect(f.writes).toEqual([])
  f.data.set(key, JSON.stringify({ v: 1, owner, state: createBillingPreviewState(owner), notifications: [] }))
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'id').ok).toBe(false)
  expect(f.store.retry()).toBe(true)
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'id').ok).toBe(true)
})

test('unknown fields·nonfinite·중복ID·역행원장·seen/이벤트/알림 손상을 거절한다', () => {
  const f = prepared(), good = saved(f)
  const changes: ((value: Saved) => void)[] = [
    value => { Reflect.set(value, 'extra', true) }, value => { Reflect.set(value.state, 'tier', 'CARD') },
    value => { value.state.ledger[0].amt = Infinity }, value => { value.state.ledger[0].at = -1 },
    value => { value.state.ledger.push({ ...value.state.ledger[0] }) },
    value => { value.state.ledger.push({ ...value.state.ledger[0], id: 'other', at: 999 }) },
    value => { value.state.ledger[0].reason = 'unknown' }, value => { value.state.ledger[0].type = 'reset' },
    value => { value.state.seen.welcome = NaN }, value => { value.state.seen.unknown = 1000 },
    value => { Object.defineProperty(value.state.seen, '__proto__', { enumerable: true, value: 1 }) },
    value => { Reflect.set(value.state, 'constructor', { polluted: true }) },
    value => { value.state.cardFails = .5 },
    value => { value.state.events[0].key = 'unknown' }, value => { value.state.events[0].data = { amt: 'not-number' } },
    value => { value.notifications[0].intent.titleKey = 'arbitrary' },
    value => { Reflect.set(value.notifications[0], 'foreignAuthority', true) },
    value => { value.notifications[0].at = 1002 },
    value => { delete value.state.seen['notice:bill.free.out:0'] },
  ]
  for (const change of changes) {
    const value = structuredClone(good); change(value)
    const raw = JSON.stringify(value); f.data.set(key, raw)
    const store = createBillingPreviewStore(owner, f.port)
    expect(store.getSnapshot(), String(change)).toEqual({ state: null, error: 'invalid-state', notifications: [] })
    expect(store.dispatch({ kind: 'boot' }, 2000, 'boot').ok).toBe(false)
    expect(f.data.get(key)).toBe(raw)
  }
  // JSON.stringify(Infinity) becomes null, which is a valid active graceAt.
  // Supply an overflowing JSON number so decoding actually encounters Infinity.
  const overflowing = JSON.stringify(good).replace('"graceAt":null', '"graceAt":1e999')
  f.data.set(key, overflowing)
  expect(createBillingPreviewStore(owner, f.port).getSnapshot()).toEqual({ state: null, error: 'invalid-state', notifications: [] })
  expect(f.data.get(key)).toBe(overflowing)
  expect(Reflect.get(Object.prototype, 'polluted')).toBeUndefined()
})

test('2MB·ledger2000·event/coupon engine limits·알림100·seen20000 한도를 넘으면 복원하지 않는다', () => {
  const f = prepared(), good = saved(f)
  const variants = [
    { ...good, state: { ...good.state, ledger: Array.from({ length: billingPreviewLimits.ledger + 1 }, (_, i) => ({ ...good.state.ledger[0], id: `L${i}` })) } },
    { ...good, state: { ...good.state, events: Array.from({ length: billingPreviewLimits.events + 1 }, () => good.state.events[0]) } },
    { ...good, state: { ...good.state, coupons: Array.from({ length: billingPreviewLimits.coupons + 1 }, (_, i) => ({ id: `C${i}`, kind: 'rescue90', rate: .9, at: 0, usedAt: null })) } },
    { ...good, notifications: Array.from({ length: 101 }, () => good.notifications[0]) },
    { ...good, state: { ...good.state, seen: Object.fromEntries(Array.from({ length: 20001 }, (_, i) => [`action:${i}`, 0])) } },
  ]
  for (const raw of [...variants.map(value => JSON.stringify(value)), ' '.repeat(2_000_001), '가'.repeat(666_667)]) {
    f.data.set(key, raw)
    expect(createBillingPreviewStore(owner, f.port).getSnapshot().error).toBe('invalid-state')
    expect(f.data.get(key)).toBe(raw)
  }
})

test('허용하지 않은 action·extra key·잘못된시간/ID는 쓰기없이 거절하고 store를 잠그지 않는다', () => {
  const f = fixture()
  for (const action of [null, {}, { kind: 'unknown' }, { kind: 'welcome', fee: 10 }, { kind: 'volume', fid: 'a', exchange: 'x', notional: Infinity },
    { kind: 'card-on', on: 'yes' }, { kind: 'coupon', couponId: 'x', kindName: '' }, { kind: 'qa-drain', ratio: 2 },
    Object.create({ kind: 'welcome' })]) expect(f.store.dispatch(action as BillingPreviewAction, 1000, 'id').ok).toBe(false)
  for (const now of [-1, .5, Infinity, NaN]) expect(f.store.dispatch({ kind: 'welcome' }, now, 'id').ok).toBe(false)
  for (const id of ['', ' id', '\ud800', 'a'.repeat(241)]) expect(f.store.dispatch({ kind: 'welcome' }, 1000, id).ok).toBe(false)
  expect(f.store.getSnapshot().error).toBeNull(); expect(f.writes).toEqual([])
  expect(f.store.dispatch({ kind: 'welcome' }, 1000, 'constructor').ok).toBe(true)
  expect(f.store.dispatch({ kind: 'debit', reqId: '__proto__' }, 999, 'past').ok).toBe(false)
  expect(f.store.dispatch({ kind: 'debit', reqId: '__proto__' }, 1001, '__proto__').ok).toBe(true)
})

test('쓰기 전/후예외·무시된쓰기·재조회 실패는 새 state/알림을 publish하지 않고 retry 전 재변경을 막는다', () => {
  for (const mode of ['set', 'afterSet', 'drop', 'readback', 'corrupt'] as const) {
    const f = fixture(), before = f.store.getSnapshot()
    f.fail[mode] = true
    const result = f.store.dispatch({ kind: 'blocked' }, 1000, 'notice')
    expect(result).toMatchObject({ ok: false, notifications: [], error: ['set', 'afterSet'].includes(mode) ? 'write-failed' : 'readback-failed' })
    expect(f.store.getSnapshot().state).toBe(before.state)
    expect(f.store.getSnapshot().notifications).toBe(before.notifications)
    const reads = f.reads.length, writes = f.writes.length
    f.fail[mode] = false
    expect(f.store.dispatch({ kind: 'blocked' }, 1000, 'notice')).toMatchObject({ ok: false, error: 'retry-required' })
    expect(f.reads).toHaveLength(reads); expect(f.writes).toHaveLength(writes)
    if (mode !== 'corrupt') {
      expect(f.store.retry()).toBe(true)
      expect(f.store.dispatch({ kind: 'blocked' }, 1000, 'notice').ok).toBe(true)
      expect(f.store.getSnapshot().notifications).toHaveLength(1)
    }
  }
})

test('read failure와 읽음 저장 실패도 이전 snapshot을 보존하며 새 알림/read 표시는 노출하지 않는다', () => {
  const f = prepared(), before = f.store.getSnapshot()
  f.fail.get = true
  expect(f.store.dispatch({ kind: 'qa-watch' }, 1002, 'watch')).toMatchObject({ ok: false, error: 'read-failed', notifications: [] })
  expect(f.store.getSnapshot().state).toBe(before.state)
  f.fail.get = false; expect(f.store.retry()).toBe(true)
  f.fail.set = true
  expect(f.store.readAll()).toBe(false)
  expect(f.store.getSnapshot().notifications[0].read).toBe(false)
  f.fail.set = false; expect(f.store.retry()).toBe(true)
  expect(f.store.readAll()).toBe(true)
})

test('snapshot은 deep frozen이고 subscriber 예외가 저장 성공을 실패로 바꾸지 않는다', () => {
  const f = fixture(), notices: string[] = []
  f.store.subscribe(() => { throw new Error('view only') })
  const unsubscribe = f.store.subscribe(() => notices.push('published'))
  expect(f.store.dispatch({ kind: 'blocked' }, 1000, 'notice').ok).toBe(true)
  const snapshot = f.store.getSnapshot()
  expect(Object.isFrozen(snapshot)).toBe(true); expect(Object.isFrozen(snapshot.state?.seen)).toBe(true)
  expect(Object.isFrozen(snapshot.notifications[0].intent)).toBe(true)
  expect(notices).toEqual(['published'])
  unsubscribe(); expect(f.store.readAll()).toBe(true); expect(notices).toEqual(['published'])
})

test('QA signed graceAt·coupon·UID·card·cycle의 정상 engine state를 누락없이 보존한다', () => {
  const f = fixture()
  const actions: BillingPreviewAction[] = [{ kind: 'welcome' }, { kind: 'qa-watch' }, { kind: 'qa-topup' }, { kind: 'uid-link', linked: true },
    { kind: 'qa-card', on: true }, { kind: 'promo' }, { kind: 'coupon', couponId: 'coupon' }, { kind: 'qa-pay-fail', fail: true }]
  actions.forEach((action, i) => expect(f.store.dispatch(action, 1000 + i, `step-${i}`).ok, action.kind).toBe(true))
  expect(createBillingPreviewStore(owner, f.port).getSnapshot()).toEqual(f.store.getSnapshot())
  expect(f.store.getSnapshot().state?.coupons).toHaveLength(1)
})

test('모듈/명시port에는 clock·network·전역storage 의존성이 없고 default getter 실패는 안전하게 잠긴다', () => {
  const exports: Record<string, typeof createBillingPreviewStore> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, TextEncoder, require: () => ({ applyBillingPreviewAction, billingPreviewLimits, createBillingPreviewState }),
    fetch: forbidden('fetch'), Date: forbidden('Date'), setTimeout: forbidden('setTimeout'), setInterval: forbidden('setInterval') }
  for (const name of ['window', 'document', 'sessionStorage', 'localStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  const compiled = ts.transpileModule(readFileSync('src/client-billing-preview-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 1000 }); expect(touches).toEqual([])
  const store = exports.createBillingPreviewStore(owner, storageFixture().port)
  expect(store.dispatch({ kind: 'welcome' }, 1000, 'id').ok).toBe(true); expect(touches).toEqual([])
  expect(exports.createBillingPreviewStore(null).getSnapshot().state).toBeNull(); expect(touches).toEqual([])
  expect(exports.createBillingPreviewStore(owner).getSnapshot().error).toBe('storage-unavailable')
  expect(touches).toEqual(['sessionStorage'])
})
