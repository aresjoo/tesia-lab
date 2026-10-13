import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { expect, test, type Page } from '@playwright/test'

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/internal-poc/fixtures/research-strategy-proposal-valid.json'), 'utf8'))
const native = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/internal-poc/fixtures/native-service-contracts.json'), 'utf8'))
const oldApproval = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/service-v03/recorded-conversation.json'), 'utf8')).documents.find((item: { name: string }) => item.name === 'approval').value
const app = readFileSync(resolve(process.cwd(), 'src/internal-poc/NativeServiceApp.tsx'), 'utf8')
const submitCase = app.slice(app.indexOf("      case 'SUBMIT': {"), app.indexOf('\n    }\n  }\n  // Initial dispatch', app.indexOf("      case 'SUBMIT': {")))
const submitCode = ts.transpile(`async function dispatch() { switch (command.kind) { ${submitCase} } }`, { target: ts.ScriptTarget.ES2022 })
const ownerStart = app.indexOf('  const observeHistoryOwner = async')
const ownerEnd = app.indexOf('  const sourceBacktestCurrent =', ownerStart)
const ownerCode = ts.transpile(app.slice(ownerStart, ownerEnd), { target: ts.ScriptTarget.ES2022 })
const reportingHashCode = ts.transpile(readFileSync(resolve(process.cwd(), 'src/internal-poc/contracts/generated/api-v0.6/validator.ts'), 'utf8').split('class StrictParser')[0], { target: ts.ScriptTarget.ES2022 })

