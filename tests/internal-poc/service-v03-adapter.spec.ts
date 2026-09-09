import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

interface RecordedTrace {
  readonly snapshots: {
    readonly ready: unknown
    readonly blockedAfterReady: unknown
  }
  readonly approvalAuthority: {
    readonly receipt: unknown
    readonly challenge: unknown
    readonly approvalRequest: Readonly<{
      readonly validationReceiptId: string
      readonly approvalChallengeId: string
      readonly acknowledgedSemanticHash: string
      readonly expectedConversationStateRevision: string
      readonly expectedConversationStateHash: string
    }>
  }
  readonly documents: readonly Readonly<{ readonly name: string; readonly value: unknown }>[]
}

const trace = JSON.parse(
  await readFile('tests/fixtures/service-v03/recorded-conversation.json', 'utf8'),
) as RecordedTrace

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('recorded snapshot을 generated client로 검증하고 Mock-only 상태로 투영한다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, receipt }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let call = 0
    const adapter = createServiceV03Adapter({
      async request(request) {
        call += 1
        if (call === 1) {
          if (request.method !== 'GET' || request.path !== '/api/v3/conversations/conversation_fixture_0001') {
            throw new Error('UNEXPECTED_RECORDED_REQUEST')
          }
          return {
            status: 200,
            headers: { ETag: '"conversation-state-fixture-0004"' },
            body: envelope(ready, '4', 1),
          }
        }
        if (request.method !== 'POST' || request.path !== '/api/v3/strategy-drafts/draft_fixture_00000001/validate') {
          throw new Error('UNEXPECTED_RECORDED_REQUEST')
        }
        return {
          status: 200,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: envelope(receipt, '4', 2),
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    const loaded = await adapter.getConversation('conversation_fixture_0001')
    if (loaded.status !== 'APPLIED') return { loaded, validation: null, calls: call }
    const authority = loaded.view.authority!
    const validation = await adapter.validateDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'validate_fixture_00000001',
        ifMatch: authority.etag,
      },
    )
    return { loaded, validation, calls: call }

    function envelope(data: unknown, revision: string, sequence: number) {
      return {
        meta: {
          apiContractVersion: '0.3.0',
          requestId: `req_fixture_0000000${sequence}`,
          traceId: `trace_fixture_0000000${sequence}`,
          resourceRevision: revision,
        },
        data,
      }
    }
  }, { ready: trace.snapshots.ready, receipt: trace.approvalAuthority.receipt })

  expect(result.loaded.status).toBe('APPLIED')
  expect(result.loaded.view.source).toBe('CONTRACT_V03_RECORDED_MOCK')
  expect(result.loaded.view.mockOnly).toBe(true)
  expect(result.loaded.view.authority?.conversationStateRevision).toBe('4')
  expect(result.validation?.status).toBe('APPLIED')
  expect(result.calls).toBe(2)
})

test('늦게 도착한 이전 request와 이전 session 응답은 상태를 바꾸지 않는다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, blocked }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    type ResponsePayload = Readonly<{ status: number; headers: Readonly<Record<string, string>>; body: unknown }>
    let firstResolve: ((value: ResponsePayload) => void) | null = null
    let firstStartedResolve: (() => void) | null = null
    const firstStarted = new Promise<void>((resolve) => { firstStartedResolve = resolve })
    let call = 0
    const adapter = createServiceV03Adapter({
      async request() {
        call += 1
        if (call === 1) {
          firstStartedResolve?.()
          return new Promise<ResponsePayload>((resolve) => { firstResolve = resolve })
        }
        return response(blocked, '5', 2)
      },
    })
    const firstPending = adapter.getConversation('conversation_fixture_0001')
    await firstStarted
    const second = await adapter.getConversation('conversation_fixture_0001')
    if (firstResolve === null) throw new Error('FIRST_RESPONSE_NOT_PENDING')
    ;(firstResolve as (value: ResponsePayload) => void)(response(ready, '4', 1))
    const first = await firstPending
    const afterRequestRace = adapter.view()

    let sessionResolve: ((value: ResponsePayload) => void) | null = null
    const sessionAdapter = createServiceV03Adapter({
      request: async () => new Promise<ResponsePayload>((resolve) => { sessionResolve = resolve }),
    })
    const priorSession = sessionAdapter.getConversation('conversation_fixture_0001')
    while (sessionResolve === null) await Promise.resolve()
    sessionAdapter.startSession()
    ;(sessionResolve as (value: ResponsePayload) => void)(response(ready, '4', 3))
    const sessionResult = await priorSession
    return { first, second, afterRequestRace, sessionResult, afterSession: sessionAdapter.view() }

    function response(data: unknown, revision: string, sequence: number): ResponsePayload {
      return {
        status: 200,
        headers: { ETag: `"conversation-state-fixture-000${revision}"` },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_fixture_0000000${sequence}`,
            traceId: `trace_fixture_0000000${sequence}`,
            resourceRevision: revision,
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, blocked: trace.snapshots.blockedAfterReady })

  expect(result.second.status).toBe('APPLIED')
  expect(result.first).toMatchObject({ status: 'DISCARDED', reason: 'STALE_REQUEST_EPOCH' })
  expect(result.afterRequestRace.authority?.conversationStateRevision).toBe('5')
  expect(result.sessionResult).toMatchObject({ status: 'DISCARDED', reason: 'STALE_SESSION_EPOCH' })
  expect(result.afterSession.authority).toBeNull()
})

test('활성 authority에서 새 conversation 생성을 transport 전에 차단한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let sequence = 0
    const adapter = createServiceV03Adapter({
      async request(request) {
        if (request.method !== 'POST' || request.path !== '/api/v3/conversations') {
          throw new Error('UNEXPECTED_RECORDED_REQUEST')
        }
        sequence += 1
        return {
          status: 201,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: 'req_fixture_replay_0001',
              traceId: 'trace_fixture_replay_0001',
              resourceRevision: '4',
            },
            data: ready,
          },
        }
      },
    })
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'create_fixture_00000001',
    }
    const first = await adapter.createConversation(context)
    const second = await adapter.createConversation(context)
    return { first, second, view: adapter.view(), sequence }
  }, trace.snapshots.ready)

  expect(result.first.status).toBe('APPLIED')
  expect(result.second).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.view.authority?.conversationStateRevision).toBe('4')
  expect(result.view.lastError).toBe('RESOURCE_BINDING_INVALID')
  expect(result.sequence).toBe(1)
})

test('같은 raw idempotency key는 operation별 독립 authority로 취급한다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, receipt }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let call = 0
    const adapter = createServiceV03Adapter({
      async request(request) {
        call += 1
        const isCreate = request.path === '/api/v3/conversations'
        return {
          status: isCreate ? 201 : 200,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: isCreate ? 'req_fixture_create_00001' : 'req_fixture_validate_001',
              traceId: isCreate ? 'trace_fixture_create_001' : 'trace_fixture_validate_01',
              resourceRevision: '4',
            },
            data: isCreate ? ready : receipt,
          },
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    const idempotencyKey = 'shared_raw_key_00000001'
    const created = await adapter.createConversation({
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey,
    })
    const authority = adapter.view().authority!
    const validated = await adapter.validateDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey,
        ifMatch: authority.etag,
      },
    )
    return { created, validated, call }
  }, { ready: trace.snapshots.ready, receipt: trace.approvalAuthority.receipt })

  expect(result.created.status).toBe('APPLIED')
  expect(result.validated.status).toBe('APPLIED')
  expect(result.call).toBe(2)
})

test('서버 error allowlist와 invalid response를 구분하고 원문 message는 상태에 저장하지 않는다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let call = 0
    const adapter = createServiceV03Adapter({
      async request() {
        call += 1
        if (call === 1) return success(ready)
        const code = call === 2 ? 'PRECONDITION_FAILED' : 'SERVER_PRIVATE_DETAIL'
        return {
          status: 412,
          headers: {},
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_fixture_error_0000${call}`,
              traceId: `trace_fixture_error_0000${call}`,
              resourceRevision: '4',
            },
            error: { code, message: '이 문장은 UI 상태로 복사되면 안 됩니다.' },
          },
        }
      },
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const body = {
      clientMessageId: 'client_message_fixture_0002',
      message: 'RSI 기준을 25로 바꿔줘',
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'turn_fixture_0000000001',
      ifMatch: authority.etag,
    }
    const allowed = await adapter.createTurn(authority.conversationId, body, context)
    const rejected = await adapter.createTurn(authority.conversationId, body, {
      ...context,
      idempotencyKey: 'turn_fixture_0000000002',
    })
    return { allowed, rejected, serializedView: JSON.stringify(adapter.view()) }

    function success(data: unknown) {
      return {
        status: 200,
        headers: { ETag: '"conversation-state-fixture-0004"' },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: 'req_fixture_success_0001',
            traceId: 'trace_fixture_success_0001',
            resourceRevision: '4',
          },
          data,
        },
      }
    }
  }, trace.snapshots.ready)

  expect(result.allowed).toMatchObject({ status: 'FAILED', code: 'PRECONDITION_FAILED' })
  expect(result.rejected).toMatchObject({ status: 'FAILED', code: 'INVALID_API_V03_RESPONSE' })
  expect(result.serializedView).not.toContain('UI 상태로 복사되면')
  expect(result.serializedView).not.toContain('SERVER_PRIVATE_DETAIL')
})

