import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/internal-poc/fixtures/research-strategy-proposal-valid.json'), 'utf8'))
// Independently frozen donor Contracts 4db116ea. No adjacent worktree is
// required by a clean checkout, CI or the full migration delivery.
const sdkSha256: Readonly<Record<string, string>> = {
  'types.ts': '50b25b6129bfe8515dbb781da56729c4159c1021a4fa254085710b7b1c7c6ac6',
  'validator.ts': 'fbebebf48f2801c009f2806b6c74bfe47ed33f227263160c610d701e054b0f7b',
  'client.ts': '501766ff3d8d48f8c8f9f2ff7f8de7ef6b492397f6695ea152a5a5c8c7b6934a',
  'index.ts': '6ab7634857b19b499833bd303b4ef4ffd8fc783ae12ba61b676f108603c3cf46',
  'operation-manifest.json': 'b5f696ff5af767d3e44f4bfce323ce5856e6825e21e4c5b5da808a533059d2d9',
  'generation-manifest.json': 'cc6095f6445792437a6fdb64cd1266e95d08a9d5de8ecb032501c75c011c64fe',
  'package.json': 'd878db60c72d58fb1333674b5ce7e590abb3c9a37244b9059ed126fb4ec8ec01',
}
const html = `<!doctype html><html><body><script type="module">
import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
</script></body></html>`

