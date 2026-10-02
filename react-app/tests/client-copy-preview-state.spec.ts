import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import { adjustCopyPreview, calculateCopyPreview, closeCopyPreview, copyPreviewDashboard, copyPreviewPairs,
  createCopyPreviewState, flattenCopyPreview, startCopyPreview, topUpCopyPreview,
  type CopyPreviewActionResult, type CopyPreviewCopy, type CopyPreviewState } from '../src/client-copy-preview-state'
import { sourceSharedStrategies, type SharedStrategy } from '../src/client-shared-strategies'

// Directly transcribed from origin/main 621cbedcdd6b8f30b9b678763d8ed0bf2767e8bb
// index.html:10941–10970 cpCalc, identical to f209bdf's equity-last-close update.
// teth-copy.js copytrade.PROFIT_SHARE=0.10. Pure source VM oracle only;
// not actual account, execution or financial validation.
const originalCalc = `function cpCalc(c2){
  var s2=tfSSFind(c2.nick), m=s2?cpMeta(c2.nick):null;
  var inv=c2.ledger.reduce(function(a,e){ return a+(e.type==='add'?e.amt:-e.amt); },0);
  if(!s2||!s2.r.eq||s2.r.eq.length<32) return {inv:inv,pnlPct:0,total:0,realized:0,unreal:0,share:0,net:0,est:inv,avail:inv,posOpen:false};
  var eq=s2.r.eq;
  var startI=c2.simStartI!=null?c2.simStartI:eq[eq.length-31].i;
  var e0=null,e1=eq[eq.length-1];
  for(var k=0;k<eq.length;k++){ if(eq[k].i>=startI){ e0=eq[k]; break; } }
  if(!e0) e0=eq[0];
  if(c2.flatI!=null){
    for(var k2=eq.length-1;k2>=0;k2--){ if(eq[k2].i<=c2.flatI){ e1=eq[k2]; break; } }
  }
  var pnlPct=e1.v/e0.v-1;
  var total=c2.amount*pnlPct;
  var closed=(s2.r.trades||[]).filter(function(x){ var e=(x.exit!=null?x.exit:x.entry); return e>=startI&&(c2.flatI==null||e<=c2.flatI); });
  var lastX=-1; closed.forEach(function(x){ var e=(x.exit!=null?x.exit:x.entry); if(e>lastX) lastX=e; });
  var eLast=e0;
  if(lastX>=0){ for(var k3=eq.length-1;k3>=0;k3--){ if(eq[k3].i<=lastX){ eLast=eq[k3]; break; } } }
  var realized=lastX>=0?c2.amount*(eLast.v/e0.v-1):0;
  var unreal=total-realized;
  if(c2.flatI!=null){ realized=total; unreal=0; }
  var share=Math.max(0,realized)*(m?m.share:0.1);
  var net=total-share;
  var posOpen=Math.abs(unreal)>c2.amount*0.002;
  var est=inv+net;
  var avail=Math.max(0,est-(posOpen?c2.amount*0.4:0));
  return {inv:inv,pnlPct:pnlPct,total:total,realized:realized,unreal:unreal,share:share,net:net,est:est,avail:avail,posOpen:posOpen,closedN:closed.length};
} cpCalc(copy);`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function next(result: CopyPreviewActionResult): CopyPreviewState {
  expect(result.ok, result.ok ? '' : result.message).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result.state
}
const owner = 'preview-owner'
const request = { owner, id: 'cp1', at: 100, amount: 200, pairs: ['BTC/USDT'], mode: 'ratio' as const }
function fixture(last = 1.2): SharedStrategy {
  const row = sourceSharedStrategies()[0]
  return { ...row, nick: 'fixture', asset: '비트코인', result: { ...row.result,
    eq: Array.from({ length: 40 }, (_, i) => ({ i, v: i === 39 ? last : 1 })),
    trades: [{ entry: 12, exit: 19, pnl: 0.05, kind: 'tp', lowVol: false }],
  } }
}
function started(source = fixture()) { return next(startCopyPreview(createCopyPreviewState(owner), request, source)) }

