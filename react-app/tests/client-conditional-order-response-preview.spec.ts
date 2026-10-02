import { expect, test } from '@playwright/test'
import { readConditionalOrderTag } from '../src/client-conditional-order-intake'
import { readMockConditionalOrderPending, replyConditionalOrderPreview, type MockConditionalOrderPending } from '../src/client-conditional-order-response-preview'

function asking(question: string, field: MockConditionalOrderPending['asking'], pending?: MockConditionalOrderPending) {
  const reply = replyConditionalOrderPreview(question, pending)
  expect(reply?.kind).toBe('ask')
  if (!reply || reply.kind !== 'ask') throw new Error('Expected an explicit clarification')
  expect(reply.pending.asking).toBe(field)
  expect(reply.pending.unsupported).toBeUndefined()
  expect(readMockConditionalOrderPending(JSON.parse(JSON.stringify(reply.pending)))).toEqual(reply.pending)
  return reply
}
function complete(question: string, pending?: MockConditionalOrderPending) {
  const reply = replyConditionalOrderPreview(question, pending)
  expect(reply?.kind).toBe('order')
  if (!reply || reply.kind !== 'order') throw new Error('Expected a validated Mock display order')
  const parsed = readConditionalOrderTag(reply.answer)
  expect(parsed?.spec).toEqual(reply.spec)
  expect(parsed?.cleanText.trim()).toBe('조건을 확인했습니다. 아래에서 예약합니다.')
  expect(reply.spec.last).toBeNull()
  expect(reply.pending).toBeNull()
  return reply
}

test('source QA BTC 9만 달러 매도는 수량과 TTL을 각각 묻고 완료 태그를 만든다', () => {
  const first = asking('비트코인 9만 달러 되면 팔아줘', 'qty')
  expect(first.pending.fields).toEqual({ asset: '비트코인', side: 'sell', trigger: 90000 })
  expect(first.suggestions).toEqual(['전부', '절반'])
  const second = asking('전부', 'ttl', first.pending)
  expect(second.suggestions).toEqual(['취소할 때까지', '7일', '하루'])
  expect(complete('7일', JSON.parse(JSON.stringify(second.pending))).spec).toMatchObject({ symbol: 'BTC', side: 'sell', trigger: 90000, qty: 'all', lev: null, ttl: '7d' })
  expect(complete('취소할 때까지', second.pending).spec.ttl).toBe('gtc')
  const alreadyQty = asking('BTC 90000달러 되면 전부 매도', 'ttl')
  expect(complete('7일', alreadyQty.pending).spec.trigger).toBe(90000)
})

test('source ETH 3천 아래 3배 롱은 달러와 수량 및 TTL을 임의로 채우지 않는다', () => {
  const price = asking('이더리움 3천 아래로 오면 3배 롱', 'trigger')
  expect(price.pending.fields).toEqual({ asset: '이더리움', side: 'long', lev: 3 })
  expect(price.suggestions).toEqual([])
  const qty = asking('3000달러', 'qty', price.pending)
  const ttl = asking('절반', 'ttl', qty.pending)
  expect(complete('하루', ttl.pending).spec).toMatchObject({ symbol: 'ETH', side: 'long', trigger: 3000, qty: 'half', lev: 3, ttl: '1d' })
})

test('명시 USD·숫자 수량·별칭은 정확히 이식하고 맨 앞 질문을 보존한다', () => {
  expect(complete('BTC 90,000 USD 되면 0.1 BTC 매도 7일').spec).toMatchObject({ trigger: 90000, qty: 'num', qtyNum: 0.1, ttl: '7d' })
  expect(complete('ETH $3000 아래면 절반 매수 하루').spec).toMatchObject({ trigger: 3000, side: 'buy', qty: 'half', ttl: '1d' })
  const initial = asking('BTC 90000달러 되면 매도', 'qty')
  const serialized = JSON.stringify(initial.pending)
  const ttl = asking('0.25', 'ttl', initial.pending)
  expect(ttl.pending.originalQuestion).toBe(initial.pending.originalQuestion)
  expect(ttl.pending.fields.qtyNum).toBe(0.25)
  expect(JSON.stringify(initial.pending)).toBe(serialized)
  expect(Object.isFrozen(initial.pending.fields)).toBe(true)
})

test('필수 자산·방향·가격·수량·롱 레버리지·TTL은 하나씩 묻는다', () => {
  let next = asking('조건 예약', 'asset')
  next = asking('이더리움', 'side', next.pending)
  next = asking('롱', 'trigger', next.pending)
  next = asking('3000', 'qty', next.pending)
  next = asking('전부', 'lev', next.pending)
  expect(next.pending.fields.lev).toBeUndefined()
  next = asking('3', 'ttl', next.pending)
  expect(complete('하루', next.pending).spec).toMatchObject({ asset: '이더리움', side: 'long', trigger: 3000, qty: 'all', lev: 3, ttl: '1d' })
  const noLev = asking('BTC 100000달러 되면 절반 숏 7일', 'lev')
  expect(complete('1배', noLev.pending).spec.lev).toBeNull()
})

