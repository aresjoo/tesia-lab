import { validConditionalOrderSpec, type ConditionalOrderPreviewSpec } from './client-conditional-order-preview'

export type ConditionalOrderTag = Readonly<{ cleanText: string; spec: ConditionalOrderPreviewSpec }>
export type ConditionalOrderTagDisplay = { last?: number | null; symbol?: string; exchange?: string | null }
const keys = ['asset', 'side', 'trigger', 'triggerPct', 'qty', 'qtyNum', 'lev', 'ttl']
const sourceTickers: Readonly<Record<string, string>> = {
  비트코인: 'BTC', 이더리움: 'ETH', 솔라나: 'SOL', 나스닥: 'NASDAQ', 리플: 'XRP', 도지코인: 'DOGE', 아발란체: 'AVAX', 에이다: 'ADA', 비앤비: 'BNB',
  테슬라: 'TSLA', 엔비디아: 'NVDA', 애플: 'AAPL', 마이크로소프트: 'MSFT', 아마존: 'AMZN', 메타: 'META', 알파벳: 'GOOGL', 에이엠디: 'AMD',
}
const plainLabel = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 80
  && [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)

/** Extract one completed source ORDER tag for Mock display. No model command,
 * strategy schema, transport, price lookup, or execution authority is created. */
export function readConditionalOrderTag(text: string, display: ConditionalOrderTagDisplay = {}): ConditionalOrderTag | null {
  if (typeof text !== 'string' || text.length > 16_000) return null
  const tags = [...text.matchAll(/\[ORDER\b/gi)]
  if (tags.length !== 1) return null
  const start = tags[0].index!
  const prefix = /^\[ORDER\s+/.exec(text.slice(start))
  if (!prefix) return null
  const jsonStart = start + prefix[0].length
  if (text[jsonStart] !== '{') return null
  let quoted = false, escaped = false, jsonEnd = -1
  for (let index = jsonStart + 1; index < Math.min(text.length, jsonStart + 2048); index++) {
    const character = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
    } else if (character === '"') quoted = true
    else if (character === '{' || character === '[') return null
    else if (character === '}') { jsonEnd = index + 1; break }
  }
  if (jsonEnd < 0) return null
  const closing = /^\s*\]/.exec(text.slice(jsonEnd))
  if (!closing) return null
  const raw = text.slice(jsonStart, jsonEnd)
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  // Flat source keys only; duplicate/escaped keys and secret fields are rejected.
  const fieldNames = [...raw.matchAll(/(?:^\{|,)\s*"([^"\\]*)"\s*:/g)].map(match => match[1])
  if (fieldNames.length !== Object.keys(data).length || new Set(fieldNames).size !== fieldNames.length
    || Object.keys(data).some(key => !keys.includes(key))) return null
  if (!plainLabel(data.asset) || !['buy', 'sell', 'long', 'short'].includes(String(data.side))) return null
  if (data.side !== 'buy' && data.side !== 'sell' && data.side !== 'long' && data.side !== 'short') return null
  const asset = data.asset.trim()
  const ticker = sourceTickers[asset] ?? (/^[a-z][a-z0-9]{1,15}$/i.test(asset) ? asset.toUpperCase() : null)
  const symbol = display.symbol ?? ticker
  if (!plainLabel(symbol) || display.exchange !== undefined && display.exchange !== null && !plainLabel(display.exchange)) return null
  const last = display.last ?? null
  if (last !== null && (typeof last !== 'number' || !Number.isFinite(last) || last <= 0)) return null
  let trigger = data.trigger ?? null
  const triggerPct = data.triggerPct ?? null
  if (trigger !== null && triggerPct !== null) return null
  if (trigger === null && triggerPct !== null && last !== null) {
    if (typeof triggerPct !== 'number' || !Number.isFinite(triggerPct) || triggerPct <= -100) return null
    trigger = Math.round(last * (1 + triggerPct / 100))
  }
  const spec = { asset, symbol, side: data.side, trigger, triggerPct, last,
    qty: data.qty === undefined ? 'all' : data.qty, qtyNum: data.qtyNum ?? null,
    lev: data.lev ?? null, ttl: data.ttl === undefined ? 'gtc' : data.ttl, exchange: display.exchange ?? null }
  if (!validConditionalOrderSpec(spec) || ((spec.side === 'buy' || spec.side === 'sell') && spec.lev !== null)) return null
  const cleanText = text.slice(0, start) + text.slice(jsonEnd + closing[0].length)
  return Object.freeze({ cleanText, spec: Object.freeze(spec) })
}

/** Exact identities, no lossy hash or aliases between sessions and turns. */
export function conditionalOrderTurnId(sessionId: string, turnId: string): string | null {
  if (!plainLabel(sessionId) || !plainLabel(turnId)) return null
  const id = `od-tag:${encodeURIComponent(sessionId)}:${encodeURIComponent(turnId)}`
  return id.length <= 120 ? id : null
}