test('원본 cpCalc VM과 전체 source seed의 초기·증액·출금·flat 계산이 일치한다', () => {
  for (const source of [...sourceSharedStrategies(), fixture(0.7), fixture(1.5)]) {
    const state = next(startCopyPreview(createCopyPreviewState(owner), { ...request, pairs: [copyPreviewPairs(source)[0]] }, source))
    const base = state.copies[0]
    const cases: CopyPreviewCopy[] = [base,
      { ...base, ledger: [...base.ledger, { at: 101, type: 'add', amt: 40 }, { at: 102, type: 'out', amt: 10 }] },
      { ...base, flatI: source.result.eq[source.result.eq.length - 1].i },
      { ...base, flatI: source.result.eq[source.result.eq.length - 5].i },
    ]
    for (const copy of cases) {
      const expected = runInNewContext(originalCalc, { copy: clone(copy), tfSSFind: () => ({ r: clone(source.result) }), cpMeta: () => ({ share: 0.1 }) }, { timeout: 1000 })
      expect(calculateCopyPreview(freeze(copy), freeze(source))).toEqual(clone(expected))
    }
  }
})

test('200 USDT의 +10%/-10% 완료 거래는 equity 1→0.99의 -2 실현손익이며 가상 포지션이 없다', () => {
  const source = fixture(0.99)
  source.result.eq[30].v = 1.1
  source.result.trades = [
    { entry: 10, exit: 30, pnl: .1, kind: 'tp', lowVol: false },
    { entry: 31, exit: 39, pnl: -.1, kind: 'sl', lowVol: false },
  ]
  const state = freeze(started(source)), copy = state.copies[0]
  const d = calculateCopyPreview(copy, freeze(source))!
  expect(d).toEqual(clone(runInNewContext(originalCalc, { copy: clone(copy), tfSSFind: () => ({ r: clone(source.result) }), cpMeta: () => ({ share: .1 }) })))
  expect(d.total).toBeCloseTo(-2)
  expect(d.realized).toBeCloseTo(-2)
  expect(d).toMatchObject({ unreal: 0, share: 0, posOpen: false, closedN: 2 })
  expect(d.avail).toBeCloseTo(198)
  expect(flattenCopyPreview(state, { owner, id: 'cp1', at: 101 }, source)).toMatchObject({ ok: false, error: 'no-open-position' })
  const ended = next(closeCopyPreview(state, { owner, id: 'cp1', at: 101 }, source))
  expect(ended.copies[0].realizedBasis).toEqual({ model: 'equity-last-close-v1', startEquity: 1, lastClosedEquity: .99, lastClosedIndex: 39 })
  expect(ended.spot).toBeCloseTo(998)
  expect(calculateCopyPreview(ended.copies[0], fixture(9))).toEqual(ended.copies[0].settle)
  expect(copy).not.toHaveProperty('realizedBasis')
})

test('마지막 청산은 거래 순서가 아닌 max exit와 마지막 동일-index 관측이며 무거래 basis는 null이다', () => {
  const source = fixture(1.2)
  source.result.eq[30].v = 1.05
  source.result.eq.splice(31, 0, { i: 30, v: 1.08 })
  source.result.trades = [
    { entry: 20, exit: 30, pnl: .4, kind: 'tp', lowVol: false },
    { entry: 10, exit: 19, pnl: -.3, kind: 'sl', lowVol: false },
  ]
  const state = started(source), d = calculateCopyPreview(state.copies[0], source)!
  expect(d.realized).toBeCloseTo(16)
  expect(d.unreal).toBeCloseTo(24)
  expect(d.share).toBeCloseTo(1.6)
  expect(d.posOpen).toBe(true)
  expect(next(closeCopyPreview(state, { owner, id: 'cp1', at: 101 }, source)).copies[0].realizedBasis?.lastClosedEquity).toBe(1.08)
  source.result.trades = []
  const empty = started(source), closed = next(closeCopyPreview(empty, { owner, id: 'cp1', at: 101 }, source))
  expect(closed.copies[0].realizedBasis).toEqual({ model: 'equity-last-close-v1', startEquity: 1, lastClosedEquity: null, lastClosedIndex: null })
  expect(closed.copies[0].settle).toMatchObject({ realized: 0, closedN: 0 })
})

