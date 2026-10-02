import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import {
  SOURCE_ACCOUNT_REFERENCE_SHA, SOURCE_ACCOUNT_CREDIT, SOURCE_NOTIFICATION_DEFAULT_PREFERENCES,
  createSourceAccountEventState, appendSourceNotification, readSourceNotification,
  readAllSourceNotifications, setSourceNotificationPreference, projectSourceEntitlement,
  type SourceAccountEventState, type SourceAccountNotification, type SourceAccountReview,
  type SourceNotificationPreferenceKey,
} from '../src/client-account-event-state'

// Frozen original 42a0d81 index.html tfNFInit/tfEnt (comments omitted), plus teth-copy.js credit literal.
// Only these small functions run in a VM: never the full HTML, external scripts or browser globals.
// Original slices (including original comments) SHA-256:
// tfNFInit e05ff45e6bdc8cbe8f8fef509ea1e2c30d4669384e988c9157ba1956d88c604f
// tfEnt eb5f4e2b838f8b1d8bb7425f79102776378084a75881ad4c5242e91aad701459
// tfNotify e3015add39f10224dad18142baee8b546663a5604f2b39cc10922ecae08d1f28
// tfNotifReadAll d347bb8776322b1a67903be003e94e40a5631ada2b521987e2d4344318be016f
// tfNotifGo 9ccbc95ae3e4045effe466eb6aba0be0b4f87fe84d942001358d491ef41f75b3
const originalProjection = `
function tfNFInit(){
  var t=tfS();
  if(t.creditBal==null) t.creditBal=0;
  t.creditGrants=t.creditGrants||{};
  t.creditReqs=t.creditReqs||[];
  t.notifs=t.notifs||[];
  t.rebates=t.rebates||[];
  t.reviews=t.reviews||[];
  t.periodics=t.periodics||[];
  t.notifPrefs=t.notifPrefs||{pos:true,loss:true,review:true,rebate:true,watch:true,chW:true,chK:false,chT:false,chM:false};
  t.uidLinked=t.uidLinked||false;
  t.freeUsed=t.freeUsed||0;
  t.creditSeen=t.creditSeen||{};
  t.notifKeys=t.notifKeys||{};
  t.reviewKeys=t.reviewKeys||{};
  t.fillLog=t.fillLog||[];
  return t;
}
function tfEnt(){
  var t=tfNFInit(), C=TFC.credit;
  if(!S.user) return {tier:'low', why:'guest', label:'기본 분석', bal:null};
  if(t.payDone) return {tier:'high', why:'paid', label:'PRO, 구독', bal:null};
  var tradeActive=t.tradeActiveUntil&&Date.now()<t.tradeActiveUntil;
  if(t.uidLinked&&tradeActive) return {tier:'high', why:'trade', label:'PRO, 파트너 거래 활성', bal:null};
  if(t.uidLinked&&t.creditBal>=C.costHigh) return {tier:'high', why:'credit', label:'PRO 크레딧', bal:t.creditBal};
  var fq=C.freeQuota!=null?C.freeQuota:10;
  if((t.freeUsed||0)<fq) return {tier:'high', why:'free', label:'무료 체험', bal:t.uidLinked?t.creditBal:null, freeLeft:fq-(t.freeUsed||0)};
  return {tier:'low', why:'free-out', label:'업그레이드 필요', bal:t.uidLinked?t.creditBal:null};
}`
const originalNotification = `
function tfNotify(type,key,title,body,link){
  var t=tfNFInit();
  if(t.notifKeys[key]) return null;
  t.notifKeys[key]=1;
  var n={id:'n'+Date.now()+Math.floor(Math.random()*1e3),type:type,key:key,title:title,body:body||'',link:link||null,at:Date.now(),read:false};
  t.notifs.unshift(n);
  if(t.notifs.length>100) t.notifs=t.notifs.slice(0,100);
  tfSave(); tfNFBar();
  var bl=$('nf-bell'), bd=$('nf-bell-bd');
  if(bl){ bl.classList.remove('shake'); void bl.offsetWidth; bl.classList.add('shake'); }
  if(bd){ bd.classList.remove('pop'); void bd.offsetWidth; bd.classList.add('pop'); }
  return n;
}
function tfNotifReadAll(){ var t=tfNFInit(); t.notifs.forEach(function(n){ n.read=true; }); tfSave(); tfNFBar(); tfNotifRender(); if(typeof tfNFAlertsRender==='function') tfNFAlertsRender(); }
function tfNotifGo(id){
  var t=tfNFInit(); var n=t.notifs.find(function(x){return x.id===id;}); if(!n) return;
  n.read=true; tfSave(); tfNFBar();
  if(n.link){ tfNotifClose(); tfNav(n.link); }
  else { tfNotifRender(); if(typeof tfNFAlertsRender==='function') tfNFAlertsRender(); }
}`
const originalCredit = { version: 1, uidGrant: 1000, costHigh: 10, warnRatio: .8, activityDays: 30, freeQuota: 10 }
const normalized = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const now = 1_700_000_000_000
const notification = (id: string, type: SourceAccountNotification['type'] = 'pos'): SourceAccountNotification => ({ id, key: `key:${id}`, type, title: '원본 체결 +2.1%', body: '확정된 사건', link: '#/trade', at: now, read: false })

