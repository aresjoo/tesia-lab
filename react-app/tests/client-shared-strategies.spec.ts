import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import { readSharedLocation, sharedAnalysisRequest, sharedHash, sharedPeriodResult, sourceSharedStrategies, type SharedPeriod } from '../src/client-shared-strategies'
import { evaluateSourceTerminal, sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { scoreSourceTerminal } from '../src/client-terminal-source-proposal'

// Exact source 501053b tfRankSeeds config/filter/sort; only the existing pure
// source engine is injected. This is never service validation or marketplace data.
const originalSeeds = `
var cfgs=[
 {nick:'세븐틴층',asset:'비트코인',p:{sl:-5,tp:12,rsiTh:44,trendFilter:true,startI:61,endI:PRICE.length-1},fw:1284},
 {nick:'단타는안해요',asset:'이더리움',p:{sl:-8,tp:15,rsiTh:47,trendFilter:true,startI:61,endI:PRICE.length-1},fw:911},
 {nick:'월급두배',asset:'비트코인',p:{sl:-5,tp:8,rsiTh:38,trendFilter:true,startI:61,endI:PRICE.length-1},fw:640},
 {nick:'조용한복리',asset:'나스닥',p:{sl:-3,tp:10,rsiTh:41,trendFilter:true,startI:Math.max(61,PRICE.length-1-730),endI:PRICE.length-1},fw:377},
 {nick:'바닥만줍는사람',asset:'비트코인',p:{sl:-8,tp:12,rsiTh:41,trendFilter:true,startI:61,endI:PRICE.length-1},fw:512},
 {nick:'느긋한스윙',asset:'이더리움',p:{sl:-5,tp:10,rsiTh:44,trendFilter:true,startI:Math.max(61,PRICE.length-1-730),endI:PRICE.length-1},fw:298},
 {nick:'리스크헌터',asset:'나스닥',p:{sl:-5,tp:15,rsiTh:44,trendFilter:true,startI:61,endI:PRICE.length-1},fw:203},
 {nick:'천천히꾸준히',asset:'비트코인',p:{sl:-3,tp:8,rsiTh:38,trendFilter:true,startI:Math.max(61,PRICE.length-1-365),endI:PRICE.length-1},fw:156}
];
cfgs.map(function(c){var r=runBacktest(c.p);return {nick:c.nick,asset:c.asset,p:c.p,fw:c.fw,score:tfScore(r),ret:r.ret,mdd:r.mdd,n:r.n};})
 .filter(function(x){return x.score>=TFC.score.pass-8;})
 .sort(function(a,b){return b.score-a.score||b.ret-a.ret;});`
const normalized = (value: unknown) => JSON.parse(JSON.stringify(value))
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('원본 seed 8개 계산·72점 필터·점수/수익률 정렬의 VM 결과와 같다', () => {
  const expected = runInNewContext(originalSeeds, { PRICE: sourceTerminalPrices, TFC: { score: { pass: 80 } },
    runBacktest: (parameters: Parameters<typeof evaluateSourceTerminal>[0]) => evaluateSourceTerminal(parameters, 5000000).r,
    tfScore: scoreSourceTerminal,
  }, { timeout: 1000 })
  const rows = sourceSharedStrategies()
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.length).toBeLessThanOrEqual(8)
  expect(rows.map(row => ({ nick: row.nick, asset: row.asset, p: row.parameters, fw: row.followers, score: row.score, ret: row.result.ret, mdd: row.result.mdd, n: row.result.n }))).toEqual(normalized(expected))
  expect(rows.every(row => row.score >= 72)).toBe(true)
  for (const row of rows) expect(row.result).toEqual(evaluateSourceTerminal(row.parameters, 5000000).r)
})

for (const period of ['all', '2y', '1y'] as const) test(`공유 ${period} 결과는 원본 구간 재계산과 같고 입력을 변경하지 않는다`, () => {
  for (const row of sourceSharedStrategies()) {
    const before = normalized(row), frozen = freeze(row)
    const result = sharedPeriodResult(frozen, period)
    if (period === 'all') expect(result).toBe(frozen.result)
    else {
      const endI = frozen.parameters.endI!
      const startI = Math.max(61, endI - (period === '1y' ? 365 : 730))
      expect(result).toEqual(evaluateSourceTerminal({ ...frozen.parameters, startI, endI }, 5000000).r)
      expect(result.params.startI).toBe(startI)
      expect(result.params.endI).toBe(endI)
    }
    expect(frozen).toEqual(before)
  }
})

