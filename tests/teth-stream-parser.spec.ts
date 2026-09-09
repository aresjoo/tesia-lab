import { expect, test } from '@playwright/test'
import { createTethStreamParser, type TethParseEvent } from '../src/teth-stream-parser'
import { parseChipsJson, validateProb } from '../src/teth-chips-schema'
import { validateWorkModel } from '../src/teth-model-routing'

// Node-only unit spec: no page fixture, one project is enough.
test.skip(({ isMobile }) => isMobile, '브라우저 무관 단위 검증은 desktop 프로젝트에서만 1회 실행')

/** 연속 say-delta 를 합치고 렌더 무관 이벤트(say-open/close)를 접어,
 * 청크 경계와 무관한 정규형으로 만든다. */
function normalize(events: TethParseEvent[]) {
  const out: (TethParseEvent | { kind: 'say'; text: string })[] = []
  for (const event of events) {
    if (event.kind === 'say-open' || event.kind === 'say-close') continue
    if (event.kind === 'say-delta') {
      const last = out.at(-1)
      if (last?.kind === 'say') { last.text += event.text; continue }
      out.push({ kind: 'say', text: event.text })
      continue
    }
    out.push(event)
  }
  return out
}

function run(chunks: string[]) {
  const parser = createTethStreamParser()
  const events: TethParseEvent[] = []
  for (const chunk of chunks) events.push(...parser.push(chunk))
  events.push(...parser.finish())
  return normalize(events)
}

const SAMPLE = '<say>비트코인 진입 타이밍 보시는군요. 차트부터 볼게요.</say>\n' +
  '<work model="gemini-agy-flash" role="차트 검토">\n<item>주봉 추세 구조 검토</item>\n<item>일봉 조정 구간 점검</item>\n</work>\n' +
  '<say>두 신호가 살짝 어긋나 있어요.</say>\n' +
  '<work model="claude-fable-5" role="종합 판단">\n<item>반대 시나리오 점검</item>\n</work>\n' +
  '<say>결론: 분할 접근이 낫습니다.\n<prob up="58" down="42"/>\n무효선은 $XX,XXX 입니다.</say>\n' +
  '<chips>{"suggest": ["다음 질문 A"], "action": [{"type": "backtest", "label": "검증하기"}]}</chips>'

const SAMPLE_NORMALIZED = [
  { kind: 'say', text: '비트코인 진입 타이밍 보시는군요. 차트부터 볼게요.' },
  { kind: 'work-open', model: 'gemini-agy-flash', role: '차트 검토' },
  { kind: 'item', label: '주봉 추세 구조 검토' },
  { kind: 'item', label: '일봉 조정 구간 점검' },
  { kind: 'work-close' },
  { kind: 'say', text: '두 신호가 살짝 어긋나 있어요.' },
  { kind: 'work-open', model: 'claude-fable-5', role: '종합 판단' },
  { kind: 'item', label: '반대 시나리오 점검' },
  { kind: 'work-close' },
  { kind: 'say', text: '결론: 분할 접근이 낫습니다.\n' },
  { kind: 'prob-raw', up: '58', down: '42' },
  { kind: 'say', text: '\n무효선은 $XX,XXX 입니다.' },
  { kind: 'chips-raw', raw: '{"suggest": ["다음 질문 A"], "action": [{"type": "backtest", "label": "검증하기"}]}' },
]

test('전체 프로토콜을 한 청크로 받아도 정규형이 일치한다', () => {
  expect(run([SAMPLE])).toEqual(SAMPLE_NORMALIZED)
})

test('한 글자씩 끊어 받아도 결과는 한 청크와 동일하다', () => {
  expect(run([...SAMPLE])).toEqual(SAMPLE_NORMALIZED)
})

test('임의 2~7자 청크로 끊어 받아도 결과가 동일하다', () => {
  let seed = 20260910
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  for (let round = 0; round < 20; round++) {
    const chunks: string[] = []
    for (let i = 0; i < SAMPLE.length;) { const size = 2 + Math.floor(random() * 6); chunks.push(SAMPLE.slice(i, i + size)); i += size }
    expect(run(chunks), `round ${round}`).toEqual(SAMPLE_NORMALIZED)
  }
})

