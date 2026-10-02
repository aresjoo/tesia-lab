import { readConditionalOrderTag } from './client-conditional-order-intake'
import type { ConditionalOrderPreviewSpec, ConditionalOrderSide, ConditionalOrderTtl } from './client-conditional-order-preview'

/** Source 9fbff821:12464. Bounded local display grammar, not an LLM, an
 * exchange instruction, a price feed, a Strategy Version, or execution authority. */
export type MockConditionalOrderFields = Readonly<{
  asset?: '비트코인' | '이더리움'; side?: ConditionalOrderSide
  trigger?: number; triggerPct?: number; qty?: 'all' | 'half' | 'num'; qtyNum?: number
  lev?: number | null; ttl?: ConditionalOrderTtl
}>
export type MockConditionalOrderField = 'asset' | 'side' | 'trigger' | 'qty' | 'lev' | 'ttl'
export type MockConditionalOrderPending = Readonly<{
  v: 1; originalQuestion: string; fields: MockConditionalOrderFields
  asking: MockConditionalOrderField; steps: number; unsupported?: true
}>
export type MockConditionalOrderReply =
  | Readonly<{ kind: 'ask'; answer: string; suggestions: readonly string[]; pending: MockConditionalOrderPending }>
  | Readonly<{ kind: 'order'; answer: string; spec: ConditionalOrderPreviewSpec; pending: null }>

const fieldKeys = ['asset', 'side', 'trigger', 'triggerPct', 'qty', 'qtyNum', 'lev', 'ttl']
const askKeys: readonly MockConditionalOrderField[] = ['asset', 'side', 'trigger', 'qty', 'lev', 'ttl']
const positive = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max
const boundedText = (value: unknown, max = 800): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
  && Array.from(value).every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  && !/\[|\]|API\s*KEY|secret|token|cookie|credential|비밀번호|인증키/i.test(value)
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.values(Object.getOwnPropertyDescriptors(value)).every(field => 'value' in field)

/** Only this Mock UI metadata may be hydrated. Unknown fields and inferred
 * defaults are rejected; the caller separately binds it to the current owner. */
export function readMockConditionalOrderPending(value: unknown): MockConditionalOrderPending | null {
  if (!plain(value) || Object.keys(value).some(key => !['v', 'originalQuestion', 'fields', 'asking', 'steps', 'unsupported'].includes(key))
    || value.v !== 1 || !boundedText(value.originalQuestion, 1200) || !askKeys.includes(value.asking as MockConditionalOrderField)
    || !Number.isSafeInteger(value.steps) || (value.steps as number) < 0 || (value.steps as number) > 12
    || value.unsupported !== undefined && value.unsupported !== true || !plain(value.fields)) return null
  const f = value.fields
  if (Object.keys(f).some(key => !fieldKeys.includes(key)) || Object.values(f).some(item => item === undefined)
    || f.asset !== undefined && (typeof f.asset !== 'string' || !['비트코인', '이더리움'].includes(f.asset))
    || f.side !== undefined && (typeof f.side !== 'string' || !['buy', 'sell', 'long', 'short'].includes(f.side))
    || f.trigger !== undefined && !positive(f.trigger, 1e12)
    || f.triggerPct !== undefined && (typeof f.triggerPct !== 'number' || !Number.isFinite(f.triggerPct) || f.triggerPct <= -100 || f.triggerPct > 100)
    || f.trigger !== undefined && f.triggerPct !== undefined
    || f.qty !== undefined && (typeof f.qty !== 'string' || !['all', 'half', 'num'].includes(f.qty))
    || f.qtyNum !== undefined && (f.qty !== 'num' || !positive(f.qtyNum, 1e9)) || f.qty === 'num' && !positive(f.qtyNum, 1e9)
    || f.lev !== undefined && f.lev !== null && (!positive(f.lev, 100) || !Number.isSafeInteger(f.lev) || f.lev <= 1)
    || f.ttl !== undefined && (typeof f.ttl !== 'string' || !['gtc', '7d', '1d'].includes(f.ttl))) return null
  return Object.freeze({ v: 1, originalQuestion: value.originalQuestion, fields: Object.freeze({ ...f }) as MockConditionalOrderFields,
    asking: value.asking as MockConditionalOrderField, steps: value.steps as number, ...(value.unsupported ? { unsupported: true as const } : {}) })
}