const runOrchestration = async (page: Page, delta = false, alias = false, cold = false, resume = false, lostReply = false) => {
  await page.route('**/__proposal_orchestration__', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.goto('/__proposal_orchestration__')
  return page.evaluate(async ({ fixture, delta, alias, cold, resume, lostReply }) => {
    const { NativeResearchProposalOrchestration, NativeResearchProposalV14ClaimAdapter } = await import('/src/internal-poc/NativeServiceApp.tsx')
    const { NativeConsultationSessionV14Controller } = await import('/src/internal-poc/native-consultation-session-v14-controller.ts')
    const { NativeResearchStrategyProposalV22Adapter } = await import('/src/internal-poc/native-research-strategy-proposal-v22-adapter.ts')
    const { ConsultationV16Adapter } = await import('/src/internal-poc/consultation-v16-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    const { createServiceConversationV03Port } = await import('/src/internal-poc/contracts/generated/api-v0.3/sdk.ts')
    const { canonicalApiV22 } = await import('/src/internal-poc/contracts/generated/api-v0.22/index.ts')
    const calls: { path: string; method: string; headers: Record<string, string>; body?: string; credentials?: RequestCredentials }[] = []
    const source = { conversationId: 'conversation_actual_api13_00001', turnId: fixture.result.customerSource.turnId }
    const sourceOrigin = { sourceAPI13Locator: source, customerSource: fixture.result.customerSource, sourceRequestSha256: 'a'.repeat(64) }
    const proposalId = 'proposal_orchestration_actual_01'
    const pending = { proposalId, state: 'PENDING', executionState: 'QUEUED', sourceOrigin,
      reportLocator: fixture.result.report, draftBase: fixture.result.draftBase }
    const unapproved = { proposalId, state: 'UNAPPROVED', executionState: 'COMPLETED', sourceOrigin, proposal: fixture.result }
    const sha = async (value: unknown, prefix = '') => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prefix + canonicalApiV22(value))))]
      .map(value => value.toString(16).padStart(2, '0')).join('')
    const draftState = { ...fixture.input.draftState, revision: 2, projectionHash: '',
      projection: { ...fixture.input.draftState.projection, ...fixture.result.tradingCandidate } }
    draftState.projectionHash = await sha({ projection: draftState.projection, serverDefaultsVersion: draftState.serverDefaultsVersion })
    const afterBase = { ...fixture.result.draftBase, draftRevision: '2', conversationStateRevision: '2',
      conversationStateHash: 'c'.repeat(64), projectionHash: draftState.projectionHash }
    const { metadata: _metadata, provenance: _provenance, ...business } = draftState.projection
    const bound = { proposalId, proposalHash: fixture.result.proposalHash, sourceOrigin, reportLocator: fixture.result.report,
      reportProvenance: fixture.result.reportProvenance, sourceMapping: { sourceOriginSha256: await sha(sourceOrigin, 'tesia.api22.source-origin.v1\0'), draftBase: afterBase },
      draftBase: afterBase, draftState, candidateState: 'READY_FOR_VALIDATION', semanticHash: await sha(business),
      proposalProvenanceSha256: await sha(fixture.result.reportProvenance), bindingHash: '' }
    const { bindingHash: _bindingHash, ...boundMaterial } = bound
    bound.bindingHash = await sha(boundMaterial, 'tesia.api22.proposal-bound-draft.v1\0')
    const challengeId = 'approval_challenge_actual_00001', receiptId = 'validation_receipt_actual_00001'
    const companion = { proposalId, proposalHash: bound.proposalHash, proposalBoundDraftSha256: bound.bindingHash,
      sourceOriginSha256: bound.sourceMapping.sourceOriginSha256, sourceMappingHash: await sha(bound.sourceMapping),
      reportLocator: bound.reportLocator, proposalProvenanceSha256: bound.proposalProvenanceSha256, draftBase: afterBase,
      semanticHash: bound.semanticHash, fullPolicySha256: await sha(draftState.projection),
      validationReceiptId: receiptId, validationReceiptSha256: '1'.repeat(64), challengeId,
      approvalChallengeSha256: '2'.repeat(64), issuedStrategyVersionId: null, issuedContentHash: null, bindingHash: '' }
    const { bindingHash: _companionHash, ...companionMaterial } = companion
    companion.bindingHash = await sha(companionMaterial, 'tesia.api22.approval-companion.v1\0')
    const snapshot = (base: typeof afterBase, state: typeof draftState, ready: boolean) => ({ ...base,
      migrationState: 'NATIVE_V03', draftState: state, unresolvedCapabilityBlockers: [],
      candidateState: ready ? 'READY_FOR_VALIDATION' : 'INCOMPLETE', semanticHash: ready ? bound.semanticHash : null,
      nextQuestion: ready ? null : { kind: 'CANDIDATE_MISSING_PATH', questionId: 'q_market_symbol', targetPath: '/market/symbol',
        reasonCode: 'MISSING_REQUIRED_FIELD', prompt: 'Synthetic missing path', options: ['Synthetic option one', 'Synthetic option two'] } })
    let projected = pending, listItems: unknown[] = [], applied = false, poisoned = false, casDrift = false, failCreate = false, refuseRead = false, failApply = false, missingRead = false
    const admittedKeys = new Set<string>()
    let syntheticReservations = 0, syntheticDispatches = 0, syntheticObservations = 0, revealPaidResult = false, markerBeforeFirstPost = false, failBeforeAdmission = false
    const origin = location.origin, headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const fetchPort = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input)), method = init?.method ?? 'GET'
      calls.push({ path: url.pathname, method, headers: Object.fromEntries(new Headers(init?.headers)), credentials: init?.credentials, ...(init?.body ? { body: String(init.body) } : {}) })
      if (url.pathname.endsWith('/locator')) return new Response(JSON.stringify({ apiContractVersion: '0.16.0', data: fixture.result.report }), { headers })
      if (url.pathname.endsWith('/applied-draft')) return applied
        ? new Response(JSON.stringify({ apiContractVersion: '0.22.0', data: poisoned ? { ...bound, bindingHash: '0'.repeat(64) } : bound }), { headers })
        : new Response(JSON.stringify({ apiContractVersion: '0.22.0', error: { code: 'PROPOSAL_NOT_READY', message: 'Synthetic adjunct unavailable' } }), { status: 409, headers })
      if (url.pathname.includes('/approval-companions/')) return new Response(JSON.stringify({ apiContractVersion: '0.22.0',
        data: { proposalBoundDraft: bound, approvalCompanion: poisoned ? { ...companion, fullPolicySha256: '0'.repeat(64) } : companion } }), { headers })
      if (url.pathname.endsWith('/apply')) { if (failApply) throw new Error('SYNTHETIC_APPLY_UNCONFIRMED'); applied = true; return new Response(JSON.stringify({ apiContractVersion: '0.22.0', data: bound }), { headers }) }
      if (method === 'POST') {
        if (resume) {
          if (failBeforeAdmission) throw new Error('SYNTHETIC_NOT_ADMITTED')
          const key = new Headers(init?.headers).get('Idempotency-Key')!
          if (!admittedKeys.has(key)) {
            admittedKeys.add(key); syntheticReservations++
            markerBeforeFirstPost = [...storageValues.values()].some(raw => JSON.parse(raw).createAttempted === true)
            listItems = [pending]
          } else if (projected.executionState === 'COMPLETED') {
            syntheticObservations++
            if (revealPaidResult) { projected = unapproved; listItems = [unapproved]; applied = true }
          } else if (projected.executionState === 'QUEUED') syntheticDispatches++
        }
        if (failCreate) throw new Error('SYNTHETIC_LOST_RESPONSE')
        if (!resume) listItems = [pending]
        return new Response(JSON.stringify({ apiContractVersion: '0.22.0', data: pending }), { status: 202, headers })
      }
      if ((refuseRead || missingRead) && url.pathname.endsWith(proposalId)) return new Response(JSON.stringify({ apiContractVersion: '0.22.0',
        error: { code: missingRead ? 'NOT_FOUND' : 'FORBIDDEN', message: 'Synthetic current authority refusal' } }), { status: missingRead ? 404 : 403, headers })
      return new Response(JSON.stringify({ apiContractVersion: '0.22.0', data: url.pathname.endsWith(proposalId)
        ? projected : { items: listItems, nextCursor: null } }), { headers })
    }
    const conversations = createServiceConversationV03Port(new TesiaConversationV03Client({ request: async (request: { path: string; method: string }) => {
      calls.push({ path: request.path, method: request.method, headers: {} })
      return { status: 200, headers: { ETag: applied ? '"actual_after_etag_0001"' : '"actual_before_etag_0001"' }, body: {
        meta: { apiContractVersion: '0.3.0', requestId: 'req_orchestration_000001', traceId: 'trace_orchestration_000001', resourceRevision: applied ? '2' : '1' },
        data: applied ? snapshot(casDrift ? { ...afterBase, conversationStateHash: '0'.repeat(64) } : afterBase, draftState, true)
          : snapshot(casDrift ? { ...fixture.result.draftBase, conversationStateHash: '0'.repeat(64) } : fixture.result.draftBase, fixture.input.draftState, false),
      } }
    } }))
    const storageValues = new Map<string, string>()
    const storage = { getItem: (key: string) => storageValues.get(key) ?? null, setItem: (key: string, value: string) => { storageValues.set(key, value) }, removeItem: (key: string) => { storageValues.delete(key) } }
    const fixtureFailures: string[] = []
    const checkedConversations = { getConversation: async (id: string) => conversations.getConversation(id).catch((error: Error & { code?: string }) => {
      fixtureFailures.push(`v3:${error.code ?? error.message}`); throw error
    }) }
    let ids = 0
    const ports = { proposals: new NativeResearchStrategyProposalV22Adapter({ origin, fetch: fetchPort }),
      documents: new ConsultationV16Adapter({ origin, fetch: fetchPort }), conversations: checkedConversations, storage, randomId: () => `orchestration_key_${++ids}` }
    const orchestrator = new NativeResearchProposalOrchestration(ports)
    const owner = JSON.stringify(['session_actual_owner_000001', 'ANONYMOUS'])
    const input = { owner, sourceOwner: owner, researchWorkId: fixture.result.report.documentId,
      sourceConversationId: source.conversationId, sourceTurnId: source.turnId, reportText: fixture.reportText,
      csrfToken: 'csrf_captured_actual_owner_01', isCurrent: () => true }
    if (resume) {
      const posts = () => calls.filter(call => call.method === 'POST')
      const key = 'tesia.native.consultation-v22.proposal-intent:' + encodeURIComponent(JSON.stringify([
        owner, source.conversationId, source.turnId, input.researchWorkId]))
      const first = await orchestrator.observe(input)
      const originalBytes = storageValues.get(key)!, originalIntent = JSON.parse(originalBytes)
      const originalPost = posts()[0], initialIds = ids
      if (lostReply) {
        const originalNow = Date.now
        let now = originalNow()
        Date.now = () => now // Deterministic clock drives the production cadence guard.
        try {
          const currentInput = { ...input, csrfToken: 'csrf_current_lost_reply_00001' }
          projected = { ...pending, executionState: 'COMPLETED' }; listItems = [projected]
          revealPaidResult = true; failCreate = true
          const acceptedLost = await orchestrator.observe(currentInput)
          const acceptedPoll = NativeResearchProposalOrchestration.shouldObserve(acceptedLost, 0)
          const acceptedStart = posts().length
          const lateComplete = await new NativeResearchProposalOrchestration(ports).observe(currentInput)
          const latePosts = posts().length - acceptedStart
          failCreate = false; revealPaidResult = false; applied = false
          projected = { ...pending, executionState: 'COMPLETED' }; listItems = [projected]
          const resumeKeys = [...storageValues.keys()].filter(storedKey => storedKey.startsWith('tesia.native.consultation-v22.proposal-resume:'))
          for (const storedKey of resumeKeys) storageValues.delete(storedKey)
          failBeforeAdmission = true
          const refusedStart = posts().length
          const refused = await orchestrator.observe(currentInput)
          const refusedPoll = NativeResearchProposalOrchestration.shouldObserve(refused, 0)
          await orchestrator.observe(currentInput)
          now += 3_999
          await new NativeResearchProposalOrchestration(ports).observe(currentInput)
          const earlyPosts = posts().length - refusedStart
          now++
          await Promise.all([new NativeResearchProposalOrchestration(ports).observe(currentInput), new NativeResearchProposalOrchestration(ports).observe(currentInput)])
          const cappedPosts = posts().length - refusedStart
          let observations = 0, lastObserved = refused
          while (NativeResearchProposalOrchestration.shouldObserve(lastObserved, observations++)) {
            now += 4_000
            lastObserved = await new NativeResearchProposalOrchestration(ports).observe(currentInput)
          }
          const capPosts = posts().length - refusedStart
          const attemptMarker = JSON.parse(storageValues.get(resumeKeys[0])!)
          const rejected = []
          for (const executionState of ['DISPATCHING', 'STREAMING', 'AMBIGUOUS', 'FAILED', 'CANCELLED']) {
            projected = { ...pending, executionState }; listItems = [projected]
            const value = await orchestrator.observe(currentInput)
            rejected.push({ state: executionState, poll: NativeResearchProposalOrchestration.shouldObserve(value, 0) })
          }
          projected = { ...pending, executionState: 'COMPLETED' }; listItems = [projected]; failBeforeAdmission = false
          storageValues.set(resumeKeys[0], attemptMarker.transition) // Deployed raw marker means one consumed attempt.
          const legacyStart = posts().length
          await orchestrator.observe(currentInput)
          now += 4_000
          await orchestrator.observe(currentInput)
          const legacyPosts = posts().length - legacyStart
          refuseRead = true
          const foreign = await orchestrator.observe(currentInput)
          refuseRead = false; casDrift = true
          storageValues.set(resumeKeys[0], attemptMarker.transition)
          const casStart = posts().length
          const stale = await orchestrator.observe(currentInput)
          const stalePosts = posts().length - casStart
          casDrift = false
          const { ConsultationV14Adapter } = await import('/src/internal-poc/consultation-v14-adapter.ts')
          const timestamp = '2026-10-13T00:00:00Z', targetOwner = JSON.stringify(['session_current_auth_owner_00001', 'AUTHENTICATED'])
          const sessions = new ConsultationV14Adapter({ origin, csrfToken: () => { throw new Error('COLD_CSRF_USED') }, fetch: async url =>
            new Response(JSON.stringify({ apiContractVersion: '0.14.0', data: { snapshotId: 'snapshot_lost_reply_account_00001',
              offset: 0, limit: Number(new URL(String(url)).searchParams.get('limit')), totalCount: 1, nextCursor: null,
              conversations: [{ conversationId: source.conversationId, createdAt: timestamp, updatedAt: timestamp,
                turnCount: 1, lastTurnId: source.turnId, lastTurnState: 'COMPLETED' }] } }), { headers }) })
          const coldStart = posts().length
          const coldResult = await new NativeResearchProposalOrchestration({ ...ports, sessions }).observe({ ...currentInput,
            owner: targetOwner, csrfToken: '', readOnlyRecovery: true })
          const coldPosts = posts().length - coldStart
          return { lostEvidence: { acceptedHold: acceptedLost.hold, acceptedPoll, lateRevision: lateComplete.view?.snapshot.draftRevision,
            latePosts, refusedHold: refused.hold, refusedPoll, earlyPosts, cappedPosts, capPosts, observations: observations - 1,
            attemptCount: attemptMarker.attempts, rejected, legacyPosts, foreignHold: foreign.hold,
            foreignPoll: NativeResearchProposalOrchestration.shouldObserve(foreign, 0), staleHold: stale.hold,
            stalePoll: NativeResearchProposalOrchestration.shouldObserve(stale, 0), stalePosts, coldHold: coldResult.hold,
            coldPosts, originalPreserved: storageValues.get(key) === originalBytes, newIds: ids - initialIds,
            syntheticReservations, admittedKeys: admittedKeys.size, syntheticDispatches, syntheticObservations,
            originalPost, replayPosts: posts().slice(1) }, calls, fixtureFailures }
        } finally { Date.now = originalNow }
      }
      projected = { ...pending, executionState: 'COMPLETED' }; listItems = [projected]
      const currentInput = { ...input, csrfToken: 'csrf_current_resume_owner_00001' }
      const beforePaid = posts().length
      const paid = orchestrator.observe(currentInput), strictDuplicate = orchestrator.observe(currentInput)
      const paidObservation = await paid
      const paidPosts = posts().slice(beforePaid)
      await new NativeResearchProposalOrchestration(ports).observe(currentInput)
      await orchestrator.observe(currentInput)
      const repeatPaidPosts = posts().length - beforePaid - paidPosts.length
      const originalPreserved = storageValues.get(key) === originalBytes
      const clearTransitions = () => { for (const storedKey of storageValues.keys()) if (storedKey.startsWith('tesia.native.consultation-v22.proposal-resume:')) storageValues.delete(storedKey) }
      clearTransitions()
      const concurrentStart = posts().length
      await Promise.all([new NativeResearchProposalOrchestration(ports).observe(currentInput), new NativeResearchProposalOrchestration(ports).observe(currentInput)])
      const separateMountPosts = posts().length - concurrentStart
      const unsafeStart = posts().length, unsafeHolds = []
      for (const executionState of ['DISPATCHING', 'STREAMING', 'AMBIGUOUS', 'FAILED', 'CANCELLED']) {
        projected = { ...pending, executionState }; listItems = [projected]
        unsafeHolds.push((await orchestrator.observe(currentInput)).hold)
      }
      const unsafePosts = posts().length - unsafeStart
      projected = { ...pending, executionState: 'COMPLETED' }; listItems = [projected]; clearTransitions()
      const absentStart = posts().length, absentIds = ids
      storageValues.delete(key)
      const absent = await new NativeResearchProposalOrchestration(ports).observe(currentInput)
      const absentKeys = ids - absentIds, absentMarker = storageValues.has(key)
      const { createAttempted: _attempted, ...legacy } = originalIntent
      storageValues.set(key, JSON.stringify(legacy))
      const legacyHold = (await new NativeResearchProposalOrchestration(ports).observe(currentInput)).hold
      storageValues.set(key, JSON.stringify({ ...originalIntent, request: { ...originalIntent.request,
        sourceAPI13Locator: { ...source, turnId: 'turn_foreign_resume_origin_00001' } } }))
      const tamperedHold = (await new NativeResearchProposalOrchestration(ports).observe(currentInput)).hold
      storageValues.set(key, originalBytes); casDrift = true
      const staleHold = (await orchestrator.observe(currentInput)).hold
      casDrift = false
      const absentPosts = posts().length - absentStart
      const lostStart = posts().length; failCreate = true
      const lost = await orchestrator.observe(currentInput)
      await new NativeResearchProposalOrchestration(ports).observe(currentInput)
      const lostPosts = posts().length - lostStart
      failCreate = false; clearTransitions()
      const sourceSession = 'session_actual_owner_000001', targetSession = 'session_current_auth_owner_00001'
      const targetOwner = JSON.stringify([targetSession, 'AUTHENTICATED']), claimEpoch = 9
      const originalSource = { version: 2, owner, locatorOwner: owner, conversationId: source.conversationId, turnId: source.turnId,
        pair: 'BTC/USDT', status: 'accepted', value: { answers: {} }, idempotencyKey: 'origin_source_key_000001', completion: {
          completionCommitId: 'source_commit_actual_00001', receiptId: 'source_receipt_actual_00001',
          researchWorkId: input.researchWorkId, sourceSessionId: sourceSession } }
      const aliasSource = { ...originalSource, locatorOwner: targetOwner }
      const claimAdapter = new NativeResearchProposalV14ClaimAdapter({ origin, csrfToken: () => 'csrf_actual_auth_claim_00001',
        fetch: async () => new Response(JSON.stringify({ apiContractVersion: '0.14.0', data: {
          anonymousSessionId: sourceSession, sessionId: targetSession, state: 'AUTHENTICATED', revision: '9', mode: 'COMBINED',
          grantScope: 'CONSULTATION_V13', oldSessionRevoked: true,
          claimedLegacyResourceCounts: { conversations: 1, messages: 0, drafts: 1, patches: 0, validations: 0, idempotencyRecords: 0 },
          claimedConsultationResourceCounts: { conversations: 1, turns: 1, events: 2, idempotencyRecords: 1 },
        } }), { headers }) }, { capture: () => ({ source: originalSource, owner: targetOwner, epoch: claimEpoch, isCurrent: () => true }) })
      const claimController = new NativeConsultationSessionV14Controller(claimAdapter, { storage,
        randomId: () => 'actual_combined_claim_key_00001',
        currentSession: async () => ({ sessionId: targetSession, state: 'AUTHENTICATED', revision: '7' }),
        refreshSession: async () => ({ sessionId: targetSession, state: 'AUTHENTICATED', revision: '9' }),
        restoreConversation: async (id, target, anonymous) => id === source.conversationId && target === targetSession && anonymous === sourceSession,
      })
      claimController.offer({ anonymousSessionId: sourceSession, anonymousIfMatch: '"actual_anonymous_etag_00001"',
        targetSessionId: targetSession, conversationId: source.conversationId })
      const claimCompleted = await claimController.claim()
      const combined = claimAdapter.completed(aliasSource, targetOwner, claimEpoch)!
      const aliasInput = { ...currentInput, owner: targetOwner, csrfToken: 'csrf_current_claimed_resume_00001', combinedClaim: combined, epoch: claimEpoch }
      projected = pending; listItems = [pending]
      const queuedStart = posts().length
      const queued = await orchestrator.observe(aliasInput)
      await new NativeResearchProposalOrchestration(ports).observe(aliasInput)
      const queuedPosts = posts().slice(queuedStart)
      projected = { ...pending, executionState: 'COMPLETED' }; listItems = [projected]
      const claimedPaidStart = posts().length
      await orchestrator.observe(aliasInput)
      await orchestrator.observe(aliasInput)
      const claimedPaidPosts = posts().slice(claimedPaidStart)
      const { ConsultationV14Adapter } = await import('/src/internal-poc/consultation-v14-adapter.ts')
      const timestamp = '2026-10-13T00:00:00Z'
      const accountSessions = new ConsultationV14Adapter({ origin, csrfToken: () => { throw new Error('COLD_CSRF_USED') }, fetch: async (url, init) => {
        calls.push({ path: new URL(String(url)).pathname, method: init?.method ?? 'GET', headers: Object.fromEntries(new Headers(init?.headers)), credentials: init?.credentials })
        return new Response(JSON.stringify({ apiContractVersion: '0.14.0', data: { snapshotId: 'snapshot_current_account_00001',
          offset: 0, limit: Number(new URL(String(url)).searchParams.get('limit')), totalCount: 1, nextCursor: null,
          conversations: [{ conversationId: source.conversationId, createdAt: timestamp, updatedAt: timestamp,
            turnCount: 1, lastTurnId: source.turnId, lastTurnState: 'COMPLETED' }] } }), { headers })
      } })
      const coldStart = posts().length
      const coldObservation = await new NativeResearchProposalOrchestration({ ...ports, sessions: accountSessions }).observe({
        ...aliasInput, combinedClaim: undefined, readOnlyRecovery: true, csrfToken: '' })
      const coldPosts = posts().length - coldStart
      const noProofStart = posts().length
      const noProof = await orchestrator.observe({ ...aliasInput, combinedClaim: undefined })
      const noProofPosts = posts().length - noProofStart
      clearTransitions(); revealPaidResult = true
      const finalStart = posts().length
      const completed = await orchestrator.observe(aliasInput)
      await new NativeResearchProposalOrchestration(ports).observe(aliasInput)
      const finalPosts = posts().slice(finalStart)
      return { resumeEvidence: { firstState: first.projection?.state, createAttempted: originalIntent.createAttempted,
        markerBeforeFirstPost, sameFlight: paid === strictDuplicate, paidState: paidObservation.projection?.state,
        paidPosts, repeatPaidPosts, separateMountPosts, originalPreserved, unsafeHolds, unsafePosts,
        absentHold: absent.hold, absentKeys, absentMarker, legacyHold, tamperedHold, staleHold, absentPosts,
        lostHold: lost.hold, lostPosts, claimCompleted, queuedHold: queued.hold, queuedPosts, claimedPaidPosts,
        coldHold: coldObservation.hold, coldPosts, noProofHold: noProof.hold, noProofPosts,
        finalHold: completed.hold, finalRevision: completed.view?.snapshot.draftRevision, finalPosts,
        newIds: ids - initialIds, originalPost, syntheticReservations, admittedKeys: admittedKeys.size,
        syntheticDispatches, syntheticObservations }, calls, fixtureFailures }
    }
    if (cold) {
      const { ConsultationV14Adapter } = await import('/src/internal-poc/consultation-v14-adapter.ts')
      const { ConsultationV13Adapter } = await import('/src/internal-poc/consultation-v13-adapter.ts')
      const { NativeConsultationV13Controller } = await import('/src/internal-poc/native-consultation-v13-controller.ts')
      const { NativeResearchWorkV20Adapter } = await import('/src/internal-poc/native-research-work-v20-adapter.ts')
      const timestamp = '2026-10-13T00:00:00Z'
      const targetOwner = JSON.stringify(['session_current_auth_owner_00001', 'AUTHENTICATED'])
      const turn = { conversationId: source.conversationId, turnId: source.turnId, clientMessageId: 'client_message_restored_00001',
        userText: fixture.customerText, answerText: 'Synthetic saved source answer', state: 'COMPLETED',
        createdAt: timestamp, updatedAt: timestamp, lastSequence: 2, terminalSequence: 2, cancelRequested: false,
        usage: { status: 'UNKNOWN', inputTokens: null, outputTokens: null }, failureCode: null }
      let accountMissing = false, accountRefused = false
      const coldFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input)), method = init?.method ?? 'GET'
        if (url.pathname.startsWith('/api/v14/') || url.pathname.startsWith('/api/v13/') || url.pathname.startsWith('/api/v20/')) {
          calls.push({ path: url.pathname, method, headers: Object.fromEntries(new Headers(init?.headers)), ...(init?.body ? { body: String(init.body) } : {}) })
          if (url.pathname.startsWith('/api/v14/')) {
            if (accountRefused) return new Response(JSON.stringify({ apiContractVersion: '0.14.0', error: {
              code: 'FORBIDDEN', message: 'Consultation session request failed.' } }), { status: 403, headers })
            return new Response(JSON.stringify({ apiContractVersion: '0.14.0', data: {
              snapshotId: 'snapshot_current_account_00001', offset: 0, limit: Number(url.searchParams.get('limit')),
              totalCount: accountMissing ? 0 : 1, conversations: accountMissing ? [] : [{ conversationId: source.conversationId,
                createdAt: timestamp, updatedAt: timestamp, turnCount: 1, lastTurnId: source.turnId, lastTurnState: 'COMPLETED' }], nextCursor: null,
            } }), { headers })
          }
          if (url.pathname.startsWith('/api/v20/')) return new Response(JSON.stringify({ apiContractVersion: '0.20.0',
            data: { researchWorkId: fixture.result.report.documentId, state: 'COMPLETED', reportText: fixture.reportText } }), { headers })
          return new Response(JSON.stringify({ apiContractVersion: '0.13.0', data: url.pathname.endsWith('/history')
            ? { conversationId: source.conversationId, snapshotId: 'snapshot_restored_history_00001', offset: 0,
              limit: Number(url.searchParams.get('limit')), totalCount: 1, turns: [turn], nextCursor: null } : turn }), { headers })
        }
        return fetchPort(input, init)
      }
      const history = new NativeConsultationV13Controller(new ConsultationV13Adapter({ origin, fetch: coldFetch,
        csrfToken: () => { throw new Error('COLD_READ_CSRF_USED') } }), { storage })
      history.bindOwner(targetOwner)
      const historyRestored = await history.restoreConversation(source.conversationId)
      const report = await new NativeResearchWorkV20Adapter({ origin, fetch: coldFetch }).read(input.researchWorkId)
      projected = unapproved; listItems = [unapproved]; applied = true
      let custodyReads = 0, custodyWrites = 0, freshKeys = 0
      const coldPorts = { ...ports, sessions: new ConsultationV14Adapter({ origin, fetch: coldFetch,
        csrfToken: () => { throw new Error('COLD_READ_CSRF_USED') } }), storage: {
          getItem: () => { custodyReads++; throw new Error('COLD_LOCAL_CUSTODY_USED') },
          setItem: () => { custodyWrites++; throw new Error('COLD_LOCAL_CUSTODY_USED') },
        }, randomId: () => { freshKeys++; throw new Error('COLD_KEY_ALLOCATED') } }
      const coldInput = { ...input, owner: targetOwner, csrfToken: '', readOnlyRecovery: true, reportText: report.reportText,
        // A forged historical hint changes neither current-cookie reads nor
        // the mandatory POST-free recovery mode.
        combinedClaim: { owner: 'untrusted_stored_mode' }, epoch: 999 }
      const restored = await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)
      const rejected = []
      accountMissing = true
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      accountMissing = false; accountRefused = true
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      accountRefused = false; listItems = []
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      listItems = [unapproved, { ...unapproved, proposalId: 'proposal_cold_multiple_match_00001' }]
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      listItems = [unapproved]; refuseRead = true
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      refuseRead = false; missingRead = true
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      missingRead = false
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe({ ...coldInput, sourceTurnId: 'turn_foreign_cold_origin_00001' })).hold)
      applied = false
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      applied = true; casDrift = true
      const changed = await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)
      casDrift = false; poisoned = true
      rejected.push((await new NativeResearchProposalOrchestration(coldPorts).observe(coldInput)).hold)
      poisoned = false
      const badReport = await new NativeResearchProposalOrchestration(coldPorts).observe({ ...coldInput, reportText: fixture.reportText + 'changed' })
      const pausedStart = calls.length
      const pendingClaim = await new NativeResearchProposalOrchestration(coldPorts).observe({ ...coldInput, isCurrent: () => false })
      const pendingCalls = calls.length - pausedStart
      history.detach()
      return { coldEvidence: { historyRestored, historyConversation: history.getSnapshot().conversationId,
        historyMessageCount: history.getSnapshot().messages.length, reportState: report.state, restoredHold: restored.hold,
        restoredRevision: restored.view?.snapshot.draftRevision, restoredOwner: restored.view?.owner,
        originalConversation: restored.view?.bound.sourceOrigin.sourceAPI13Locator.conversationId,
        originalTurn: restored.view?.bound.sourceOrigin.customerSource.turnId, originalCustomerHash: restored.view?.bound.sourceOrigin.customerSource.textSha256,
        sourceOwner: input.sourceOwner, changedHold: changed.hold, rejected, badReportHold: badReport.hold,
        pendingHold: pendingClaim.hold, pendingCalls, custodyReads, custodyWrites, freshKeys }, calls }
    }
    if (alias) {
      const sourceSession = 'session_actual_owner_000001', targetSession = 'session_current_auth_owner_00001'
      const targetOwner = JSON.stringify([targetSession, 'AUTHENTICATED']), claimEpoch = 9
      const original = { version: 2, owner, locatorOwner: owner, conversationId: source.conversationId, turnId: source.turnId,
        pair: 'BTC/USDT', status: 'accepted', value: { answers: {} }, idempotencyKey: 'origin_source_key_000001', completion: {
          completionCommitId: 'source_commit_actual_00001', receiptId: 'source_receipt_actual_00001',
          researchWorkId: input.researchWorkId, sourceSessionId: sourceSession } }
      const aliasSource = { ...original, locatorOwner: targetOwner }
      const claimResponse = (mode: string) => ({ apiContractVersion: '0.14.0', data: {
        anonymousSessionId: sourceSession, sessionId: targetSession, state: 'AUTHENTICATED', revision: '9', mode,
        grantScope: 'CONSULTATION_V13', oldSessionRevoked: true,
        claimedLegacyResourceCounts: { conversations: mode === 'COMBINED' ? 1 : 0, messages: 0,
          drafts: mode === 'COMBINED' ? 1 : 0, patches: 0, validations: 0, idempotencyRecords: 0 },
        claimedConsultationResourceCounts: { conversations: 1, turns: 1, events: 2, idempotencyRecords: 1 },
      } })
      const capturedClaim = (mode = 'COMBINED', current = true) => new NativeResearchProposalV14ClaimAdapter({ origin,
        csrfToken: () => 'csrf_actual_auth_claim_00001', fetch: async () => new Response(JSON.stringify(claimResponse(mode)), { headers }) }, {
        capture: () => ({ source: original, owner: targetOwner, epoch: claimEpoch, isCurrent: () => current }),
      })
      const claimAdapter = capturedClaim()
      const pendingCapture = claimAdapter.completed(aliasSource, targetOwner, claimEpoch)
      const claimController = new NativeConsultationSessionV14Controller(claimAdapter, { storage,
        randomId: () => 'actual_combined_claim_key_00001',
        currentSession: async () => ({ sessionId: targetSession, state: 'AUTHENTICATED', revision: '7' }),
        refreshSession: async () => ({ sessionId: targetSession, state: 'AUTHENTICATED', revision: '9' }),
        restoreConversation: async (conversation, target, anonymous) => conversation === source.conversationId
          && target === targetSession && anonymous === sourceSession,
      })
      claimController.offer({ anonymousSessionId: sourceSession, anonymousIfMatch: '"actual_anonymous_etag_00001"',
        targetSessionId: targetSession, conversationId: source.conversationId })
      const claimCompleted = await claimController.claim()
      const combined = claimCompleted ? claimAdapter.completed(aliasSource, targetOwner, claimEpoch) : null
      const command = { anonymousSessionId: sourceSession, anonymousIfMatch: '"actual_anonymous_etag_00001"', targetSessionId: targetSession,
        targetExpectedRevision: '7', idempotencyKey: 'actual_combined_claim_key_00002' }
      const consultationOnly = capturedClaim('CONSULTATION_ONLY'); await consultationOnly.claim(command)
      const staleCapture = capturedClaim('COMBINED', false); await staleCapture.claim(command)
      const refusedModes = { consultationOnly: consultationOnly.completed(aliasSource, targetOwner, claimEpoch),
        staleCapture: staleCapture.completed(aliasSource, targetOwner, claimEpoch),
        staleEpoch: claimAdapter.completed(aliasSource, targetOwner, claimEpoch + 1),
        wrongTurn: claimAdapter.completed({ ...aliasSource, turnId: 'turn_foreign_origin_00001' }, targetOwner, claimEpoch) }
      const aliasInput = { ...input, owner: targetOwner, csrfToken: 'csrf_current_auth_first_apply_01',
        combinedClaim: combined, epoch: claimEpoch }
      projected = unapproved; listItems = [unapproved]; applied = true
      const posts = () => calls.filter(call => call.method === 'POST')
      const afterStart = posts().length, idsBefore = ids
      const afterApply = await orchestrator.observe(aliasInput)
      const afterPosts = posts().length - afterStart, afterKeys = ids - idsBefore
      const missingProofStart = calls.length
      const missingProof = await orchestrator.observe({ ...aliasInput, combinedClaim: undefined })
      const missingProofCalls = calls.length - missingProofStart
      const rejected = []
      const rejectedStart = posts().length
      listItems = []
      rejected.push((await orchestrator.observe(aliasInput)).hold)
      listItems = [unapproved, { ...unapproved, proposalId: 'proposal_other_same_origin_00001' }]
      rejected.push((await orchestrator.observe(aliasInput)).hold)
      listItems = [{ ...unapproved, sourceOrigin: { ...sourceOrigin,
        sourceAPI13Locator: { ...source, conversationId: 'conversation_foreign_origin_00001' } } }]
      rejected.push((await orchestrator.observe(aliasInput)).hold)
      listItems = [unapproved]; refuseRead = true
      rejected.push((await orchestrator.observe(aliasInput)).hold)
      refuseRead = false; projected = pending
      rejected.push((await orchestrator.observe(aliasInput)).hold)
      projected = unapproved; casDrift = true
      const staleBound = await orchestrator.observe(aliasInput)
      casDrift = false
      const rejectedPosts = posts().length - rejectedStart
      // Anonymous local custody remains byte-identical and never becomes the
      // AUTH principal. Only the exact false marker permits a first AUTH key.
      applied = false
      const prefix = 'tesia.native.consultation-v22.proposal-intent:'
      const originalKey = prefix + encodeURIComponent(JSON.stringify([owner, source.conversationId, source.turnId, input.researchWorkId]))
      const authKey = prefix + encodeURIComponent(JSON.stringify([targetOwner, source.conversationId, source.turnId, input.researchWorkId]))
      const originalBytes = JSON.stringify({ request: { apiContractVersion: '0.22.0', reportLocator: fixture.result.report,
        sourceAPI13Locator: source }, createKey: 'original_create_key_00001', proposalId, applyKey: null, applyAttempted: false })
      storageValues.set(originalKey, originalBytes)
      const beforeStart = posts().length
      const first = orchestrator.observe(aliasInput), concurrent = orchestrator.observe(aliasInput)
      const beforeApply = await first
      const firstPosts = posts().slice(beforeStart), originalPreserved = storageValues.get(originalKey) === originalBytes
      const repeatStart = posts().length
      const recovered = await new NativeResearchProposalOrchestration(ports).observe(aliasInput)
      const repeatPosts = posts().length - repeatStart
      applied = false; storageValues.delete(authKey); failApply = true
      const lostStart = posts().length, lostKeys = ids
      const lost = await orchestrator.observe(aliasInput)
      const lostAgain = await new NativeResearchProposalOrchestration(ports).observe(aliasInput)
      const lostPosts = posts().length - lostStart, lostNewKeys = ids - lostKeys
      return { aliasEvidence: { pendingCapture, claimCompleted, claimModeRevision: combined?.revision, refusedModes,
        afterHold: afterApply.hold, afterOwner: afterApply.view?.owner, afterPosts, afterKeys,
        sourceOwner: original.owner, sourceConversationId: afterApply.view?.bound.sourceOrigin.sourceAPI13Locator.conversationId,
        missingProofHold: missingProof.hold, missingProofCalls, rejected, rejectedPosts, staleBoundHold: staleBound.hold,
        concurrent: first === concurrent, firstRevision: beforeApply.view?.snapshot.draftRevision,
        firstPosts, originalPreserved, recoveredRevision: recovered.view?.snapshot.draftRevision, repeatPosts,
        lostHold: lost.hold, lostAgainHold: lostAgain.hold, lostPosts, lostNewKeys }, calls }
    }
    const first = orchestrator.observe(input), duplicate = orchestrator.observe(input)
    const sameFlight = first === duplicate
    const pendingResult = await first
    projected = unapproved; listItems = [unapproved]
    const completed = await orchestrator.observe(input)
    const reobserved = await orchestrator.observe(input)
    const reload = await new NativeResearchProposalOrchestration(ports).observe(input)
    let deltaEvidence: Record<string, unknown> | null = null
    if (delta && completed.view) {
      const receipt = { ...afterBase, validationReceiptId: receiptId, semanticHash: bound.semanticHash, status: 'VALID' }
      const challenge = { ...afterBase, approvalChallengeId: challengeId, validationReceiptId: receiptId,
        semanticHash: bound.semanticHash, consumptionState: 'AVAILABLE' }
      const reviewInput = { view: completed.view, receipt, challenge, isCurrent: () => true }
      const review = await orchestrator.approvalReview(reviewInput)
      poisoned = true
      const tamperedReview = await orchestrator.approvalReview(reviewInput)
      const tamperedReload = await new NativeResearchProposalOrchestration(ports).observe(input)
      poisoned = false; casDrift = true
      const staleReview = await orchestrator.approvalReview(reviewInput)
      const staleReload = await new NativeResearchProposalOrchestration(ports).observe(input)
      casDrift = false
      const wrongChallenge = await orchestrator.approvalReview({ ...reviewInput, challenge: { ...challenge, approvalChallengeId: 'approval_challenge_foreign_00001' } })
      const foreignStart = calls.length
      const foreign = await orchestrator.observe({ ...input, owner: JSON.stringify(['session_foreign_owner_00001', 'AUTHENTICATED']) })
      const foreignCalls = calls.length - foreignStart
      const ownerChanged = await orchestrator.observe({ ...input, isCurrent: () => false })
      const reportTamperStart = calls.filter(call => call.method === 'POST').length
      const badReport = await orchestrator.observe({ ...input, reportText: fixture.reportText + 'tamper' })
      const badReportPosts = calls.filter(call => call.method === 'POST').length - reportTamperStart
      const aborted = new AbortController(); aborted.abort()
      let abortCode = ''
      try { await ports.proposals.getAppliedDraft(proposalId, { signal: aborted.signal }) } catch (error) { abortCode = String(error.code) }
      let malformedCode = ''
      try { await ports.proposals.getApprovalCompanion(proposalId, challengeId + '\n') } catch (error) { malformedCode = String(error.code) }
      // A genuinely unobserved create remains one POST even on re-observation.
      applied = false; listItems = []; storageValues.clear(); failCreate = true
      const uncertainStart = calls.filter(call => call.method === 'POST').length
      const uncertain = await new NativeResearchProposalOrchestration(ports).observe(input)
      const uncertainAgain = await new NativeResearchProposalOrchestration(ports).observe(input)
      const uncertainPosts = calls.filter(call => call.method === 'POST').length - uncertainStart
      deltaEvidence = { reviewChallenge: review?.challengeId, reviewPolicyHash: review?.fullPolicySha256,
        tamperedReview, tamperedReloadHold: tamperedReload.hold, staleReview, staleReloadHold: staleReload.hold,
        wrongChallenge, foreignHold: foreign.hold, foreignCalls, ownerChangedHold: ownerChanged.hold,
        badReportHold: badReport.hold, badReportPosts, abortCode, malformedCode,
        uncertainHold: uncertain.hold, uncertainAgainHold: uncertainAgain.hold, uncertainPosts }
    }
    return { sameFlight, pendingState: pendingResult.projection.state, completedHold: completed.hold,
      viewBase: completed.view && { conversationId: completed.view.snapshot.conversationId, draftRevision: completed.view.snapshot.draftRevision,
        etag: completed.view.etag, sourceConversationId: completed.view.bound.sourceOrigin.sourceAPI13Locator.conversationId,
        sourceMapping: completed.view.bound.sourceMapping, policy: completed.view.snapshot.draftState.projection.riskLimits },
      reobserved: reobserved.view?.snapshot.draftRevision, reloadHold: reload.hold, reloadRevision: reload.view?.snapshot.draftRevision,
      calls, fixtureFailures, deltaEvidence }
  }, { fixture, delta, alias, cold, resume, lostReply })
}

