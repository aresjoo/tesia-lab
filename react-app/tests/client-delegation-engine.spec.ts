import { createHash } from 'node:crypto'
import { createContext, runInContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import {
  delegationEasyText, delegationParameters, delegationRecommendationRows,
  delegationRecommendedParameters, evaluateDelegation,
} from '../src/client-delegation-engine'
import type { DelegationAnswers } from '../src/client-delegation-fixtures'
import { sourceTerminalPrices, type NormalizedSourceTerminalParameters, type SourceTerminalEvaluation } from '../src/client-terminal-source-fixture'

/**
 * Original oracle: aresjoo/tesia-lab 42a0d81f4776681938fb1d08efbabbcaa7f7c67e.
 * AST-extracted exact declarations: index.html 4609–4723 PRICE/RSI/SMA/backtest,
 * tfParams 8388, tfRecommend 8525, tfScore 8551, tfEasyText 8567; score literals
 * from teth-copy.js:9. Only a counter S and intake accessor are supplied.
 * No application script, timer, DOM, transport or storage is executed.
 * Embedded oracle keeps tests independent of the local source checkout.
 * Original optional purpose remains a counter label, absent from React's six
 * parameters; every other result field, trade and equity point is compared.
 */
const originalSource = "var iv={}, S={}, TF_STOP=[-3,-5,-8,-12], TFC={score:{\n    wWin: 0.30,      /* 승률 (40%→0, 75%→1) */\n    wRet: 0.28,      /* 연환산 수익률 (0%→0, 40%→1) */\n    wMdd: 0.27,      /* 최대 낙폭 (-30%→0, -5%→1) */\n    wVol: 0.15,      /* 거래당 변동성 (8%→0, 2%→1) */\n    winLo: 35, winHi: 60,\n    retLo: 0, retHi: 6,\n    mddLo: -25, mddHi: -6,\n    volLo: 9, volHi: 4,\n    pass: 80,        /* 실행 게이트 점수 */\n    maxTries: 5      /* 미달 반복 상한 */\n  }}; function tfS(){return {intake:iv};}\nfunction mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }\nvar PRICE=(function(){\n  var rng=mulberry32(3), p=[16500], regimes=[[0,365,.0016],[365,660,.00003],[660,1050,.0013],[1050,1335,.0004]];\n  for(var i=1;i<1335;i++){\n    var drift=.0005;\n    for(var r=0;r<regimes.length;r++){ if(i>=regimes[r][0]&&i<regimes[r][1]) drift=regimes[r][2]; }\n    var shock=(rng()-.5)*.036;\n    p.push(Math.max(9000, p[i-1]*(1+drift+shock)));\n  }\n  return p;\n})();\nfunction sma(arr,n,i){ if(i<n-1) return null; var s=0; for(var k=i-n+1;k<=i;k++) s+=arr[k]; return s/n; }\nfunction rsi(arr,i){\n  var n=14; if(i<n) return 50;\n  var g=0,l=0;\n  for(var k=i-n+1;k<=i;k++){ var d=arr[k]-arr[k-1]; if(d>0) g+=d; else l-=d; }\n  if(l===0) return 100;\n  return 100-100/(1+(g/n)/(l/n));\n}\nfunction idxToDate(i){\n  var t=new Date(2023,0,2); t.setDate(t.getDate()+i);\n  return t;\n}\nvar RUNSTATS={total:0,by:{}};\nfunction runBacktest(params){\n  RUNSTATS.total++; var pu=params.purpose||'candidate'; RUNSTATS.by[pu]=(RUNSTATS.by[pu]||0)+1;\n  var sl=params.sl/100, tp=params.tp!=null?params.tp/100:null, rsiTh=params.rsiTh, trendFilter=params.trendFilter;\n  var startI=params.startI!=null?params.startI:61, endI=params.endI!=null?params.endI:PRICE.length-1;\n  var fee=params.feeRate!=null?params.feeRate:0.002, dly=params.entryDelay||0;\n  var trades=[], eq=[{i:startI,v:1}], equity=1, inPos=false, entryI=0, entryP=0;\n  for(var i=startI;i<=endI;i++){\n    var s20=sma(PRICE,20,i), s60=sma(PRICE,60,i);\n    if(!inPos){\n      var wasLow = rsi(PRICE,i-1) < rsiTh;\n      var bounce = PRICE[i] > PRICE[i-1]*1.005;\n      var trendOk = !trendFilter || Math.abs(s20 - s60)/PRICE[i] > 0.03;\n      if(wasLow && bounce && trendOk && i+dly<=endI){ inPos=true; entryI=i+dly; entryP=PRICE[i+dly]; }\n    } else if(i>entryI){\n      var chg=PRICE[i]/entryP-1, exit=null, exitPnl=0;\n      if(chg<=sl){ exit='sl'; exitPnl=sl; }\n      else if(tp!=null && chg>=tp){ exit='tp'; exitPnl=tp; }\n      else if(i-entryI>=25){ exit='time'; exitPnl=chg; }\n      if(exit){\n        equity*=(1+exitPnl-fee);\n        trades.push({entry:entryI, exit:i, pnl:exitPnl-fee, kind:exit});\n        eq.push({i:i,v:equity});\n        inPos=false;\n      }\n      else eq.push({i:i,v:equity*(1+chg)}); /* 보유 중 평가액 — 낙폭(mdd)이 청산 시점만 보던 왜곡 제거 (codex QA P1) */\n    }\n  }\n  /* 관측 종료 시점의 미청산 포지션도 평가에 반영 — 마지막 보유 손익이 수익률에서 증발하지 않게 */\n  var openPnl=0;\n  if(inPos&&endI>entryI){ openPnl=PRICE[endI]/entryP-1; equity*=(1+openPnl); eq.push({i:endI,v:equity}); }\n  S.btCount=(S.btCount||0)+1;\n  /* low-volatility flag per trade (entry-time trend strength) */\n  trades.forEach(function(t){\n    var a=sma(PRICE,20,t.entry), b=sma(PRICE,60,t.entry);\n    t.lowVol = Math.abs(a-b)/PRICE[t.entry] < 0.03;\n  });\n  var wins=trades.filter(function(t){return t.pnl>0;});\n  var losses=trades.filter(function(t){return t.pnl<=0;});\n  var gw=wins.reduce(function(a,t){return a+t.pnl;},0);\n  var gl=losses.reduce(function(a,t){return a-t.pnl;},0);\n  /* mdd + longest underwater */\n  var peak=1, peakI=startI, mdd=0, mddStartI=startI, mddEndI=startI, curStart=startI, underMax=0;\n  eq.forEach(function(e){\n    if(e.v>=peak){ var dur=e.i-curStart; if(dur>underMax) underMax=dur; peak=e.v; curStart=e.i; peakI=e.i; }\n    var dd=e.v/peak-1;\n    if(dd<mdd){ mdd=dd; mddStartI=peakI; mddEndI=e.i; }\n  });\n  var tailDur=endI-curStart; if(tailDur>underMax) underMax=tailDur;\n  /* per-year */\n  var byYear={};\n  trades.forEach(function(t){\n    var y=idxToDate(t.exit).getFullYear();\n    if(!byYear[y]) byYear[y]={prod:1,pnl:0,n:0,w:0};\n    byYear[y].prod*=(1+t.pnl); byYear[y].n++; if(t.pnl>0) byYear[y].w++;\n  });\n  Object.keys(byYear).forEach(function(y){ byYear[y].pnl=byYear[y].prod-1; }); /* 연 수익률 = 체결 복리 — 자산 곡선과 같은 계산 (codex qa3 P1-7) */\n  var worstYear=null, bestYear=null;\n  Object.keys(byYear).forEach(function(y){\n    if(worstYear===null||byYear[y].pnl<byYear[worstYear].pnl) worstYear=y;\n    if(bestYear===null||byYear[y].pnl>byYear[bestYear].pnl) bestYear=y;\n  });\n  /* advanced */\n  var years=Math.max((endI-startI)/365,0.2), n=trades.length;\n  var mean=n?trades.reduce(function(a,t){return a+t.pnl;},0)/n:0;\n  var sd=n>1?Math.sqrt(trades.reduce(function(a,t){return a+Math.pow(t.pnl-mean,2);},0)/(n-1)):0;\n  var dSd=losses.length>1?Math.sqrt(losses.reduce(function(a,t){return a+t.pnl*t.pnl;},0)/losses.length):Math.abs(sl);\n  var cagr=(Math.pow(equity,1/years)-1)*100;\n  var sharpe=sd>0?mean/sd*Math.sqrt(n/years):0;\n  var sortino=dSd>0?mean/dSd*Math.sqrt(n/years):0;\n  var expoDays=trades.reduce(function(a,t){return a+(t.exit-t.entry);},0);\n  var lowVolLosses=losses.filter(function(t){return t.lowVol;}).length;\n  var eqNoFee=trades.reduce(function(a,t){return a*(1+t.pnl+fee);},1);\n  return {\n    params:params, trades:trades, eq:eq,\n    ret:(equity-1)*100, mdd:mdd*100,\n    winRate:n?wins.length/n*100:0,\n    n:n, pf:gl>0?gw/gl:gw>0?9.9:0,\n    byYear:byYear, worstYear:worstYear, bestYear:bestYear,\n    worstYearPnl:worstYear?byYear[worstYear].pnl*100:0,\n    bestYearPnl:bestYear?byYear[bestYear].pnl*100:0,\n    mddStartI:mddStartI, mddEndI:mddEndI, underwaterDays:underMax,\n    cagr:cagr, sharpe:sharpe, sortino:sortino,\n    calmar:mdd<0?cagr/Math.abs(mdd*100):0,\n    exposure:expoDays/Math.max(endI-startI,1)*100, tradeVol:sd*100,\n    avgHold:n?expoDays/n:0,\n    lossCount:losses.length, lowVolLosses:lowVolLosses,\n    lowVolLossShare:losses.length?lowVolLosses/losses.length*100:0,\n    costImpact:(eqNoFee-equity)*100\n  };\n}\nfunction tfParams(base){\n  var t=tfS(),iv=t.intake;\n  var style=(iv.style||{}).i!=null?iv.style.i:1, stop=(iv.stop||{}).i!=null?iv.stop.i:1, period=(iv.period||{}).i!=null?iv.period.i:1; /* 첫 번째 선택(0)이 1로 뭉개지던 결함 수정 */\n  var p={\n    sl: TF_STOP[stop],\n    tp: style===0?null:(style===1?12:8),\n    rsiTh: style===0?52:(style===1?44:38),\n    trendFilter: style===2,\n    startI: period===0?Math.max(61,PRICE.length-1-365):(period===1?Math.max(61,PRICE.length-1-730):61),\n    endI: PRICE.length-1,\n    purpose:'delegate'\n  };\n  if(base){ for(var k in base) p[k]=base[k]; }\n  return p;\n}\nfunction tfRecommend(p){\n  var rows=[];\n  var R={sl:-5,tp:12,rsiTh:44,trendFilter:true,startI:61};\n  if(p.sl!==R.sl) rows.push({k:'손실 제한',a:p.sl+'%',b:R.sl+'%'});\n  if(p.startI!==R.startI) rows.push({k:'기간',a:p.startI>61?'최근 구간':'전체 기간',b:'전체 기간'});\n  if(p.rsiTh!==R.rsiTh||p.tp!==R.tp||p.trendFilter!==R.trendFilter) rows.push({k:'진입 조건',a:'현재 설정',b:'TETH 권장'});\n  if(!rows.length) rows.push({k:'설정',a:'현재 설정',b:'TETH 권장'});\n  return {rows:rows};\n}\nfunction tfScore(res){\n  var c=TFC.score;\n  function nz(v,lo,hi){ var x=(v-lo)/(hi-lo); return Math.max(0,Math.min(1,x)); }\n  var sc=nz(res.winRate,c.winLo,c.winHi)*c.wWin\n       +nz(res.cagr,c.retLo,c.retHi)*c.wRet\n       +nz(res.mdd,c.mddLo,c.mddHi)*c.wMdd\n       +nz(res.tradeVol,c.volLo,c.volHi)*c.wVol;\n  sc*=100;\n  if(res.n<4) sc*=0.65; /* 표본 부족 페널티 */\n  if(res.n<6) sc=Math.min(sc,79); /* 표본이 너무 적으면 실행 기준을 넘지 못하게 상한 (P0-05) */\n  return Math.max(5,Math.min(99,Math.round(sc)));\n}\nfunction tfEasyText(c){\n  var shp=c.sharpe>=1.5?'위험 대비 수익이 좋은 편이에요':c.sharpe>=0.8?'위험 대비 수익이 무난한 편이에요':'수익 대비 흔들림이 좀 있는 편이에요';\n  return '100번 중 '+Math.round(c.winRate)+'번 꼴로 이기는 전략이었고, 가장 안 좋았던 구간에서는 약 '+Math.abs(c.mdd).toFixed(1)+'%까지 떨어졌어요. '+shp+'. 검증 구간 동안 총 '+c.n+'번 사고팔았어요.';\n}"
type Params = NormalizedSourceTerminalParameters & { purpose?: string }
type Result = SourceTerminalEvaluation['r']
type Oracle = {
  iv: Record<string, { i: number }>
  PRICE: number[]
  tfParams: (base?: Partial<Params>) => Params
  runBacktest: (parameters: Params) => Result
  tfScore: (result: Result) => number
  tfRecommend: (parameters: Params) => { rows: { k: string; a: string; b: string }[] }
  tfEasyText: (result: Result) => string
}
function original() {
  const context = createContext({})
  runInContext(originalSource, context, { timeout: 1000 })
  return context as unknown as Oracle
}
const answersFor = (style: number, period: number, stop: number): DelegationAnswers => ({
  style: { index: style, label: 'display only', recommended: false },
  period: { index: period, label: 'display only', recommended: false },
  stop: { index: stop, label: 'display only', recommended: false },
})
function plain<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function parametersOnly(p: Params): NormalizedSourceTerminalParameters {
  return { sl: p.sl, tp: p.tp, rsiTh: p.rsiTh, trendFilter: p.trendFilter, startI: p.startI, endI: p.endI }
}
test('원본 VM 선택 선언과 전체 합성 PRICE 출처가 고정되어 있다', () => {
  expect(createHash('sha256').update(originalSource).digest('hex')).toBe('98c29bb511b716ed7feb4db281a916badbe0f4977ef9c4a7a962e2df188052fb')
  expect(plain(original().PRICE)).toEqual(sourceTerminalPrices)
})

for (let style = 0; style < 3; style++) for (let period = 0; period < 3; period++) for (let stop = 0; stop < 4; stop++) {
  test(`원본 VM 동등: 성향 ${style} · 기간 ${period} · 손절 ${stop}`, () => {
    const reference = original()
    reference.iv = { style: { i: style }, period: { i: period }, stop: { i: stop } }
    const originalP = reference.tfParams(), parameters = delegationParameters(answersFor(style, period, stop))
    expect(parameters).toEqual(parametersOnly(originalP))
    const expected = reference.runBacktest(originalP), actual = evaluateDelegation(parameters, 5000000)
    expect(plain(actual.result)).toEqual(plain({ ...expected, params: parametersOnly(originalP) }))
    expect(actual.score).toBe(reference.tfScore(expected))
    expect(actual.parameters).toEqual(parameters)
    expect(actual.evaluation.r).toBe(actual.result)
    expect(delegationRecommendationRows(parameters)).toEqual(plain(reference.tfRecommend(originalP).rows))
    expect(delegationEasyText(actual.result)).toBe(reference.tfEasyText(expected))
  })
}

test('기본 52점 → 명시 추천 80점이며 답변 라벨만 바꾸면 49점이다', () => {
  const base = evaluateDelegation(delegationParameters({}), 5000000)
  expect(base.score).toBe(52)
  expect(base.result.ret).toBe(-0.5342542410601614)
  const recommendation = delegationRecommendedParameters()
  expect(recommendation).toEqual({ sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 })
  const applied = evaluateDelegation(recommendation, 5000000)
  expect(applied.score).toBe(80)
  expect(applied.result.ret).toBe(14.68500011381595)
  expect(applied.result.n).toBe(13)
  const ref = original(), result = ref.runBacktest(ref.tfParams({ ...recommendation }))
  expect(plain(applied.result)).toEqual(plain({ ...result, params: recommendation }))
  expect(applied.score).toBe(ref.tfScore(result))
  expect(evaluateDelegation(delegationParameters(answersFor(1, 2, 1)), 5000000).score).toBe(49)
  expect(evaluateDelegation(delegationRecommendedParameters(), 5000000)).toEqual(applied)
})

test('첫 선택 index 0과 원본 기본값·빈값을 혼동하지 않는다', () => {
  expect(delegationParameters({})).toEqual(delegationParameters(answersFor(1, 1, 1)))
  expect(delegationParameters(answersFor(0, 0, 0))).toEqual({ sl: -3, tp: null, rsiTh: 52, trendFilter: false, startI: 969, endI: 1334 })
  for (const key of ['style', 'period', 'stop'] as const) {
    for (const index of [-1, .5, NaN, Infinity, key === 'stop' ? 4 : 3]) {
      expect(() => delegationParameters({ [key]: { index, label: '', recommended: false } })).toThrow(RangeError)
    }
  }
})

test('자산·예산·추천 배지·라벨은 원본 % 성과를 바꾸지 않는다', () => {
  const base = delegationParameters(answersFor(1, 1, 1)), expected = evaluateDelegation(base, 5000000)
  for (let asset = 0; asset < 4; asset++) for (let budget = 0; budget < 4; budget++) {
    const parameters = delegationParameters({ ...answersFor(1, 1, 1),
      asset: { index: asset, label: 'ETH or Tesla display', recommended: true },
      budget: { index: budget, label: 'budget display', recommended: true } })
    const result = evaluateDelegation(parameters, [1000000, 5000000, 10000000, 30000000][budget])
    expect(parameters).toEqual(base)
    expect(result.result).toEqual(expected.result)
    expect(result.score).toBe(expected.score)
  }
})

test('36개 최초 선택의 실제 게이트와 소표본 페널티를 유지한다', () => {
  const results = []
  for (let s = 0; s < 3; s++) for (let p = 0; p < 3; p++) for (let l = 0; l < 4; l++) results.push(evaluateDelegation(delegationParameters(answersFor(s, p, l)), 1))
  expect(Math.min(...results.map(r => r.score))).toBe(23)
  expect(Math.max(...results.map(r => r.score))).toBe(95)
  expect(results.filter(r => r.score >= 80)).toHaveLength(6)
  expect(results.filter(r => r.result.n < 6).every(r => r.score < 80)).toBe(true)
})

test('추천 diff는 변경 필드만, 쉬운 설명은 원본 Sharpe 경계로 분기한다', () => {
  const recommended = delegationRecommendedParameters()
  expect(delegationRecommendationRows(recommended)).toEqual([{ k: '설정', a: '현재 설정', b: 'TETH 권장' }])
  const result = evaluateDelegation(recommended, 1).result, reference = original()
  for (const sharpe of [-1, .7999, .8, 1.4999, 1.5]) {
    const input = { ...result, sharpe }
    expect(delegationEasyText(input)).toBe(reference.tfEasyText(input))
  }
  expect(delegationEasyText({ ...result, sharpe: .8 })).toContain('무난한 편')
  expect(delegationEasyText({ ...result, sharpe: 1.5 })).toContain('좋은 편')
  expect(delegationEasyText(result)).toContain('흔들림이 좀 있는 편')
})

test('평가와 추천 결과의 소비자 변경이 다음 호출에 전파되지 않는다', () => {
  const p = delegationRecommendedParameters(), expected = evaluateDelegation(p, 5000000)
  const changed = evaluateDelegation(p, 5000000)
  changed.parameters.sl = -99
  changed.result.params.tp = null
  changed.result.eq[0].v = -999
  changed.result.trades[0].pnl = 999
  changed.evaluation.L.evs[0].txt = 'mutated'
  expect(p).toEqual(delegationRecommendedParameters())
  expect(evaluateDelegation(p, 5000000)).toEqual(expected)
  p.trendFilter = false
  expect(delegationRecommendedParameters().trendFilter).toBe(true)
})

test('잘못된 가격 구간·비유한 파라미터·예산은 기존 엔진이 거부한다', () => {
  const p = delegationRecommendedParameters()
  for (const parameters of [{ ...p, startI: 60 }, { ...p, endI: 1335 }, { ...p, rsiTh: NaN }]) expect(() => evaluateDelegation(parameters, 1)).toThrow(RangeError)
  for (const capital of [-1, NaN, Infinity]) expect(() => evaluateDelegation(p, capital)).toThrow(RangeError)
  expect(evaluateDelegation(p, 0).evaluation.nav).toBe(0)
})