const strategy = /전략|백테스트|연구|분석|RSI|이동평균|손절|익절|매일|매주|매달|반복|계속|주기|일봉|분봉|시간봉|다시\s*(?:사|팔|매수|매도)|사(?:고|서).*(?:팔|매도)|팔(?:고|아서).*(?:사|매수)/i
const informational = /전망|뉴스|얼마(?:야|예요|인가|인가요)|살까|팔까|사도\s*되|팔아야|될까|어때|알려|할까|[?？]/
const condition = /되면|넘으면|내리면|내려오면|떨어지면|오르면|닿으면|도달하면|아래|이하|이상|올라가면|하락하면|상승하면/
const command = /매수|매도|사줘|사\s*주세요|팔아|롱|숏|예약/
const unsupportedCondition = /원화|KRW|\d\s*원|월요일|화요일|수요일|목요일|금요일|토요일|일요일|주말|오전|오후|거래량|지표|MACD|\bEMA\b|\bSMA\b|볼린저|수익률|손익|알림|시장가|즉시|지금\s*(?:사|팔)|또는|혹은|비트코인\s*캐시|이더리움\s*클래식|\bBCH\b|\bETC\b|(?<!\d)\d+[eE][+-]?\d+|\d,\d{1,2}(?!\d)/i
const canceled = /취소(?:해|하자|해줘|해주세요)|그만|하지\s*마|말고\s*(?:분석|전략)/
const numeric = '[+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?'
const scales: Readonly<Record<string, number>> = { 천만: 10000000, 백만: 1000000, 십만: 100000, 만: 10000, 천: 1000, 백: 100 }
const amountValue = (text: string, scale = '') => Number(text.replaceAll(',', '')) * (scales[scale] ?? 1)

