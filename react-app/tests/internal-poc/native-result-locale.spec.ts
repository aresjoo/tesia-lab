import { expect, test } from '@playwright/test'
import { nativeResultCopy, nativeResultNavigationCopy, nativeResultText, nativeResultNavigationText } from '../../src/internal-poc/native-result-copy'
import { nativeJobCopy } from '../../src/internal-poc/native-job-copy'
import { clientTerminalCopy, clientTerminalText } from '../../src/client-terminal-copy'
import { formatResultRatePercent } from '../../src/internal-poc/native-result-number-format'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()

test('결과125·체결8·터미널16 사전은7언어와 원 치환자를 보존한다', () => {
  expect(Object.keys(nativeResultCopy)).toHaveLength(125)
  expect(Object.keys(nativeResultNavigationCopy)).toHaveLength(8)
  expect(Object.keys(clientTerminalCopy)).toHaveLength(16)
  for (const dictionary of [nativeResultCopy, nativeResultNavigationCopy, clientTerminalCopy]) {
    for (const [key, values] of Object.entries(dictionary)) {
      expect(values, key).toHaveLength(7)
      values.forEach((value, index) => {
        expect(value.trim(), `${key}:${index}`).not.toBe('')
        expect(placeholders(value), `${key}:${index}`).toEqual(placeholders(values[0]))
        if (index) expect(value, `${key}:${index}`).not.toMatch(/[가-힣]/)
      })
    }
  }
  expect(nativeResultCopy.statusNeedsCheck).toBe(nativeJobCopy.resultNeedsCheck)
  expect(nativeResultCopy.statusReady).toBe(nativeJobCopy.resultReady)
  expect(nativeResultCopy.statusChecking).toBe(nativeJobCopy.resultChecking)
})

test('한국어 계산 한계·초과/미만·원문 단위와 표시/전체 구분을 바꾸지 않는다', () => {
  const expected = {
    tinyNegative: '−0.01% 초과 · 0% 미만',
    nonCausalFill: '체결가는 사후에 확인한 다음 계약봉의 시가를 사용하는 비인과적 재실행 기준입니다. 실제 시점에 같은 가격으로 체결할 수 있는지 검증한 결과가 아닙니다.',
    symbolRuleSubstitute: '거래 규칙은 현재 규칙을 대용합니다. 과거 각 시점의 거래 규칙과 일치하는지는 검증하지 않았습니다.',
    mddSampling: 'MDD는 정해진 이벤트 처리 후 활성 mark 가격의 1분 표본을 기준으로 계산합니다. 분 안에서 발생한 최대 낙폭은 검증하지 않았습니다.',
    independentSegments: 'IS와 OOS는 각각 독립된 초기 자본, 포지션 없음, 빈 원장으로 시작합니다. 두 구간 사이에 포지션이나 원장을 이어받지 않으며 누적 운용 실적으로 합산하지 않습니다.',
    limitationHeadline: '현재 MMR 미검증 · 청산 검증 불가(UNAVAILABLE). 정확한 청산가·청산 거리·청산 적합성은 제공하지 않습니다. 공개 재배포 불가.',
    slippageIncluded: '슬리피지는 체결가에 포함되어 있으며 손익에서 다시 차감하지 않습니다.',
    markerPageSummary: '{page}페이지 · 조회한 체결 마커 {count}개 중 현재 표시 범위 {visible}개. 조회한 한 페이지만 표시하며 전체 체결 누계가 아닙니다.',
    tradePageLimit: '이 화면은 최대 50페이지의 이동 위치만 기억합니다. 첫 거래 페이지로 돌아가 탐색을 다시 시작할 수 있습니다. 서버의 거래 내역을 삭제하거나 전체 거래를 조회했다는 뜻이 아닙니다.',
  } as const
  for (const [key, value] of Object.entries(expected)) expect(nativeResultCopy[key as keyof typeof expected][0]).toBe(value)
  expect(nativeResultCopy.mmrUnverifiedPrefix[0]).toBe('MMR 미검증 · ')
  expect(nativeResultCopy.mddSampling[6]).toContain("Le drawdown maximal survenu à l'intérieur d'une minute n'a pas été vérifié.")
  for (const language of languages) {
    for (const key of ['initialCapital', 'finalEquity', 'netPnlRow', 'feeCostRow', 'slippageCostRow', 'fundingCashflowRow'] as const) expect(nativeResultText(language, key)).toContain('(USDT)')
    expect(nativeResultText(language, 'rawRateCaption')).toContain('×100 = %')
    expect(nativeResultText(language, 'limitationHeadline')).toContain('UNAVAILABLE')
  }
})

test('시각·식별자 치환자는 통화 변환·HTML 해석·달러 치환을 하지 않는다', () => {
  const raw = '2030-01-01T00:00:00Z · BUY · 001.00001 · $&/$1/{value}/<raw>'
  for (const language of languages) {
    expect(nativeResultNavigationText(language, 'entry', { value: raw })).toContain(raw)
    expect(nativeResultNavigationText(language, 'exit', { value: raw })).toContain(raw)
    expect(nativeResultText(language, 'requestedStart', { from: raw, resolution: '1m' })).toContain(raw)
    expect(clientTerminalText(language, 'widthSeparator', { label: raw })).toContain(raw)
    expect(nativeResultText(language, 'markerPageSummary', { page: 0, count: 100, visible: 0 })).not.toMatch(/\{(page|count|visible)\}/)
  }
})

test('아주 작은 음수의 표시만 번역하고 기존 반올림·정밀도·기본값을 보존한다', () => {
  const ordinary = ['0', '-0.000', '0.000000001', '-0.00005', '0.01235', '123456789.00125']
  for (const language of languages) {
    const tiny = nativeResultText(language, 'tinyNegative')
    expect(formatResultRatePercent('-0.00000001', tiny)).toBe(tiny)
    expect(formatResultRatePercent('-0.000049999', tiny)).toBe(tiny)
    for (const value of ordinary) expect(formatResultRatePercent(value, tiny)).toBe(formatResultRatePercent(value))
    expect(formatResultRatePercent('1E-8', tiny)).toBeUndefined()
  }
  expect(formatResultRatePercent('-0.00000001')).toBe('−0.01% 초과 · 0% 미만')
})