test('lost-reply proposal delta keeps finite GET observation and recovers only original key with durable two-attempt cadence', async ({ page }) => {
  const observed = await runOrchestration(page, false, false, false, true, true)
  expect(observed.lostEvidence, JSON.stringify(observed.fixtureFailures)).toMatchObject({
    acceptedHold: 'REQUEST_UNCONFIRMED', acceptedPoll: true, lateRevision: '2', latePosts: 0,
    refusedHold: 'REQUEST_UNCONFIRMED', refusedPoll: true, earlyPosts: 1, cappedPosts: 2, capPosts: 2,
    observations: 75, attemptCount: 2, legacyPosts: 1,
    rejected: [{ state: 'DISPATCHING', poll: true }, { state: 'STREAMING', poll: true },
      { state: 'AMBIGUOUS', poll: false }, { state: 'FAILED', poll: false }, { state: 'CANCELLED', poll: false }],
    foreignHold: 'BINDING_CONFLICT', foreignPoll: false, staleHold: 'BINDING_CONFLICT', stalePoll: false,
    stalePosts: 0, coldHold: 'API22_CLAIM_UNAVAILABLE', coldPosts: 0, originalPreserved: true,
    newIds: 0, syntheticReservations: 1, admittedKeys: 1, syntheticDispatches: 0,
  })
  const evidence = observed.lostEvidence!
  for (const post of evidence.replayPosts) {
    expect(post.body).toBe(evidence.originalPost.body)
    expect(post.headers['idempotency-key']).toBe(evidence.originalPost.headers['idempotency-key'])
    expect(post.headers['x-csrf-token']).toBe('csrf_current_lost_reply_00001')
    expect(post.credentials).toBe('include')
  }
  for (const get of observed.calls.filter(call => call.method === 'GET')) {
    expect(get.body).toBeUndefined()
    expect(get.headers['idempotency-key']).toBeUndefined()
    expect(get.headers['x-csrf-token']).toBeUndefined()
  }
  const source = readFileSync(resolve(process.cwd(), 'src/internal-poc/NativeServiceApp.tsx'), 'utf8')
  expect(source).toContain('if (NativeResearchProposalOrchestration.shouldObserve(value, observations++)) timer = setTimeout(() => { void observe() }, 4_000)')
})

