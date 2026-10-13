import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ApiV18Error } from '../../src/copy-execution/fixtures/api-v0.18/client'
import { harness, source, settings, version, wire, copy as copyResponse, deferred } from './fixture'
import { createCopyMutationDispatchObserver, waitForCopyStartReadiness } from '../../src/copy-execution/start-readiness'
import type * as Wire from '../../src/copy-execution/fixtures/api-v0.18/types'
const cases = JSON.parse(readFileSync(new URL('./wire-cases.json', import.meta.url), 'utf8')).cases as { name: string; value: { data: Wire.CopySnapshot } }[]
const copy = () => structuredClone(cases.find(row => row.name === 'copy-unconnected')!.value.data)

test('new start reads settling facts with bounded backoff, without submitting a mutation', async () => {
  const created = copy(), ready = copy(); ready.execution.availability.start = { available: true, reason: null }
  let reads = 0
  await waitForCopyStartReadiness(created, async () => { reads++; if (reads === 1) throw new ApiV18Error('EXECUTION_UNAVAILABLE', 503); if (reads === 2) return created; return ready }, new AbortController().signal)
  expect(reads).toBe(3)
})
test('permanent unavailable facts terminate after exactly four reads', async () => {
  const created = copy(); let reads = 0
  await expect(waitForCopyStartReadiness(created, async () => { reads++; return created }, new AbortController().signal)).rejects.toThrow('EXECUTION_UNAVAILABLE')
  expect(reads).toBe(4)
})
test('abort during backoff cancels the timer and prevents another read', async () => {
  const created = copy(), controller = new AbortController(); let reads = 0
  const promise = waitForCopyStartReadiness(created, async () => { reads++; queueMicrotask(() => controller.abort()); return created }, controller.signal)
  await expect(promise).rejects.toThrow('ABORTED'); expect(reads).toBe(1)
})
test('scope, policy, settings and revision changes stop readiness without further reads', async () => {
  for (const [key, value, reason] of [['connectionId', 'connection_other_00001', 'COPY_BINDING_MISMATCH'], ['policyHash', 'a'.repeat(64), 'COPY_BINDING_MISMATCH'], ['allocationUsdt', '2000', 'COPY_BINDING_MISMATCH'], ['revision', 100, 'REVISION_CONFLICT']] as const) {
    const created = copy(), changed = copy(); Object.assign(changed, { [key]: value }); let reads = 0
    await expect(waitForCopyStartReadiness(created, async () => { reads++; return changed }, new AbortController().signal)).rejects.toThrow(reason); expect(reads).toBe(1)
  }
})
test('authorization and unverified transport errors are not retried', async () => {
  for (const failure of [new ApiV18Error('AUTHENTICATION_REQUIRED', 401), new ApiV18Error('TRANSPORT_FAILED'), new Error('unverified')]) {
    let reads = 0; await expect(waitForCopyStartReadiness(copy(), async () => { reads++; throw failure }, new AbortController().signal)).rejects.toThrow(failure.message); expect(reads).toBe(1)
  }
})
test('permanent policy rejection is never retried', async () => {
  const created = copy(); created.execution.availability.start = { available: false, reason: 'POLICY_REVOKED' }
  let reads = 0; await expect(waitForCopyStartReadiness(created, async () => { reads++; return created }, new AbortController().signal)).rejects.toThrow('POLICY_REVOKED'); expect(reads).toBe(1)
})