test('meta revision과 snapshot revision이 다르면 generated 검증 뒤에도 state boundary가 거절한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const adapter = createServiceV03Adapter({
      async request() {
        return {
          status: 200,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: 'req_fixture_mismatch_0001',
              traceId: 'trace_fixture_mismatch_0001',
              resourceRevision: '5',
            },
            data: ready,
          },
        }
      },
    })
    const settled = await adapter.getConversation('conversation_fixture_0001')
    return { settled, view: adapter.view() }
  }, trace.snapshots.ready)

  expect(result.settled).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.view.authority).toBeNull()
})

test('현재 authority와 다른 draft 대상은 transport 호출 전에 차단한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    const adapter = createServiceV03Adapter({
      async request() {
        calls += 1
        return {
          status: 200,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: 'req_fixture_authority_001',
              traceId: 'trace_fixture_authority_01',
              resourceRevision: '4',
            },
            data: ready,
          },
        }
      },
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const invalidResults = []
    invalidResults.push(
      await adapter.validateDraft(
        'draft_other_00000001',
        {
          expectedConversationStateRevision: authority.conversationStateRevision,
          expectedConversationStateHash: authority.conversationStateHash,
        },
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: 'validate_fixture_cross_0001',
          ifMatch: authority.etag,
        },
      ),
    )
    invalidResults.push(
      await adapter.patchDraft(
        'draft_other_00000001',
        {
          expectedConversationStateRevision: authority.conversationStateRevision,
          expectedConversationStateHash: authority.conversationStateHash,
          source: {
            turnId: 'turn_fixture_target_0001',
            textSha256: 'a'.repeat(64),
            normalization: 'unicode_nfc_codepoint_v1',
          },
          draftPatch: {
            contractVersion: '0.1.0',
            baseDraftVersion: 2,
            atomic: true,
            patches: [{
              op: 'replace',
              target: { entity: 'feature', id: 'rsi14', field: 'period' },
              precondition: { expectedValueHash: 'b'.repeat(64) },
              evidenceSpan: { text: 'RSI 14', start: 0, end: 6, offsetUnit: 'unicode_code_point' },
              reasonCode: 'user_correction',
              value: 14,
            }],
          },
        },
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: 'patch_fixture_cross_000001',
          ifMatch: authority.etag,
        },
      ),
    )
    const approvalBody = {
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
      validationReceiptId: 'validation_receipt_fixture_0001',
      acknowledgedSemanticHash: authority.snapshot.semanticHash!,
    }
    invalidResults.push(
      await adapter.createApprovalChallenge(
        'draft_other_00000001',
        approvalBody,
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: 'challenge_fixture_cross_001',
          ifMatch: authority.etag,
        },
      ),
    )
    invalidResults.push(
      await adapter.approveDraft(
        'draft_other_00000001',
        { ...approvalBody, approvalChallengeId: 'approval_challenge_fixture_0001' },
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: 'approve_fixture_cross_0001',
          ifMatch: authority.etag,
        },
      ),
    )
    const crossRead = await adapter.getDraft('draft_other_00000001')
    const crossConversation = await adapter.getConversation('conversation_other_00000001')
    return { calls, invalidResults, crossRead, crossConversation, revision: adapter.view().authority?.conversationStateRevision }
  }, trace.snapshots.ready)

  for (const invalid of result.invalidResults) {
    expect(invalid).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  }
  expect(result.crossRead).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.crossConversation).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.calls).toBe(1)
  expect(result.revision).toBe('4')
})

test('validation 응답은 현재 draft tuple·semantic hash·ETag에 exact 결속된다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, receipt }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const variants: ReadonlyArray<Readonly<{ name: string; mutate(data: Record<string, unknown>): void; etag?: string }>> = [
      { name: 'draftId', mutate: (data) => { data.draftId = 'draft_other_00000001' } },
      { name: 'draftRevision', mutate: (data) => { data.draftRevision = '3' } },
      { name: 'projectionHash', mutate: (data) => { data.projectionHash = 'a'.repeat(64) } },
      { name: 'semanticHash', mutate: (data) => { data.semanticHash = 'b'.repeat(64) } },
      { name: 'etag', mutate: () => {}, etag: '"conversation-state-other-0004"' },
    ]
    const outcomes: Array<Readonly<{ name: string; status: string; code?: string }>> = []
    for (const [index, variant] of variants.entries()) {
      let call = 0
      const adapter = createServiceV03Adapter({
        async request() {
          call += 1
          if (call === 1) return response(ready, '"conversation-state-fixture-0004"', index * 2 + 1)
          const changed = structuredClone(receipt) as Record<string, unknown>
          variant.mutate(changed)
          return response(changed, variant.etag ?? '"conversation-state-fixture-0004"', index * 2 + 2)
        },
      })
      await adapter.getConversation('conversation_fixture_0001')
      const authority = adapter.view().authority!
      const settled = await adapter.validateDraft(
        authority.snapshot.draftId,
        {
          expectedConversationStateRevision: authority.conversationStateRevision,
          expectedConversationStateHash: authority.conversationStateHash,
        },
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: `validate_binding_0000000${index}`,
          ifMatch: authority.etag,
        },
      )
      outcomes.push({ name: variant.name, status: settled.status, ...('code' in settled ? { code: settled.code } : {}) })
    }
    return outcomes

    function response(data: unknown, etag: string, sequence: number) {
      return {
        status: 200,
        headers: { ETag: etag },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_binding_validation_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_binding_validation_${String(sequence).padStart(3, '0')}`,
            resourceRevision: '4',
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, receipt: trace.approvalAuthority.receipt })

  expect(result).toHaveLength(5)
  for (const outcome of result) {
    expect(outcome, outcome.name).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  }
})

test('challenge와 approval은 요청 receipt·challenge·semantic authority에 exact 결속된다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approval, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const attempts: Array<Readonly<{ name: string; status: string; code?: string }>> = []
    const baseContext = { csrfToken: 'csrf_fixture_token_00000001', ifMatch: '"conversation-state-fixture-0004"' }
    const validationBody = {
      expectedConversationStateRevision: '4',
      expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
    }
    const challengeBody = {
      ...validationBody,
      validationReceiptId: approvalRequest.validationReceiptId,
      acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
    }

    for (const changedField of ['validationReceiptId', 'semanticHash'] as const) {
      let call = 0
      const adapter = createServiceV03Adapter({
        async request() {
          call += 1
          if (call === 1) return response(ready, call, 200)
          if (call === 2) return response(receipt, call, 200)
          const changed = structuredClone(challenge) as Record<string, unknown>
          changed[changedField] = changedField === 'semanticHash'
            ? 'c'.repeat(64)
            : 'validation_receipt_other_000001'
          return response(changed, call, 201)
        },
      }, () => Date.parse('2026-09-07T00:03:00Z'))
      await adapter.getConversation('conversation_fixture_0001')
      await adapter.validateDraft('draft_fixture_00000001', validationBody, {
        ...baseContext,
        idempotencyKey: `validate_before_challenge_${changedField}`,
      })
      const settled = await adapter.createApprovalChallenge('draft_fixture_00000001', challengeBody, {
        ...baseContext,
        idempotencyKey: `challenge_binding_${changedField}_01`,
      })
      attempts.push({ name: `challenge.${changedField}`, status: settled.status, ...('code' in settled ? { code: settled.code } : {}) })
    }

    for (const changedField of ['validationReceiptId', 'approvalChallengeId', 'semanticHash'] as const) {
      let call = 0
      const adapter = createServiceV03Adapter({
        async request() {
          call += 1
          if (call === 1) return response(ready, call, 200)
          if (call === 2) return response(receipt, call, 200)
          if (call === 3) return response(challenge, call, 201)
          const changed = structuredClone(approval) as Record<string, unknown>
          changed[changedField] = changedField === 'semanticHash'
            ? 'd'.repeat(64)
            : changedField === 'validationReceiptId'
              ? 'validation_receipt_other_000001'
              : 'approval_challenge_other_000001'
          return response(changed, call, 201)
        },
      }, () => Date.parse('2026-09-07T00:03:00Z'))
      await adapter.getConversation('conversation_fixture_0001')
      await adapter.validateDraft('draft_fixture_00000001', validationBody, {
        ...baseContext,
        idempotencyKey: `validate_before_approve_${changedField}`,
      })
      await adapter.createApprovalChallenge('draft_fixture_00000001', challengeBody, {
        ...baseContext,
        idempotencyKey: `challenge_before_approve_${changedField}`,
      })
      const settled = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, {
        ...baseContext,
        idempotencyKey: `approve_binding_${changedField}_001`,
      })
      attempts.push({ name: `approval.${changedField}`, status: settled.status, ...('code' in settled ? { code: settled.code } : {}) })
    }
    return attempts

    function response(data: unknown, sequence: number, status: number) {
      return {
        status,
        headers: { ETag: '"conversation-state-fixture-0004"' },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_binding_approval_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_binding_approval_${String(sequence).padStart(3, '0')}`,
            resourceRevision: '4',
          },
          data,
        },
      }
    }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approval,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result).toHaveLength(5)
  for (const outcome of result) {
    expect(outcome, outcome.name).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  }
})

