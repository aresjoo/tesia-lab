import { expect, test } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeJob } from '../../src/internal-poc/native-service-api'
import { createNativeResultPresentationIntent, type NativeResultPresentationScope } from '../../src/internal-poc/native-result-presentation-intent'

const completed = fixtures.sources[3].fixture.cases!.find(item => item.name === 'COMPLETED')!.response.data
// UI-state-machine coordinates for the unissued schema job. Preserve COMPLETED
// verbatim; earlier schema states use its immutable identifiers, not vice versa.
// This is not a generated-client response or actual completion evidence.
const job = (state: NativeJob['state']) => ({
  ...structuredClone(fixtures.sources[3].fixture.cases!.find(item => item.name === state)!.response.data),
  ...Object.fromEntries((['backtestId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'splitGroupId', 'createdAt'] as const).map(key => [key, completed[key]])),
}) as NativeJob
const initial: NativeResultPresentationScope = { sessionId: 'owner', sessionState: 'AUTHENTICATED', conversationId: 'conversation', draftId: 'draft', epoch: 1 }
function host() {
  let scope: NativeResultPresentationScope | null = { ...initial }
  const intent = createNativeResultPresentationIntent(() => scope)
  return { intent, change: (value: typeof scope) => { scope = value }, complete: () => {
    intent.beginSubmission('fresh-submit'); intent.acceptSubmission('fresh-submit', job('QUEUED'))
    return intent.observe(job('COMPLETED'))!
  } }
}
test('fresh same-key progress then completion produces one consumable display request, no fabricated job fields', () => {
  const { intent, complete } = host(), completed = job('COMPLETED'), original = JSON.stringify(completed)
  const request = complete()
  expect(request.backtestId).toBe(completed.backtestId)
  expect(request.consume()).toBe(true); expect(request.consume()).toBe(false)
  expect(intent.observe(completed)).toBeUndefined()
  expect(JSON.stringify(completed)).toBe(original)
  expect(Object.keys(request).sort()).toEqual(['backtestId', 'consume', 'isCurrent'])
})
test('same-screen uncertain fresh submit keeps its stamp for an explicit same-key response', () => {
  const { intent } = host()
  intent.beginSubmission('uncertain')
  // No acknowledgement: no observed job and no display request.
  expect(intent.observe(job('COMPLETED'))).toBeUndefined()
  intent.acceptSubmission('uncertain', job('REPLAYING'))
  expect(intent.observe(job('COMPLETED'))?.consume()).toBe(true)
})
for (const kind of ['restored', 'immediately-completed', 'different-key', 'failed', 'invalid'] as const) test(`${kind} does not issue an automatic display request`, () => {
  const { intent } = host()
  if (kind !== 'restored') intent.beginSubmission('fresh')
  intent.acceptSubmission(kind === 'different-key' ? 'other' : 'fresh', job(kind === 'immediately-completed' ? 'COMPLETED' : 'QUEUED'))
  expect(intent.observe(job(kind === 'failed' ? 'FAILED' : kind === 'invalid' ? 'INVALID' : 'COMPLETED'))).toBeUndefined()
})
for (const key of ['sessionId', 'sessionState', 'conversationId', 'draftId', 'epoch'] as const) test(`${key} replacement invalidates pending and already consumed requests`, () => {
  const pending = host()
  pending.intent.beginSubmission('fresh'); pending.intent.acceptSubmission('fresh', job('QUEUED'))
  pending.change({ ...initial, [key]: key === 'epoch' ? 2 : key === 'sessionState' ? 'ANONYMOUS' : 'other' })
  expect(pending.intent.observe(job('COMPLETED'))).toBeUndefined()
  const state = host(), request = state.complete()
  expect(request.consume()).toBe(true)
  state.change({ ...initial, [key]: key === 'epoch' ? 2 : key === 'sessionState' ? 'ANONYMOUS' : 'other' })
  expect(request.isCurrent()).toBe(false)
})
test('retirement fences A to B to A, remount, and new submission after an already issued request', () => {
  const state = host(), request = state.complete()
  state.intent.invalidate(); state.change({ ...initial, sessionId: 'other' }); state.change({ ...initial })
  expect(request.consume()).toBe(false)
  const newer = state.complete(); state.intent.beginSubmission('newer')
  expect(newer.isCurrent()).toBe(false)
})
for (const key of ['backtestId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'splitGroupId', 'createdAt'] as const) test(`${key} mismatch never crosses the observed job`, () => {
  const { intent } = host()
  intent.beginSubmission('fresh'); intent.acceptSubmission('fresh', job('QUEUED'))
  expect(intent.observe({ ...job('COMPLETED'), [key]: 'different' } as NativeJob)).toBeUndefined()
  expect(intent.observe(job('COMPLETED'))).toBeUndefined()
})