test('public proposal resume delta uses proven original POST key once per eligible transition and never resumes uncertain or cold state', async ({ page }) => {
  const observed = await runOrchestration(page, false, false, false, true)
  expect(observed.resumeEvidence, JSON.stringify(observed.fixtureFailures)).toMatchObject({
    firstState: 'PENDING', createAttempted: true, markerBeforeFirstPost: true, sameFlight: true,
    paidState: 'PENDING', repeatPaidPosts: 0, separateMountPosts: 1, originalPreserved: true,
    unsafeHolds: [null, null, 'PROPOSAL_FAILED', 'PROPOSAL_FAILED', 'PROPOSAL_FAILED'], unsafePosts: 0,
    absentHold: 'REQUEST_UNCONFIRMED', absentKeys: 0, absentMarker: false, legacyHold: 'REQUEST_UNCONFIRMED',
    tamperedHold: 'BINDING_CONFLICT', staleHold: 'BINDING_CONFLICT', absentPosts: 0,
    lostHold: 'REQUEST_UNCONFIRMED', lostPosts: 1, claimCompleted: true, queuedHold: null,
    coldHold: 'API22_CLAIM_UNAVAILABLE', coldPosts: 0, noProofHold: 'API22_CLAIM_UNAVAILABLE', noProofPosts: 0,
    finalHold: 'APPROVAL_COMPANION_UNAVAILABLE', finalRevision: '2', newIds: 0,
    syntheticReservations: 1, admittedKeys: 1, syntheticDispatches: 1,
  })
  const evidence = observed.resumeEvidence!
  for (const group of [evidence.paidPosts, evidence.queuedPosts, evidence.claimedPaidPosts, evidence.finalPosts]) {
    expect(group).toHaveLength(1)
    expect(group[0].body).toBe(evidence.originalPost.body)
    expect(group[0].headers['idempotency-key']).toBe(evidence.originalPost.headers['idempotency-key'])
    expect(group[0].headers['if-match']).toBeUndefined()
    expect(group[0].credentials).toBe('include')
  }
  expect(evidence.paidPosts[0].headers['x-csrf-token']).toBe('csrf_current_resume_owner_00001')
  expect(evidence.queuedPosts[0].headers['x-csrf-token']).toBe('csrf_current_claimed_resume_00001')
  for (const get of observed.calls.filter(call => call.method === 'GET')) {
    expect(get.body).toBeUndefined()
    expect(get.headers['idempotency-key']).toBeUndefined()
    expect(get.headers['x-csrf-token']).toBeUndefined()
    expect(get.headers['if-match']).toBeUndefined()
  }
})

