import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  ApiV22Error, NativeResearchStrategyProposalV22Adapter,
  type CreateRequest, type DraftBase, type ProposalBoundDraft, type ProposalProjection,
} from '../../src/internal-poc/native-research-strategy-proposal-v22-adapter'
import { canonicalApiV22, type UnapprovedProjection } from '../../src/internal-poc/contracts/generated/api-v0.22/index'

const origin = 'https://service.example.test'
const basePath = '/api/v22/consultation/research-strategy-proposals'
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const donor = resolve(process.cwd(), '../contracts-research-strategy-proposal')
const fixture = JSON.parse(readFileSync(resolve(donor, 'fixtures/research-strategy-proposal/valid.json'), 'utf8')) as {
  reportText: string
  input: { draftState: ProposalBoundDraft['draftState'] }
  result: UnapprovedProjection['proposal']
}
const proposalId = 'proposal_native_source_000001'
const source = { conversationId: 'api13_conversation_source_000001', turnId: fixture.result.customerSource.turnId }
const sourceOrigin = { sourceAPI13Locator: source, customerSource: fixture.result.customerSource,
  sourceRequestSha256: 'a'.repeat(64) }
const request: CreateRequest = { apiContractVersion: '0.22.0',
  reportLocator: fixture.result.report, sourceAPI13Locator: source }
const mutation = { csrfToken: 'csrf_current_session_0001', idempotencyKey: 'proposal_create_key_0001' }
const pending: ProposalProjection = { proposalId, state: 'PENDING', sourceOrigin,
  reportLocator: request.reportLocator, draftBase: fixture.result.draftBase }
const unapproved: ProposalProjection = { proposalId, state: 'UNAPPROVED', sourceOrigin, proposal: fixture.result }
const digest = (value: unknown) => createHash('sha256').update(canonicalApiV22(value)).digest('hex')
const state = { ...fixture.input.draftState, revision: fixture.input.draftState.revision + 1,
  projection: { ...fixture.input.draftState.projection, ...fixture.result.tradingCandidate }, projectionHash: 'b'.repeat(64) }
const appliedBase: DraftBase = { ...fixture.result.draftBase,
  draftRevision: String(state.revision), conversationStateRevision: '2',
  conversationStateHash: 'c'.repeat(64), projectionHash: state.projectionHash }
const applied: ProposalBoundDraft = {
  proposalId, proposalHash: fixture.result.proposalHash, sourceOrigin,
  sourceMapping: { sourceOriginSha256: 'd'.repeat(64), draftBase: appliedBase },
  reportLocator: fixture.result.report, reportProvenance: fixture.result.reportProvenance,
  draftBase: appliedBase, draftState: state, candidateState: 'READY_FOR_VALIDATION',
  semanticHash: 'e'.repeat(64), proposalProvenanceSha256: digest(fixture.result.reportProvenance), bindingHash: 'f'.repeat(64),
}
const envelope = (data: unknown) => JSON.stringify({ apiContractVersion: '0.22.0', data })
const reply = (data: unknown, status = 200, extra: HeadersInit = {}) => new Response(envelope(data),
  { status, headers: { ...headers, ...extra } })
const applyRequest = { apiContractVersion: '0.22.0' as const,
  proposalHash: fixture.result.proposalHash, draftBase: fixture.result.draftBase }
const applyOptions = { ...mutation, ifMatch: '"conversation_current_etag_0001"' }