test('시드는 owner별 1000 USDT이며 ratio·30봉 전 시작·원본 고급 기본값을 보존한다', () => {
  const state = createCopyPreviewState(owner), source = fixture()
  expect(state).toEqual({ v: 1, owner, spot: 1000, copies: [] })
  const after = next(startCopyPreview(freeze(state), request, freeze(source)))
  expect(after.spot).toBe(800)
  expect(after.copies[0]).toMatchObject({ mode: 'ratio', amount: 200, simStartI: 9, pairs: ['BTC/USDT'],
    adv: { marginMode: 'follow', lev: 'follow', slip: 'sys', maxMarginPct: 95, maxPosX: 5 }, ledger: [{ at: 100, type: 'add', amt: 200 }] })
  expect(state.copies).toEqual([])
  expect(next(topUpCopyPreview(freeze(after), owner)).spot).toBe(1800)
  expect(createCopyPreviewState('other').spot).toBe(1000)
})

test('실제 공유 seed 모두 시작할 수 있고 마지막 동일 index 관측 순서를 보존한다', () => {
  const seeds = sourceSharedStrategies()
  expect(seeds.length).toBeGreaterThan(0)
  for (const source of seeds) expect(startCopyPreview(createCopyPreviewState(owner), { ...request, pairs: [copyPreviewPairs(source)[0]] }, source).ok).toBe(true)
  const source = fixture()
  source.result.eq.push({ i: 39, v: 1.3 })
  const state = started(source)
  const d = calculateCopyPreview(state.copies[0], source)!
  expect(d.pnlPct).toBeCloseTo(0.3)
  expect(next(flattenCopyPreview(state, { owner, id: 'cp1', at: 101 }, source)).copies[0].flatSnapshot?.total).toBe(d.total)
})

test('시작은 유한 금액·최소50·잔액·허용페어·source·owner·중복을 검사한다', () => {
  const source = fixture(), state = createCopyPreviewState(owner)
  const bad = [
    { patch: { amount: NaN }, error: 'invalid-input' }, { patch: { amount: Infinity }, error: 'invalid-input' },
    { patch: { amount: 49.99 }, error: 'minimum-amount' }, { patch: { amount: 1001 }, error: 'insufficient-spot' },
    { patch: { pairs: [] }, error: 'invalid-pairs' }, { patch: { pairs: ['DOGE/USDT'] }, error: 'invalid-pairs' },
    { patch: { pairs: ['BTC/USDT', 'BTC/USDT'] }, error: 'invalid-pairs' },
    { patch: { owner: 'other' }, error: 'owner-mismatch' },
  ]
  for (const { patch, error } of bad) expect(startCopyPreview(state, { ...request, ...patch }, source)).toMatchObject({ ok: false, state, error })
  expect(startCopyPreview(state, request, null)).toMatchObject({ ok: false, error: 'source-unavailable' })
  expect(startCopyPreview(state, request, { ...source, me: true })).toMatchObject({ ok: false, error: 'own-strategy' })
  expect(startCopyPreview(started(), { ...request, id: 'cp2' }, source)).toMatchObject({ ok: false, error: 'duplicate-active' })
  expect(startCopyPreview(started(), request, source)).toMatchObject({ ok: false, error: 'duplicate-id' })
  expect(next(startCopyPreview(state, { ...request, amount: 50 }, source)).spot).toBe(950)
})

