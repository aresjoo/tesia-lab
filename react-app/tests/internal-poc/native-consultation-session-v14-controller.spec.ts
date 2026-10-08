import { expect, test } from '@playwright/test'
import { ConsultationV14Adapter } from '../../src/internal-poc/consultation-v14-adapter'
import { NativeConsultationSessionV14Controller } from '../../src/internal-poc/native-consultation-session-v14-controller'

const origin = 'https://service.example.test'
const offer = { anonymousSessionId: 'session_anonymous_fixture_01', anonymousIfMatch: '"anonymous_etag_fixture_01"',
  targetSessionId: 'session_authenticated_fixture_01', conversationId: 'conversation_fixture_01' }
const auth = (revision = '7') => ({ sessionId: offer.targetSessionId, state: 'AUTHENTICATED', revision })
const result = { anonymousSessionId: offer.anonymousSessionId, sessionId: offer.targetSessionId, state: 'AUTHENTICATED', revision: '9',
  mode: 'CONSULTATION_ONLY', grantScope: 'CONSULTATION_V13', oldSessionRevoked: true,
  claimedLegacyResourceCounts: { conversations: 0, messages: 0, drafts: 0, patches: 0, validations: 0, idempotencyRecords: 0 },
  claimedConsultationResourceCounts: { conversations: 1, turns: 1, events: 2, idempotencyRecords: 1 } }
const response = () => new Response(JSON.stringify({ apiContractVersion: '0.14.0', data: result }), {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const memoryStorage = () => {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}

test('explicit claim uses fresh target revision, then refreshed authority before restoring the same conversation', async () => {
  const calls: string[] = [], storage = memoryStorage()
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async (_input, init) => {
    calls.push(`POST:${String(init?.body)}`)
    expect(new Headers(init?.headers).get('if-match')).toBe(offer.anonymousIfMatch)
    return response()
  } })
  const controller = new NativeConsultationSessionV14Controller(adapter, { storage, randomId: () => 'fixture_stable_0001',
    currentSession: async () => { calls.push('CURRENT:7'); return auth() },
    refreshSession: async () => { calls.push('REFRESH:9'); return auth('9') },
    restoreConversation: async (conversation, owner) => { calls.push(`RESTORE:${conversation}:${owner}`); return true } })
  controller.offer(offer)
  expect(calls).toEqual([])
  expect(await controller.claim()).toBe(true)
  expect(calls).toEqual(['CURRENT:7', 'POST:{"expectedSessionRevision":"7"}', 'REFRESH:9',
    `RESTORE:${offer.conversationId}:${offer.targetSessionId}`])
  expect(storage.values.size).toBe(0)
  expect(controller.getSnapshot()).toMatchObject({ available: false, busy: false, issue: null })
})

test('lost response survives reload and explicitly retries the same durable key and original body', async () => {
  const posts: { key: string | null; body: string }[] = [], storage = memoryStorage()
  let first = true
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async (_input, init) => {
    posts.push({ key: new Headers(init?.headers).get('idempotency-key'), body: String(init?.body) })
    if (first) { first = false; throw new TypeError('fixture response loss') }
    return response()
  } })
  const options = { storage, randomId: () => 'fixture_stable_0002', currentSession: async () => auth(),
    refreshSession: async () => auth('9'), restoreConversation: async () => true }
  const controller = new NativeConsultationSessionV14Controller(adapter, options)
  controller.offer(offer)
  expect(await controller.claim()).toBe(false)
  expect(posts).toHaveLength(1)
  const restored = new NativeConsultationSessionV14Controller(adapter, { ...options, currentSession: async () => auth('9') })
  restored.bindTarget(offer.targetSessionId)
  expect(posts).toHaveLength(1)
  expect(await restored.claim()).toBe(true)
  expect(posts).toHaveLength(2)
  expect(posts[1]).toEqual(posts[0])
})

test('partial storage readback failure preserves one key and never dispatches until durable retry succeeds', async () => {
  const base = memoryStorage()
  let failReadback = true, wrote = false, calls = 0
  const storage = { ...base, setItem: (key: string, value: string) => { base.setItem(key, value); wrote = true },
    getItem: (key: string) => { if (wrote && failReadback) throw new Error('fixture storage failure'); return base.getItem(key) } }
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => { calls++; return response() } })
  const controller = new NativeConsultationSessionV14Controller(adapter, { storage, randomId: () => 'fixture_stable_0003',
    currentSession: async () => auth(), refreshSession: async () => auth('9'), restoreConversation: async () => true })
  expect(() => controller.offer(offer)).toThrow('CLAIM_STORAGE_UNAVAILABLE')
  const recorded = JSON.parse([...base.values.values()][0])
  expect(await controller.claim()).toBe(false)
  expect(calls).toBe(0)
  failReadback = false
  expect(await controller.claim()).toBe(true)
  expect(recorded.idempotencyKey).toBe('consultation_claim_fixture_stable_0003')
  expect(calls).toBe(1)
})