test('API22 executionState delta preserves FAILED independently of PENDING without GET effects', async () => {
  for (const name of ['types.ts', 'validator.ts', 'client.ts', 'index.ts', 'operation-manifest.json', 'generation-manifest.json', 'package.json']) {
    const mirrored = readFileSync(resolve(process.cwd(), 'src/internal-poc/contracts/generated/api-v0.22', name))
    const original = readFileSync(resolve(donor, 'generated/typescript/api-v0.22', name))
    expect(createHash('sha256').update(mirrored).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'))
  }
  const failed: ProposalProjection = { ...pending, executionState: 'FAILED' }
  const completed: ProposalProjection = { ...unapproved, executionState: 'COMPLETED' }
  const calls: { url: string; init?: RequestInit }[] = []
  let selected: unknown = failed
  const adapter = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async (input, init) => {
    calls.push({ url: String(input), init })
    return reply(new URL(String(input)).pathname === basePath ? { items: [selected], nextCursor: null } : selected)
  } })
  const read = await adapter.read(proposalId)
  expect(read).toEqual(failed)
  expect(read.state).toBe('PENDING')
  expect(read.executionState).toBe('FAILED')
  expect(Object.isFrozen(read)).toBe(true)
  await expect(adapter.list({ sourceConversationId: source.conversationId })).resolves.toEqual({ items: [failed], nextCursor: null })
  for (const executionState of ['QUEUED', 'DISPATCHING', 'STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED', 'AMBIGUOUS'] as const) {
    selected = { ...pending, executionState }
    await expect(adapter.read(proposalId)).resolves.toMatchObject({ state: 'PENDING', executionState })
  }
  selected = completed
  await expect(adapter.read(proposalId)).resolves.toEqual(completed)
  selected = pending
  await expect(adapter.read(proposalId)).resolves.toEqual(pending)
  for (const executionState of ['READY', 'FAILED\n', null, 0]) {
    selected = { ...pending, executionState }
    await expect(adapter.read(proposalId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  }
  expect(calls).toHaveLength(15)
  for (const call of calls) {
    expect(call.init).toMatchObject({ method: 'GET', credentials: 'include', mode: 'same-origin', redirect: 'manual', cache: 'no-store' })
    expect(call.init?.body).toBeUndefined()
    for (const name of ['content-type', 'x-csrf-token', 'idempotency-key', 'if-match']) expect(new Headers(call.init?.headers).get(name)).toBeNull()
  }
})

test('exact SDK mirror and API22 source/report/CAS operations preserve immutable caller fields', async () => {
  const sdkFiles = ['types.ts', 'validator.ts', 'client.ts', 'index.ts', 'operation-manifest.json', 'generation-manifest.json', 'package.json']
  for (const name of sdkFiles) {
    const mirrored = readFileSync(resolve(process.cwd(), 'src/internal-poc/contracts/generated/api-v0.22', name))
    const original = readFileSync(resolve(donor, 'generated/typescript/api-v0.22', name))
    expect(createHash('sha256').update(mirrored).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'))
  }
  const manifest = JSON.parse(readFileSync(resolve(donor, 'generated/typescript/api-v0.22/operation-manifest.json'), 'utf8'))
  expect(manifest.getEffects).toEqual({ billing: false, dispatch: false, resume: false, retry: false })
  expect(manifest.customerConsentEffect).toBe(false)
  expect(manifest.executionEffect).toBe(false)
  const calls: { url: string; init?: RequestInit }[] = []
  const adapter = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async (input, init) => {
    calls.push({ url: String(input), init })
    const url = new URL(String(input))
    if (url.pathname.endsWith('/apply')) return reply(applied)
    if (init?.method === 'POST') return reply(pending, 202)
    if (url.pathname === basePath) return reply({ items: [unapproved], nextCursor: null })
    return reply(unapproved)
  } })
  const signal = new AbortController().signal
  const mutableRequest = { apiContractVersion: '0.22.0' as const,
    sourceAPI13Locator: { ...source }, reportLocator: { ...fixture.result.report } }
  const mutableOptions = { ...mutation, signal }
  const creating = adapter.create(mutableRequest, mutableOptions, fixture.reportText)
  mutableRequest.reportLocator.revision = 999
  mutableRequest.sourceAPI13Locator.conversationId = 'api13_changed_after_capture_0001'
  mutableOptions.idempotencyKey = 'changed_after_capture_key_0001'
  await expect(creating).resolves.toEqual(pending)
  const read = await adapter.read(proposalId, { signal })
  expect(read).toEqual(unapproved)
  expect(Object.isFrozen(read)).toBe(true)
  expect(Object.isFrozen(read.sourceOrigin.sourceAPI13Locator)).toBe(true)
  await expect(adapter.list({ sourceConversationId: source.conversationId, limit: 1 }, { signal }))
    .resolves.toEqual({ items: [unapproved], nextCursor: null })
  await expect(adapter.apply(proposalId, applyRequest, { ...applyOptions, signal })).resolves.toEqual(applied)
  expect(calls.map(call => [new URL(call.url).pathname, call.init?.method])).toEqual([
    [basePath, 'POST'], [`${basePath}/${proposalId}`, 'GET'], [basePath, 'GET'], [`${basePath}/${proposalId}/apply`, 'POST'],
  ])
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(request)
  expect(JSON.parse(String(calls[3]?.init?.body))).toEqual(applyRequest)
  expect(createHash('sha256').update(Buffer.from(fixture.reportText, 'utf8')).digest('hex')).toBe(request.reportLocator.contentSha256)
  expect(source.conversationId).not.toBe(applied.draftBase.conversationId)
  for (const call of calls) {
    expect(call.init).toMatchObject({ credentials: 'include', mode: 'same-origin', redirect: 'manual', cache: 'no-store', signal })
    const wireHeaders = new Headers(call.init?.headers)
    expect(wireHeaders.get('cookie')).toBeNull()
    expect(wireHeaders.get('authorization')).toBeNull()
    expect(wireHeaders.get('origin')).toBeNull()
    if (call.init?.method === 'GET') {
      expect(call.init.body).toBeUndefined()
      for (const name of ['content-type', 'x-csrf-token', 'idempotency-key', 'if-match']) expect(wireHeaders.get(name)).toBeNull()
    } else {
      expect(wireHeaders.get('x-csrf-token')).toBe(mutation.csrfToken)
      expect(wireHeaders.get('idempotency-key')).toBe(mutation.idempotencyKey)
    }
  }
  expect(new Headers(calls[3]?.init?.headers).get('if-match')).toBe(applyOptions.ifMatch)
  expect(new URL(calls[2]!.url).searchParams.get('sourceConversationId')).toBe(source.conversationId)
})