test('원본 초기화 VM과 상태 필드가 같으며 최초 이벤트는 하나도 생성하지 않는다', () => {
  const source = runInNewContext(`${originalProjection}; tfNFInit()`, { tfS: () => ({}) }, { timeout: 100 }) as Record<string, unknown>
  const state = createSourceAccountEventState()
  for (const key of Object.keys(source)) expect(state[key as keyof SourceAccountEventState]).toEqual(normalized(source[key]))
  expect(state.source).toBe('client-source-preview')
  expect(state.sourceSha).toBe(SOURCE_ACCOUNT_REFERENCE_SHA)
  expect(SOURCE_ACCOUNT_CREDIT).toEqual(originalCredit)
  for (const key of ['notifs', 'rebates', 'reviews', 'periodics', 'fillLog'] as const) expect(state[key]).toEqual([])
  expect(state.creditBal).toBe(0)
})

test('원본 PLAN 여섯 분기·우선순위·만료 경계를 384개 조합에서 VM 대조한다', () => {
  const reasons = new Set<string>()
  for (const signedIn of [false, true]) for (const payDone of [false, true]) for (const uidLinked of [false, true])
    for (const creditBal of [0, 9, 10, 1000]) for (const freeUsed of [0, 9, 10]) for (const tradeActiveUntil of [null, now - 1, now, now + 1]) {
      const state = createSourceAccountEventState({ payDone, uidLinked, creditBal, freeUsed, tradeActiveUntil })
      const result = projectSourceEntitlement(state, signedIn, now)
      const source = runInNewContext(`${originalProjection}; tfEnt()`, { tfS: () => normalized(state), S: { user: signedIn }, TFC: { credit: originalCredit }, Date: { now: () => now } }, { timeout: 100 })
      expect(result).toEqual({ kind: 'ready', ...normalized(source) })
      if (result.kind === 'ready') reasons.add(result.why)
    }
  expect([...reasons].sort()).toEqual(['credit', 'free', 'free-out', 'guest', 'paid', 'trade'])
})