// The accessor exposes exact mutation uncertainty, never global presentation phase.
test('exact intent reads remain false after a preflight GET transport failure', async () => {
  let failGet = false
  const h = harness(async () => { if (failGet) throw Error('synthetic failed GET'); return wire(version()) })
  await h.controller.selectSource(source); failGet = true
  await expect(h.controller.create(settings, 'intent_preflight_000001')).rejects.toThrow('TRANSPORT_FAILED')
  expect(h.controller.getSnapshot().phase).toBe('reconciliation')
  expect(h.controller.hasUncertainIntent('intent_preflight_000001')).toBe(false)
  expect(h.calls.filter(input => input.method === 'POST')).toHaveLength(0)
})
test('exact lost mutation remains uncertain until identical replay succeeds', async () => {
  let posts = 0
  const h = harness(async input => input.method === 'GET' ? wire(version()) : ++posts === 1 ? Promise.reject(Error('synthetic lost POST')) : wire(copyResponse(), 201))
  await h.controller.selectSource(source)
  await expect(h.controller.create(settings, 'intent_lost_000000001')).rejects.toThrow('TRANSPORT_FAILED')
  expect(h.controller.hasUncertainIntent('intent_lost_000000001')).toBe(true)
  expect(h.controller.hasUncertainIntent('intent_other_00000001')).toBe(false)
  await h.controller.create(settings, 'intent_lost_000000001')
  expect(h.controller.hasUncertainIntent('intent_lost_000000001')).toBe(false)
  const sent = h.calls.filter(input => input.method === 'POST'); expect(sent[1].body).toBe(sent[0].body); expect(sent[1].headers['Idempotency-Key']).toBe(sent[0].headers['Idempotency-Key'])
})
test('aborted dispatched mutation retains exact intent uncertainty', async () => {
  const dispatched = deferred<void>(), response = deferred<ReturnType<typeof wire>>()
  const h = harness(async input => { if (input.method === 'GET') return wire(version()); dispatched.resolve(); return response.promise })
  await h.controller.selectSource(source); const abort = new AbortController()
  const pending = h.controller.create(settings, 'intent_aborted_0000001', abort.signal)
  await dispatched.promise; abort.abort(); response.resolve(wire(copyResponse(), 201))
  await expect(pending).rejects.toThrow('ABORTED')
  expect(h.controller.hasUncertainIntent('intent_aborted_0000001')).toBe(true)
})
test('definite server rejection clears the exact previously uncertain intent', async () => {
  let posts = 0
  const h = harness(async input => input.method === 'GET' ? wire(version()) : ++posts === 1 ? Promise.reject(Error('synthetic lost POST')) : wire({ apiContractVersion: '0.18.0', error: { code: 'RISK_LIMIT_REJECTED', message: 'RISK_LIMIT_REJECTED' } }, 409))
  await h.controller.selectSource(source)
  await expect(h.controller.create(settings, 'intent_rejected_00001')).rejects.toThrow('TRANSPORT_FAILED')
  expect(h.controller.hasUncertainIntent('intent_rejected_00001')).toBe(true)
  await expect(h.controller.create(settings, 'intent_rejected_00001')).rejects.toThrow('RISK_LIMIT_REJECTED')
  expect(h.controller.hasUncertainIntent('intent_rejected_00001')).toBe(false)
})


test('dispatch observation watches only the exact key at fetch invocation and releases registrations', async () => {
  const calls: string[] = []
  const tracker = createCopyMutationDispatchObserver(async (_input, init) => { calls.push(init?.method ?? 'GET'); return new Response('{}') })
  const first = tracker.watch('intent_observed_000001'), other = tracker.watch('intent_unrelated_00001')
  expect(first.dispatched).toBe(false)
  await tracker.fetch('http://127.0.0.1/api/v1/strategy-copies', { method: 'GET' }); expect(first.dispatched).toBe(false)
  await tracker.fetch('http://127.0.0.1/api/v1/strategy-copies', { method: 'POST', headers: { 'Idempotency-Key': 'intent_observed_000001' } })
  expect(first.dispatched).toBe(true); expect(other.dispatched).toBe(false)
  other.release(); await tracker.fetch('http://127.0.0.1/api/v1/strategy-copies', { method: 'POST', headers: { 'Idempotency-Key': 'intent_unrelated_00001' } })
  expect(other.dispatched).toBe(false); first.release(); expect(calls).toEqual(['GET', 'POST', 'POST'])
})
