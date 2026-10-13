import { test, expect } from '@playwright/test'
import { parseExecutionMinimum, minimumForPolicy, ceilMinimumUsdt, decimalAtLeast, readExecutionMinimum } from '../src/client-execution-minimum'
import { catalogueCopySettings } from '../src/client-catalogue-copy-setup'
const now = Date.parse('2026-10-12T02:00:00.000Z'), policy = 'a'.repeat(64)
function quote() {
  return { schemaVersion: 'bitget-copy-minimum-0.1', venue: 'bitget', symbol: 'BTCUSDT', asOf: new Date(now - 10).toISOString(), expiresAt: new Date(now + 2990).toISOString(), snapshotRuleSha256: 'b'.repeat(64), quoteSha256: 'c'.repeat(64), estimates: { [policy]: { descriptorPolicyHash: policy, minimumAllocationUsdt: '334.92280000', requiredAvailableUsdt: '334.92280000', requiredMaxLossUsdt: '0.41865350', riskRequiredAvailableUsdt: '16.82987070', status: 'estimated' } } }
}
test('decimal ceiling and exact form floor never round down and retain normal decimal input', () => {
  expect(ceilMinimumUsdt('334.92280000')).toBe('334.93')
  expect(ceilMinimumUsdt('0.00000001')).toBe('0.01')
  expect(decimalAtLeast('334.92279999', '334.92280000')).toBe(false)
  expect(catalogueCopySettings(undefined, 500, '334.92279999', -20, 'skip', '95', '334.92280000')).toBeNull()
  expect(catalogueCopySettings(undefined, 500, '0334.92280000', -20, 'skip', '95', '334.92280000')?.amount).toBe(334.9228)
  expect(catalogueCopySettings(undefined, 500, '400', -20, 'skip', '95')).toBeNull()
})
test('minimum authority is exact policy and fresh public evidence, not cached values or other rows', () => {
  const parsed = parseExecutionMinimum(quote(), now)
  expect(minimumForPolicy(parsed, policy, policy, now)?.minimumAllocationUsdt).toBe('334.92280000')
  expect(minimumForPolicy(parsed, policy, 'd'.repeat(64), now)).toBeNull()
  expect(minimumForPolicy(parsed, 'unrelated-policy', policy, now)).toBeNull()
  expect(minimumForPolicy(parsed, policy, policy, now + 3000)).toBeNull()
  for (const edit of [(v: ReturnType<typeof quote>) => { v.expiresAt = new Date(now + 5000).toISOString() }, (v: ReturnType<typeof quote>) => { v.estimates[policy].minimumAllocationUsdt = '0' }, (v: ReturnType<typeof quote>) => { Object.assign(v, { accountVerified: true }) }]) {
    const value = quote(); edit(value); expect(parseExecutionMinimum(value, now)).toBeNull()
  }
})
test('failed, invalid and duplicate-key minimum GETs remain unavailable', async () => {
  const controller = new AbortController()
  const failing = async () => new Response('{"error":"MINIMUM_MARKET_STALE"}', { status: 503, headers: { 'content-type': 'application/json' } })
  expect(await readExecutionMinimum(controller.signal, failing as typeof fetch)).toBeNull()
  const raw = JSON.stringify(quote()).replace('"minimumAllocationUsdt":"334.92280000"', '"minimumAllocationUsdt":"1","minimumAllocationUsdt":"334.92280000"')
  const duplicate = async () => new Response(raw, { headers: { 'content-type': 'application/json' } })
  expect(await readExecutionMinimum(controller.signal, duplicate as typeof fetch)).toBeNull()
})