test('patch·challenge·approve 정상 경로와 transport 계약을 검증한다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approval, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const requests: Array<Readonly<{ method: string; path: string; responseStatus: number }>> = []
    let nextData: unknown = ready
    let nextStatus = 200
    const adapter = createServiceV03Adapter({
      async request(request) {
        requests.push({ method: request.method, path: request.path, responseStatus: nextStatus })
        return {
          status: nextStatus,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_normal_operation_${String(requests.length).padStart(3, '0')}`,
              traceId: `trace_normal_operation_${String(requests.length).padStart(3, '0')}`,
              resourceRevision: '4',
            },
            data: nextData,
          },
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    const loaded = await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      ifMatch: authority.etag,
    }
    nextData = ready
    const patched = await adapter.patchDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
        source: {
          turnId: 'turn_fixture_patch_0001',
          textSha256: 'e'.repeat(64),
          normalization: 'unicode_nfc_codepoint_v1',
        },
        draftPatch: {
          contractVersion: '0.1.0',
          baseDraftVersion: 2,
          atomic: true,
          patches: [{
            op: 'replace',
            target: { entity: 'feature', id: 'rsi14', field: 'period' },
            precondition: { expectedValueHash: 'f'.repeat(64) },
            evidenceSpan: { text: 'RSI 14', start: 0, end: 6, offsetUnit: 'unicode_code_point' },
            reasonCode: 'user_correction',
            value: 14,
          }],
        },
      },
      { ...context, idempotencyKey: 'patch_normal_0000000001' },
    )
    nextData = receipt
    const validated = await adapter.validateDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      { ...context, idempotencyKey: 'validate_normal_0000001' },
    )
    nextData = challenge
    nextStatus = 201
    const challenged = await adapter.createApprovalChallenge(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
      },
      { ...context, idempotencyKey: 'challenge_normal_0000001' },
    )
    nextData = approval
    nextStatus = 201
    const approved = await adapter.approveDraft(
      authority.snapshot.draftId,
      approvalRequest,
      { ...context, idempotencyKey: 'approve_normal_000000001' },
    )
    return { loaded, patched, validated, challenged, approved, requests }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approval,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.loaded.status).toBe('APPLIED')
  expect(result.patched.status).toBe('APPLIED')
  expect(result.validated.status).toBe('APPLIED')
  expect(result.challenged, JSON.stringify(result.challenged)).toMatchObject({ status: 'APPLIED' })
  expect(result.approved, JSON.stringify(result.approved)).toMatchObject({ status: 'APPLIED' })
  expect(result.requests).toEqual([
    { method: 'GET', path: '/api/v3/conversations/conversation_fixture_0001', responseStatus: 200 },
    { method: 'PATCH', path: '/api/v3/strategy-drafts/draft_fixture_00000001', responseStatus: 200 },
    { method: 'POST', path: '/api/v3/strategy-drafts/draft_fixture_00000001/validate', responseStatus: 200 },
    { method: 'POST', path: '/api/v3/strategy-drafts/draft_fixture_00000001/approval-challenges', responseStatus: 201 },
    { method: 'POST', path: '/api/v3/strategy-drafts/draft_fixture_00000001/approve', responseStatus: 201 },
  ])
})

test('createTurn과 getDraft 정상 path·method·status를 실제 호출로 검증한다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const turnRequests: Array<Readonly<{ method: string; path: string; responseStatus: number }>> = []
    let turnCall = 0
    const turnAdapter = createServiceV03Adapter({
      async request(request) {
        turnCall += 1
        const responseStatus = 200
        turnRequests.push({ method: request.method, path: request.path, responseStatus })
        const data = turnCall === 1 ? ready : turn
        const revision = turnCall === 1 ? '4' : '5'
        return {
          status: responseStatus,
          headers: { ETag: `"conversation-state-fixture-000${revision}"` },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_normal_turn_${String(turnCall).padStart(3, '0')}`,
              traceId: `trace_normal_turn_${String(turnCall).padStart(3, '0')}`,
              resourceRevision: revision,
            },
            data,
          },
        }
      },
    })
    await turnAdapter.getConversation('conversation_fixture_0001')
    const authority = turnAdapter.view().authority!
    const turnResult = await turnAdapter.createTurn(
      authority.conversationId,
      {
        clientMessageId: 'client_message_fixture_0001',
        message: '뉴스 조건도 추가해줘',
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'turn_normal_000000000001',
        ifMatch: authority.etag,
      },
    )

    const draftRequests: Array<Readonly<{ method: string; path: string; responseStatus: number }>> = []
    const draftAdapter = createServiceV03Adapter({
      async request(request) {
        const responseStatus = 200
        draftRequests.push({ method: request.method, path: request.path, responseStatus })
        return {
          status: responseStatus,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: 'req_normal_draft_0001',
              traceId: 'trace_normal_draft_0001',
              resourceRevision: '4',
            },
            data: ready,
          },
        }
      },
    })
    const draftResult = await draftAdapter.getDraft('draft_fixture_00000001')
    return { turnResult, draftResult, turnRequests, draftRequests }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.turnResult.status).toBe('APPLIED')
  expect(result.draftResult.status).toBe('APPLIED')
  expect(result.turnRequests).toEqual([
    { method: 'GET', path: '/api/v3/conversations/conversation_fixture_0001', responseStatus: 200 },
    { method: 'POST', path: '/api/v3/conversations/conversation_fixture_0001/messages', responseStatus: 200 },
  ])
  expect(result.draftRequests).toEqual([
    { method: 'GET', path: '/api/v3/strategy-drafts/draft_fixture_00000001', responseStatus: 200 },
  ])
})

test('동일 revision/hash snapshot의 ETag 또는 draft projection drift를 차단한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const outcomes: string[] = []
    for (const kind of ['etag', 'projection'] as const) {
      let call = 0
      const adapter = createServiceV03Adapter({
        async request() {
          call += 1
          const data = structuredClone(ready) as Record<string, unknown>
          if (call === 2 && kind === 'projection') {
            data.projectionHash = '9'.repeat(64)
            ;(data.draftState as Record<string, unknown>).projectionHash = '9'.repeat(64)
          }
          return {
            status: 200,
            headers: { ETag: call === 2 && kind === 'etag' ? '"conversation-state-other-0004"' : '"conversation-state-fixture-0004"' },
            body: {
              meta: {
                apiContractVersion: '0.3.0',
                requestId: `req_snapshot_drift_${kind}_${call}`,
                traceId: `trace_snapshot_drift_${kind}_${call}`,
                resourceRevision: '4',
              },
              data,
            },
          }
        },
      })
      await adapter.getConversation('conversation_fixture_0001')
      const settled = await adapter.getConversation('conversation_fixture_0001')
      outcomes.push(settled.status === 'FAILED' ? settled.code : settled.status)
    }
    return outcomes
  }, trace.snapshots.ready)

  expect(result).toEqual(['RESOURCE_BINDING_INVALID', 'RESOURCE_BINDING_INVALID'])
})

test('approval의 exact parsed replay만 허용하고 lineage 밖 성공 응답 replay는 차단한다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approval, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let call = 0
    let responseData = approval
    const adapter = createServiceV03Adapter({
      async request() {
        call += 1
        if (call === 1) return response(ready, 200)
        if (call === 2) return response(receipt, 200)
        if (call === 3) return response(challenge, 201)
        return response(call === 5 ? reverseObjectKeys(responseData) : responseData, 201)
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    await adapter.getConversation('conversation_fixture_0001')
    await adapter.validateDraft(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: '4',
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'validate_before_replay_001',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    await adapter.createApprovalChallenge(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: '4',
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'challenge_before_replay_01',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'approve_replay_000000001',
      ifMatch: '"conversation-state-fixture-0004"',
    }
    const first = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    const exactParsedReplay = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    responseData = { ...(approval as Record<string, unknown>), issuedAt: '2026-09-07T00:02:01Z' }
    const mismatch = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    const differentKey = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, {
      ...context,
      idempotencyKey: 'approve_replay_other_00001',
    })
    return { first, exactParsedReplay, mismatch, differentKey, call }

    function response(data: unknown, status: number) {
      return {
        status,
        headers: { ETag: '"conversation-state-fixture-0004"' },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: 'req_approval_replay_0001',
            traceId: 'trace_approval_replay_0001',
            resourceRevision: '4',
          },
          data,
        },
      }
    }

    function reverseObjectKeys(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reverseObjectKeys)
      if (typeof value !== 'object' || value === null) return value
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .reverse()
          .map(([key, item]) => [key, reverseObjectKeys(item)]),
      )
    }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approval,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.first.status).toBe('APPLIED')
  expect(result.exactParsedReplay.status).toBe('APPLIED')
  expect(result.mismatch).toMatchObject({ status: 'FAILED', code: 'IDEMPOTENT_RESPONSE_MISMATCH' })
  expect(result.differentKey).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.call).toBe(6)
})