test('태그 없는 평문 답변은 전부 say 채널로 흐른다 (work 0개)', () => {
  expect(run(['손절은 ', '손해를 멈추는 기준선이에요.'])).toEqual([
    { kind: 'say', text: '손절은 손해를 멈추는 기준선이에요.' },
  ])
})

test('work 태그가 청크 경계에서 잘려도 복원된다', () => {
  expect(run(['<say>확인해볼게요.</say><wor', 'k model="gpt-sol" role="뉴스 검토"><ite', 'm>시장 심리 점검</item></work>'])).toEqual([
    { kind: 'say', text: '확인해볼게요.' },
    { kind: 'work-open', model: 'gpt-sol', role: '뉴스 검토' },
    { kind: 'item', label: '시장 심리 점검' },
    { kind: 'work-close' },
  ])
})

// ── 버그 클래스 ① 회귀 (직전 세션: 셀프클로즈 누락 prob 의 산문 삼킴) ──

test('버그① prob: 닫는 괄호 누락 + 멀리 있는 > 가 본문을 삼키지 않는다', () => {
  const prose = 'BTC 가격이 오르면 '.repeat(30)
  const result = run([`<say>앞 <prob up="62" down="38" ${prose} > 뒤</say>`])
  expect(result.some(event => event.kind === 'prob-raw')).toBe(false)
  const text = result.filter(event => event.kind === 'say').map(event => (event as { text: string }).text).join('')
  expect(text).toContain('뒤')
  expect(text).toContain(prose.trim())
})

test('버그① work: 닫는 괄호 누락 태그도 상한 초과 시 산문으로 복구된다', () => {
  const prose = '이후 본문이 계속 이어진다 '.repeat(20)
  const result = run([`<work model="gpt-sol" role="뉴스" ${prose}`])
  expect(result.some(event => event.kind === 'work-open')).toBe(false)
  const text = result.filter(event => event.kind === 'say').map(event => (event as { text: string }).text).join('')
  expect(text).toContain('이후 본문이 계속 이어진다')
})

// ── 버그 클래스 ② 회귀 (미종결 태그의 전체 흡수 방지) ──

test('버그② item: 라벨 상한 초과 시 절단 커밋 + drop 신호', () => {
  const long = '가'.repeat(400)
  const result = run([`<work model="claude-fable-5" role="검토"><item>${long}</item></work>`])
  const item = result.find(event => event.kind === 'item') as { label: string }
  expect(item.label.length).toBeLessThanOrEqual(200)
  expect(result.some(event => event.kind === 'drop' && event.reason === 'item-overflow')).toBe(true)
})

test('버그② 미종결 say/work/item 은 finish 가 관대하게 커밋한다', () => {
  expect(run(['<say>부분 답변', '</say><work model="claude-fable-5" role="검토"><item>무효선 계산'])).toEqual([
    { kind: 'say', text: '부분 답변' },
    { kind: 'work-open', model: 'claude-fable-5', role: '검토' },
    { kind: 'item', label: '무효선 계산' },
    { kind: 'work-close' },
  ])
})

test('버그② 종결되지 않은 chips 는 drop 된다', () => {
  const result = run(['<say>답</say><chips>{"suggest": ['])
  expect(result).toEqual([
    { kind: 'say', text: '답' },
    { kind: 'drop', reason: 'unterminated-chips' },
  ])
})

// ── 관대 복구 ──

test('item 태그 없이 줄만 나열한 work 도 줄 단위로 item 이 된다', () => {
  expect(run(['<work model="claude-opus-5" role="전략">\n손절선 계산\n익절 구간 설계\n</work>'])).toEqual([
    { kind: 'work-open', model: 'claude-opus-5', role: '전략' },
    { kind: 'item', label: '손절선 계산' },
    { kind: 'item', label: '익절 구간 설계' },
    { kind: 'work-close' },
  ])
})