const observeSourceBacktest = async (page: Page, multi = false) => {
  await page.route('**/__source_backtest__', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.goto('/__source_backtest__')
  return page.evaluate(async ({ fixture, native, oldApproval, submitCode, ownerCode, reportingHashCode, multi }) => {
    const runtime = (await import('/@react-refresh')).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const { NativeSourceStrategyBacktestAuthority } = await import('/src/internal-poc/NativeServiceApp.tsx')
    const { NativeResearchStrategyProposalV22Adapter } = await import('/src/internal-poc/native-research-strategy-proposal-v22-adapter.ts')
    const { canonicalApiV22 } = await import('/src/internal-poc/contracts/generated/api-v0.22/index.ts')
    const { createNativeServiceApi } = await import('/src/internal-poc/native-service-api.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    const { createServiceConversationV03Port } = await import('/src/internal-poc/contracts/generated/api-v0.3/sdk.ts')
    const { TesiaApiClient, createSdk, ApiResponseError } = await import('/src/internal-poc/contracts/generated/api-v0.1/index.ts')
    const { createNativeResultPresentationIntent } = await import('/src/internal-poc/native-result-presentation-intent.ts')
    const { reportingProjectionContentHash, reportingReceiptContentHash, reportingEnvelopeContentHash } = new Function(`${reportingHashCode}; return {reportingProjectionContentHash,reportingReceiptContentHash,reportingEnvelopeContentHash}`)()
    const sha = async (value: unknown, prefix = '') => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prefix + canonicalApiV22(value))))].map(value => value.toString(16).padStart(2, '0')).join('')
    const sourceOrigin = { sourceAPI13Locator: { conversationId: 'conversation_source_backtest_api13_0001', turnId: fixture.result.customerSource.turnId },
      customerSource: fixture.result.customerSource, sourceRequestSha256: 'a'.repeat(64) }
    const draftState = { ...fixture.input.draftState, revision: 2, projectionHash: '', projection: { ...fixture.input.draftState.projection, ...fixture.result.tradingCandidate } }
    draftState.projectionHash = await sha({ projection: draftState.projection, serverDefaultsVersion: draftState.serverDefaultsVersion })
    const base = { ...fixture.result.draftBase, draftRevision: '2', conversationStateRevision: '2', conversationStateHash: 'c'.repeat(64), projectionHash: draftState.projectionHash }
    const { metadata: _metadata, provenance: _provenance, ...business } = draftState.projection
    const bound = { proposalId: 'proposal_source_backtest_00001', proposalHash: fixture.result.proposalHash, sourceOrigin,
      reportLocator: fixture.result.report, reportProvenance: fixture.result.reportProvenance,
      sourceMapping: { sourceOriginSha256: await sha(sourceOrigin, 'tesia.api22.source-origin.v1\0'), draftBase: base },
      draftBase: base, draftState, candidateState: 'READY_FOR_VALIDATION', semanticHash: await sha(business),
      proposalProvenanceSha256: await sha(fixture.result.reportProvenance), bindingHash: '' }
    const { bindingHash: _bindingHash, ...material } = bound
    bound.bindingHash = await sha(material, 'tesia.api22.proposal-bound-draft.v1\0')
    const snapshot = { ...base, migrationState: 'NATIVE_V03', draftState, unresolvedCapabilityBlockers: [], candidateState: 'READY_FOR_VALIDATION', semanticHash: bound.semanticHash, nextQuestion: null }
    const approval = { ...oldApproval, strategyVersionId: 'sv_v03_11111111111111111111111111111111', sourceConversationId: base.conversationId,
      sourceDraftId: base.draftId, sourceDraftRevision: base.draftRevision, sourceConversationStateRevision: base.conversationStateRevision,
      sourceConversationStateHash: base.conversationStateHash, sourceProjectionHash: base.projectionHash, semanticHash: bound.semanticHash }
    const report = native.sources[1].fixture.response.data
    report.strategyAuthorityMapping.approvalStrategyVersionId = approval.strategyVersionId
    report.strategyAuthorityMapping.approvalStrategyContentHash = approval.strategyVersionContentHash
    // This remains a synthetic service response, not an issued real replay.
    // v7 excludes the old display-only fixture tag. Preserve financial/source
    // values and bind the contract-required response tag with original hashes.
    report.binding.evidenceClass = 'SOURCE_BOUND_PROJECTION'
    report.nativeEnvelope.projection.evidenceClass = 'SOURCE_BOUND_PROJECTION'
    const projectionHash = await reportingProjectionContentHash(report.nativeEnvelope.projection)
    report.nativeEnvelope.projection.contentHash = projectionHash
    report.nativeEnvelope.projectionContentHash = projectionHash
    report.nativeEnvelope.verificationReceipt.projectionContentHash = projectionHash
    const receiptHash = await reportingReceiptContentHash(report.nativeEnvelope.verificationReceipt)
    report.nativeEnvelope.verificationReceipt.contentHash = receiptHash
    report.nativeEnvelope.verificationReceiptContentHash = receiptHash
    report.nativeEnvelope.contentHash = await reportingEnvelopeContentHash(report.nativeEnvelope)
    report.binding.projectionContentHash = projectionHash
    report.binding.nativeEnvelopeContentHash = report.nativeEnvelope.contentHash
    const queued = { ...native.sources[3].fixture.cases[0].response.data, backtestId: report.binding.backtestId,
      splitGroupId: report.binding.splitGroupId, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash }
    const completed = { ...queued, state: 'COMPLETED', revision: '7', resultAvailable: true, nativeReportBinding: report.binding }
    let observedJob = queued, historyApproval = approval, foreign = false, cas = false, absent = false, duplicate = false, endless = false, notReady = false, poisoned = false
    let multiRows: { approval: typeof approval; job: typeof queued | null }[] | null = null, paginate = false
    const sessionId = 'session_source_backtest_owner_0001', owner = JSON.stringify([sessionId, 'AUTHENTICATED'])
    const view = { owner, researchWorkId: fixture.result.report.documentId, bound, snapshot, etag: '"source_current_v3_etag_0001"' }
    const calls: { method: string; path: string; body?: string; headers: Record<string, string> }[] = []
    const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_source_backtest_0001', traceId: 'trace_source_backtest_0001', resourceRevision: revision })
    const transport = { request: async (request: { method: string; path: string; headers: Record<string, string>; body?: string }) => {
      calls.push({ ...request })
      if (request.path.startsWith('/api/v8/')) return { status: 200, headers: { ETag: '"source_history_etag_0001"', 'cache-control': 'no-store' },
        body: JSON.stringify({ meta: meta('0.8.0', '4'), data: { conversationId: base.conversationId, snapshotRevision: '4', limit: 50,
          rows: multiRows ? paginate ? new URL(request.path, location.origin).searchParams.has('cursor') ? multiRows.slice(1) : multiRows.slice(0, 1) : multiRows
            : absent ? [] : duplicate ? [{ approval: historyApproval, job: observedJob }, { approval: historyApproval, job: observedJob }] : [{ approval: historyApproval, job: observedJob }],
          ...(paginate && !new URL(request.path, location.origin).searchParams.has('cursor') ? { nextCursor: 'cursor_multijob_page_two_0001' }
            : endless ? { nextCursor: 'cursor_source_repeat_000001' } : {}) } }) }
      if (request.path.startsWith('/api/v6/')) return { status: 200, headers: { ETag: '"source_result_etag_0001"', 'cache-control': 'no-store' }, body: JSON.stringify({ ...native.sources[1].fixture.response, data: report }) }
      if (notReady && request.method === 'POST') return { status: 409, headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.7.0', null), error: { code: 'NOT_READY', message: 'Native job request failed.' } }) }
      const returnedJob = request.method === 'GET' ? multiRows?.find(row => row.job && request.path.endsWith('/' + row.job.backtestId))?.job ?? observedJob : observedJob
      return { status: request.method === 'POST' ? 202 : 200, headers: { ETag: '"source_job_etag_0001"', 'cache-control': 'no-store' },
        body: JSON.stringify({ meta: meta('0.7.0', returnedJob.revision), data: returnedJob }) }
    } }
    const nativeApi = createNativeServiceApi(transport)
    const conversations = createServiceConversationV03Port(new TesiaConversationV03Client({ request: async request => {
      calls.push({ ...request })
      return { status: 200, headers: { ETag: view.etag }, body: { meta: meta('0.3.0', snapshot.conversationStateRevision),
        data: cas ? { ...snapshot, conversationStateHash: '0'.repeat(64) } : snapshot } }
    } }))
    const sessionApi = createSdk(new TesiaApiClient({ request: async (path, init) => {
      calls.push({ path, ...init })
      return { status: 200, headers: { ETag: '"source_session_etag_0001"' }, body: { meta: meta('0.1.0', '1'),
        data: { sessionId: foreign ? 'session_foreign_backtest_0001' : sessionId, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } } }
    }, openEventStream: async () => { throw new Error('NO_STREAM') } })).session
    const proposals = new NativeResearchStrategyProposalV22Adapter({ origin: location.origin, fetch: async (url, init) => {
      calls.push({ method: init?.method ?? 'GET', path: new URL(String(url)).pathname, headers: Object.fromEntries(new Headers(init?.headers)) })
      return new Response(JSON.stringify({ apiContractVersion: '0.22.0', data: poisoned ? { ...bound, bindingHash: '0'.repeat(64) } : bound }), { headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' } })
    } })
    const epoch = { current: 1 }, session = { current: { sessionId, sessionState: 'AUTHENTICATED' } }
    const noop = () => undefined
    const observedOwner = new Function('env', `const {epoch,session,clients,ApiResponseError,bindSession,setSessionState,clearViews,setPhase}=env; ${ownerCode}; return observeHistoryOwner`)(
      { epoch, session, clients: { session: sessionApi, setCsrf: noop }, ApiResponseError, bindSession: noop, setSessionState: noop, clearViews: noop, setPhase: noop })
    const authority = new NativeSourceStrategyBacktestAuthority({ owner: observedOwner, conversations, proposals,
      history: async (conversationId, cursor) => (await nativeApi.history.call('listNativeConversationHistoryV8', { conversationId, limit: 50, ...(cursor ? { cursor } : {}) })).data,
      job: async backtestId => (await nativeApi.jobs.call('getNativeBacktestV7', { backtestId })).data })
    const scope = { sessionId, sessionState: 'AUTHENTICATED', conversationId: base.conversationId, draftId: base.draftId, epoch: 1 }
    const presentationIntent = createNativeResultPresentationIntent(() => scope)
    let jobScope: unknown = null, postedJob: unknown = null
    const command = { kind: 'SUBMIT', sessionId, sessionState: 'AUTHENTICATED', conversationId: base.conversationId,
      idempotencyKey: 'source_backtest_original_key_0001', body: { strategyVersionId: approval.strategyVersionId, expectedSemanticHash: approval.semanticHash, profileId: 'INTERNAL_POC_FULL' } }
    const context = { csrfToken: 'csrf_source_current_owner_0001', idempotencyKey: command.idempotencyKey }
    const current = () => session.current?.sessionId === sessionId && epoch.current === 1
    const dispatch = new Function('env', `const {command,proposalActive,conversation,approval,generation,sourceBacktestAuthority,sourceBacktestCurrent,assertCurrent,contextFor,clients,context,NativeSubmitNotReady,complete,presentationIntent,setSourceJobScope,sourceJobBinding,setResultStatus,setJob}=env; ${submitCode}; return dispatch`)(
      { command, proposalActive: view, conversation: null, approval, generation: 1, sourceBacktestAuthority: () => authority,
        sourceBacktestCurrent: current, assertCurrent: () => { if (!current()) throw new Error('SESSION_CHANGED') }, contextFor: () => context,
        clients: { native: nativeApi }, context, NativeSubmitNotReady: class extends Error {}, complete: noop, presentationIntent,
        setSourceJobScope: value => { jobScope = value }, sourceJobBinding: (source, job) => ({ owner: source.owner, bindingHash: source.bound.bindingHash,
          conversationId: source.snapshot.conversationId, draftId: source.snapshot.draftId, strategyVersionId: job.strategyVersionId, semanticHash: job.semanticHash, backtestId: job.backtestId }),
        setResultStatus: noop, setJob: value => { postedJob = value } })
    if (multi) {
      const secondJob = { ...queued, backtestId: 'backtest_same_approval_second_0001', splitGroupId: 'split_same_approval_second_0001',
        createdAt: '2026-09-10T00:00:01Z', updatedAt: '2026-09-10T00:00:01Z' }
      multiRows = [{ approval, job: queued }, { approval, job: secondJob }]; paginate = true
      const confirmed = await authority.confirm(view, approval, current)
      const selectedFirst = await authority.selectJob(view, approval, queued, current)
      const selectedSecond = await authority.selectJob(view, approval, secondJob, current)
      command.idempotencyKey = 'source_backtest_customer_second_key_0001'
      context.idempotencyKey = command.idempotencyKey
      await dispatch()
      paginate = false
      const rejected = []
      for (const kind of ['duplicate-job', 'duplicate-null', 'mixed-null', 'different-approval', 'missing-selected', 'cas', 'foreign']) {
        epoch.current = 1; cas = kind === 'cas'; foreign = kind === 'foreign'
        multiRows = kind === 'duplicate-job' ? [{ approval, job: queued }, { approval, job: queued }]
          : kind === 'duplicate-null' ? [{ approval, job: null }, { approval, job: null }]
            : kind === 'mixed-null' ? [{ approval, job: null }, { approval, job: secondJob }]
              : kind === 'different-approval' ? [{ approval, job: queued }, { approval: { ...approval, issuanceReceiptId: 'issuance_receipt_drift_0001' }, job: secondJob }]
                : [{ approval, job: queued }, { approval, job: secondJob }]
        const before = calls.filter(call => call.method === 'POST').length
        try {
          if (kind === 'missing-selected') await authority.selectJob(view, approval, { ...queued, backtestId: 'backtest_missing_selection_0001' }, current)
          else await dispatch()
          rejected.push('NOT_REJECTED')
        } catch { rejected.push(kind) }
        if (calls.filter(call => call.method === 'POST').length !== before) throw new Error('AMBIGUOUS_HISTORY_POST')
      }
      return { multiEvidence: { confirmedCount: confirmed.rows.length,
        selectedFirst: selectedFirst.job.backtestId, selectedSecond: selectedSecond.job.backtestId,
        firstId: queued.backtestId, secondId: secondJob.backtestId, rejected }, calls }
    }
    presentationIntent.beginSubmission(command.idempotencyKey)
    await dispatch()
    const accepted = postedJob, acceptedScope = jobScope
    const rejected: string[] = []
    for (const kind of ['foreign', 'cas', 'absent', 'duplicate', 'endless', 'poisoned', 'content', 'receipt', 'challenge']) {
      epoch.current = 1
      foreign = kind === 'foreign'; cas = kind === 'cas'; absent = kind === 'absent'; duplicate = kind === 'duplicate'; endless = kind === 'endless'; poisoned = kind === 'poisoned'
      historyApproval = kind === 'content' ? { ...approval, strategyVersionContentHash: '0'.repeat(64) }
        : kind === 'receipt' ? { ...approval, validationReceiptId: 'validation_receipt_foreign_0001' }
          : kind === 'challenge' ? { ...approval, approvalChallengeId: 'approval_challenge_foreign_0001' } : approval
      const before = calls.filter(call => call.method === 'POST').length
      try { await dispatch(); rejected.push('NOT_REJECTED') } catch { rejected.push(kind) }
      if (calls.filter(call => call.method === 'POST').length !== before) throw new Error('UNAUTHORIZED_POST')
    }
    epoch.current = 1; foreign = false; cas = false; absent = false; duplicate = false; endless = false; poisoned = false; historyApproval = approval
    observedJob = completed
    const selected = await authority.selectJob(view, approval, completed, current)
    const replay = presentationIntent.observe(selected.job)
    const loadedReport = await nativeApi.report(selected.job)
    let reportConflict = ''
    try { await nativeApi.report({ ...selected.job, splitGroupId: 'split_foreign_report_0001' }) } catch (error) { reportConflict = error.message }
    let notReadyCode = ''
    notReady = true
    try { await nativeApi.jobs.call('submitNativeBacktestV7', command.body, context) } catch (error) { notReadyCode = error.code }
    return { acceptedState: accepted?.state, matches: NativeSourceStrategyBacktestAuthority.matchesJob(accepted, acceptedScope, view),
      changedSource: NativeSourceStrategyBacktestAuthority.matchesJob(accepted, acceptedScope, { ...view, researchWorkId: 'work_foreign_source_0001', bound: { ...bound, bindingHash: '0'.repeat(64) } }),
      rejected, selectedState: selected.job.state, replayId: replay?.backtestId, replayOnce: replay?.consume(), replayTwice: replay?.consume(),
      loadedReport: loadedReport.binding.backtestId, reportConflict, notReadyCode, calls }
  }, { fixture, native, oldApproval, submitCode, ownerCode, reportingHashCode, multi })
}

test('same-approval multi-job delta accepts actual history semantics and selects only the exact unique backtest ID', async ({ page }) => {
  const evidence = await observeSourceBacktest(page, true)
  expect(evidence.multiEvidence).toMatchObject({ confirmedCount: 2,
    rejected: ['duplicate-job', 'duplicate-null', 'mixed-null', 'different-approval', 'missing-selected', 'cas', 'foreign'] })
  expect(evidence.multiEvidence?.selectedFirst).toBe(evidence.multiEvidence?.firstId)
  expect(evidence.multiEvidence?.selectedSecond).toBe(evidence.multiEvidence?.secondId)
  const posts = evidence.calls.filter(call => call.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0].headers['Idempotency-Key']).toBe('source_backtest_customer_second_key_0001')
  expect(evidence.calls.filter(call => call.path.startsWith('/api/v7/') && call.method === 'GET').map(call => call.path)).toEqual([
    `/api/v7/backtests/${evidence.multiEvidence?.firstId}`, `/api/v7/backtests/${evidence.multiEvidence?.secondId}`,
  ])
  for (const get of evidence.calls.filter(call => call.method === 'GET')) {
    expect(get.body).toBeUndefined()
    expect(get.headers['Idempotency-Key']).toBeUndefined()
    expect(get.headers['X-CSRF-Token']).toBeUndefined()
  }
})

