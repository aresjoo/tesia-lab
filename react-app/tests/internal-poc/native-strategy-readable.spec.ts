import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import { describeCondition, describeFeature, formatFractionPercent } from '../../src/internal-poc/native-strategy-readable'
import { nativeStrategyCopy, nativeStrategyText } from '../../src/internal-poc/native-strategy-copy'
import type { StrategyCondition, StrategyFeature, StrategyOperand } from '../../src/internal-poc/contracts/generated/api-v0.3/types'

const features: readonly StrategyFeature[] = [
  { id: 'close', type: 'ohlcv', field: 'close', timeframe: '15m' },
  { id: 'rsi', type: 'rsi', period: 14, source: 'close', timeframe: '15m' },
  { id: 'sma', type: 'sma', period: 20, source: 'close', timeframe: '15m' },
  { id: 'ema', type: 'ema', period: 50, source: 'close', timeframe: '15m' },
]
const number = (value = '30.00', unit: Extract<StrategyOperand, { kind: 'number' }>['unit'] = 'index'): StrategyOperand => ({ kind: 'number', value, unit })
const ref = (featureId: string): Extract<StrategyOperand, { kind: 'feature_ref' }> => ({ kind: 'feature_ref', featureId })
const comparison = (operator: Extract<StrategyCondition, { kind: 'comparison' }>['operator'] = 'lt', left = ref('rsi') as StrategyOperand, right = number()): StrategyCondition =>
  ({ id: 'comparison', kind: 'comparison', operator, left, right })
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('OHLCV 각 필드와 15분봉을 원문 의미대로 구별한다', () => {
  for (const [field, label] of Object.entries({ open: '시가', high: '고가', low: '저가', close: '종가', volume: '거래량' })) {
    expect(describeFeature({ id: 'ohlcv', type: 'ohlcv', field: field as 'open', timeframe: '15m' })).toBe(`${label} (15분봉)`)
  }
})

test('RSI/SMA/EMA의 기간은 봉 수이며 source와 timeframe을 생략하지 않는다', () => {
  expect(describeFeature(features[1])).toBe('RSI (14봉, 종가, 15분봉)')
  expect(describeFeature(features[2])).toBe('SMA 단순이동평균 (20봉, 종가, 15분봉)')
  expect(describeFeature(features[3])).toBe('EMA 지수이동평균 (50봉, 종가, 15분봉)')
  expect(describeFeature({ ...features[1], type: 'rsi', source: 'close', period: 500 })).toContain('500봉')
})

test('rolling max/min은 source/기간/현재 봉 제외를 모두 보존한다', () => {
  for (const type of ['rolling_max', 'rolling_min'] as const) {
    for (const [source, label] of [['high', '고가'], ['low', '저가'], ['close', '종가'], ['volume', '거래량']] as const) {
      expect(describeFeature({ id: 'rolling', type, source, period: 5000, timeframe: '15m', excludeCurrent: true }))
        .toBe(`구간 ${type === 'rolling_max' ? '최댓값' : '최솟값'} (5000봉, ${label}, 15분봉, 현재 봉 제외)`)
    }
  }
})

for (const [operator, label] of [['lt', '미만'], ['lte', '이하'], ['gt', '초과'], ['gte', '이상']] as const) {
  test(`${operator}: ${label}의 등호 경계를 정확히 구별한다`, () => {
    const result = describeCondition(comparison(operator), features)
    expect(result).toEqual({ text: `RSI (14봉, 종가, 15분봉) [rsi] 값이 30.00\u00a0(지표값)\u00a0${label}`, warnings: [] })
    const swapped = describeCondition(comparison(operator, number(), ref('rsi')), features)
    expect(swapped.text).toBe(`30.00\u00a0(지표값) 값이 RSI (14봉, 종가, 15분봉) [rsi] ${label}`)
    expect(result.text).not.toContain('%')
  })
}

