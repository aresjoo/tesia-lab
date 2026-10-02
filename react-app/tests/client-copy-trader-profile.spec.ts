import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import {
  copyTraderAiNote, copyTraderAssetAllocation, copyTraderHash, copyTraderMeta,
  copyTraderPerformance, copyTraderPeriods, copyTraderWeeklyBars, projectCopyTraderProfile,
} from '../src/client-copy-trader-profile'
import { sourceSharedStrategies, type SharedStrategy } from '../src/client-shared-strategies'
import { copySetupSourceText, copySetupText } from '../src/client-copy-setup-copy'
import type { ClientLanguage } from '../src/client-preferences'

test('설정 표시 adapter는 원본 bio·신뢰 설명만 번역하며 한국어·값·사용자 문구를 보존한다', () => {
  const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
  for (const days of [34, 89, 90, 453]) for (const roi of [49.9, 50, 123.4]) {
    const note = copyTraderAiNote('trust', { days, roi, mdd: 0 })!, before = JSON.stringify(note)
    for (const lang of languages) {
      const result = copySetupSourceText(lang, note.t)
      expect(result).toContain(days.toLocaleString(lang))
      if (lang === 'ko') expect(result).toBe(note.t)
      else expect(result).not.toMatch(/[가-힣]|\{\w+\}/)
      if (days < 90 && roi >= 50) expect(result).toContain(roi.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
    }
    expect(JSON.stringify(note)).toBe(before)
  }
  for (const lang of languages) {
    for (const nick of ['', 'a', 'b', 'c']) {
      const bio = copyTraderMeta(nick).bio, result = copySetupSourceText(lang, bio)
      if (lang === 'ko') expect(result).toBe(bio)
      else expect(result).not.toMatch(/[가-힣]/)
    }
    for (const value of ['사용자가 직접 쓴 소개', '<b>원칙대로만 삽니다.</b>', '기록이 90일째 이어지고 있어요. 사용자 추가 문장']) expect(copySetupSourceText(lang, value)).toBe(value)
    expect(copySetupText(lang, ' 외 {count}개', { count: 2 })).toContain('2')
  }
  expect(copySetupText('ko', '{amount}까지, 자동', { amount: '1,000 USDT' })).toBe('1,000 USDT까지, 자동')
  expect(copySetupText('es', '시스템 기본')).toBe('Por defecto')
  expect(copySetupText('fr', '시스템 기본')).toBe('Par défaut')
})

// Pinned b2ee991d index.html cpHash/cpMeta/cpPerf/cpAiNote, unchanged formulas
// and Korean source copy. This oracle is synthetic UI parity, not service proof.
const original = `
function cpCfg(){ return {PROFIT_SHARE:0.10,COPIER_CAP:500,TRUST_MIN_DAYS:90,TRUST_HI_ROI:50}; }
function cpHash(str){ var h=0; for(var i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return h; }
function cpMeta(nick){
  var cfg=cpCfg(), h=cpHash(nick);
  var aum=25000+(h%90)*1000;
  return { nick:nick, days:34+(h%420), share:cfg.PROFIT_SHARE!=null?cfg.PROFIT_SHARE:0.1,
    copiers:3+(h%97), cap:cfg.COPIER_CAP||500, aum:aum, total:Math.round(aum*1.6)+(h%7000), lastTradeMin:5+(h%700),
    bio:['원칙대로만 삽니다. 손절은 기계처럼.','추세가 확인되기 전에는 움직이지 않아요.','하락장에서 살아남는 것이 첫 번째 목표입니다.','복리는 지루함을 견딘 사람의 몫이에요.'][h%4] };
}
function cpPerf(s,days){
  var r=s.r, eq=r.eq||[], m=cpMeta(s.nick);
  if(!eq.length) return {roi:r.ret,pnl:0,copiersPnl:0,winRate:r.winRate||0,mdd:r.mdd,wins:0,losses:0,n:r.n,eq:[]};
  var i1=eq[eq.length-1].i, cut=i1-days;
  var win=eq.filter(function(e){ return e.i>=cut; });
  if(win.length<2) win=eq.slice();
  var roi=(win[win.length-1].v/win[0].v-1)*100;
  var pnl=m.aum*roi/100;
  var peak=-1e18, mdd=0;
  win.forEach(function(e){ if(e.v>peak)peak=e.v; var dd2=(e.v/peak-1)*100; if(dd2<mdd)mdd=dd2; });
  var tr=(r.trades||[]).filter(function(x){ return (x.exit!=null?x.exit:x.entry)>=cut; });
  var wn=tr.filter(function(x){return x.pnl>0;}).length;
  return { roi:roi, pnl:pnl, copiersPnl:pnl*Math.min(1.6,m.copiers/20), winRate:tr.length?wn/tr.length*100:(r.winRate||0),
    mdd:Math.abs(mdd), wins:wn, losses:tr.length-wn, n:tr.length, eq:win };
}
function cpAiNote(kind,d){
  var cfg=cpCfg();
  if(kind==='trust'){
    if(d.days<(cfg.TRUST_MIN_DAYS||90)&&d.roi>=(cfg.TRUST_HI_ROI||50))
      return {w:1,t:'트레이딩 '+d.days+'일차 계좌의 수익률 '+d.roi.toFixed(1)+'%는 아직 검증 기간이 짧아요. 최소 3개월 이상 이어지는지 지켜보고 판단해도 늦지 않아요.'};
    if(d.days<(cfg.TRUST_MIN_DAYS||90))
      return {w:0,t:'기록이 '+d.days+'일로 짧은 편이에요. 수치보다 손절 원칙이 지켜지는지를 먼저 봐주세요.'};
    return {w:0,t:'기록이 '+d.days+'일째 이어지고 있어요. 기간이 길수록 수치의 신뢰도가 높아요.'};
  }
  if(kind==='mdd'){
    if(d.mdd>=15) return {w:1,t:'가장 힘들었던 구간에서 고점 대비 '+d.mdd.toFixed(1)+'% 내려갔어요. 이만큼의 평가 손실을 견딜 수 있는 금액으로만 시작하세요.'};
    return {w:0,t:'최대 낙폭이 '+d.mdd.toFixed(1)+'%로 관리되는 편이에요. 그래도 하락 구간은 언제든 다시 올 수 있어요.'};
  }
  return null;
}
`
const normalized = (value: unknown) => JSON.parse(JSON.stringify(value))
const rows = sourceSharedStrategies()
function sourceEval(expression: string, scope: Record<string, unknown> = {}) {
  return normalized(runInNewContext(original + expression, scope, { timeout: 1000 }))
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function fixture(): SharedStrategy {
  const row = structuredClone(rows[0])
  return { ...row, nick: '', result: { ...row.result, ret: 80, winRate: 62, mdd: 45, n: 99,
    eq: [{ i: 0, v: 1 }, { i: 10, v: 1.2 }, { i: 20, v: .9 }, { i: 30, v: 1.35 }, { i: 40, v: 1.08 }],
    trades: [1, 0, -.1, .2].map((pnl, index) => ({ entry: index * 10, exit: (index + 1) * 10, pnl, kind: 'time', lowVol: false })),
  } }
}

test('닉 UTF-16 hash와 합성 meta는 원본 VM 및 고정 Golden과 같다', () => {
  for (const nick of ['', ...rows.map(row => row.nick), '😀한글', 'a'.repeat(200), '<img onerror=alert(1)>']) {
    expect(copyTraderHash(nick)).toBe(sourceEval('cpHash(nick)', { nick }))
    expect(copyTraderMeta(nick)).toEqual(sourceEval('cpMeta(nick)', { nick }))
  }
  expect(copyTraderHash('a')).toBe(97)
  expect(copyTraderHash('😀')).toBe(1772899)
  expect(copyTraderMeta('')).toEqual({ nick: '', days: 34, share: .1, copiers: 3, cap: 500, aum: 25000, total: 40000, lastTradeMin: 5, bio: '원칙대로만 삽니다. 손절은 기계처럼.' })
})

for (const period of copyTraderPeriods) test(`원본 seed 전체의 ${period}일 성과·곡선이 cpPerf VM과 일치한다`, () => {
  expect(copyTraderPeriods).toEqual([7, 30, 90, 180])
  for (const row of rows) {
    const frozen = freeze(structuredClone(row)), before = normalized(frozen)
    expect(copyTraderPerformance(frozen, period)).toEqual(sourceEval('cpPerf(s,days)', { s: { nick: row.nick, r: row.result }, days: period }))
    expect(frozen).toEqual(before)
  }
})

test('기간 cut 포함·선택 곡선 MDD·0손익 손실 분류·카피어 배율 Golden', () => {
  const actual = copyTraderPerformance(fixture(), 30)
  expect(actual.eq.map(point => point.i)).toEqual([10, 20, 30, 40])
  expect(actual.roi).toBeCloseTo(-10, 10)
  expect(actual.pnl).toBeCloseTo(-2500, 10)
  expect(actual.copiersPnl).toBeCloseTo(-375, 10)
  expect(actual.mdd).toBeCloseTo(25, 10)
  expect(actual).toMatchObject({ wins: 2, losses: 2, n: 4, winRate: 50 })
  const crowded = { ...fixture(), nick: 'a' }
  expect(copyTraderMeta(crowded.nick).copiers).toBe(3)
  const capped = rows.find(row => copyTraderMeta(row.nick).copiers >= 32)!
  const result = copyTraderPerformance(capped, 180)
  expect(result.copiersPnl).toBe(result.pnl * 1.6)
})

test('곡선 2점 미만은 전체곡선으로 돌아가지만 거래 cut은 원본처럼 유지한다', () => {
  const row = fixture(), actual = copyTraderPerformance(row, 7)
  expect(actual.eq).toEqual(row.result.eq)
  expect(actual.roi).toBeCloseTo(8, 10)
  expect(actual).toMatchObject({ wins: 1, losses: 0, n: 1, winRate: 100 })
  expect(actual.mdd).toBeCloseTo(25, 10)
})

test('빈 곡선·거래없음·exit 미정의 entry fallback을 원본 그대로 보존한다', () => {
  const empty = fixture(); empty.result.eq = []
  expect(copyTraderPerformance(empty)).toEqual({ roi: 80, pnl: 0, copiersPnl: 0, winRate: 62, mdd: 45, wins: 0, losses: 0, n: 99, eq: [] })
  const noTrades = fixture(); noTrades.result.trades = []
  expect(copyTraderPerformance(noTrades)).toMatchObject({ wins: 0, losses: 0, n: 0, winRate: 62 })
  const entryFallback = fixture()
  entryFallback.result.trades = [{ ...entryFallback.result.trades[0], entry: 39 }]
  Reflect.deleteProperty(entryFallback.result.trades[0], 'exit')
  expect(copyTraderPerformance(entryFallback, 7)).toMatchObject({ wins: 1, losses: 0, n: 1, winRate: 100 })
  for (const row of [empty, noTrades, entryFallback]) expect(copyTraderPerformance(row, 7)).toEqual(sourceEval('cpPerf(s,7)', { s: { nick: row.nick, r: row.result } }))
})

test('AI 원문과 90일·50%·15% 경계를 지키고 신뢰도는 전체 수익률을 쓴다', () => {
  for (const days of [34, 89, 90, 453]) for (const roi of [-10, 49.999, 50, 80.25]) {
    expect(copyTraderAiNote('trust', { days, roi })).toEqual(sourceEval("cpAiNote('trust',d)", { d: { days, roi } }))
  }
  for (const mdd of [0, 14.999, 15, 25]) expect(copyTraderAiNote('mdd', { mdd })).toEqual(sourceEval("cpAiNote('mdd',d)", { d: { mdd } }))
  const actual = projectCopyTraderProfile(fixture(), 30)
  expect(actual.trustNote).toEqual({ w: 1, t: '트레이딩 34일차 계좌의 수익률 80.0%는 아직 검증 기간이 짧아요. 최소 3개월 이상 이어지는지 지켜보고 판단해도 늦지 않아요.' })
  expect(actual.mddNote.t).toContain('25.0%')
  expect(actual.performance.roi).toBeLessThan(0)
})

test('주간 표시는 거래합 아닌 마지막91개 곡선의 7표본 차이이며 15점 미만은 빈 상태다', () => {
  const row = fixture()
  for (const count of [0, 14, 15, 16, 91, 100]) {
    row.result.eq = Array.from({ length: count }, (_, index) => ({ i: index * 3, v: 1 + index * .01 }))
    const actual = copyTraderWeeklyBars(row)
    const expected = sourceEval(`
      var eq=s.r.eq||[], m=cpMeta(s.nick);
      if(eq.length<15) ({available:false,bars:[]}); else {
        var last=eq.slice(-13*7), wk=[];
        for(var i=0;i<13;i++){var seg=last.slice(i*7,(i+1)*7);if(seg.length>1)wk.push((seg[seg.length-1].v-seg[0].v)*m.aum);}
        var mx=Math.max.apply(null,wk.map(Math.abs))||1;
        ({available:true,bars:wk.map(function(v){return {value:v,heightPx:Math.max(3,Math.round(Math.abs(v)/mx*92)),positive:v>=0};})});
      }`, { s: { nick: row.nick, r: row.result } })
    expect(actual).toEqual(expected)
    if (count >= 91) { expect(actual.bars).toHaveLength(13); expect(actual.bars[0].value).toBeCloseTo(1500, 8) }
    if (count === 15) expect(actual.bars).toHaveLength(2)
    if (count === 16) expect(actual.bars).toHaveLength(3)
  }
  row.result.eq = Array.from({ length: 91 }, (_, i) => ({ i, v: 1 }))
  expect(copyTraderWeeklyBars(row).bars.every(bar => bar.value === 0 && bar.heightPx === 3 && bar.positive)).toBe(true)
  row.result.eq = row.result.eq.map((point, index) => ({ ...point, v: 2 - index * .01 }))
  expect(copyTraderWeeklyBars(row).bars.every(bar => !bar.positive && bar.heightPx === 92)).toBe(true)
})

test('도넛은 원본 닉 파생 비중·자산명·색·반지름40의 SVG 반올림을 보존한다', () => {
  for (const row of [...rows, { ...fixture(), asset: '이더리움' }, { ...fixture(), asset: '<나만의 자산>' }]) {
    const expected = sourceEval(`
      var CPP_PAIR={'비트코인':'BTC/USDT','이더리움':'ETH/USDT','나스닥':'NAS100/USDT'}, h=cpHash(s.nick);
      var main=58+(h%22), second=Math.min(88-main,14+(h%12)), third=Math.max(4,Math.round((100-main-second)*0.7)), other=100-main-second-third;
      var rows=[[CPP_PAIR[s.asset]||s.asset,main,'#8fb2ff'],[s.asset==='이더리움'?'BTC/USDT':'ETH/USDT',second,'#56c486'],['SOL/USDT',third,'#eab308'],['기타',other,'#5b6472']];
      var C=2*Math.PI*40, off=0;
      rows.map(function(r2){var len=C*r2[1]/100;var result={label:r2[0],percent:r2[1],color:r2[2],dashArray:len.toFixed(1)+' '+(C-len).toFixed(1),dashOffset:(-off).toFixed(1)};off+=len;return result;});
    `, { s: row })
    expect(copyTraderAssetAllocation(row)).toEqual(expected)
    expect(copyTraderAssetAllocation(row).reduce((sum, item) => sum + item.percent, 0)).toBe(100)
  }
  expect(copyTraderAssetAllocation(fixture()).map(item => item.percent)).toEqual([58, 14, 20, 8])
  expect(copyTraderAssetAllocation({ ...fixture(), asset: 'toString' })[0].label).toBe('toString')
})

test('전체 projection은 브라우저·저장소·네트워크·시간 없이 결정적이며 입력 별칭을 내보내지 않는다', () => {
  const compiled = ts.transpileModule(readFileSync('src/client-copy-trader-profile.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, typeof projectCopyTraderProfile> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: forbidden('require'), fetch: forbidden('fetch'), setTimeout: forbidden('setTimeout'), setInterval: forbidden('setInterval'), Date: forbidden('Date') }
  for (const name of ['window', 'document', 'localStorage', 'sessionStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  runInNewContext(compiled, context, { timeout: 1000 })
  const row = freeze(fixture()), before = normalized(row)
  const actual = exports.projectCopyTraderProfile(row)
  expect(normalized(actual)).toEqual(projectCopyTraderProfile(row, 30))
  actual.performance.eq[0].v = -999
  actual.meta.aum = -999
  actual.allocation[0].percent = -999
  expect(row).toEqual(before)
  expect(normalized(exports.projectCopyTraderProfile(row))).toEqual(projectCopyTraderProfile(row))
  expect(touches).toEqual([])
})