test('digest 이전에 예약한 session epoch로 즉시 reset된 요청을 transport 전에 폐기한다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    let delayTurnDigest = false
    let digestStartedResolve: (() => void) | null = null
    let releaseDigest: (() => void) | null = null
    const digestStarted = new Promise<void>((resolve) => { digestStartedResolve = resolve })
    const digestGate = new Promise<void>((resolve) => { releaseDigest = resolve })
    const adapter = createServiceV03Adapter({
      async request() {
        calls += 1
        const isSnapshot = calls <= 2
        const data = isSnapshot ? ready : turn
        const revision = isSnapshot ? '4' : '5'
        return {
          status: 200,
          headers: { ETag: `"conversation-state-fixture-000${revision}"` },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_epoch_reservation_${String(calls).padStart(3, '0')}`,
              traceId: `trace_epoch_reservation_${String(calls).padStart(3, '0')}`,
              resourceRevision: revision,
            },
            data,
          },
        }
      },
    }, undefined, async (value: string) => {
      if (delayTurnDigest && value.includes('"operationId":"createConversationTurnV3"')) {
        digestStartedResolve?.()
        await digestGate
      }
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const body = {
      clientMessageId: 'client_message_epoch_0001',
      message: 'RSI 조건을 유지해줘',
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'turn_epoch_reset_00000001',
      ifMatch: authority.etag,
    }
    delayTurnDigest = true
    const oldRequest = adapter.createTurn(authority.conversationId, body, context)
    await digestStarted
    const resetView = adapter.startSession()
    if (releaseDigest === null) throw new Error('DIGEST_GATE_NOT_READY')
    ;(releaseDigest as () => void)()
    const discarded = await oldRequest
    const afterDiscard = adapter.view()

    await adapter.getConversation('conversation_fixture_0001')
    const replayAuthority = adapter.view().authority!
    const reusedKey = await adapter.createTurn(
      replayAuthority.conversationId,
      {
        ...body,
        expectedConversationStateRevision: replayAuthority.conversationStateRevision,
        expectedConversationStateHash: replayAuthority.conversationStateHash,
      },
      { ...context, ifMatch: replayAuthority.etag },
    )
    return { discarded, resetView, afterDiscard, reusedKey, calls }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.discarded).toMatchObject({ status: 'DISCARDED', reason: 'STALE_SESSION_EPOCH' })
  expect(result.resetView).toMatchObject({ authority: null, lastError: null, requestEpoch: 0 })
  expect(result.afterDiscard).toEqual(result.resetView)
  expect(result.reusedKey.status).toBe('APPLIED')
  expect(result.calls).toBe(3)
})

test('호출 직후 body/context 변조가 digest 또는 outbound snapshot을 바꾸지 않는다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    let outbound: Readonly<{ body: unknown; headers: Readonly<Record<string, string>> }> | null = null
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (calls === 2) outbound = { body: request.body, headers: request.headers }
        const data = calls === 1 ? ready : turn
        const revision = calls === 1 ? '4' : '5'
        return {
          status: 200,
          headers: { ETag: `"conversation-state-fixture-000${revision}"` },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_immutable_input_${String(calls).padStart(3, '0')}`,
              traceId: `trace_immutable_input_${String(calls).padStart(3, '0')}`,
              resourceRevision: revision,
            },
            data,
          },
        }
      },
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const body = {
      clientMessageId: 'client_message_immutable_0001',
      message: '최초 메시지를 보존해줘',
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'turn_immutable_000000001',
      ifMatch: authority.etag,
    }
    const pending = adapter.createTurn(authority.conversationId, body, context)
    body.message = '호출 뒤 바꾼 메시지'
    context.idempotencyKey = 'turn_mutated_0000000001'
    context.ifMatch = '"conversation-state-mutated-0001"'
    const settled = await pending
    return { settled, outbound, callerBody: body, callerContext: context }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.settled.status).toBe('APPLIED')
  expect(result.outbound?.body).toMatchObject({ message: '최초 메시지를 보존해줘' })
  expect(result.outbound?.headers).toMatchObject({
    'Idempotency-Key': 'turn_immutable_000000001',
    'If-Match': '"conversation-state-fixture-0004"',
  })
  expect(result.callerBody.message).toBe('호출 뒤 바꾼 메시지')
  expect(result.callerContext.idempotencyKey).toBe('turn_mutated_0000000001')
})