test('같은 작성자의 변경 파라미터·다른 종료 봉에 이전 기간 계산을 재사용하지 않는다', () => {
  const row = sourceSharedStrategies()[0]
  const first = { ...row, parameters: { ...row.parameters, endI: 800 } }
  const changed = { ...first, parameters: { ...first.parameters, sl: -3, rsiTh: 38 } }
  for (const candidate of [first, changed]) {
    for (const period of ['2y', '1y'] as const) {
      const endI = candidate.parameters.endI
      expect(sharedPeriodResult(candidate, period)).toEqual(evaluateSourceTerminal({ ...candidate.parameters, startI: Math.max(61, endI - (period === '1y' ? 365 : 730)) }, 5000000).r)
    }
  }
  expect(sharedPeriodResult(first, '1y')).not.toEqual(sharedPeriodResult(changed, '1y'))
})

test('반복 seed 조회는 호출자가 변경한 배열·파라미터·곡선에 오염되지 않는다', () => {
  const first = sourceSharedStrategies(), expected = normalized(first)
  first[0].nick = 'caller-only'
  first[0].parameters.sl = -99
  first[0].result.eq[0].v = -99
  first.pop()
  expect(sourceSharedStrategies()).toEqual(expected)
})

test('공유 허브와 정상 상세 기간만 분리하고 유효 문자열을 정확히 roundtrip한다', () => {
  expect(readSharedLocation('#/share')).toEqual({ period: 'all' })
  for (const nick of ['세븐틴층', 'space name', '한글/슬래시', '100% 수익?', 'a#b&c=d', "quote'\"\\<svg>", '%2F']) {
    expect(readSharedLocation('#/share/s/' + encodeURIComponent(nick) + '/all')).toEqual({ nick, period: 'all' })
    for (const period of ['all', '2y', '1y'] as SharedPeriod[]) {
      const hash = sharedHash({ nick, period })
      expect(readSharedLocation(hash)).toEqual({ nick, period })
      expect(hash).not.toContain('<')
      expect(hash).not.toContain('>')
      expect(hash).not.toContain('"')
      expect(hash).not.toContain("'")
      expect(hash).not.toContain('\\')
      expect(hash.split('/').length).toBe(period === 'all' ? 4 : 5)
    }
  }
  expect(sharedHash({ period: 'all' })).toBe('#/share')
  expect(sharedHash({ nick: "quote'", period: 'all' })).toBe('#/share/s/quote%27')
})

test('공유 경로 아닌 문자열은 분리하고 손상 인코딩·extra segments는 허브로 복구한다', () => {
  for (const hash of ['', '#/', '#/shared', '#/shareevil/s/name', '#/trade', '/share', 'javascript:alert(1)']) expect(readSharedLocation(hash), hash).toBeNull()
  for (const hash of ['#/share/', '#/share/s/', '#/share/s/name/3y', '#/share/s/name/1y/extra', '#/share/s/name/1y/', '#/share/s/%', '#/share/s/%GG', '#/share/s/%E0%A4%A', '#/share/s/name?x=1/extra']) {
    expect(readSharedLocation(hash), hash).toEqual({ period: 'all' })
  }
})

test('인코딩은 한 번만 해석하며 route 값으로 사용자 문자열을 실행하거나 HTML로 바꾸지 않는다', () => {
  const nick = "');globalThis.__sharedInjected=true;//<img onerror=alert(1)>"
  const location = freeze({ nick, period: '1y' as const })
  expect(readSharedLocation(sharedHash(location))).toEqual(location)
  expect(readSharedLocation('#/share/s/%252F')).toEqual({ nick: '%2F', period: 'all' })
  expect(Reflect.get(globalThis, '__sharedInjected')).toBeUndefined()
  expect(location.nick).toBe(nick)
})

test('분석 요청은 원본 규칙과 선택 기간 성과·원본 점수를 빠짐없이 보존한다', () => {
  const row = freeze(sourceSharedStrategies()[0]), before = normalized(row)
  for (const period of ['all', '2y', '1y'] as const) {
    const r = sharedPeriodResult(row, period), p = row.parameters
    expect(sharedAnalysisRequest(row, period)).toBe(`공유 전략 분석 요청: "${row.nick}" (${row.asset}). 규칙: RSI ${p.rsiTh} 이하 눌림 후 반등 진입, 추세 필터 사용, 손절 ${p.sl}%, 익절 +${p.tp}%. 검증 결과: 수익 ${r.ret >= 0 ? '+' : ''}${r.ret.toFixed(1)}%, MDD ${r.mdd.toFixed(1)}%, 승률 ${Math.round(r.winRate)}%, 거래 ${r.n}회, TETH ${row.score}점. 이 전략의 강점과 약점, 그리고 따라하기 전에 확인해야 할 점을 분석해줘.`)
  }
  expect(row).toEqual(before)
  const noOptionalRule = freeze({ ...row, nick: '<사용자 "원문">', parameters: { ...row.parameters, tp: null, trendFilter: false } })
  const text = sharedAnalysisRequest(noOptionalRule, 'all')
  expect(text).toContain('<사용자 "원문">')
  expect(text).not.toContain('익절')
  expect(text).not.toContain('추세 필터 사용')
})