test('same-owner API22 orchestration creates/applies once and reads actual v3 CAS without taking over API13 chat', async ({ page }) => {
  const observed = await runOrchestration(page)
  expect(observed.sameFlight).toBe(true)
  expect(observed.pendingState).toBe('PENDING')
  expect(observed.completedHold, JSON.stringify({ fixtureFailures: observed.fixtureFailures, routes: observed.calls.map(call => [call.method, call.path]) })).toBe('APPROVAL_COMPANION_UNAVAILABLE')
  expect(observed.viewBase).toMatchObject({ conversationId: fixture.result.draftBase.conversationId,
    draftRevision: '2', etag: '"actual_after_etag_0001"', sourceConversationId: 'conversation_actual_api13_00001',
    policy: fixture.input.draftState.projection.riskLimits })
  expect(observed.reobserved).toBe('2')
  expect(observed.reloadHold).toBe('APPROVAL_COMPANION_UNAVAILABLE')
  const posts = observed.calls.filter(call => call.method === 'POST')
  expect(posts).toHaveLength(2)
  expect(posts[0].headers['x-csrf-token']).toBe('csrf_captured_actual_owner_01')
  expect(JSON.parse(posts[0].body!)).toMatchObject({ sourceAPI13Locator: { conversationId: 'conversation_actual_api13_00001' }, reportLocator: fixture.result.report })
  expect(posts[1].headers['if-match']).toBe('"actual_before_etag_0001"')
  expect(observed.calls.filter(call => call.path.startsWith('/api/v3/'))).toHaveLength(4)
  for (const get of observed.calls.filter(call => call.method === 'GET')) {
    expect(get.body).toBeUndefined()
    expect(get.headers['idempotency-key']).toBeUndefined()
  }
  const source = readFileSync(resolve(process.cwd(), 'src/internal-poc/NativeServiceApp.tsx'), 'utf8')
  expect(source).toContain('const consultationChat = consultationEnabled && conversation === null')
  expect(source).toContain('const displayMessages = consultationChat ? retainedConsultationMessages ?? consultationState.messages')
  expect(source).toContain('proposalActive?.researchWorkId ?? JSON.stringify')
  expect(source).toContain('strategyDocument={sourceResearchPresentation && !proposalActive ? undefined : strategyDocument}')
  expect(source).toContain('projection: snapshot, proposalBoundDraft: proposalActive.bound')
})

