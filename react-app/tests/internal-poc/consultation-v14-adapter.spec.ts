import { expect, test } from '@playwright/test'
import {
  ConsultationV14Adapter,
  ConsultationV14HttpError,
  ConsultationV14ProtocolError,
  ConsultationV14TransportError,
  type ConsultationV14ClaimCommand,
} from '../../src/internal-poc/consultation-v14-adapter'

const origin = 'https://service.example.test'
const anonymousSessionId = 'session_anonymous_fixture_01'
const targetSessionId = 'session_authenticated_fixture_01'
const anonymousIfMatch = '"anonymous_etag_fixture_01"'
const idempotencyKey = 'idempotency_fixture_01'
const headers = () => ({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' })
const wire = (data: unknown) => JSON.stringify({ apiContractVersion: '0.14.0', data })
const command: ConsultationV14ClaimCommand = {
  anonymousSessionId,
  anonymousIfMatch,
  targetSessionId,
  targetExpectedRevision: '7',
  idempotencyKey,
}
const legacy = {
  conversations: 0, messages: 0, drafts: 0, patches: 0, validations: 0, idempotencyRecords: 0,
}
const claim = {
  anonymousSessionId,
  sessionId: targetSessionId,
  state: 'AUTHENTICATED',
  revision: '9',
  mode: 'CONSULTATION_ONLY',
  grantScope: 'CONSULTATION_V13',
  claimedLegacyResourceCounts: legacy,
  claimedConsultationResourceCounts: { conversations: 1, turns: 2, events: 3, idempotencyRecords: 1 },
  oldSessionRevoked: true,
}

test('claim propagates an observation deadline signal without dispatching a retry', async () => {
  const controller = new AbortController()
  let calls = 0
  const adapter = new ConsultationV14Adapter({ origin, csrfToken: () => 'csrf_fixture_token', fetch: async (_input, init) => {
    calls++
    expect(init?.signal).toBe(controller.signal)
    controller.abort()
    throw new DOMException('fixture deadline', 'AbortError')
  } })
  await expect(adapter.claim(command, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect({ calls, aborted: controller.signal.aborted }).toEqual({ calls: 1, aborted: true })
})
const conversations = [
  {
    conversationId: 'conversation_fixture_01',
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T02:00:00Z',
    turnCount: 2,
    lastTurnId: 'turn_fixture_000002',
    lastTurnState: 'COMPLETED',
  },
  {
    conversationId: 'conversation_fixture_02',
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T01:00:00Z',
    turnCount: 0,
    lastTurnId: null,
    lastTurnState: null,
  },
] as const

test('claim uses one fixed same-origin request with both CAS fences and no automatic side effects', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const adapter = new ConsultationV14Adapter({
    origin,
    csrfToken: () => 'csrf_fixture_token',
    fetch: async (input, init) => {
      calls.push({ url: String(input), init })
      return new Response(wire(claim), { status: 200, headers: headers() })
    },
  })

  adapter.validateClaim(command)
  expect(calls).toHaveLength(0)
  await expect(adapter.claim(command)).resolves.toMatchObject({ data: { revision: '9' } })
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe(`${origin}/api/v14/consultation/anonymous-sessions/${anonymousSessionId}/claim`)
  expect(calls[0].init).toMatchObject({
    method: 'POST', credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
    body: JSON.stringify({ expectedSessionRevision: '7' }),
  })
  const sent = new Headers(calls[0].init?.headers)
  expect(sent.get('origin')).toBeNull()
  expect(sent.get('x-csrf-token')).toBe('csrf_fixture_token')
  expect(sent.get('idempotency-key')).toBe(idempotencyKey)
  expect(sent.get('if-match')).toBe(anonymousIfMatch)
})

test('claim accepts a strictly increasing revision and rejects normative binding conflicts without retry', async () => {
  const invalidClaims = [
    { ...claim, anonymousSessionId: 'session_different_fixture_01' },
    { ...claim, sessionId: 'session_different_fixture_02' },
    { ...claim, revision: '7' },
    { ...claim, claimedConsultationResourceCounts: { ...claim.claimedConsultationResourceCounts, turns: 0 } },
    { ...claim, claimedLegacyResourceCounts: { ...legacy, drafts: 1 } },
    {
      ...claim,
      mode: 'COMBINED',
      claimedLegacyResourceCounts: legacy,
    },
  ]
  for (const invalid of invalidClaims) {
    let calls = 0
    const adapter = new ConsultationV14Adapter({
      origin,
      csrfToken: () => 'csrf_fixture_token',
      fetch: async () => {
        calls += 1
        return new Response(wire(invalid), { status: 200, headers: headers() })
      },
    })
    await expect(adapter.claim(command)).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
    expect(calls).toBe(1)
  }
})

test('list defaults to 50 and enforces the published dense-page ordering and null-pair rules', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const page = {
    snapshotId: 'snapshot_fixture_0001',
    offset: 0,
    limit: 50,
    totalCount: 2,
    conversations,
    nextCursor: null,
  }
  const adapter = new ConsultationV14Adapter({
    origin,
    csrfToken: () => null,
    fetch: async (input, init) => {
      calls.push({ url: String(input), init })
      return new Response(wire(page), { status: 200, headers: headers() })
    },
  })
  await expect(adapter.list()).resolves.toMatchObject({ data: { limit: 50, totalCount: 2 } })
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe(`${origin}/api/v14/consultation/conversations?limit=50`)
  expect(calls[0].init).toMatchObject({ method: 'GET', credentials: 'same-origin', redirect: 'manual', cache: 'no-store' })

  for (const rows of [
    [conversations[1], conversations[0]],
    [conversations[0], conversations[0]],
    [{ ...conversations[0], turnCount: 0 }],
  ]) {
    let count = 0
    const invalid = new ConsultationV14Adapter({
      origin,
      csrfToken: () => null,
      fetch: async () => {
        count += 1
        return new Response(wire({ ...page, totalCount: rows.length, conversations: rows }), { status: 200, headers: headers() })
      },
    })
    await expect(invalid.list()).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
    expect(count).toBe(1)
  }
})

test('duplicate JSON, invalid UTF-8, declared oversize, missing no-store and redirects fail closed once', async () => {
  const responses = [
    () => new Response('{"apiContractVersion":"0.14.0","apiContractVersion":"0.14.0","data":{}}', { status: 200, headers: headers() }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { status: 200, headers: headers() }),
    () => new Response('x', { status: 200, headers: { ...headers(), 'Content-Length': '262145' } }),
    () => new Response(wire(claim), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    () => new Response(null, { status: 302, headers: { Location: `${origin}/login` } }),
  ]
  for (const makeResponse of responses) {
    let calls = 0
    const adapter = new ConsultationV14Adapter({
      origin,
      csrfToken: () => 'csrf_fixture_token',
      fetch: async () => { calls += 1; return makeResponse() },
    })
    await expect(adapter.claim(command)).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
    expect(calls).toBe(1)
  }
})

test('closed errors preserve operation/status binding and gateway bodies are never adopted', async () => {
  const error = (code: string) => JSON.stringify({
    apiContractVersion: '0.14.0',
    error: { code, message: 'Consultation session request failed.' },
  })
  let calls = 0
  const handoff = new ConsultationV14Adapter({
    origin,
    csrfToken: () => 'csrf_fixture_token',
    fetch: async () => {
      calls += 1
      return new Response(error('HANDOFF_INVALID'), { status: 409, headers: headers() })
    },
  })
  await expect(handoff.claim(command)).rejects.toMatchObject<Partial<ConsultationV14HttpError>>({
    status: 409, code: 'HANDOFF_INVALID',
  })
  expect(calls).toBe(1)

  const wrongStatus = new ConsultationV14Adapter({
    origin,
    csrfToken: () => 'csrf_fixture_token',
    fetch: async () => new Response(error('HANDOFF_INVALID'), { status: 403, headers: headers() }),
  })
  await expect(wrongStatus.claim(command)).rejects.toBeInstanceOf(ConsultationV14ProtocolError)

  const gateway = new ConsultationV14Adapter({
    origin,
    csrfToken: () => null,
    fetch: async () => new Response('<html>gateway</html>', {
      status: 503, headers: { 'Content-Type': 'text/html' },
    }),
  })
  await expect(gateway.list()).rejects.toBeInstanceOf(ConsultationV14TransportError)
})

test('invalid claim/list inputs are rejected before fetch', async () => {
  let calls = 0
  const adapter = new ConsultationV14Adapter({
    origin,
    csrfToken: () => '',
    fetch: async () => { calls += 1; throw Error('must not fetch') },
  })
  await expect(adapter.claim({ ...command, anonymousIfMatch: 'weak-etag' })).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
  await expect(adapter.claim(command)).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
  await expect(adapter.list({ limit: 51 })).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
  await expect(adapter.list({ cursor: 'short' })).rejects.toBeInstanceOf(ConsultationV14ProtocolError)
  expect(calls).toBe(0)
})
