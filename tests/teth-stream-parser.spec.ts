import { expect, test } from '@playwright/test'
import { createTethStreamParser, type TethParseEvent } from '../src/teth-stream-parser'
import { parseChipsJson, validateProb } from '../src/teth-chips-schema'

// Node-only unit spec: no page fixture, one project is enough.
test.skip(({ isMobile }) => isMobile, '브라우저 무관 단위 검증은 desktop 프로젝트에서만 1회 실행')

/** 연속 answer-delta 를 합쳐 청크 경계와 무관한 정규형으로 만든다. */
function normalize(events: TethParseEvent[]) {
  const out: (TethParseEvent | { kind: 'answer-delta'; text: string })[] = []
  for (const event of events) {
    const last = out.at(-1)
    if (event.kind === 'answer-delta' && last?.kind === 'answer-delta') last.text += event.text
    else out.push(event.kind === 'answer-delta' ? { ...event } : event)
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

const SAMPLE = '<trace>주봉 흐름 확인</trace>\n<trace>반대 시나리오 검증</trace>\n<answer>\n결론: 분할 접근이 낫습니다.\n<prob up="58" down="42"/>\n근거는 주봉 추세입니다.\n</answer>\n<chips>{"suggest": ["다음 질문 A", "다음 질문 B"], "action": [{"type": "backtest", "label": "검증하기"}]}</chips>'

const SAMPLE_NORMALIZED = [
  { kind: 'trace-step', label: '주봉 흐름 확인' },
  { kind: 'trace-step', label: '반대 시나리오 검증' },
  { kind: 'answer-open' },
  { kind: 'answer-delta', text: '결론: 분할 접근이 낫습니다.\n' },
  { kind: 'prob-raw', up: '58', down: '42' },
  { kind: 'answer-delta', text: '\n근거는 주봉 추세입니다.\n' },
  { kind: 'answer-close' },
  { kind: 'chips-raw', raw: '{"suggest": ["다음 질문 A", "다음 질문 B"], "action": [{"type": "backtest", "label": "검증하기"}]}' },
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

test('태그가 청크 경계에서 잘려도 복원된다: <ans + wer>', () => {
  expect(run(['<ans', 'wer>결론', '만 있음</an', 'swer>'])).toEqual([
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: '결론만 있음' },
    { kind: 'answer-close' },
  ])
})

test('prob 속성이 중간에서 잘려도 복원된다', () => {
  expect(run(['<answer>a<prob up="6', '2" down="38"/>b</answer>'])).toEqual([
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: 'a' },
    { kind: 'prob-raw', up: '62', down: '38' },
    { kind: 'answer-delta', text: 'b' },
    { kind: 'answer-close' },
  ])
})

test('닫는 태그가 없어도 finish 가 내용을 커밋한다', () => {
  expect(run(['<trace>무효선 계산', '\n<answer>부분 답변'])).toEqual([
    { kind: 'trace-step', label: '무효선 계산' },
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: '부분 답변' },
    { kind: 'answer-close' },
  ])
})

test('answer 태그가 아예 없으면 본문 전체가 답변으로 흐른다', () => {
  expect(run(['그냥 ', '평문으로 답한 경우'])).toEqual([
    { kind: 'answer-delta', text: '그냥 평문으로 답한 경우' },
  ])
})

test('본문 속 비교 기호 < 는 태그로 오인되지 않는다', () => {
  expect(run(['<answer>가격 < 100 이면 매수, x<y 유지</answer>'])).toEqual([
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: '가격 < 100 이면 매수, x<y 유지' },
    { kind: 'answer-close' },
  ])
})

test('알 수 없는 태그 <foo> 는 리터럴 텍스트로 남는다', () => {
  expect(run(['<answer><foo>내용</foo></answer>'])).toEqual([
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: '<foo>내용</foo>' },
    { kind: 'answer-close' },
  ])
})

test('chips JSON 내부의 < 와 닫는 태그 분할을 견딘다', () => {
  expect(run(['<chips>{"suggest": ["a<b?"]}</chi', 'ps>'])).toEqual([
    { kind: 'chips-raw', raw: '{"suggest": ["a<b?"]}' },
  ])
})

test('종결되지 않은 chips 는 drop 된다', () => {
  expect(run(['<answer>답</answer><chips>{"suggest": ['])).toEqual([
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: '답' },
    { kind: 'answer-close' },
    { kind: 'drop', reason: 'unterminated-chips' },
  ])
})

test('중복 chips 블록은 파서 단계에서는 둘 다 통과한다 (검증 계층이 첫 유효만 채택)', () => {
  const result = run(['<chips>{"a":1}</chips><chips>{"b":2}</chips>'])
  expect(result.filter(event => event.kind === 'chips-raw')).toHaveLength(2)
})

test('빈 스트림은 아무 이벤트도 만들지 않는다', () => {
  expect(run([])).toEqual([])
  expect(run(['', ''])).toEqual([])
})

test('trace 사이 공백·개행은 답변으로 새지 않는다', () => {
  expect(run(['<trace>a</trace>\n  \n<trace>b</trace>\n\n<answer>본문</answer>'])).toEqual([
    { kind: 'trace-step', label: 'a' },
    { kind: 'trace-step', label: 'b' },
    { kind: 'answer-open' },
    { kind: 'answer-delta', text: '본문' },
    { kind: 'answer-close' },
  ])
})

// ── 검증 계층 (프롬프트를 믿지 않는다) ─────────────────────────────

test('validateProb: 합 100 의 0~100 값만 통과한다', () => {
  expect(validateProb('62', '38')).toEqual({ up: 62, down: 38 })
  expect(validateProb(58.4, 41.6)).toEqual({ up: 58, down: 42 })
  expect(validateProb('62', '39')).toBeNull()
  expect(validateProb('abc', '38')).toBeNull()
  expect(validateProb(-10, 110)).toBeNull()
  expect(validateProb('', '')).toBeNull()
  expect(validateProb(101, -1)).toBeNull()
})

test('parseChipsJson: 깨진 JSON 과 비객체는 invalid', () => {
  expect(parseChipsJson('{"suggest": [', { allowTwoActions: false }).kind).toBe('invalid')
  expect(parseChipsJson('[1,2]', { allowTwoActions: false }).kind).toBe('invalid')
  expect(parseChipsJson('"text"', { allowTwoActions: false }).kind).toBe('invalid')
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

test('parseChipsJson: 빈 라벨 액션은 버린다', () => {
  const result = parseChipsJson('{"action": [{"type": "alert", "label": "  "}]}', { allowTwoActions: false })
  expect(result.kind === 'ok' && result.chips.actions).toEqual([])
})