test('committed claim with failed refresh remains recoverable without a second mutation', async () => {
  let calls = 0, fail = true, restored = 0
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => { calls++; return response() } })
  const controller = new NativeConsultationSessionV14Controller(adapter, { storage: memoryStorage(), randomId: () => 'fixture_stable_0004',
    currentSession: async () => auth(), refreshSession: async () => { if (fail) throw new Error('fixture refresh failure'); return auth('9') },
    restoreConversation: async () => { restored++; return true } })
  controller.offer(offer)
  expect(await controller.claim()).toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ available: true, issue: 'request-unconfirmed', busy: false })
  expect({ calls, restored }).toEqual({ calls: 1, restored: 0 })
  fail = false
  expect(await controller.claim()).toBe(true)
  expect({ calls, restored }).toEqual({ calls: 1, restored: 1 })
})

test('foreign owner and detached generation cannot adopt a delayed claim or start automatic retries', async () => {
  let release!: () => void, posts = 0, restored = 0
  const held = new Promise<void>(resolve => { release = resolve })
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => { posts++; await held; return response() } })
  const controller = new NativeConsultationSessionV14Controller(adapter, { storage: memoryStorage(), randomId: () => 'fixture_stable_0005',
    currentSession: async () => auth(), refreshSession: async () => auth('9'), restoreConversation: async () => { restored++; return true } })
  controller.offer(offer)
  const pending = controller.claim()
  await expect.poll(() => posts).toBe(1)
  controller.bindTarget('session_foreign_fixture_01')
  expect(controller.setPorts({ currentSession: async () => auth(), refreshSession: async () => auth('9'), restoreConversation: async () => true })).toBe(false)
  release()
  expect(await pending).toBe(false)
  expect({ posts, restored }).toEqual({ posts: 1, restored: 0 })
  controller.bindTarget(offer.targetSessionId)
  controller.detach()
  expect(posts).toBe(1)
})

test('regressed refreshed revision or unauthenticated target never restores local content', async () => {
  for (const observation of [auth('8'), { ...auth('9'), state: 'ANONYMOUS' }, { ...auth('9'), sessionId: 'session_foreign_fixture_01' }]) {
    let restores = 0
    const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => response() })
    const controller = new NativeConsultationSessionV14Controller(adapter, { storage: memoryStorage(), randomId: () => 'fixture_stable_0006',
      currentSession: async () => auth(), refreshSession: async () => observation, restoreConversation: async () => { restores++; return true } })
    controller.offer(offer)
    expect(await controller.claim()).toBe(false)
    expect(restores).toBe(0)
  }
})

test('deterministic claim refusal survives reload, cannot retry, and only CAS-discard removes the local record', async () => {
  for (const code of ['HANDOFF_INVALID', 'CLAIM_CONFLICT', 'NOT_FOUND', 'IDEMPOTENCY_KEY_REUSED', 'BAD_REQUEST', 'FORBIDDEN', 'SESSION_REVISION_CONFLICT']) {
    let posts = 0
    const storage = memoryStorage(), status = code === 'NOT_FOUND' ? 404 : code === 'BAD_REQUEST' ? 400 : code === 'FORBIDDEN' ? 403 : 409
    const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => {
      posts++
      return new Response(JSON.stringify({ apiContractVersion: '0.14.0', error: { code, message: 'Consultation session request failed.' } }), {
        status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    } })
    const options = { storage, randomId: () => 'fixture_refused_0001', currentSession: async () => auth(),
      refreshSession: async () => auth('9'), restoreConversation: async () => true }
    const controller = new NativeConsultationSessionV14Controller(adapter, options)
    controller.offer(offer)
    expect(await controller.claim()).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ available: true, busy: false, issue: 'request-refused', canDiscard: true })
    const recovered = new NativeConsultationSessionV14Controller(adapter, options)
    recovered.bindTarget(offer.targetSessionId)
    expect(await recovered.claim()).toBe(false)
    expect(posts).toBe(1)
    const [key, raw] = [...storage.values.entries()][0]
    storage.values.set(key, 'changed by another controller')
    expect(recovered.discardPending()).toBe(false)
    storage.values.set(key, raw)
    expect(recovered.discardPending()).toBe(true)
    expect(storage.values.size).toBe(0)
    expect(recovered.getSnapshot()).toMatchObject({ available: false, issue: null, canDiscard: false })
  }
})

test('same authenticated session may advance beyond committed revision and confirmed restoration failures have a local exit', async () => {
  let restores = 0
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => response() })
  const options = { storage: memoryStorage(), randomId: () => 'fixture_advanced_0001', currentSession: async () => auth(),
    refreshSession: async () => auth('10'), restoreConversation: async () => { restores++; return true } }
  const controller = new NativeConsultationSessionV14Controller(adapter, options)
  controller.offer(offer)
  expect(await controller.claim()).toBe(true)
  expect(restores).toBe(1)
  const capped = new NativeConsultationSessionV14Controller(adapter, { ...options, restoreConversation: async () => false })
  capped.offer(offer)
  expect(await capped.claim()).toBe(false)
  expect(capped.getSnapshot()).toMatchObject({ issue: 'request-unconfirmed', canDiscard: true })
  const [key, raw] = [...options.storage.values.entries()][0]
  options.storage.values.set(key, 'changed by another controller')
  expect(capped.discardPending()).toBe(false)
  expect(capped.getSnapshot().issue).toBe('request-unconfirmed')
  options.storage.values.set(key, raw)
  expect(capped.discardPending()).toBe(true)
})