test('generated preflight invalid 입력은 in-flight valid 요청의 activation을 취소하지 않는다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    type ResponsePayload = Readonly<{ status: number; headers: Readonly<Record<string, string>>; body: unknown }>
    let calls = 0
    let validResolve: ((value: ResponsePayload) => void) | null = null
    let validStartedResolve: (() => void) | null = null
    const validStarted = new Promise<void>((resolve) => { validStartedResolve = resolve })
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (calls === 1) return response(ready, '4', 1, 200)
        if (calls === 2 && request.method === 'POST') {
          validStartedResolve?.()
          return new Promise<ResponsePayload>((resolve) => { validResolve = resolve })
        }
        throw new Error('INVALID_INPUT_REACHED_REAL_TRANSPORT')
      },
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const body = {
      clientMessageId: 'client_message_preflight_0001',
      message: '정상 요청은 유지해줘',
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'preflight_valid_request_001',
      ifMatch: authority.etag,
    }
    const valid = adapter.createTurn(authority.conversationId, body, context)
    await validStarted
    const epochBeforeInvalid = adapter.view().requestEpoch
    const invalidClientMessageId = await adapter.createTurn(
      authority.conversationId,
      { ...body, clientMessageId: 'bad' },
      { ...context, idempotencyKey: 'invalid_client_message_001' },
    )
    const invalidBody = await adapter.createTurn(
      authority.conversationId,
      { ...body, message: '' },
      { ...context, idempotencyKey: 'invalid_empty_body_000001' },
    )
    const invalidContext = await adapter.createTurn(
      authority.conversationId,
      body,
      { ...context, idempotencyKey: 'bad' },
    )
    const invalidResourceId = await adapter.createTurn(
      'bad',
      body,
      { ...context, idempotencyKey: 'invalid_resource_id_0001' },
    )
    const protoBody = { ...body }
    Object.defineProperty(protoBody, '__proto__', {
      value: 'must_not_be_silently_dropped',
      enumerable: true,
      writable: true,
      configurable: true,
    })
    const ownProtoKey = await adapter.createTurn(
      authority.conversationId,
      protoBody,
      { ...context, idempotencyKey: 'own_proto_key_invalid_001' },
    )
    const beforeValidSettlement = adapter.view()
    const callsBeforeSettlement = calls
    if (validResolve === null) throw new Error('VALID_REQUEST_NOT_STARTED')
    ;(validResolve as (value: ResponsePayload) => void)(response(turn, '5', 2, 200))
    const validResult = await valid

    let createCalls = 0
    let createResolve: ((value: ResponsePayload) => void) | null = null
    let createStartedResolve: (() => void) | null = null
    const createStarted = new Promise<void>((resolve) => { createStartedResolve = resolve })
    const resourceAdapter = createServiceV03Adapter({
      async request() {
        createCalls += 1
        createStartedResolve?.()
        return new Promise<ResponsePayload>((resolve) => { createResolve = resolve })
      },
    })
    const createPending = resourceAdapter.createConversation({
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'resource_preflight_create_01',
    })
    await createStarted
    const invalidGeneratedResource = await resourceAdapter.getConversation('bad')
    const resourceBeforeSettlement = resourceAdapter.view()
    if (createResolve === null) throw new Error('CREATE_REQUEST_NOT_STARTED')
    ;(createResolve as (value: ResponsePayload) => void)(response(ready, '4', 3, 201))
    const createResult = await createPending
    return {
      invalidClientMessageId,
      invalidBody,
      invalidContext,
      invalidResourceId,
      invalidGeneratedResource,
      ownProtoKey,
      epochBeforeInvalid,
      beforeValidSettlement,
      callsBeforeSettlement,
      validResult,
      finalView: adapter.view(),
      createCalls,
      resourceBeforeSettlement,
      createResult,
      resourceFinalView: resourceAdapter.view(),
    }

    function response(data: unknown, revision: string, sequence: number, status: number): ResponsePayload {
      return {
        status,
        headers: { ETag: `"conversation-state-fixture-000${revision}"` },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_generated_preflight_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_generated_preflight_${String(sequence).padStart(3, '0')}`,
            resourceRevision: revision,
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.invalidClientMessageId).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.invalidBody).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.invalidContext).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.invalidResourceId).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.invalidGeneratedResource).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.ownProtoKey).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.beforeValidSettlement.requestEpoch).toBe(result.epochBeforeInvalid)
  expect(result.callsBeforeSettlement).toBe(2)
  expect(result.validResult.status).toBe('APPLIED')
  expect(result.finalView.authority?.conversationStateRevision).toBe('5')
  expect(result.finalView.lastError).toBeNull()
  expect(result.resourceBeforeSettlement.requestEpoch).toBe(1)
  expect(result.createCalls).toBe(1)
  expect(result.createResult.status).toBe('APPLIED')
  expect(result.resourceFinalView.authority?.conversationStateRevision).toBe('4')
  expect(result.resourceFinalView.lastError).toBeNull()
})

test('createApprovalChallenge는 AVAILABLE 이외 lifecycle 응답을 거절한다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, receipt, challenge, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const outcomes: string[] = []
    for (const lifecycle of ['CONSUMED', 'INVALIDATED'] as const) {
      let calls = 0
      const adapter = createServiceV03Adapter({
        async request() {
          calls += 1
          const data = calls === 1
            ? ready
            : calls === 2
              ? receipt
              : { ...(challenge as Record<string, unknown>), consumptionState: lifecycle }
          return {
            status: calls === 3 ? 201 : 200,
            headers: { ETag: '"conversation-state-fixture-0004"' },
            body: {
              meta: {
                apiContractVersion: '0.3.0',
                requestId: `req_challenge_lifecycle_${lifecycle.toLowerCase()}`,
                traceId: `trace_challenge_lifecycle_${lifecycle.toLowerCase()}`,
                resourceRevision: '4',
              },
              data,
            },
          }
        },
      }, () => Date.parse('2026-09-07T00:03:00Z'))
      await adapter.getConversation('conversation_fixture_0001')
      await adapter.validateDraft(
        'draft_fixture_00000001',
        {
          expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
          expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
        },
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: `validate_before_lifecycle_${lifecycle.toLowerCase()}`,
          ifMatch: '"conversation-state-fixture-0004"',
        },
      )
      const settled = await adapter.createApprovalChallenge(
        'draft_fixture_00000001',
        {
          expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
          expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
          validationReceiptId: approvalRequest.validationReceiptId,
          acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
        },
        {
          csrfToken: 'csrf_fixture_token_00000001',
          idempotencyKey: `challenge_lifecycle_${lifecycle.toLowerCase()}`,
          ifMatch: '"conversation-state-fixture-0004"',
        },
      )
      outcomes.push(settled.status === 'FAILED' ? settled.code : settled.status)
    }
    return outcomes
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result).toEqual(['RESOURCE_BINDING_INVALID', 'RESOURCE_BINDING_INVALID'])
})

test('remove patch의 own undefined는 JSON wire처럼 제거하고 비JSON 입력은 typed FAILED로 차단한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    let outboundHasValue = true
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (calls === 2) {
          const requestBody = request.body as Record<string, unknown>
          const draftPatch = requestBody.draftPatch as Record<string, unknown>
          const patches = draftPatch.patches as Array<Record<string, unknown>>
          outboundHasValue = Object.hasOwn(patches[0]!, 'value')
        }
        return {
          status: 200,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_json_wire_input_${String(calls).padStart(3, '0')}`,
              traceId: `trace_json_wire_input_${String(calls).padStart(3, '0')}`,
              resourceRevision: '4',
            },
            data: ready,
          },
        }
      },
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const removeBody = {
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
      source: {
        turnId: 'turn_remove_wire_0001',
        textSha256: '1'.repeat(64),
        normalization: 'unicode_nfc_codepoint_v1' as const,
      },
      draftPatch: {
        contractVersion: '0.1.0' as const,
        baseDraftVersion: 2,
        atomic: true as const,
        patches: [{
          op: 'remove' as const,
          target: { entity: 'exit_rule' as const, id: 'exit_stop' },
          precondition: { expectedValueHash: '2'.repeat(64) },
          evidenceSpan: { text: '손절 삭제', start: 0, end: 5, offsetUnit: 'unicode_code_point' as const },
          reasonCode: 'user_removal' as const,
          value: undefined,
        }],
      },
    }
    const removed = await adapter.patchDraft(
      authority.snapshot.draftId,
      removeBody,
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'remove_wire_undefined_0001',
        ifMatch: authority.etag,
      },
    )
    const badBody = {
      clientMessageId: 'client_message_nonjson_0001',
      message: 1n,
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    const rejected = await adapter.createTurn(
      authority.conversationId,
      badBody as unknown as Parameters<typeof adapter.createTurn>[1],
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'turn_nonjson_0000000001',
        ifMatch: authority.etag,
      },
    )
    return { removed, rejected, outboundHasValue, calls, serialized: JSON.stringify(adapter.view()) }
  }, trace.snapshots.ready)

  expect(result.removed.status).toBe('APPLIED')
  expect(result.outboundHasValue).toBe(false)
  expect(result.rejected).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.calls).toBe(2)
  expect(result.serialized).not.toContain('bigint')
})

test('같은 operation과 idempotency key의 다른 request digest는 transport 전에 차단한다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approval, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    const adapter = createServiceV03Adapter({
      async request() {
        calls += 1
        const status = calls === 1 || calls === 2 ? 200 : 201
        const data = calls === 1 ? ready : calls === 2 ? receipt : calls === 3 ? challenge : approval
        return {
          status,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_local_idem_${String(calls).padStart(3, '0')}`,
              traceId: `trace_local_idem_${String(calls).padStart(3, '0')}`,
              resourceRevision: '4',
            },
            data,
          },
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    await adapter.getConversation('conversation_fixture_0001')
    await adapter.validateDraft(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: '4',
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'validate_before_local_idem',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    await adapter.createApprovalChallenge(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: '4',
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'challenge_before_local_01',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'approve_local_idem_000001',
      ifMatch: '"conversation-state-fixture-0004"',
    }
    const first = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    const conflict = await adapter.approveDraft(
      'draft_fixture_00000001',
      { ...approvalRequest, validationReceiptId: 'validation_receipt_other_000001' },
      context,
    )
    return { first, conflict, calls, view: adapter.view() }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approval,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.first.status).toBe('APPLIED')
  expect(result.conflict).toMatchObject({ status: 'FAILED', code: 'IDEMPOTENCY_KEY_REUSED_LOCALLY' })
  expect(result.view.lastError).toBe('IDEMPOTENCY_KEY_REUSED_LOCALLY')
  expect(result.calls).toBe(4)
})

test('validation receipt와 challenge의 expiresAt 경계를 주입 clock으로 결정론 검증한다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, receipt, challenge, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const outcomes: string[] = []
    const cases = [
      { kind: 'receipt', now: '2026-09-07T00:09:59.999Z', expected: 'APPLIED' },
      { kind: 'receipt', now: '2026-09-07T00:10:00.000Z', expected: 'RESOURCE_EXPIRED' },
      { kind: 'challenge', now: '2026-09-07T00:05:59.999Z', expected: 'APPLIED' },
      { kind: 'challenge', now: '2026-09-07T00:06:00.000Z', expected: 'RESOURCE_EXPIRED' },
    ] as const
    for (const item of cases) {
      let calls = 0
      const adapter = createServiceV03Adapter({
        async request() {
          calls += 1
          const isChallenge = item.kind === 'challenge'
          const responseData = calls === 1
            ? ready
            : isChallenge && calls === 2
              ? receipt
              : isChallenge
                ? challenge
                : receipt
          return {
            status: isChallenge && calls === 3 ? 201 : 200,
            headers: { ETag: '"conversation-state-fixture-0004"' },
            body: {
              meta: {
                apiContractVersion: '0.3.0',
                requestId: `req_expiry_${item.kind}_${String(calls).padStart(3, '0')}`,
                traceId: `trace_expiry_${item.kind}_${String(calls).padStart(3, '0')}`,
                resourceRevision: '4',
              },
              data: responseData,
            },
          }
        },
      }, () => Date.parse(item.now))
      await adapter.getConversation('conversation_fixture_0001')
      const authority = adapter.view().authority!
      const context = {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: `expiry_${item.kind}_${item.expected.toLowerCase()}`,
        ifMatch: authority.etag,
      }
      if (item.kind === 'challenge') {
        await adapter.validateDraft(
          authority.snapshot.draftId,
          {
            expectedConversationStateRevision: authority.conversationStateRevision,
            expectedConversationStateHash: authority.conversationStateHash,
          },
          { ...context, idempotencyKey: `expiry_receipt_before_${item.expected.toLowerCase()}` },
        )
      }
      const settled = item.kind === 'receipt'
        ? await adapter.validateDraft(
            authority.snapshot.draftId,
            {
              expectedConversationStateRevision: authority.conversationStateRevision,
              expectedConversationStateHash: authority.conversationStateHash,
            },
            context,
          )
        : await adapter.createApprovalChallenge(
            authority.snapshot.draftId,
            {
              expectedConversationStateRevision: authority.conversationStateRevision,
              expectedConversationStateHash: authority.conversationStateHash,
              validationReceiptId: approvalRequest.validationReceiptId,
              acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
            },
            context,
          )
      outcomes.push(settled.status === 'FAILED' ? settled.code : settled.status)
    }
    return { outcomes, expected: cases.map((item) => item.expected) }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.outcomes).toEqual(result.expected)
})

test('in-flight mutation 중 시작한 read가 mutation 응답을 보수적으로 stale 처리한다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    type ResponsePayload = Readonly<{ status: number; headers: Readonly<Record<string, string>>; body: unknown }>
    let calls = 0
    let mutationResolve: ((value: ResponsePayload) => void) | null = null
    let mutationStartedResolve: (() => void) | null = null
    const mutationStarted = new Promise<void>((resolve) => { mutationStartedResolve = resolve })
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (request.method === 'POST') {
          mutationStartedResolve?.()
          return new Promise<ResponsePayload>((resolve) => { mutationResolve = resolve })
        }
        return response(ready, '4', calls)
      },
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const mutation = adapter.createTurn(
      authority.conversationId,
      {
        clientMessageId: 'client_message_concurrent_0001',
        message: 'RSI 조건을 변경해줘',
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'turn_concurrent_read_000001',
        ifMatch: authority.etag,
      },
    )
    await mutationStarted
    const read = await adapter.getConversation(authority.conversationId)
    if (mutationResolve === null) throw new Error('MUTATION_NOT_STARTED')
    ;(mutationResolve as (value: ResponsePayload) => void)(response(turn, '5', calls + 1))
    const mutationResult = await mutation
    return { read, mutationResult, calls, view: adapter.view() }

    function response(data: unknown, revision: string, sequence: number): ResponsePayload {
      return {
        status: 200,
        headers: { ETag: `"conversation-state-fixture-000${revision}"` },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_concurrent_policy_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_concurrent_policy_${String(sequence).padStart(3, '0')}`,
            resourceRevision: revision,
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.read.status).toBe('APPLIED')
  expect(result.mutationResult).toMatchObject({ status: 'DISCARDED', reason: 'STALE_REQUEST_EPOCH' })
  expect(result.view.authority?.conversationStateRevision).toBe('4')
  expect(result.calls).toBe(3)
})