test('상향/하향 교차와 좌우 operand 순서를 보존하고 매수/현재값을 추정하지 않는다', () => {
  for (const operator of ['cross_above', 'cross_below'] as const) {
    for (const [left, right] of [['sma', 'ema'], ['ema', 'sma']] as const) {
      const result = describeCondition({ id: 'cross', kind: 'cross', operator, left: ref(left), right: ref(right) }, features)
      expect(result.text).toBe(`${describeFeature(features.find(feature => feature.id === left)!)} [${left}] 값이 ${describeFeature(features.find(feature => feature.id === right)!)} [${right}] 값을 ${operator === 'cross_above' ? '상향 교차' : '하향 교차'}`)
      expect(result.warnings).toEqual([])
      expect(result.text).not.toMatch(/매수|진입|현재값|체결|돌파/)
    }
  }
})

test('number 원 decimal과 price/index/volume 단위를 보존한다', () => {
  for (const [unit, label] of [['price', '가격'], ['index', '지표값'], ['volume', '거래량']] as const) {
    const value = '999999999999.12345678'
    const result = describeCondition(comparison('gte', number(value, unit), number('0.00000001', unit)), [])
    expect(result.text).toBe(`${value}\u00a0(${label}) 값이 0.00000001\u00a0(${label})\u00a0이상`)
    expect(result.text).not.toMatch(/USDT|달러|%|BTC/)
  }
})

test('AND/OR 모든 그룹을 괄호로 감싸 논리 중첩과 자식 순서를 보존한다', () => {
  const first = comparison('lt', number('1'), number('2'))
  const second = comparison('gte', number('3'), number('4'))
  const third = comparison('gt', number('5'), number('6'))
  const condition: StrategyCondition = { id: 'all', kind: 'logical', operator: 'and', conditions: [first,
    { id: 'either', kind: 'logical', operator: 'or', conditions: [second, third] }] }
  expect(describeCondition(condition, []).text).toBe('(1\u00a0(지표값) 값이 2\u00a0(지표값)\u00a0미만 그리고 (3\u00a0(지표값) 값이 4\u00a0(지표값)\u00a0이상 또는 5\u00a0(지표값) 값이 6\u00a0(지표값)\u00a0초과))')
  expect(describeCondition({ ...condition, operator: 'or' }, []).text).toContain('미만 또는 (')
})

test('누락 지표는 ID 그대로와 확인 필요 경고이며 동일 참조 경고는 중복하지 않는다', () => {
  const result = describeCondition(comparison('lt', ref('missing_feature'), ref('missing_feature')), features)
  expect(result.text).toBe('지표 ID missing_feature (확인 필요) 값이 지표 ID missing_feature (확인 필요) 미만')
  expect(result.warnings).toEqual(['지표 ID missing_feature: 참조 대상을 찾을 수 없습니다. 전체 조건 원문을 확인해주세요.'])
  expect(result.text).not.toContain('RSI')
})

test('중복 ID는 처음/마지막 지표를 임의 선택하지 않는다', () => {
  const duplicate: StrategyFeature = { id: 'rsi', type: 'ema', period: 200, source: 'close', timeframe: '15m' }
  for (const list of [[...features, duplicate], [duplicate, ...features], [features[1], features[1], features[1]]]) {
    const result = describeCondition(comparison(), list)
    expect(result.text).toBe('지표 ID rsi (확인 필요) 값이 30.00\u00a0(지표값)\u00a0미만')
    expect(result.warnings).toEqual(['지표 ID rsi: 중복된 ID로 참조 대상을 정할 수 없습니다. 전체 조건 원문을 확인해주세요.'])
    expect(result.text).not.toMatch(/200|RSI|EMA/)
  }
})

test('긴 ID/태그/숫자는 텍스트 그대로이며 HTML이나 단위로 해석하지 않는다', () => {
  const id = `<script>unsafe()</script>${'긴ID'.repeat(100)}`
  const result = describeCondition(comparison('lt', ref(id), number('0.00000001')), [])
  expect(result.text).toContain(`지표 ID ${id} (확인 필요)`)
  expect(result.warnings[0]).toContain(id)
  const longDecimal = `1.${'0'.repeat(200)}1`
  expect(describeCondition(comparison('lt', number(longDecimal), number('2')), []).text).toContain(longDecimal)
})