test('mismatched and corrupt records stay isolated from new offers and null target needs no storage', async () => {
  const storage = memoryStorage(), adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => response() })
  const options = { storage, randomId: () => 'fixture_hint_0001', currentSession: async () => auth(), refreshSession: async () => auth('9'), restoreConversation: async () => true }
  const controller = new NativeConsultationSessionV14Controller(adapter, options)
  controller.offer(offer)
  const [key, raw] = [...storage.values.entries()][0]
  expect(() => controller.offer({ ...offer, conversationId: 'conversation_new_fixture_01' })).toThrow('CLAIM_STORAGE_CHANGED')
  expect(storage.values.get(key)).toBe(raw)
  storage.values.set(key, '{invalid json')
  const corrupt = new NativeConsultationSessionV14Controller(adapter, options)
  corrupt.bindTarget(offer.targetSessionId)
  expect(() => corrupt.offer(offer)).toThrow('CLAIM_STORAGE_INVALID')
  expect(corrupt.getSnapshot()).toMatchObject({ available: false, issue: 'request-refused', canDiscard: true })
  expect(corrupt.discardPending()).toBe(true)
  const absent = new NativeConsultationSessionV14Controller(adapter, { ...options, storage: null })
  absent.bindTarget(offer.targetSessionId); absent.bindTarget(null)
  expect(absent.getSnapshot()).toMatchObject({ targetSessionId: null, issue: null, canDiscard: false })
})

test('observe and claim deadlines release busy without automatic retry or changing the request identity', async () => {
  for (const stalled of ['observe', 'claim']) {
    const storage = memoryStorage(), posts: { key: string | null; body: string }[] = []
    let hold = true, observedSignal: AbortSignal | undefined
    const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async (_input, init) => {
      posts.push({ key: new Headers(init?.headers).get('idempotency-key'), body: String(init?.body) })
      if (hold && stalled === 'claim') { observedSignal = init?.signal ?? undefined; return new Promise<Response>(() => {}) }
      return response()
    } })
    const controller = new NativeConsultationSessionV14Controller(adapter, { storage, requestTimeoutMs: 20, randomId: () => 'fixture_deadline_0001',
      currentSession: async signal => { if (hold && stalled === 'observe') { observedSignal = signal; return new Promise<typeof result>(() => {}) }; return auth() },
      refreshSession: async () => auth('9'), restoreConversation: async () => true })
    controller.offer(offer)
    const before = JSON.parse([...storage.values.values()][0]).idempotencyKey
    expect(await controller.claim()).toBe(false)
    expect(observedSignal?.aborted).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ busy: false, available: true, issue: 'request-unconfirmed', canDiscard: false })
    const attempts = posts.length
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(posts).toHaveLength(attempts)
    hold = false
    expect(await controller.claim()).toBe(true)
    expect(posts.at(-1)?.key).toBe(before)
    if (stalled === 'claim') expect(posts[1]).toEqual(posts[0])
  }
})

test('fresh foreign or anonymous authentication refuses claim before any mutation', async () => {
  for (const observation of [{ ...auth(), state: 'ANONYMOUS' }, { ...auth(), sessionId: 'session_foreign_fixture_01' }]) {
    let posts = 0
    const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => { posts++; return response() } })
    const controller = new NativeConsultationSessionV14Controller(adapter, { storage: memoryStorage(), randomId: () => 'fixture_stable_0007',
      currentSession: async () => observation, refreshSession: async () => auth('9'), restoreConversation: async () => true })
    controller.offer(offer)
    expect(await controller.claim()).toBe(false)
    expect(posts).toBe(0)
    expect(controller.getSnapshot()).toMatchObject({ available: true, issue: 'request-unconfirmed' })
  }
})

test('a foreign target retains its own pending record without overwriting the original account', async () => {
  const storage = memoryStorage()
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => response() })
  const options = { storage, randomId: () => 'fixture_stable_0008', currentSession: async () => auth(),
    refreshSession: async () => auth('9'), restoreConversation: async () => true }
  const controller = new NativeConsultationSessionV14Controller(adapter, options)
  controller.offer(offer)
  const first = [...storage.values.entries()][0]
  const foreign = new NativeConsultationSessionV14Controller(adapter, options)
  foreign.offer({ ...offer, targetSessionId: 'session_foreign_fixture_01' })
  expect(storage.values.size).toBe(2)
  expect(storage.values.get(first[0])).toBe(first[1])
  const restored = new NativeConsultationSessionV14Controller(adapter, options)
  restored.bindTarget(offer.targetSessionId)
  expect(restored.getSnapshot()).toMatchObject({ targetSessionId: offer.targetSessionId, conversationId: offer.conversationId, available: true })
})