test('먼저 호출된 slow digest 요청은 더 최신 valid activation 뒤 transport 없이 stale 처리한다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    let delayMutationDigest = false
    let digestStartedResolve: (() => void) | null = null
    let releaseDigest: (() => void) | null = null
    const digestStarted = new Promise<void>((resolve) => { digestStartedResolve = resolve })
    const digestGate = new Promise<void>((resolve) => { releaseDigest = resolve })
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        return response(request.method === 'POST' ? turn : ready, request.method === 'POST' ? '5' : '4', calls)
      },
    }, undefined, async (value: string) => {
      if (delayMutationDigest && value.includes('"operationId":"createConversationTurnV3"')) {
        digestStartedResolve?.()
        await digestGate
      }
      return hash(value)
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'slow_first_invocation_0001',
      ifMatch: authority.etag,
    }
    const body = {
      clientMessageId: 'client_message_slow_first_01',
      message: '먼저 호출한 느린 요청',
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    delayMutationDigest = true
    const slowFirst = adapter.createTurn(authority.conversationId, body, context)
    await digestStarted
    const newerRead = await adapter.getConversation(authority.conversationId)
    const afterRead = adapter.view()
    if (releaseDigest === null) throw new Error('DIGEST_GATE_NOT_READY')
    ;(releaseDigest as () => void)()
    const staleFirst = await slowFirst
    const afterStale = adapter.view()
    const callsBeforeReuse = calls
    const reusedKey = await adapter.createTurn(
      authority.conversationId,
      { ...body, message: 'stale invocation이 기록을 남기지 않았는지 확인' },
      context,
    )
    return { newerRead, staleFirst, afterRead, afterStale, callsBeforeReuse, reusedKey, calls }

    async function hash(value: string): Promise<string> {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }

    function response(data: unknown, revision: string, sequence: number) {
      return {
        status: 200,
        headers: { ETag: `"conversation-state-fixture-000${revision}"` },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_slow_first_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_slow_first_${String(sequence).padStart(3, '0')}`,
            resourceRevision: revision,
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.newerRead.status).toBe('APPLIED')
  expect(result.staleFirst).toMatchObject({ status: 'DISCARDED', reason: 'STALE_REQUEST_EPOCH' })
  expect(result.afterStale).toEqual(result.afterRead)
  expect(result.afterStale.lastError).toBeNull()
  expect(result.callsBeforeReuse).toBe(2)
  expect(result.reusedKey.status).toBe('APPLIED')
  expect(result.calls).toBe(3)
})

test('나중 호출된 slow digest valid 요청이 activate되면 이전 in-flight 응답은 stale 처리한다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    type ResponsePayload = Readonly<{ status: number; headers: Readonly<Record<string, string>>; body: unknown }>
    let calls = 0
    let mutationResolve: ((value: ResponsePayload) => void) | null = null
    let mutationStartedResolve: (() => void) | null = null
    let delayReadDigest = false
    let readDigestStartedResolve: (() => void) | null = null
    let releaseReadDigest: (() => void) | null = null
    const mutationStarted = new Promise<void>((resolve) => { mutationStartedResolve = resolve })
    const readDigestStarted = new Promise<void>((resolve) => { readDigestStartedResolve = resolve })
    const readDigestGate = new Promise<void>((resolve) => { releaseReadDigest = resolve })
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (request.method === 'POST') {
          mutationStartedResolve?.()
          return new Promise<ResponsePayload>((resolve) => { mutationResolve = resolve })
        }
        return response(ready, '4', calls)
      },
    }, undefined, async (value: string) => {
      if (delayReadDigest && value.includes('"operationId":"getConversationV3"')) {
        readDigestStartedResolve?.()
        await readDigestGate
      }
      return hash(value)
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const mutation = adapter.createTurn(
      authority.conversationId,
      {
        clientMessageId: 'client_message_fast_first_01',
        message: '먼저 activate되는 요청',
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'fast_first_invocation_0001',
        ifMatch: authority.etag,
      },
    )
    await mutationStarted
    delayReadDigest = true
    const newerReadPending = adapter.getConversation(authority.conversationId)
    await readDigestStarted
    const beforeReadActivation = adapter.view()
    if (releaseReadDigest === null) throw new Error('READ_DIGEST_GATE_NOT_READY')
    ;(releaseReadDigest as () => void)()
    const newerRead = await newerReadPending
    const afterRead = adapter.view()
    if (mutationResolve === null) throw new Error('MUTATION_NOT_STARTED')
    ;(mutationResolve as (value: ResponsePayload) => void)(response(turn, '5', 2))
    const staleMutation = await mutation
    return { beforeReadActivation, newerRead, staleMutation, afterRead, afterStale: adapter.view(), calls }

    async function hash(value: string): Promise<string> {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }

    function response(data: unknown, revision: string, sequence: number): ResponsePayload {
      return {
        status: 200,
        headers: { ETag: `"conversation-state-fixture-000${revision}"` },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_slow_newer_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_slow_newer_${String(sequence).padStart(3, '0')}`,
            resourceRevision: revision,
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.beforeReadActivation.requestEpoch).toBe(2)
  expect(result.newerRead.status).toBe('APPLIED')
  expect(result.staleMutation).toMatchObject({ status: 'DISCARDED', reason: 'STALE_REQUEST_EPOCH' })
  expect(result.afterStale).toEqual(result.afterRead)
  expect(result.afterStale.lastError).toBeNull()
  expect(result.afterStale.authority?.conversationStateRevision).toBe('4')
  expect(result.calls).toBe(3)
})