test('API22 getters delta restores only server-hashed adjunct and rejects stale/tampered/foreign approval evidence', async ({ page }) => {
  const observed = await runOrchestration(page, true)
  expect(observed.reloadRevision).toBe('2')
  expect(observed.deltaEvidence, JSON.stringify(observed.fixtureFailures)).toMatchObject({
    reviewChallenge: 'approval_challenge_actual_00001', tamperedReview: null,
    tamperedReloadHold: 'APPLIED_SNAPSHOT_RELOAD_UNAVAILABLE', staleReview: null, staleReloadHold: 'BINDING_CONFLICT',
    wrongChallenge: null, foreignHold: 'API22_CLAIM_UNAVAILABLE', foreignCalls: 0,
    ownerChangedHold: 'REQUEST_UNCONFIRMED', badReportHold: 'BINDING_CONFLICT', badReportPosts: 0,
    abortCode: 'ABORTED', malformedCode: 'INVALID_REQUEST', uncertainHold: 'REQUEST_UNCONFIRMED',
    uncertainAgainHold: 'REQUEST_UNCONFIRMED', uncertainPosts: 1,
  })
  expect(String(observed.deltaEvidence?.reviewPolicyHash)).toMatch(/^[0-9a-f]{64}$/)
  for (const get of observed.calls.filter(call => call.method === 'GET')) {
    expect(get.body).toBeUndefined()
    expect(get.headers['idempotency-key']).toBeUndefined()
    expect(get.headers['x-csrf-token']).toBeUndefined()
    expect(get.headers['if-match']).toBeUndefined()
  }
  for (const name of ['types.ts', 'validator.ts', 'client.ts', 'index.ts', 'operation-manifest.json', 'generation-manifest.json', 'package.json']) {
    expect(createHash('sha256').update(readFileSync(resolve(process.cwd(), 'src/internal-poc/contracts/generated/api-v0.22', name))).digest('hex'))
      .toBe(sdkSha256[name])
  }
})