test('숫자 원문은 보존하고 숫자·단위·오른쪽 비교어 공백만 NBSP로 묶는다', () => {
  const value = '00028.00000001'
  const output = describeCondition(comparison('lt', ref('rsi'), number(value)), features).text
  expect(output).toBe(`RSI (14봉, 종가, 15분봉) [rsi] 값이 ${value}\u00a0(지표값)\u00a0미만`)
  expect(output.match(/\u00a0/g)).toHaveLength(2)
  expect(output.slice(output.indexOf(value), output.indexOf('\u00a0'))).toBe(value)
  const reversed = describeCondition(comparison('gte', number(value), ref('rsi')), features).text
  expect(reversed).toBe(`${value}\u00a0(지표값) 값이 RSI (14봉, 종가, 15분봉) [rsi] 이상`)
  expect(reversed.match(/\u00a0/g)).toHaveLength(1)
})

test('빈/단일 논리 그룹은 항상참 또는 유효 조건으로 추정하지 않는다', () => {
  for (const children of [[], [comparison()]]) {
    const result = describeCondition({ id: 'empty', kind: 'logical', operator: 'and', conditions: children }, features)
    expect(result.text).toBe('조건 설명 확인 필요 · 전체 조건 원문을 확인해주세요.')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('하위 조건이 부족')
    expect(result.text).not.toMatch(/항상|충족|통과/)
  }
})

test('SDK 허용 깊이 8까지 표시하고 초과 시 부분 AND/OR를 남기지 않는다', () => {
  let condition = comparison()
  for (let depth = 0; depth < 8; depth++) condition = { id: `depth_${depth}`, kind: 'logical', operator: 'and', conditions: [condition, comparison()] }
  expect(describeCondition(condition, features).warnings).toEqual([])
  condition = { id: 'too_deep', kind: 'logical', operator: 'or', conditions: [condition, comparison()] }
  const result = describeCondition(condition, features)
  expect(result.text).toBe('조건 설명 확인 필요 · 전체 조건 원문을 확인해주세요.')
  expect(result.warnings[0]).toContain('너무 깊거나 길거나 순환')
  expect(result.text).not.toContain('또는')
})

test('노드·문자열 상한 및 순환은 안전한 원문 확인으로 끝난다', () => {
  const wide: StrategyCondition = { id: 'wide', kind: 'logical', operator: 'and', conditions: Array.from({ length: 256 }, () => comparison()) }
  const huge = comparison('lt', number(`1.${'0'.repeat(20_000)}1`), number('2'))
  const cyclic: Extract<StrategyCondition, { kind: 'logical' }> = { id: 'cycle', kind: 'logical', operator: 'or', conditions: [] }
  ;(cyclic.conditions as StrategyCondition[]).push(cyclic, comparison())
  for (const condition of [wide, huge, cyclic]) {
    const result = describeCondition(condition, features)
    expect(result.text).toBe('조건 설명 확인 필요 · 전체 조건 원문을 확인해주세요.')
    expect(result.warnings.length).toBeGreaterThan(0)
  }
})

test('동일한 subtree 재사용은 cycle이 아니며 독립 조건 순서를 보존한다', () => {
  const child = comparison()
  const result = describeCondition({ id: 'reuse', kind: 'logical', operator: 'or', conditions: [child, child] }, features)
  expect(result.warnings).toEqual([])
  expect(result.text.match(/RSI/g)).toHaveLength(2)
})

test('정확 소수점 이동: 0/정수/소액/큰값/소수 끝 0에서 반올림하지 않는다', () => {
  for (const [input, expected] of [
    ['0', '0%'], ['0.00', '0%'], ['1', '100%'], ['10', '1000%'], ['0.1', '10%'], ['0.02', '2%'],
    ['0.02000000', '2%'], ['0.12345678', '12.345678%'], ['0.00000001', '0.000001%'], ['0.000000001', '0.0000001%'],
    ['999999999999.99999999', '99999999999999.999999%'], ['1.0010', '100.1%'], ['1.0099', '100.99%'],
    ['123456789012345678901234567890.1234567890123456789', '12345678901234567890123456789012.34567890123456789%'],
    [`0.${'0'.repeat(200)}1`, `0.${'0'.repeat(198)}1%`],
  ]) expect(formatFractionPercent(input)).toBe(expected)
})