test('관측하지 않은 receipt와 challenge ID는 request epoch 및 transport 변경 없이 거절한다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    const adapter = createServiceV03Adapter({
      async request() {
        calls += 1
        return {
          status: 200,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: 'req_unobserved_authority_001',
              traceId: 'trace_unobserved_authority_01',
              resourceRevision: '4',
            },
            data: ready,
          },
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    await adapter.getConversation('conversation_fixture_0001')
    const before = adapter.view()
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'unobserved_authority_0001',
      ifMatch: '"conversation-state-fixture-0004"',
    }
    const challenge = await adapter.createApprovalChallenge(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
      },
      context,
    )
    const approval = await adapter.approveDraft(
      'draft_fixture_00000001',
      approvalRequest,
      { ...context, idempotencyKey: 'unobserved_approval_00001' },
    )
    return { before, challenge, approval, after: adapter.view(), calls }
  }, { ready: trace.snapshots.ready, approvalRequest: trace.approvalAuthority.approvalRequest })

  expect(result.challenge).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.approval).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.after.requestEpoch).toBe(result.before.requestEpoch)
  expect(result.after.authority).toEqual(result.before.authority)
  expect(result.calls).toBe(1)
})

test('관측한 receipt와 challenge도 request 시점에 만료되면 transport 전에 거절한다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    const validationBody = {
      expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
      expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
    }
    const challengeBody = {
      ...validationBody,
      validationReceiptId: approvalRequest.validationReceiptId,
      acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
    }

    let receiptNow = Date.parse('2026-09-07T00:03:00Z')
    let receiptCalls = 0
    const receiptAdapter = createServiceV03Adapter({
      async request() {
        receiptCalls += 1
        return response(receiptCalls === 1 ? ready : receipt, 200, receiptCalls)
      },
    }, () => receiptNow)
    await receiptAdapter.getConversation('conversation_fixture_0001')
    await receiptAdapter.validateDraft('draft_fixture_00000001', validationBody, {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'observe_receipt_expiry_001',
      ifMatch: '"conversation-state-fixture-0004"',
    })
    const receiptEpoch = receiptAdapter.view().requestEpoch
    receiptNow = Date.parse('2026-09-07T00:10:00Z')
    const expiredReceipt = await receiptAdapter.createApprovalChallenge(
      'draft_fixture_00000001',
      challengeBody,
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'expired_receipt_request_001',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )

    let challengeNow = Date.parse('2026-09-07T00:03:00Z')
    let challengeCalls = 0
    const challengeAdapter = createServiceV03Adapter({
      async request() {
        challengeCalls += 1
        const data = challengeCalls === 1 ? ready : challengeCalls === 2 ? receipt : challenge
        return response(data, challengeCalls === 3 ? 201 : 200, challengeCalls + 10)
      },
    }, () => challengeNow)
    await challengeAdapter.getConversation('conversation_fixture_0001')
    await challengeAdapter.validateDraft('draft_fixture_00000001', validationBody, {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'observe_challenge_receipt1',
      ifMatch: '"conversation-state-fixture-0004"',
    })
    await challengeAdapter.createApprovalChallenge(
      'draft_fixture_00000001',
      challengeBody,
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'observe_challenge_expiry1',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    const challengeEpoch = challengeAdapter.view().requestEpoch
    challengeNow = Date.parse('2026-09-07T00:06:00Z')
    const expiredChallenge = await challengeAdapter.approveDraft(
      'draft_fixture_00000001',
      approvalRequest,
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'expired_challenge_approve1',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    return {
      expiredReceipt,
      expiredChallenge,
      receiptCalls,
      challengeCalls,
      receiptEpoch,
      receiptAfterEpoch: receiptAdapter.view().requestEpoch,
      challengeEpoch,
      challengeAfterEpoch: challengeAdapter.view().requestEpoch,
    }

    function response(data: unknown, status: number, sequence: number) {
      return {
        status,
        headers: { ETag: '"conversation-state-fixture-0004"' },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_request_expiry_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_request_expiry_${String(sequence).padStart(3, '0')}`,
            resourceRevision: '4',
          },
          data,
        },
      }
    }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approvalRequest: trace.approvalAuthority.approvalRequest,
    approval,
  })

  expect(result.expiredReceipt).toMatchObject({ status: 'FAILED', code: 'RESOURCE_EXPIRED' })
  expect(result.expiredChallenge).toMatchObject({ status: 'FAILED', code: 'RESOURCE_EXPIRED' })
  expect(result.receiptCalls).toBe(2)
  expect(result.challengeCalls).toBe(3)
  expect(result.receiptAfterEpoch).toBe(result.receiptEpoch)
  expect(result.challengeAfterEpoch).toBe(result.challengeEpoch)
})

test('session reset과 content epoch 변경은 관측한 approval authority를 폐기한다', async ({ page }) => {
  const result = await page.evaluate(async ({ ready, receipt, challenge, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    const readyFive = structuredClone(ready) as Record<string, unknown>
    readyFive.conversationStateRevision = '5'
    readyFive.conversationStateHash = '8'.repeat(64)
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        const path = request.path
        const data = path.endsWith('/validate')
          ? receipt
          : path.endsWith('/approval-challenges')
            ? challenge
            : calls === 4
              ? readyFive
              : ready
        const revision = data === readyFive ? '5' : '4'
        return {
          status: path.endsWith('/approval-challenges') ? 201 : 200,
          headers: { ETag: `"conversation-state-fixture-000${revision}"` },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_authority_reset_${String(calls).padStart(3, '0')}`,
              traceId: `trace_authority_reset_${String(calls).padStart(3, '0')}`,
              resourceRevision: revision,
            },
            data,
          },
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    const validationBody = {
      expectedConversationStateRevision: '4',
      expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
    }
    const challengeBody = {
      ...validationBody,
      validationReceiptId: approvalRequest.validationReceiptId,
      acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
    }
    await adapter.getConversation('conversation_fixture_0001')
    await adapter.validateDraft('draft_fixture_00000001', validationBody, {
      csrfToken: 'csrf_fixture_token_00000001', idempotencyKey: 'authority_reset_validate1', ifMatch: '"conversation-state-fixture-0004"',
    })
    await adapter.createApprovalChallenge('draft_fixture_00000001', challengeBody, {
      csrfToken: 'csrf_fixture_token_00000001', idempotencyKey: 'authority_reset_challenge', ifMatch: '"conversation-state-fixture-0004"',
    })
    await adapter.getConversation('conversation_fixture_0001')
    const advanced = adapter.view().authority!
    const afterContentChange = await adapter.createApprovalChallenge(
      advanced.snapshot.draftId,
      {
        expectedConversationStateRevision: advanced.conversationStateRevision,
        expectedConversationStateHash: advanced.conversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: advanced.snapshot.semanticHash!,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001', idempotencyKey: 'authority_after_content_01', ifMatch: advanced.etag,
      },
    )
    const callsAfterContent = calls
    adapter.startSession()
    await adapter.getConversation('conversation_fixture_0001')
    const reloaded = adapter.view().authority!
    const afterSessionReset = await adapter.createApprovalChallenge(
      reloaded.snapshot.draftId,
      {
        expectedConversationStateRevision: reloaded.conversationStateRevision,
        expectedConversationStateHash: reloaded.conversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: reloaded.snapshot.semanticHash!,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001', idempotencyKey: 'authority_after_session_01', ifMatch: reloaded.etag,
      },
    )
    return { afterContentChange, afterSessionReset, callsAfterContent, calls }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.afterContentChange).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.afterSessionReset).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.callsAfterContent).toBe(4)
  expect(result.calls).toBe(5)
})