function fieldsFrom(text: string, asking?: MockConditionalOrderField): { fields: MockConditionalOrderFields; unsupported: boolean } {
  const fields: { -readonly [Key in keyof MockConditionalOrderFields]: MockConditionalOrderFields[Key] } = {}
  let unsupported = unsupportedCondition.test(text)
  const assets = [...new Set([/비트코인|비트(?!레이트)|\bBTC\b/i.test(text) ? '비트코인' : null,
    /이더리움|이더|\bETH\b/i.test(text) ? '이더리움' : null].filter(Boolean))]
  if (assets.length > 1 || /솔라나|\bSOL\b|리플|\bXRP\b|도지|테슬라|나스닥/i.test(text)) unsupported = true
  else if (assets[0]) fields.asset = assets[0] as MockConditionalOrderFields['asset']
  const sides = (['buy', 'sell', 'long', 'short'] as const).filter(side => ({
    buy: /매수|사줘|사\s*주세요|사겠습니다|살게|사기로/, sell: /매도|팔아|팔\s*주세요|팔겠습니다|팔게|팔기로/,
    long: /롱/, short: /숏/,
  })[side].test(text))
  if (sides.length > 1) unsupported = true
  else if (sides[0]) fields.side = sides[0]

  const dollar = new RegExp(`(?:\\$\\s*(${numeric})\\s*(천만|백만|십만|만|천|백)?|(${numeric})\\s*(천만|백만|십만|만|천|백)?\\s*(?:달러|USD\\b|USDT\\b))`, 'gi')
  const prices = [...text.matchAll(dollar)]
  const percents = [...text.matchAll(new RegExp(`(${numeric})\\s*%`, 'g'))]
  if (prices.length > 1 || percents.length > 1 || prices.length && percents.length) unsupported = true
  else if (prices[0]) {
    const price = amountValue(prices[0][1] ?? prices[0][3], prices[0][2] ?? prices[0][4])
    if (positive(price, 1e12)) fields.trigger = price
    else unsupported = true
  } else if (percents[0]) {
    const amount = Number(percents[0][1].replaceAll(',', ''))
    const down = /내리|내려|떨어|하락|낮아/.test(text), up = /오르|오르면|올라|상승|높아/.test(text)
    if (down && up || up && amount < 0 || down && /^\+/.test(percents[0][1]) || !Number.isFinite(amount) || amount <= -100 || amount > 100) unsupported = true
    else if (amount >= 0 && !/^\+/.test(percents[0][1]) && !down && !up) unsupported = true
    else fields.triggerPct = down ? -Math.abs(amount) : amount
  } else if (asking === 'trigger' && new RegExp(`^${numeric}\\s*(천만|백만|십만|만|천|백)?$`).test(text)) {
    const match = new RegExp(`^(${numeric})\\s*(천만|백만|십만|만|천|백)?$`).exec(text)!
    const price = amountValue(match[1], match[2]); if (positive(price, 1e12)) fields.trigger = price; else unsupported = true
  }

  const all = /전부|모두|전체/.test(text), half = /절반|반만/.test(text) || asking === 'qty' && text === '반'
  const qtys = [...text.matchAll(new RegExp(`(${numeric})\\s*(?:BTC\\b|ETH\\b|비트코인|이더리움|개)`, 'gi'))]
  if (Number(all) + Number(half) + Number(qtys.length > 0) > 1 || qtys.length > 1) unsupported = true
  else if (all || half) fields.qty = all ? 'all' : 'half'
  else if (qtys[0] || asking === 'qty' && new RegExp(`^${numeric}$`).test(text)) {
    const qty = Number((qtys[0]?.[1] ?? text).replaceAll(',', ''))
    if (positive(qty, 1e9)) { fields.qty = 'num'; fields.qtyNum = qty } else unsupported = true
  }
  const leverage = [...text.matchAll(new RegExp(`(${numeric})\\s*배`, 'g'))]
  if (leverage.length > 1) unsupported = true
  else if (leverage[0] || asking === 'lev' && /^\d+$/.test(text)) {
    const value = Number(leverage[0]?.[1] ?? text)
    if (Number.isSafeInteger(value) && value >= 1 && value <= 100) fields.lev = value === 1 ? null : value
    else unsupported = true
  }
  const ttl = (['gtc', '7d', '1d'] as const).filter(value => ({
    gtc: /취소(?:할|하기|하기 전)?\s*(?:때)?까지|취소\s*전까지|\bGTC\b/i,
    '7d': /7\s*일|일주일|한\s*주일/, '1d': /하루|(?<!\d)1\s*일/,
  })[value].test(text))
  if (ttl.length > 1 || /(?<!\d)(?:2|3|4|5|6|8|9|\d{2,})\s*일/.test(text)) unsupported = true
  else if (ttl[0]) fields.ttl = ttl[0]
  return { fields, unsupported }
}