test('source approved strategy delta verifies real SDK authority before API7 and preserves source chat/result/replay fences', async ({ page }) => {
  const evidence = await observeSourceBacktest(page)
  expect(evidence).toMatchObject({ acceptedState: 'QUEUED', matches: true, changedSource: false,
    rejected: ['foreign', 'cas', 'absent', 'duplicate', 'endless', 'poisoned', 'content', 'receipt', 'challenge'],
    selectedState: 'COMPLETED', replayOnce: true, replayTwice: false, reportConflict: 'NATIVE_RESULT_BINDING_CONFLICT', notReadyCode: 'NOT_READY' })
  expect(evidence.replayId).toBe(evidence.loadedReport)
  const firstPost = evidence.calls.find(call => call.method === 'POST')!
  expect(JSON.parse(firstPost.body!)).toEqual({ strategyVersionId: 'sv_v03_11111111111111111111111111111111',
    expectedSemanticHash: JSON.parse(firstPost.body!).expectedSemanticHash, profileId: 'INTERNAL_POC_FULL' })
  expect(firstPost.headers['Idempotency-Key']).toBe('source_backtest_original_key_0001')
  expect(evidence.calls.filter(call => call.method === 'POST')).toHaveLength(2)
  expect(app).toContain('const consultationChat = consultationEnabled && conversation === null')
  expect(app).toContain('const displayMessages = consultationChat ? retainedConsultationMessages ?? consultationState.messages')
  expect(app).toContain('adoptStrategyRead(current.body.data, current.etag, source)')
  expect(app).toContain('strategyJob?.state === \'COMPLETED\' && strategyJob.resultAvailable')
  expect(app).toContain('currentResultStatus?.backtestId === analysisJob.backtestId && currentResultStatus.reportReady')
  expect(app).toContain('automaticPresentation={analysisJob === job ? automaticPresentation : undefined}')
})