test('API22 rejects malformed origins/paths/echoes/statuses and cancels bounded concurrent reads without retry', async () => {
  let dispatched = 0, getterReads = 0
  const invalid = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async () => {
    dispatched += 1
    throw new Error('SYNTHETIC_NO_DISPATCH_EXPECTED')
  } })
  for (const id of [proposalId + '\n', '../another_owner', 'https://foreign.example.test', proposalId + '/apply', proposalId + '%2f']) {
    await expect(invalid.read(id)).rejects.toMatchObject<Partial<ApiV22Error>>({ code: 'INVALID_REQUEST' })
  }
  await expect(invalid.create(request, mutation, fixture.reportText + 'changed')).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(invalid.create(request, mutation, '\ud800')).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(invalid.create({ ...request, sourceAPI13Locator: { ...source, turnId: source.turnId + '\n' } }, mutation,
    fixture.reportText)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(invalid.apply(proposalId, applyRequest, { ...applyOptions, ifMatch: applyOptions.ifMatch + '\n' }))
    .rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  const accessor = Object.defineProperty({ ...mutation }, 'csrfToken', { enumerable: true,
    get: () => { getterReads += 1; return mutation.csrfToken } })
  await expect(invalid.create(request, accessor, fixture.reportText)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  const aborted = new AbortController()
  aborted.abort()
  await expect(invalid.read(proposalId, { signal: aborted.signal })).rejects.toMatchObject({ code: 'ABORTED' })
  expect(getterReads).toBe(0)
  expect(dispatched).toBe(0)
  for (const poisoned of ['https://name:secret@example.test', origin + '/nested', origin + '?unexpected=1', 'file:///tmp/example']) {
    expect(() => new NativeResearchStrategyProposalV22Adapter({ origin: poisoned })).toThrow(ApiV22Error)
  }
  const foreignSource = { ...sourceOrigin, sourceAPI13Locator: { ...source, conversationId: 'api13_foreign_owner_source_0001' } }
  const echoCases = [
    { response: reply({ ...pending, sourceOrigin: foreignSource }, 202),
      invoke: (adapter: NativeResearchStrategyProposalV22Adapter) => adapter.create(request, mutation, fixture.reportText) },
    { response: reply({ ...unapproved, proposalId: 'proposal_foreign_owner_000001' }),
      invoke: (adapter: NativeResearchStrategyProposalV22Adapter) => adapter.read(proposalId) },
    { response: reply({ items: [{ ...unapproved, sourceOrigin: foreignSource }], nextCursor: null }),
      invoke: (adapter: NativeResearchStrategyProposalV22Adapter) => adapter.list({ sourceConversationId: source.conversationId }) },
    { response: reply({ ...applied, draftBase: { ...applied.draftBase, draftId: 'draft_foreign_owner_000001' } }),
      invoke: (adapter: NativeResearchStrategyProposalV22Adapter) => adapter.apply(proposalId, applyRequest, applyOptions) },
  ]
  for (const { response, invoke } of echoCases) {
    let calls = 0
    const adapter = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async () => { calls += 1; return response } })
    await expect(invoke(adapter)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(calls).toBe(1)
  }
  for (const [status, code, expected] of [[403, 'FORBIDDEN', 'FORBIDDEN'], [409, 'BINDING_CONFLICT', 'BINDING_CONFLICT'],
    [412, 'PRECONDITION_FAILED', 'PRECONDITION_FAILED'], [400, 'FORBIDDEN', 'INVALID_RESPONSE']] as const) {
    let calls = 0
    const adapter = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async () => {
      calls += 1
      return new Response(JSON.stringify({ apiContractVersion: '0.22.0', error: { code, message: 'Synthetic rejection' } }),
        { status, headers })
    } })
    await expect(adapter.read(proposalId)).rejects.toMatchObject({ code: expected, status })
    expect(calls).toBe(1)
  }
  const malformedResponses = [
    { response: reply(unapproved, 302, { Location: '/login' }), code: 'INVALID_RESPONSE' },
    { response: reply(unapproved, 200, { 'Content-Type': 'text/html' }), code: 'INVALID_RESPONSE' },
    { response: new Response('{"apiContractVersion":"0.22.0","apiContractVersion":"0.22.0","data":{}}', { headers }), code: 'INVALID_RESPONSE' },
    { response: reply(unapproved, 200, { 'Content-Length': '262145' }), code: 'TRANSPORT_FAILED' },
    { response: new Response(new Uint8Array(262145), { headers }), code: 'TRANSPORT_FAILED' },
    { response: new Response(new Uint8Array([255]), { headers }), code: 'TRANSPORT_FAILED' },
  ]
  for (const { response, code } of malformedResponses) {
    let calls = 0
    const adapter = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async () => { calls += 1; return response } })
    await expect(adapter.read(proposalId)).rejects.toMatchObject({ code })
    expect(calls).toBe(1)
  }
  let cancelled = false
  const activeAbort = new AbortController()
  const streaming = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async () => new Response(
    new ReadableStream({ start: () => undefined, cancel: () => { cancelled = true } }), { headers }) })
  const waiting = streaming.read(proposalId, { signal: activeAbort.signal })
  await Promise.resolve()
  activeAbort.abort()
  await expect(waiting).rejects.toMatchObject({ code: 'ABORTED' })
  expect(cancelled).toBe(true)
  const releases = new Map<string, (response: Response) => void>()
  const parallel = new NativeResearchStrategyProposalV22Adapter({ origin, fetch: async input => new Promise<Response>(resolveResponse => {
    releases.set(new URL(String(input)).pathname.split('/').at(-1)!, resolveResponse)
  }) })
  const otherId = 'proposal_concurrent_other_000001'
  const first = parallel.read(proposalId)
  const second = parallel.read(otherId)
  releases.get(otherId)!(reply({ ...unapproved, proposalId: otherId }))
  await expect(second).resolves.toMatchObject({ proposalId: otherId })
  releases.get(proposalId)!(reply(unapproved))
  await expect(first).resolves.toMatchObject({ proposalId })
  expect(releases.size).toBe(2)
})