test('입출금은 append-only이며 초기 금액으로 PnL을 유지하고 가용금액을 제한한다', () => {
  const source = fixture(), state = freeze(started(source)), before = calculateCopyPreview(state.copies[0], source)!
  const add = next(adjustCopyPreview(state, { owner, id: 'cp1', at: 101, amount: 100, direction: 'add' }, source))
  expect(add.copies[0].ledger).toEqual([...state.copies[0].ledger, { at: 101, type: 'add', amt: 100 }])
  expect(add.spot).toBe(700)
  expect(calculateCopyPreview(add.copies[0], source)).toMatchObject({ total: before.total, inv: 300 })
  const d = calculateCopyPreview(add.copies[0], source)!
  expect(adjustCopyPreview(add, { owner, id: 'cp1', at: 102, amount: d.avail + 1, direction: 'out' }, source)).toMatchObject({ ok: false, error: 'insufficient-available' })
  const out = next(adjustCopyPreview(freeze(add), { owner, id: 'cp1', at: 102, amount: 25, direction: 'out' }, source))
  expect(out.spot).toBe(725)
  expect(out.copies[0].ledger).toEqual([...add.copies[0].ledger, { at: 102, type: 'out', amt: 25 }])
  expect(state.copies[0].ledger).toHaveLength(1)
})

test('손실 중 추가확인은 현재 요청마다 필요하고 잔액·금액·닫힘 검사를 우회하지 않는다', () => {
  const source = fixture(0.7), state = started(source)
  const adjust = { owner, id: 'cp1', at: 101, amount: 10, direction: 'add' as const }
  expect(adjustCopyPreview(state, adjust, source)).toMatchObject({ ok: false, state, error: 'loss-confirmation-required' })
  const after = next(adjustCopyPreview(state, { ...adjust, confirmLoss: true }, source))
  expect(adjustCopyPreview(after, { ...adjust, at: 102 }, source)).toMatchObject({ ok: false, error: 'loss-confirmation-required' })
  for (const amount of [0, -1, NaN, Infinity]) expect(adjustCopyPreview(state, { ...adjust, amount, confirmLoss: true }, source)).toMatchObject({ ok: false, error: 'invalid-input' })
  expect(adjustCopyPreview(state, { ...adjust, amount: 801, confirmLoss: true }, source)).toMatchObject({ ok: false, error: 'insufficient-spot' })
  expect(adjustCopyPreview(state, { ...adjust, owner: 'other', confirmLoss: true }, source)).toMatchObject({ ok: false, error: 'owner-mismatch' })
  const boundary = fixture(0.8)
  expect(adjustCopyPreview(started(boundary), adjust, boundary)).toMatchObject({ ok: false, error: 'loss-confirmation-required' })
  const above = fixture(0.800001)
  expect(adjustCopyPreview(started(above), adjust, above).ok).toBe(true)
})

test('포지션 정리는 손익을 고정하고 다음 source 변화나 재정리로 다시 열리지 않는다', () => {
  const source = fixture(), state = freeze(started(source))
  const flat = next(flattenCopyPreview(state, { owner, id: 'cp1', at: 101 }, source))
  const fixed = calculateCopyPreview(flat.copies[0], source)!
  expect(flat.copies[0].status).toBe('active')
  expect(flat.copies[0]).not.toHaveProperty('realizedBasis')
  expect(flat.copies[0].ledger).toEqual(state.copies[0].ledger)
  expect(fixed).toMatchObject({ posOpen: false, unreal: 0, realized: fixed.total })
  expect(calculateCopyPreview(flat.copies[0], fixture(8))).toEqual(fixed)
  expect(calculateCopyPreview(flat.copies[0], null)).toEqual(fixed)
  expect(flattenCopyPreview(flat, { owner, id: 'cp1', at: 102 }, fixture(8))).toMatchObject({ ok: false, error: 'no-open-position' })
  const add = next(adjustCopyPreview(flat, { owner, id: 'cp1', at: 102, amount: 10, direction: 'add' }, source))
  expect(calculateCopyPreview(add.copies[0], null)).toMatchObject({ total: fixed.total, inv: fixed.inv + 10, est: fixed.est + 10 })
  const closed = next(closeCopyPreview(add, { owner, id: 'cp1', at: 103 }, null))
  expect(closed.copies[0]).not.toHaveProperty('realizedBasis')
  expect(closed.copies[0].settle?.net).toBe(fixed.net)
})