test('알림 추가·100개 FIFO·영구 처리키·읽음/딥링크는 원본 VM 결과와 같다', () => {
  const raw: Record<string, unknown> = {}
  let clock = now
  const navigated: string[] = []
  const api = runInNewContext(`${originalProjection};${originalNotification}; ({add:tfNotify,read:tfNotifGo,all:tfNotifReadAll})`, {
    tfS: () => raw, Date: { now: () => clock }, Math: { floor: Math.floor, random: () => .125 },
    tfSave: () => {}, tfNFBar: () => {}, $: () => null, tfNotifRender: () => {}, tfNotifClose: () => {}, tfNav: (link: string) => navigated.push(link),
  }, { timeout: 100 }) as { add: (...args: unknown[]) => unknown; read: (id: string) => void; all: () => void }
  let state = createSourceAccountEventState()
  for (let i = 0; i < 105; i++) {
    clock = now + i
    const link = i % 2 ? '#/review/rv-123' : null
    api.add('review', `k${i}`, `알림 ${i}`, '', link)
    state = appendSourceNotification(state, { id: `n${clock}125`, key: `k${i}`, title: `알림 ${i}`, type: 'review', at: clock, link })
  }
  expect(state.notifs).toEqual(normalized(raw.notifs))
  expect(state.notifKeys).toEqual(normalized(raw.notifKeys))
  expect(state.notifs).toHaveLength(100)
  expect(Object.keys(state.notifKeys)).toHaveLength(105)
  expect(appendSourceNotification(state, { id: 'different', key: 'k0', title: '', type: 'pos', at: clock })).toBe(state)
  expect(api.add('pos', 'k0', '', '', null)).toBeNull()
  const row = state.notifs.find(item => item.link)!
  api.read(row.id)
  state = readSourceNotification(state, row.id)
  expect(state.notifs).toEqual(normalized(raw.notifs))
  expect(navigated).toEqual([row.link])
  api.all()
  state = readAllSourceNotifications(state)
  expect(state.notifs).toEqual(normalized(raw.notifs))
})

test('외부 입력 배열·원장·복기 중첩 원인을 복제하고 모든 반환 컬렉션을 동결한다', () => {
  const causes: [string, string][] = [['진입 근거', '원문 설명']]
  const review: SourceAccountReview = { id: 'rv1', fid: 'f1', botId: 'b1', asset: 'BTC', kind: 'sl', kindL: '손절', pnl: -.05, at: now, budget: 100, causes, sim: true }
  const input = { notifs: [notification('n1')], reviews: [review], notifKeys: { first: 1 as const }, creditReqs: ['r1'] }
  const state = createSourceAccountEventState(input)
  input.notifs[0] = notification('changed')
  causes[0][1] = '오염'
  input.creditReqs.push('r2')
  input.notifKeys.first = 1
  expect(state.notifs[0].id).toBe('n1')
  expect(state.reviews[0].causes[0][1]).toBe('원문 설명')
  expect(state.creditReqs).toEqual(['r1'])
  for (const item of [state, state.notifs, state.notifs[0], state.reviews, state.reviews[0], state.reviews[0].causes, state.reviews[0].causes[0], state.notifKeys, state.notifPrefs]) expect(Object.isFrozen(item)).toBe(true)
  expect(() => { (state.reviews[0].causes[0] as [string, string])[1] = '오염' }).toThrow()
})

test('단일 읽음은 다른 유형을 유지하고 모두 읽음은 필터 밖까지 처리하며 중복은 무변경이다', () => {
  const initial = createSourceAccountEventState({ notifs: [notification('p', 'pos'), notification('r', 'review'), notification('c', 'credit')] })
  const one = readSourceNotification(initial, 'r')
  expect(one.notifs.map(row => row.read)).toEqual([false, true, false])
  expect(initial.notifs.every(row => !row.read)).toBe(true)
  expect(readSourceNotification(one, 'missing')).toBe(one)
  expect(readSourceNotification(one, 'r')).toBe(one)
  const all = readAllSourceNotifications(one)
  expect(all.notifs.every(row => row.read)).toBe(true)
  expect(readAllSourceNotifications(all)).toBe(all)
  expect(all.reviews).toBe(initial.reviews)
  expect(all.creditBal).toBe(0)
})