test('SDK 범위 밖 표기는 Number 파싱으로 덮지 않고 원문+확인 필요로 남긴다', () => {
  for (const input of ['', ' ', '0.02 ', '+0.02', '-0.02', '1e-8', '.02', '01.02', 'NaN', 'Infinity', '1.', '0,02', '<b>0.02</b>']) {
    expect(formatFractionPercent(input)).toBe(`${input} (비율 확인 필요)`)
  }
})

test('deep-frozen 입력을 바꾸지 않으며 재호출에 이전 경고가 남지 않는다', () => {
  const condition = freeze(comparison())
  const list = freeze(structuredClone(features))
  const before = JSON.stringify([condition, list])
  expect(describeCondition(condition, list).warnings).toEqual([])
  expect(describeCondition(comparison('lt', ref('unknown')), list).warnings).toHaveLength(1)
  expect(describeCondition(condition, list).warnings).toEqual([])
  list.forEach(feature => describeFeature(feature))
  expect(JSON.stringify([condition, list])).toBe(before)
})

test('정적 카피 외 런타임 imports/Number/Date/네트워크 없이 같은 결과를 만든다', () => {
  const copySource = readFileSync('src/internal-poc/native-strategy-copy.ts', 'utf8')
  const copyCompiled = ts.transpileModule(copySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const copyExports: Record<string, unknown> = {}
  const forbidden = () => { throw new Error('Unexpected runtime dependency') }
  runInNewContext(copyCompiled, { exports: copyExports, Date: undefined, Number: undefined, parseFloat: undefined, parseInt: undefined,
    require: forbidden }, { timeout: 100 })
  const source = readFileSync('src/internal-poc/native-strategy-readable.ts', 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, unknown> = {}
  runInNewContext(compiled, { exports, Date: undefined, Number: undefined, parseFloat: undefined, parseInt: undefined,
    require: (name: string) => name === './native-strategy-copy' ? copyExports : forbidden() }, { timeout: 100 })
  expect((exports.formatFractionPercent as typeof formatFractionPercent)('0.00000001')).toBe('0.000001%')
  expect(JSON.parse(JSON.stringify((exports.describeCondition as typeof describeCondition)(comparison(), features))))
    .toEqual(describeCondition(comparison(), features))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    expect(JSON.parse(JSON.stringify((exports.describeCondition as typeof describeCondition)(comparison(), features, language))))
      .toEqual(describeCondition(comparison(), features, language))
  }
})

test('7언어 카피의 키와 placeholder를 보존하고 삽입된 원문을 재해석하지 않는다', () => {
  for (const copy of Object.values(nativeStrategyCopy)) {
    expect(copy).toHaveLength(7)
    const placeholders = (text: string) => (text.match(/\{[a-z]+\}/g) ?? []).sort()
    for (const translated of copy) {
      expect(translated.trim()).not.toBe('')
      expect(placeholders(translated)).toEqual(placeholders(copy[0]))
    }
    for (const translated of copy.slice(1)) expect(translated).not.toMatch(/[\uAC00-\uD7A3]/)
    for (const index of [1, 5, 6]) expect(copy[index]).not.toMatch(/[\u3040-\u30FF\u4E00-\u9FFF]/)
  }
  // Literal anchors are independent of the copy implementation/column map.
  // They catch wrong locale columns; they are not a native-speaker review.
  for (const [language, marketOrder, entries, and] of [
    ['ko', '시장가', '진입 조건', '그리고'], ['en', 'Market', 'Entry conditions', 'and'],
    ['ja', '成行', 'エントリー条件', 'かつ'], ['zh-CN', '市价', '入场条件', '并且'],
    ['zh-TW', '市價', '進場條件', '並且'], ['es', 'A mercado', 'Condiciones de entrada', 'y'],
    ['fr', 'Au marché', "Conditions d'entrée", 'et'],
  ] as const) {
    expect(nativeStrategyText(language, 'marketOrder')).toBe(marketOrder)
    expect(nativeStrategyText(language, 'entries')).toBe(entries)
    expect(nativeStrategyText(language, 'and')).toBe(and)
  }
  const raw = '$&$`$\' {id} {right} <b>원문</b>'
  expect(nativeStrategyText('en', 'crossAbove', { left: raw, right: 'RIGHT' })).toBe(`${raw} value crosses above RIGHT value`)
  expect(nativeStrategyText('en', 'featureUnconfirmed', { id: raw })).toBe(`Indicator ID ${raw} (needs checking)`)
})

test('생성 계약의 고정 의미가 넓어지면 문서 카피의 컴파일 핀이 실패한다', () => {
  const document = ts.createSourceFile('NativeStrategyDocument.tsx', readFileSync('src/internal-poc/NativeStrategyDocument.tsx', 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  let pin: ts.TypeNode | undefined
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(document) === 'projection' && node.initializer && ts.isSatisfiesExpression(node.initializer)) pin = node.initializer.type
    ts.forEachChild(node, visit)
  }
  visit(document)
  expect(pin, 'Projection presentation requires an explicit compile-time semantic pin').toBeDefined()
  const contract = readFileSync('src/internal-poc/contracts/generated/api-v0.3/types.ts', 'utf8')
  const filename = '/virtual-teth-document-semantic-pin.ts'
  const options: ts.CompilerOptions = { strict: true, noEmit: true, types: [], skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  const diagnostics = (source: string) => {
    const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host)
    host.getSourceFile = (path, version, onError, create) => path === filename
      ? ts.createSourceFile(path, `${source}\ndeclare const snapshot: ConversationSnapshot;\nconst proof = snapshot.draftState.projection satisfies ${pin!.getText(document)};`, ts.ScriptTarget.ES2022, true)
      : original(path, version, onError, create)
    return ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host))
  }
  expect(diagnostics(contract).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([])
  for (const [field, before, after] of [
    ['evaluateOn', '"candle_close"', '"candle_close"|"intrabar"'], ['oncePerCandle', 'true', 'boolean'],
    ['side', '"long"', '"long"|"short"'], ['rearm', '"on_false"', '"on_false"|"always"'],
    ['positionExistsPolicy', '"skip"', '"skip"|"add"'], ['triggerPrice', '"mark_price"', '"mark_price"|"last_price"'],
    ['orderType', '"market"', '"market"|"limit"'], ['reduceOnly', 'true', 'boolean'],
    ['entryOrderType', '"market"', '"market"|"limit"'], ['type', '"fixed_notional"', '"fixed_notional"|"fixed_margin"'],
  ]) {
    const target = `readonly ${field}:${before}`, widened = contract.replace(target, `readonly ${field}:${after}`)
    expect(widened, field).not.toBe(contract)
    expect(diagnostics(widened).some(error => error.code === 1360), `${field} widening must reject fixed presentation copy`).toBe(true)
  }
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
  test(`${language}: 조건 방향·정밀 수치·중첩·원문 ID와 불완전 조건 경계를 보존한다`, () => {
    const list = freeze(structuredClone(features))
    const raw = '999999999999.12345678'
    for (const field of ['open', 'high', 'low', 'close', 'volume'] as const) {
      expect(describeFeature({ id: 'ohlcv', type: 'ohlcv', field, timeframe: '15m' }, language))
        .toBe(`${nativeStrategyText(language, field)} (${nativeStrategyText(language, 'timeframe15m')})`)
    }
    for (const type of ['rsi', 'sma', 'ema', 'rolling_max', 'rolling_min'] as const) {
      const feature: StrategyFeature = type === 'rolling_max' || type === 'rolling_min'
        ? { id: type, type, period: 500, source: 'close', timeframe: '15m', excludeCurrent: true }
        : { id: type, type, period: 500, source: 'close', timeframe: '15m' }
      expect(describeFeature(freeze(feature), language)).toBe(nativeStrategyText(language, type, {
        period: 500, source: nativeStrategyText(language, 'close'), timeframe: nativeStrategyText(language, 'timeframe15m'),
      }))
    }
    for (const [operator, symbol] of [['lt', '<'], ['lte', '≤'], ['gt', '>'], ['gte', '≥']] as const) {
      const left = number(raw, 'price'), right = number('0.00000001', 'price')
      const condition = freeze(comparison(operator, left, right))
      const before = JSON.stringify(condition)
      const result = describeCondition(condition, list, language)
      expect(result.warnings).toEqual([])
      expect(result.text).toContain(raw)
      expect(result.text).toContain('0.00000001')
      expect(result.text).not.toMatch(/USDT|USD|BTC|%/)
      if (language !== 'ko') {
        const unit = nativeStrategyText(language, 'price')
        expect(result.text).toBe(`${raw}\u00a0(${unit}) ${symbol} 0.00000001\u00a0(${unit})`)
        expect(describeCondition(comparison(operator, right, left), list, language).text)
          .toBe(`0.00000001\u00a0(${unit}) ${symbol} ${raw}\u00a0(${unit})`)
      }
      expect(JSON.stringify(condition)).toBe(before)
    }
    for (const operator of ['cross_above', 'cross_below'] as const) {
      for (const [left, right] of [[features[2], features[3]], [features[3], features[2]]]) {
        expect(describeCondition({ id: 'cross', kind: 'cross', operator, left: ref(left.id), right: ref(right.id) }, list, language).text)
          .toBe(nativeStrategyText(language, operator === 'cross_above' ? 'crossAbove' : 'crossBelow', {
            left: `${describeFeature(left, language)} [${left.id}]`, right: `${describeFeature(right, language)} [${right.id}]`,
          }))
      }
    }
    const a = comparison('lt', number('1'), number('2')), b = comparison('gte', number('3'), number('4'))
    const nested: StrategyCondition = { id: 'root', kind: 'logical', operator: 'and', conditions: [a, { id: 'child', kind: 'logical', operator: 'or', conditions: [b, a] }] }
    const at = describeCondition(a, list, language).text, bt = describeCondition(b, list, language).text
    expect(describeCondition(nested, list, language).text).toBe(`(${at} ${nativeStrategyText(language, 'and')} (${bt} ${nativeStrategyText(language, 'or')} ${at}))`)
    const id = 'ID_$&_{id}_{right}_<unsafe>'
    const missing = describeCondition(comparison('lt', ref(id), ref(id)), list, language)
    expect(missing.warnings).toEqual([nativeStrategyText(language, 'missingFeature', { id })])
    expect(missing.text).toContain(id)
    const duplicate = describeCondition(comparison(), [...list, list[1]], language)
    expect(duplicate.warnings).toEqual([nativeStrategyText(language, 'duplicateFeature', { id: 'rsi' })])
    const malformed: StrategyCondition = { id: 'empty', kind: 'logical', operator: 'and', conditions: [] }
    expect(describeCondition(malformed, list, language)).toEqual({ text: nativeStrategyText(language, 'conditionFallback'), warnings: [nativeStrategyText(language, 'logicalWarning')] })
    const cycle: StrategyCondition = { id: 'cycle', kind: 'logical', operator: 'and', conditions: [a] }
    cycle.conditions.push(cycle)
    expect(describeCondition(cycle, list, language)).toEqual({ text: nativeStrategyText(language, 'conditionFallback'), warnings: [nativeStrategyText(language, 'complexityWarning')] })
    expect(formatFractionPercent(`0.${'0'.repeat(200)}1`, language)).toBe(`0.${'0'.repeat(198)}1%`)
    expect(formatFractionPercent('0.02000000', language)).toBe('2%')
    expect(formatFractionPercent('1e-8', language)).toBe(`1e-8 (${nativeStrategyText(language, 'rateUnconfirmed')})`)
  })
}