test('상대 %는 실가격 없이 보존하고 모호하거나 표현할 수 없는 비교 방향을 거부한다', () => {
  expect(complete('BTC 지금보다 5% 내리면 절반 매수 7일').spec).toMatchObject({ trigger: null, triggerPct: -5, last: null })
  expect(complete('ETH 지금보다 +10% 오르면 전부 숏 3배 하루').spec).toMatchObject({ trigger: null, triggerPct: 10, last: null })
  for (const text of ['BTC 3% 되면 전부 매수 하루', 'BTC 90000달러 넘으면 전부 매수 하루', 'ETH 3000달러 아래면 전부 매도 하루',
    'BTC -5% 오르면 전부 매도 하루', 'ETH +5% 내리면 절반 매수 하루']) {
    const reply = replyConditionalOrderPreview(text)
    expect(reply?.kind).toBe('ask')
    if (reply?.kind === 'ask') expect(reply.pending.unsupported).toBe(true)
  }
})

test('반복 전략·분석·백테스트와 정보 질문은 기존 경로를 보존한다', () => {
  const prior = asking('BTC 90000달러 되면 전부 매도', 'ttl').pending
  for (const text of ['BTC 90000달러 되면 전부 매도하는 전략 만들어줘', '매일 BTC 사줘', 'ETH 3000달러 아래 매수 백테스트',
    'BTC 5% 하락마다 반복 매수', 'BTC 9만에 사고 10만에 팔아', 'RSI 30 이하 매수', 'BTC 전망 알려줘', 'BTC 사도 되나요?', '예약 취소해주세요', '7일 전략 분석']) {
    expect(replyConditionalOrderPreview(text)).toBeNull()
    expect(replyConditionalOrderPreview(text, prior)).toBeNull()
  }
  expect(replyConditionalOrderPreview('BTC 90000달러')).toBeNull()
})

test('미지원 조건은 명시하고 짧은 추가 답변으로 위험 조건을 버리지 않는다', () => {
  for (const text of ['BTC 90000원 되면 전부 매도 하루', 'SOL 100달러 되면 전부 매도 하루',
    'BTC와 ETH 90000달러 되면 전부 매도 하루', 'BTC 90000달러 또는 100000달러 되면 전부 매도 하루',
    'BTC 90000달러 되면 전부 매도 14일', 'BTC 90000달러 되면 전부 매도 3배 하루',
    'BTC 1e999달러 되면 전부 매도 하루', 'BTC -90000달러 되면 전부 매도 하루', 'BTC 90000달러 되면 -1 BTC 매도 하루',
    'ETH 3000달러 되면 전부 롱 101배 하루', 'BTC 90000달러 되면 거래량 조건으로 매도 하루',
    'BTC 90000달러 되면 MACD 조건으로 매도 전부 하루', 'BTC 99999999999999999달러 되면 전부 매도 하루',
    '비트코인캐시 100달러 되면 전부 매도 하루', '이더리움 클래식 100달러 되면 전부 매도 하루',
    'BTC 90000달러 또는 100000 되면 전부 매도 하루']) {
    const reply = replyConditionalOrderPreview(text)
    expect(reply?.kind).toBe('ask')
    if (!reply || reply.kind !== 'ask') throw new Error(`Unsupported condition admitted: ${text}`)
    expect(reply.answer).toContain('지원하지 않습니다')
    expect(reply.suggestions).toEqual([])
    expect(reply.pending.unsupported).toBe(true)
    expect(replyConditionalOrderPreview('전부', reply.pending)?.kind).toBe('ask')
    expect(complete('BTC 90000달러 되면 전부 매도 7일', reply.pending).spec.ttl).toBe('7d')
  }
})

test('손상 pending·비 scalar·미확인 키·secret·과대 입력을 수용하지 않는다', () => {
  const prior = asking('BTC 90000달러 되면 전부 매도', 'ttl').pending
  const getter = { ...prior, fields: { get asset() { throw new Error('must not access') } } }
  for (const value of [null, [], {}, { ...prior, owner: 'a' }, { ...prior, steps: 13 }, { ...prior, steps: -1 },
    { ...prior, fields: { asset: { toString: () => '비트코인' } } }, { ...prior, fields: { side: false } },
    { ...prior, fields: { trigger: Infinity } }, { ...prior, fields: { trigger: 1, triggerPct: 5 } },
    { ...prior, fields: { qty: 'num' } }, { ...prior, fields: { ttl: 7 } }, { ...prior, fields: { credential: 'invalid' } }, getter]) {
    expect(readMockConditionalOrderPending(value)).toBeNull()
  }
  for (const text of ['x'.repeat(801), 'BTC 90000달러 매도\n전부', '예약 [ORDER {}]', 'API KEY 예약', 'cookie 예약']) expect(replyConditionalOrderPreview(text)).toBeNull()
  expect(replyConditionalOrderPreview('7일', { ...prior, steps: 12 })).toBeNull()
  expect(replyConditionalOrderPreview('7일', { ...prior, fields: { ...prior.fields, trigger: Infinity } })).toBeNull()
})