const questions: Readonly<Record<MockConditionalOrderField, { answer: string; suggestions: readonly string[] }>> = {
  asset: { answer: '어느 자산에 예약할까요? 현재 미리보기는 비트코인과 이더리움을 지원합니다.', suggestions: ['비트코인', '이더리움'] },
  side: { answer: '매수, 매도, 롱, 숏 중 어느 방향으로 예약할까요?', suggestions: ['매수', '매도', '롱', '숏'] },
  trigger: { answer: '조건 가격을 달러로 적거나, 지금보다 몇 % 오르거나 내리면 실행할지 알려주세요.', suggestions: [] },
  qty: { answer: '수량을 전부, 절반 또는 자산 개수로 알려주세요.', suggestions: ['전부', '절반'] },
  lev: { answer: '롱 또는 숏의 레버리지를 몇 배로 할까요? 레버리지를 쓰지 않으면 1배라고 적어주세요.', suggestions: [] },
  ttl: { answer: '예약을 언제까지 유지할까요?', suggestions: ['취소할 때까지', '7일', '하루'] },
}
function ask(originalQuestion: string, fields: MockConditionalOrderFields, asking: MockConditionalOrderField, steps: number, unsupported = false): MockConditionalOrderReply {
  const pending = Object.freeze({ v: 1 as const, originalQuestion, fields: Object.freeze({ ...fields }), asking, steps, ...(unsupported ? { unsupported: true as const } : {}) })
  return Object.freeze({ kind: 'ask', answer: unsupported ? '이 조건은 현재 예약 미리보기에서 지원하지 않습니다. 비트코인이나 이더리움의 한 번만 실행할 가격, 방향, 수량과 유효 기간을 다시 적어주세요.' : questions[asking].answer,
    suggestions: Object.freeze(unsupported ? [] : [...questions[asking].suggestions]), pending })
}

export function replyConditionalOrderPreview(question: string, pending?: MockConditionalOrderPending | null): MockConditionalOrderReply | null {
  if (!boundedText(question) || strategy.test(question) || informational.test(question) || canceled.test(question)) return null
  const text = question.trim(), prior = pending === undefined || pending === null ? null : readMockConditionalOrderPending(pending)
  if (pending && !prior || prior && prior.steps >= 12) return null
  const fresh = command.test(text) && (condition.test(text) || /예약/.test(text))
  if (!fresh && !prior) return null
  if (prior?.unsupported && !fresh) return ask(prior.originalQuestion, {}, prior.asking, prior.steps + 1, true)
  const original = fresh ? text : prior!.originalQuestion, steps = fresh ? 0 : prior!.steps + 1
  const collected = fieldsFrom(text, fresh ? undefined : prior!.asking)
  if (collected.unsupported) return ask(original, {}, 'trigger', steps, true)
  const fields = { ...(fresh ? {} : prior!.fields), ...collected.fields }
  if (collected.fields.trigger !== undefined) delete fields.triggerPct
  if (collected.fields.triggerPct !== undefined) delete fields.trigger
  if (collected.fields.qty && collected.fields.qty !== 'num') delete fields.qtyNum
  // The source tag has no comparison operator. Without a supplied last price,
  // its absolute-price display is below for buy/long and above for sell/short.
  const directional = fresh ? text : `${original} ${text}`
  if (fields.trigger !== undefined && (['buy', 'long'].includes(fields.side ?? '') && /넘으면|이상|위로|올라/.test(directional)
    || ['sell', 'short'].includes(fields.side ?? '') && /이하|아래|내려|떨어/.test(directional))) return ask(original, {}, 'trigger', steps, true)
  if ((fields.side === 'buy' || fields.side === 'sell') && fields.lev !== undefined && fields.lev !== null) return ask(original, {}, 'side', steps, true)
  const missing = !fields.asset ? 'asset' : !fields.side ? 'side' : fields.trigger === undefined && fields.triggerPct === undefined ? 'trigger'
    : !fields.qty ? 'qty' : (fields.side === 'long' || fields.side === 'short') && fields.lev === undefined ? 'lev' : !fields.ttl ? 'ttl' : null
  if (missing) return ask(original, fields, missing, steps)
  const data = { asset: fields.asset, side: fields.side, trigger: fields.trigger ?? null, triggerPct: fields.triggerPct ?? null,
    qty: fields.qty, qtyNum: fields.qtyNum ?? null, lev: fields.lev ?? null, ttl: fields.ttl }
  const answer = `조건을 확인했습니다. 아래에서 예약합니다.\n[ORDER ${JSON.stringify(data)}]`
  const parsed = readConditionalOrderTag(answer)
  return parsed ? Object.freeze({ kind: 'order', answer, spec: parsed.spec, pending: null }) : ask(original, {}, 'trigger', steps, true)
}