test('say 본문 속 비교 기호 < 와 미지 태그는 리터럴로 남는다', () => {
  expect(run(['<say>가격 < 100 이면 매수, <foo>표시</foo> 유지</say>'])).toEqual([
    { kind: 'say', text: '가격 < 100 이면 매수, <foo>표시</foo> 유지' },
  ])
})

test('chips JSON 내부의 < 와 닫는 태그 분할을 견딘다', () => {
  expect(run(['<chips>{"suggest": ["a<b?"]}</chi', 'ps>'])).toEqual([
    { kind: 'chips-raw', raw: '{"suggest": ["a<b?"]}' },
  ])
})

test('빈 스트림과 공백 전용 청크는 아무 이벤트도 만들지 않는다', () => {
  expect(run([])).toEqual([])
  expect(run(['  \n', ' '])).toEqual([])
})

test('태그 사이 공백·개행은 say 로 새지 않는다', () => {
  const result = run(['<say>a</say>\n  \n<work model="gpt-sol" role="r"><item>b</item></work>\n\n<say>c</say>'])
  expect(result).toEqual([
    { kind: 'say', text: 'a' },
    { kind: 'work-open', model: 'gpt-sol', role: 'r' },
    { kind: 'item', label: 'b' },
    { kind: 'work-close' },
    { kind: 'say', text: 'c' },
  ])
})

// ── 라우팅 표 검증 ──

test('validateWorkModel: 표 안 라벨만 통과, 밖은 null', () => {
  expect(validateWorkModel('claude-fable-5')).toBe('claude-fable-5')
  expect(validateWorkModel('gemini-agy-flash')).toBe('gemini-agy-flash')
  expect(validateWorkModel('gpt-5-turbo-max')).toBeNull()
  expect(validateWorkModel('')).toBeNull()
  expect(validateWorkModel(undefined)).toBeNull()
  expect(validateWorkModel('__proto__')).toBeNull()
})

// ── 검증 계층 (프롬프트를 믿지 않는다) — 기존 스키마 회귀 유지 ──

test('validateProb: 합 100 의 0~100 값만 통과한다', () => {
  expect(validateProb('62', '38')).toEqual({ up: 62, down: 38 })
  expect(validateProb(58.4, 41.6)).toEqual({ up: 58, down: 42 })
  expect(validateProb('62', '39')).toBeNull()
  expect(validateProb('abc', '38')).toBeNull()
  expect(validateProb(-10, 110)).toBeNull()
  expect(validateProb('', '')).toBeNull()
})

test('parseChipsJson: 깨진 JSON 과 비객체는 invalid', () => {
  expect(parseChipsJson('{"suggest": [', { allowTwoActions: false }).kind).toBe('invalid')
  expect(parseChipsJson('[1,2]', { allowTwoActions: false }).kind).toBe('invalid')
})

test('parseChipsJson: 미지 액션 타입은 버리고 허용 타입만 남긴다', () => {
  const result = parseChipsJson('{"action": [{"type": "sell_all", "label": "전량 매도"}, {"type": "backtest", "label": "검증"}]}', { allowTwoActions: false })
  expect(result).toEqual({ kind: 'ok', chips: { suggest: [], actions: [{ type: 'backtest', label: '검증' }] } })
})

test('parseChipsJson: 액션은 기본 1개, 판단이 갈릴 때만 2개까지', () => {
  const raw = '{"action": [{"type": "backtest", "label": "a"}, {"type": "alert", "label": "b"}, {"type": "auto", "label": "c"}]}'
  const single = parseChipsJson(raw, { allowTwoActions: false })
  const double = parseChipsJson(raw, { allowTwoActions: true })
  expect(single.kind === 'ok' && single.chips.actions).toHaveLength(1)
  expect(double.kind === 'ok' && double.chips.actions).toHaveLength(2)
})

test('parseChipsJson: 제안은 문자열만, 중복 제거, 5개 상한', () => {
  const result = parseChipsJson('{"suggest": ["a", "a", 3, null, "b", "c", "d", "e", "f"]}', { allowTwoActions: false })
  expect(result.kind === 'ok' && result.chips.suggest).toEqual(['a', 'b', 'c', 'd', 'e'])
})