test('종료는 정산을 한 번만 회수하고 원장·카드·상세는 같은 고정값을 사용한다', () => {
  const source = fixture(), state = freeze(started(source)), d = calculateCopyPreview(state.copies[0], source)!
  const closed = next(closeCopyPreview(state, { owner, id: 'cp1', at: 101 }, source)), copy = closed.copies[0]
  expect(closed.spot).toBe(state.spot + Math.max(0, d.est))
  expect(copy.ledger).toEqual([...state.copies[0].ledger, { at: 101, type: 'out', amt: Math.max(0, d.est) }])
  expect(copy.settle).toEqual({ ...d, posOpen: false, avail: 0, back: Math.max(0, d.est) })
  expect(calculateCopyPreview(copy, fixture(9))).toEqual(copy.settle)
  expect(calculateCopyPreview(copy, null)).toEqual(copy.settle)
  expect(closeCopyPreview(closed, { owner, id: 'cp1', at: 102 }, source)).toMatchObject({ ok: false, state: closed, error: 'inactive-copy' })
  expect(adjustCopyPreview(closed, { owner, id: 'cp1', at: 102, amount: 1, direction: 'out' }, source)).toMatchObject({ ok: false, error: 'inactive-copy' })
  expect(flattenCopyPreview(closed, { owner, id: 'cp1', at: 102 }, source)).toMatchObject({ ok: false, error: 'inactive-copy' })
  expect(startCopyPreview(closed, { ...request, id: 'cp2', at: 102 }, source).ok).toBe(true)
  expect(copyPreviewDashboard(closed, []).sum).toEqual({ est: 0, avail: 0, net: 0, unreal: 0, realized: 0, share: 0 })
  expect(copyPreviewDashboard(closed, []).rows[0].calculation).toEqual(copy.settle)
  expect(copy.closedTrades).toEqual(source.result.trades)
  expect(copy.closedTrades).not.toBe(source.result.trades)
  expect(copy.closedTrades?.[0]).not.toBe(source.result.trades[0])
})

test('없는 source·짧거나 비유한 곡선은 잔액이나 정상 손익으로 위장하지 않는다', () => {
  const source = fixture(), state = started(source)
  const unavailable = [null, { ...source, nick: 'different' },
    { ...source, result: { ...source.result, eq: source.result.eq.slice(0, 31) } },
    { ...source, result: { ...source.result, eq: source.result.eq.map((point, i) => i === 39 ? { ...point, v: NaN } : point) } },
  ]
  for (const row of unavailable) {
    expect(calculateCopyPreview(state.copies[0], row)).toBeNull()
    expect(closeCopyPreview(state, { owner, id: 'cp1', at: 101 }, row)).toMatchObject({ ok: false, state, error: 'source-unavailable' })
    expect(adjustCopyPreview(state, { owner, id: 'cp1', at: 101, amount: 1, direction: 'out' }, row)).toMatchObject({ ok: false, state, error: 'source-unavailable' })
  }
  expect(copyPreviewDashboard(state, []).sum).toBeNull()
  const d = calculateCopyPreview(state.copies[0], source)!
  expect(copyPreviewDashboard(state, [source]).sum).toEqual({ est: d.est, avail: d.avail, net: d.net, unreal: d.unreal, realized: d.realized, share: d.share })
})
