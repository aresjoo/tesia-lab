export type ExecutionMinimum = Readonly<{ descriptorPolicyHash: string; minimumAllocationUsdt: string; requiredAvailableUsdt: string; requiredMaxLossUsdt: string; riskRequiredAvailableUsdt: string; status: 'estimated' }>
type Unavailable = Readonly<{ descriptorPolicyHash: string; status: 'unavailable'; reason: string }>
export type ExecutionMinimumQuote = Readonly<{ schemaVersion: 'bitget-copy-minimum-0.1'; venue: 'bitget'; symbol: 'BTCUSDT'; asOf: string; expiresAt: string; snapshotRuleSha256: string; quoteSha256: string; estimates: Readonly<Record<string, ExecutionMinimum | Unavailable>> }>
const SHA = /^[a-f0-9]{64}$/, decimal = /^(?:0|[1-9]\d{0,63})(?:\.\d{1,32})?$/
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const amounts = ['minimumAllocationUsdt', 'requiredAvailableUsdt', 'requiredMaxLossUsdt', 'riskRequiredAvailableUsdt'] as const
export function decimalAtLeast(value: string, minimum: string) {
  if (!decimal.test(value) || !decimal.test(minimum)) return false
  const [a, af = ''] = value.split('.'), [b, bf = ''] = minimum.split('.'), scale = Math.max(af.length, bf.length)
  return BigInt(a + af.padEnd(scale, '0')) >= BigInt(b + bf.padEnd(scale, '0'))
}
/** Decimal ceiling, so the visible suggestion never understates the actual input floor. */
export function ceilMinimumUsdt(value: string) {
  if (!decimal.test(value)) return null
  const [whole, fraction = ''] = value.split('.'), tail = fraction.padEnd(2, '0')
  const cents = BigInt(whole) * 100n + BigInt(tail.slice(0, 2)) + (/[1-9]/.test(tail.slice(2)) ? 1n : 0n)
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}
export function parseExecutionMinimum(input: unknown, now = Date.now()): ExecutionMinimumQuote | null {
  if (!exact(input, ['schemaVersion', 'venue', 'symbol', 'asOf', 'expiresAt', 'snapshotRuleSha256', 'quoteSha256', 'estimates']) || input.schemaVersion !== 'bitget-copy-minimum-0.1' || input.venue !== 'bitget' || input.symbol !== 'BTCUSDT' || typeof input.asOf !== 'string' || typeof input.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.asOf) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.expiresAt) || !SHA.test(String(input.snapshotRuleSha256)) || !SHA.test(String(input.quoteSha256)) || !record(input.estimates) || Object.keys(input.estimates).length > 128) return null
  const at = Date.parse(input.asOf), expires = Date.parse(input.expiresAt)
  if (!Number.isFinite(at) || at > now || expires <= now || expires <= at || expires - at > 3000) return null
  for (const [id, item] of Object.entries(input.estimates)) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !record(item) || !SHA.test(String(item.descriptorPolicyHash))) return null
    if (item.status === 'unavailable') {
      if (!exact(item, ['descriptorPolicyHash', 'status', 'reason']) || typeof item.reason !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/.test(item.reason)) return null
    } else if (!exact(item, ['descriptorPolicyHash', 'status', ...amounts]) || item.status !== 'estimated' || !amounts.every(k => typeof item[k] === 'string' && decimal.test(item[k]) && Number(item[k]) > 0 && Number.isFinite(Number(item[k]))) || !decimalAtLeast(String(item.requiredAvailableUsdt), String(item.minimumAllocationUsdt)) || !decimalAtLeast(String(item.requiredAvailableUsdt), String(item.riskRequiredAvailableUsdt))) return null
  }
  return input as unknown as ExecutionMinimumQuote
}
export function minimumForPolicy(quote: ExecutionMinimumQuote | null, policyVersionId: string, descriptorPolicyHash: string, now = Date.now()): ExecutionMinimum | null {
  if (!quote || Date.parse(quote.expiresAt) <= now || Date.parse(quote.asOf) > now) return null
  const item = Object.hasOwn(quote.estimates, policyVersionId) ? quote.estimates[policyVersionId] : undefined
  return item?.status === 'estimated' && item.descriptorPolicyHash === descriptorPolicyHash ? item : null
}
function strictMinimumJson(raw: string): unknown {
  let at = 0
  const whitespace = () => { while (at < raw.length && /[\t\r\n ]/.test(raw[at])) at++ }
  const string = () => { const start = at++; let escaped = false; while (at < raw.length) { const char = raw[at++]; if (escaped) { escaped = false; continue } if (char === '\\') { escaped = true; continue } if (char === '"') return JSON.parse(raw.slice(start, at)) as string } throw Error('Invalid JSON') }
  const value = (depth: number): unknown => {
    if (depth > 8) throw Error('Invalid JSON')
    whitespace()
    if (raw[at] === '"') return string()
    if (raw[at] === '{') {
      at++; whitespace(); const out: Record<string, unknown> = Object.create(null)
      if (raw[at] === '}') { at++; return out }
      for (;;) { whitespace(); if (raw[at] !== '"') throw Error('Invalid JSON'); const key = string(); if (Object.hasOwn(out, key)) throw Error('Duplicate JSON key'); whitespace(); if (raw[at++] !== ':') throw Error('Invalid JSON'); out[key] = value(depth + 1); whitespace(); const end = raw[at++]; if (end === '}') return out; if (end !== ',') throw Error('Invalid JSON') }
    }
    throw Error('Invalid minimum JSON scalar')
  }
  const out = value(0); whitespace(); if (at !== raw.length) throw Error('Invalid JSON'); return out
}
export async function readExecutionMinimum(signal: AbortSignal, request: typeof fetch = fetch): Promise<ExecutionMinimumQuote | null> {
  try {
    const response = await request('/__teth/execution-minimum', { method: 'GET', credentials: 'omit', signal, cache: 'no-store', redirect: 'error' })
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/json') || !response.body) return null
    const reader = response.body.getReader(), parts: Uint8Array[] = []; let size = 0
    try { for (;;) { const value = await reader.read(); if (value.done) break; size += value.value.byteLength; if (size > 262144) return null; parts.push(value.value) } }
    finally { await reader.cancel().catch(() => undefined) }
    const bytes = new Uint8Array(size); let at = 0
    for (const part of parts) { bytes.set(part, at); at += part.length }
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const value: unknown = strictMinimumJson(raw)
    return signal.aborted ? null : parseExecutionMinimum(value)
  } catch { return null }
}