test('source binding transition retires prior review/receipt/challenge only when its observed draft changes', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/internal-poc/NativeServiceApp.tsx'), 'utf8')
  const start = source.indexOf('        if (proposalViewRef.current?.bound.bindingHash !== value.view?.bound.bindingHash) {')
  const finish = source.indexOf('\n        if (value.hold &&', start)
  expect(start).toBeGreaterThan(0)
  expect(finish).toBeGreaterThan(start)
  // Execute the exact local state-transition block, not a duplicate oracle.
  const transition = new Function('proposalViewRef', 'value', 'setProposalReview', 'setReceipt', 'setChallenge',
    'setAcknowledged', 'setProposalView', 'setProposalHold', source.slice(start, finish))
  const previous = { bound: { bindingHash: 'old_server_binding' } }
  const current = { bound: { bindingHash: 'new_server_binding' } }
  const calls: [string, unknown][] = []
  const setter = (name: string) => (value: unknown) => { calls.push([name, value]) }
  const run = (prior: typeof previous | null, next: typeof previous | null) => {
    calls.length = 0
    const reference = { current: prior }
    transition(reference, { view: next, hold: 'APPROVAL_COMPANION_UNAVAILABLE' }, setter('review'), setter('receipt'),
      setter('challenge'), setter('acknowledged'), setter('view'), setter('hold'))
    expect(reference.current).toBe(next)
    return [...calls]
  }
  expect(run(previous, current)).toEqual([['review', null], ['receipt', null], ['challenge', null], ['acknowledged', false],
    ['view', current], ['hold', 'APPROVAL_COMPANION_UNAVAILABLE']])
  expect(run(current, current)).toEqual([['view', current], ['hold', 'APPROVAL_COMPANION_UNAVAILABLE']])
  expect(run(null, null)).toEqual([['view', null], ['hold', 'APPROVAL_COMPANION_UNAVAILABLE']])
})