test('9개 수신 설정만 변경 가능하고 앱 내 수신함은 항상 활성화한다', () => {
  const initial = createSourceAccountEventState()
  for (const key of Object.keys(SOURCE_NOTIFICATION_DEFAULT_PREFERENCES) as SourceNotificationPreferenceKey[]) {
    const next = setSourceNotificationPreference(initial, key, !initial.notifPrefs[key])
    expect(next.notifPrefs[key]).toBe(key === 'chW' ? true : !initial.notifPrefs[key])
    expect(next.notifs).toBe(initial.notifs)
    expect(next.notifKeys).toBe(initial.notifKeys)
    expect(next.notifPrefs.chW).toBe(true)
  }
  expect(setSourceNotificationPreference(initial, 'chW', false)).toBe(initial)
  expect(createSourceAccountEventState({ notifPrefs: { ...initial.notifPrefs, chW: false } }).notifPrefs.chW).toBe(true)
  expect(() => setSourceNotificationPreference(initial, '__proto__' as SourceNotificationPreferenceKey, true)).toThrow()
  expect(() => setSourceNotificationPreference(initial, 'pos', 'true' as unknown as boolean)).toThrow()
})

test('원본 prototype-key 버그는 교정하고 같은 키 재전달은 생성하지 않는다', () => {
  let state = createSourceAccountEventState()
  for (const key of ['__proto__', 'constructor', 'toString']) {
    const input = { id: `id:${key}`, key, type: 'bot' as const, title: '원본 알림', at: now }
    state = appendSourceNotification(state, input)
    expect(state.notifs[0].key).toBe(key)
    expect(Object.prototype.hasOwnProperty.call(state.notifKeys, key)).toBe(true)
    expect(appendSourceNotification(state, input)).toBe(state)
  }
  expect(state.notifs).toHaveLength(3)
})

test('ID 충돌과 잘못된 시간은 원본 대비 안전 교정으로 거부하며 입력을 변경하지 않는다', () => {
  const initial = createSourceAccountEventState({ notifs: [notification('same')] })
  expect(() => appendSourceNotification(initial, { id: 'same', key: 'new', type: 'pos', title: '', at: now })).toThrow('Duplicate')
  for (const at of [NaN, Infinity, -1, 8.64e15 + 1]) expect(() => appendSourceNotification(initial, { id: 'new', key: 'new', type: 'pos', title: '', at })).toThrow()
  expect(initial.notifs).toHaveLength(1)
  expect(initial.notifKeys).toEqual({})
})

test('미지원 플랜 값은 허위 자격 대신 명시 오류로 분리한다', () => {
  const initial = createSourceAccountEventState()
  for (const invalid of [NaN, Infinity, -1, .5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(projectSourceEntitlement({ ...initial, creditBal: invalid }, true, now).kind).toBe('unsupported')
    expect(projectSourceEntitlement({ ...initial, freeUsed: invalid }, true, now).kind).toBe('unsupported')
  }
  for (const invalid of [NaN, Infinity, -1, 8.64e15 + 1]) {
    expect(projectSourceEntitlement(initial, true, invalid).kind).toBe('unsupported')
    expect(projectSourceEntitlement({ ...initial, tradeActiveUntil: invalid }, true, now).kind).toBe('unsupported')
  }
  expect(projectSourceEntitlement({ ...initial, payDone: 'true' as unknown as boolean }, true, now).kind).toBe('unsupported')
  expect(projectSourceEntitlement({ ...initial, uidLinked: 1 as unknown as boolean }, true, now).kind).toBe('unsupported')
  expect(projectSourceEntitlement({ ...initial, payDone: true, creditBal: NaN }, false, now)).toMatchObject({ why: 'guest', tier: 'low' })
})

test('알림 수신과 읽음은 원금·크레딧·정산·보고서 생산으로 이어지지 않는다', () => {
  const initial = createSourceAccountEventState()
  const input = { id: 'n1', type: 'rebate' as const, key: 'r1', title: '정산', at: now }
  const added = appendSourceNotification(initial, input)
  input.title = '외부 변경'
  const final = readAllSourceNotifications(setSourceNotificationPreference(added, 'rebate', false))
  expect(final.notifs[0].title).toBe('정산')
  for (const key of ['creditBal', 'creditGrants', 'creditReqs', 'rebates', 'reviews', 'periodics', 'freeUsed', 'fillLog'] as const) expect(final[key]).toEqual(initial[key])
  expect(initial.notifs).toEqual([])
})