test('in-flight mutation 중 local idempotency 거절은 request epoch를 올리거나 정상 응답을 취소하지 않는다', async ({ page }) => {
  const turn = trace.documents.find((document) => document.name === 'turn')?.value
  expect(turn).toBeDefined()
  const result = await page.evaluate(async ({ ready, turn }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    type ResponsePayload = Readonly<{ status: number; headers: Readonly<Record<string, string>>; body: unknown }>
    let calls = 0
    let mutationResolve: ((value: ResponsePayload) => void) | null = null
    let startedResolve: (() => void) | null = null
    const started = new Promise<void>((resolve) => { startedResolve = resolve })
    let invalidDigestStartedResolve: (() => void) | null = null
    let releaseInvalidDigest: (() => void) | null = null
    const invalidDigestStarted = new Promise<void>((resolve) => { invalidDigestStartedResolve = resolve })
    const invalidDigestGate = new Promise<void>((resolve) => { releaseInvalidDigest = resolve })
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (request.method === 'POST') {
          startedResolve?.()
          return new Promise<ResponsePayload>((resolve) => { mutationResolve = resolve })
        }
        return response(ready, '4', 1)
      },
    }, undefined, async (value: string) => {
      if (value.includes('"message":"다른 요청"')) {
        invalidDigestStartedResolve?.()
        await invalidDigestGate
      }
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    })
    await adapter.getConversation('conversation_fixture_0001')
    const authority = adapter.view().authority!
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'inflight_local_reject_001',
      ifMatch: authority.etag,
    }
    const baseBody = {
      clientMessageId: 'client_message_inflight_0001',
      message: '첫 요청',
      expectedConversationStateRevision: authority.conversationStateRevision,
      expectedConversationStateHash: authority.conversationStateHash,
    }
    const pending = adapter.createTurn(authority.conversationId, baseBody, context)
    await started
    const epochBeforeInvalid = adapter.view().requestEpoch
    const invalidPending = adapter.createTurn(authority.conversationId, { ...baseBody, message: '다른 요청' }, context)
    await invalidDigestStarted
    if (releaseInvalidDigest === null) throw new Error('INVALID_DIGEST_GATE_NOT_READY')
    ;(releaseInvalidDigest as () => void)()
    const invalid = await invalidPending
    const epochAfterInvalid = adapter.view().requestEpoch
    if (mutationResolve === null) throw new Error('MUTATION_NOT_STARTED')
    ;(mutationResolve as (value: ResponsePayload) => void)(response(turn, '5', 2))
    const applied = await pending
    return { invalid, applied, epochBeforeInvalid, epochAfterInvalid, calls, view: adapter.view() }

    function response(data: unknown, revision: string, sequence: number): ResponsePayload {
      return {
        status: 200,
        headers: { ETag: `"conversation-state-fixture-000${revision}"` },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: `req_inflight_local_${String(sequence).padStart(3, '0')}`,
            traceId: `trace_inflight_local_${String(sequence).padStart(3, '0')}`,
            resourceRevision: revision,
          },
          data,
        },
      }
    }
  }, { ready: trace.snapshots.ready, turn })

  expect(result.invalid).toMatchObject({ status: 'FAILED', code: 'IDEMPOTENCY_KEY_REUSED_LOCALLY' })
  expect(result.epochAfterInvalid).toBe(result.epochBeforeInvalid)
  expect(result.applied.status).toBe('APPLIED')
  expect(result.view.authority?.conversationStateRevision).toBe('5')
  expect(result.calls).toBe(2)
})

test('approval 응답 손실 뒤 exact request만 재시도하고 성공 후 challenge를 소비한다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approval, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    let now = Date.parse('2026-09-07T00:03:00Z')
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        if (calls === 4) throw new Error('sensitive upstream detail')
        const data = request.path.endsWith('/validate')
          ? receipt
          : request.path.endsWith('/approval-challenges')
            ? challenge
            : request.path.endsWith('/approve')
              ? approval
              : ready
        return response(data, request.path.endsWith('/approval-challenges') || request.path.endsWith('/approve') ? 201 : 200)
      },
    }, () => now)
    const validationBody = {
      expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
      expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
    }
    const challengeBody = {
      ...validationBody,
      validationReceiptId: approvalRequest.validationReceiptId,
      acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
    }
    const context = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'approval_response_loss_0001',
      ifMatch: '"conversation-state-fixture-0004"',
    }
    await adapter.getConversation('conversation_fixture_0001')
    await adapter.validateDraft('draft_fixture_00000001', validationBody, {
      ...context,
      idempotencyKey: 'approval_loss_validation_01',
    })
    await adapter.createApprovalChallenge('draft_fixture_00000001', challengeBody, {
      ...context,
      idempotencyKey: 'approval_loss_challenge_001',
    })
    const lost = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    const epochAfterLoss = adapter.view().requestEpoch
    const otherWhileReserved = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, {
      ...context,
      idempotencyKey: 'approval_loss_other_key_001',
    })
    const epochAfterOther = adapter.view().requestEpoch
    const recovered = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    now = Date.parse('2026-09-07T00:11:00Z')
    const exactConsumedReplay = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, context)
    const otherAfterConsumed = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, {
      ...context,
      idempotencyKey: 'approval_consumed_other_001',
    })
    return {
      lost,
      otherWhileReserved,
      recovered,
      exactConsumedReplay,
      otherAfterConsumed,
      epochAfterLoss,
      epochAfterOther,
      calls,
      view: adapter.view(),
    }

    function response(data: unknown, status: number) {
      const approvalResponse = status === 201 && data === approval
      return {
        status,
        headers: { ETag: '"conversation-state-fixture-0004"' },
        body: {
          meta: {
            apiContractVersion: '0.3.0',
            requestId: approvalResponse ? 'req_approval_replay_0001' : `req_approval_loss_${String(calls).padStart(3, '0')}`,
            traceId: approvalResponse ? 'trace_approval_replay_0001' : `trace_approval_loss_${String(calls).padStart(3, '0')}`,
            resourceRevision: '4',
          },
          data,
        },
      }
    }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approval,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.lost).toMatchObject({ status: 'FAILED', code: 'TRANSPORT_UNAVAILABLE' })
  expect(result.lost.view.lastError).toBe('TRANSPORT_UNAVAILABLE')
  expect(JSON.stringify(result.lost)).not.toContain('sensitive upstream detail')
  expect(result.otherWhileReserved).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.epochAfterOther).toBe(result.epochAfterLoss)
  expect(result.recovered.status).toBe('APPLIED')
  expect(result.exactConsumedReplay.status).toBe('APPLIED')
  expect(result.otherAfterConsumed).toMatchObject({ status: 'FAILED', code: 'RESOURCE_BINDING_INVALID' })
  expect(result.calls).toBe(6)
  expect(result.view.authority?.conversationStateRevision).toBe('4')
})

test('invalid approval generated 입력은 AVAILABLE authority와 idempotency 기록을 오염시키지 않는다', async ({ page }) => {
  const approval = trace.documents.find((document) => document.name === 'approval')?.value
  expect(approval).toBeDefined()
  const result = await page.evaluate(async ({ ready, receipt, challenge, approval, approvalRequest }) => {
    const { createServiceV03Adapter } = await import('/src/internal-poc/service-v03-adapter.ts')
    let calls = 0
    const adapter = createServiceV03Adapter({
      async request(request) {
        calls += 1
        const data = request.path.endsWith('/validate')
          ? receipt
          : request.path.endsWith('/approval-challenges')
            ? challenge
            : request.path.endsWith('/approve')
              ? approval
              : ready
        const status = request.path.endsWith('/approval-challenges') || request.path.endsWith('/approve') ? 201 : 200
        return {
          status,
          headers: { ETag: '"conversation-state-fixture-0004"' },
          body: {
            meta: {
              apiContractVersion: '0.3.0',
              requestId: `req_approval_preflight_${String(calls).padStart(3, '0')}`,
              traceId: `trace_approval_preflight_${String(calls).padStart(3, '0')}`,
              resourceRevision: '4',
            },
            data,
          },
        }
      },
    }, () => Date.parse('2026-09-07T00:03:00Z'))
    await adapter.getConversation('conversation_fixture_0001')
    await adapter.validateDraft(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'approval_preflight_validate1',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    await adapter.createApprovalChallenge(
      'draft_fixture_00000001',
      {
        expectedConversationStateRevision: approvalRequest.expectedConversationStateRevision,
        expectedConversationStateHash: approvalRequest.expectedConversationStateHash,
        validationReceiptId: approvalRequest.validationReceiptId,
        acknowledgedSemanticHash: approvalRequest.acknowledgedSemanticHash,
      },
      {
        csrfToken: 'csrf_fixture_token_00000001',
        idempotencyKey: 'approval_preflight_challenge',
        ifMatch: '"conversation-state-fixture-0004"',
      },
    )
    const correctedContext = {
      csrfToken: 'csrf_fixture_token_00000001',
      idempotencyKey: 'approval_preflight_reuse_001',
      ifMatch: '"conversation-state-fixture-0004"',
    }
    const extraBody = { ...approvalRequest, unexpected: 'must_be_rejected' }
    const invalidExtra = await adapter.approveDraft('draft_fixture_00000001', extraBody, correctedContext)
    const invalidContext = await adapter.approveDraft(
      'draft_fixture_00000001',
      approvalRequest,
      { ...correctedContext, idempotencyKey: 'bad' },
    )
    const afterInvalid = adapter.view()
    const callsAfterInvalid = calls
    const corrected = await adapter.approveDraft('draft_fixture_00000001', approvalRequest, correctedContext)
    return { invalidExtra, invalidContext, afterInvalid, callsAfterInvalid, corrected, calls, view: adapter.view() }
  }, {
    ready: trace.snapshots.ready,
    receipt: trace.approvalAuthority.receipt,
    challenge: trace.approvalAuthority.challenge,
    approval,
    approvalRequest: trace.approvalAuthority.approvalRequest,
  })

  expect(result.invalidExtra).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.invalidContext).toMatchObject({ status: 'FAILED', code: 'CLIENT_INPUT_REJECTED' })
  expect(result.afterInvalid.requestEpoch).toBe(3)
  expect(result.callsAfterInvalid).toBe(3)
  expect(result.corrected.status).toBe('APPLIED')
  expect(result.calls).toBe(4)
  expect(result.view.requestEpoch).toBe(4)
  expect(result.view.lastError).toBeNull()
})