test('API14 typed COMBINED alias enables current AUTH reads and only one unattempted first draft apply', async ({ page }) => {
  const observed = await runOrchestration(page, false, true)
  expect(observed.aliasEvidence).toMatchObject({ pendingCapture: null, claimCompleted: true, claimModeRevision: '9',
    refusedModes: { consultationOnly: null, staleCapture: null, staleEpoch: null, wrongTurn: null },
    afterHold: 'APPROVAL_COMPANION_UNAVAILABLE', afterOwner: JSON.stringify(['session_current_auth_owner_00001', 'AUTHENTICATED']),
    afterPosts: 0, afterKeys: 0, sourceOwner: JSON.stringify(['session_actual_owner_000001', 'ANONYMOUS']),
    sourceConversationId: 'conversation_actual_api13_00001', missingProofHold: 'API22_CLAIM_UNAVAILABLE', missingProofCalls: 0,
    rejected: Array(5).fill('API22_CLAIM_UNAVAILABLE'), rejectedPosts: 0, staleBoundHold: 'BINDING_CONFLICT',
    concurrent: true, firstRevision: '2', originalPreserved: true, recoveredRevision: '2', repeatPosts: 0,
    lostHold: 'API22_CLAIM_UNAVAILABLE', lostAgainHold: 'API22_CLAIM_UNAVAILABLE', lostPosts: 1, lostNewKeys: 1,
  })
  expect(observed.aliasEvidence.firstPosts).toHaveLength(1)
  expect(observed.aliasEvidence.firstPosts[0]).toMatchObject({
    method: 'POST', path: '/api/v22/consultation/research-strategy-proposals/proposal_orchestration_actual_01/apply',
    headers: { 'x-csrf-token': 'csrf_current_auth_first_apply_01', 'if-match': '"actual_before_etag_0001"' },
  })
  expect(observed.calls.filter(call => call.method === 'POST' && !call.path.endsWith('/apply'))).toEqual([])
  for (const get of observed.calls.filter(call => call.method === 'GET')) {
    expect(get.body).toBeUndefined()
    expect(get.headers['x-csrf-token']).toBeUndefined()
    expect(get.headers['idempotency-key']).toBeUndefined()
    expect(get.headers['if-match']).toBeUndefined()
  }
})

test('cold AUTH history and applied-plan recovery uses actual SDK GET authority without historical mode or POST', async ({ page }) => {
  const observed = await runOrchestration(page, false, false, true)
  expect(observed.coldEvidence).toMatchObject({ historyRestored: true, historyConversation: 'conversation_actual_api13_00001',
    historyMessageCount: 2, reportState: 'COMPLETED', restoredHold: 'APPROVAL_COMPANION_UNAVAILABLE', restoredRevision: '2',
    restoredOwner: JSON.stringify(['session_current_auth_owner_00001', 'AUTHENTICATED']),
    sourceOwner: JSON.stringify(['session_actual_owner_000001', 'ANONYMOUS']), originalConversation: 'conversation_actual_api13_00001',
    originalTurn: fixture.result.customerSource.turnId, originalCustomerHash: fixture.result.customerSource.textSha256,
    changedHold: 'BINDING_CONFLICT', rejected: Array(9).fill('API22_CLAIM_UNAVAILABLE'), badReportHold: 'BINDING_CONFLICT',
    pendingHold: 'API22_CLAIM_UNAVAILABLE', pendingCalls: 0, custodyReads: 0, custodyWrites: 0, freshKeys: 0 })
  expect(observed.calls.every(call => call.method === 'GET')).toBe(true)
  expect(observed.calls.some(call => call.path.startsWith('/api/v14/'))).toBe(true)
  expect(observed.calls.some(call => call.path.startsWith('/api/v13/'))).toBe(true)
  expect(observed.calls.some(call => call.path.startsWith('/api/v20/'))).toBe(true)
  expect(observed.calls.some(call => call.path.endsWith('/applied-draft'))).toBe(true)
  expect(observed.calls.some(call => call.path.startsWith('/api/v3/'))).toBe(true)
  for (const get of observed.calls) {
    expect(get.body).toBeUndefined()
    expect(get.headers['x-csrf-token']).toBeUndefined()
    expect(get.headers['idempotency-key']).toBeUndefined()
    expect(get.headers['if-match']).toBeUndefined()
  }
})
