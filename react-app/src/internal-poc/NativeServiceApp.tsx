import {useCandidateCopyExecution,type CandidateCopyInput} from '../copy-execution/use-copy-execution'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { nativeAppNotice, nativeAppUiText } from './native-app-ui-copy'
import { nativeShellText } from './native-shell-copy'
import { useExchangeConnectionPresentation, useBitgetCanaryPresentation } from '../exchange-connect/use-exchange-connection'
import { readExchangeTransactionLocator } from '../exchange-connect/controller'
import { readGateBrokerTransactionLocator, useGateBrokerConnection, type GateBrokerAuthorizationPort } from '../exchange-connect/use-gate-broker-connection'
import { accountPresentationBound } from './native-account-presentation'
import { closeClientSettingsRoute } from '../use-client-settings-route'
import { nativeJobText, type NativeJobTextKey } from './native-job-copy'
import { nativeExecutionUiText } from './native-execution-ui-copy'
import { nativeWorkflowText, nativeWorkflowLeverage, type NativeWorkflowTextKey } from './native-workflow-copy'
import { describeCondition, formatFractionPercent } from './native-strategy-readable'
import { nativeStrategyText } from './native-strategy-copy'
import { ClientServiceExperience, type ClientConnectionPlanAuthRequest, type ClientConnectionPlanContinuationReceipt, type ClientServiceMessage, type ClientServiceSourceIntake } from './ClientServiceExperience'
import { planExchanges, type ConnectionPlanLocation } from '../client-connection-plan'
import { captureTurnObservation, captureValidationObservation } from './native-research-observations'
import { observedResearchEntries } from './native-research-projection'
import { nativeObservationCopy, nativeObservationNavigationErrors, type ObservationNavigationError } from './native-observation-copy'
import type { InternalPocPresentation } from './InternalPocApp'
import { NativeServiceResult, type NativeServiceResultStatus } from './NativeServiceResult'
import { NativeStrategyDocument } from './NativeStrategyDocument'
import { rowEditScope, useNativeRowEdits } from './native-row-edits'
import { NativeJobActivity } from './NativeJobActivity'
import { startNativeJobPolling } from './native-job-polling'
import { NativeHistoryList } from './NativeHistoryList'
import { describeNativeJob } from './native-job-presentation'
import { NativeServiceTransport, createNativeServiceApi, type NativeJob } from './native-service-api'
import { SameOriginApiTransport, readApiAdapterConfig } from './api-adapter'
import { ConsultationV13Adapter } from './consultation-v13-adapter'
import { NativeConsultationV13Controller, type ConsultationV13Snapshot, type NativeConsultationSetupCandidate } from './native-consultation-v13-controller'
import { ConsultationV16Adapter } from './consultation-v16-adapter'
import { ApiV16Error } from './contracts/generated/api-v0.16/index'
import { NativeSourceIntakeV19Adapter, NativeSourceIntakeV19Error } from './native-source-intake-v19-adapter'
import { ApiV20Error, NativeResearchWorkV20Adapter, type ResearchWorkProjection } from './native-research-work-v20-adapter'
import { ApiV22Error, NativeResearchStrategyProposalV22Adapter, type DraftBase, type ProposalBoundDraft, type ProposalProjection, type CreateRequest, type ApprovalCompanion } from './native-research-strategy-proposal-v22-adapter'
import { canonicalApiV22 } from './contracts/generated/api-v0.22/index'
import type { ServiceConversationV03Port } from './contracts/generated/api-v0.3/sdk'
import { pickSourceIntake, readSourceIntake, type SourceIntake } from '../client-source-intake'
import { nativeInvestmentQuestionUserText } from './native-investment-display'
import { ConsultationV14Adapter, type ConsultationV14ClaimCommand } from './consultation-v14-adapter'
import { NativeConsultationSessionV14Controller } from './native-consultation-session-v14-controller'
import { createBrowserSessionBootstrap } from './browser-session'
import { ApiResponseError, TesiaApiClient, createSdk } from './contracts/generated/api-v0.1/index'
import { TesiaConversationV03Client } from './contracts/generated/api-v0.3/client'
import { createServiceConversationV03Port } from './contracts/generated/api-v0.3/sdk'
import { createServiceV03HttpTransport } from './service-v03-http-adapter'
import type { ConversationSnapshot, DraftValidationReceipt, ApprovalChallenge, StrategyApproval } from './contracts/generated/api-v0.3/types'
import type { Operations as HistoryOperations } from './contracts/generated/api-v0.8/types'
import { ApiV07Error } from './contracts/generated/api-v0.7/client'
import { NATIVE_JOURNAL_KEY, NATIVE_LOGOUT_KEY, clearNativeJournal, readNativeJournal, writeNativeJournal, readNativeLogout, writeNativeLogout, detachNativeJournalAfterLogout, type NativeLogoutCommand, type NativeMutationCommand } from './native-mutation-journal'
import { forgetNativeEmailLocator, hasStoredNativeEmailIntent, type NativeEmailAuthenticated } from './native-email-auth'
import { NativeLoginPanel } from './NativeLoginPanel'
import { NativePaperPanel } from './NativePaperPanel'
import { NativeStructuralSmokePanel } from './NativeStructuralSmokePanel'
import type { StructuralSmokeBinding } from './native-structural-smoke'
import type { NativePaperStorageScope } from './local-paper-api-adapter'
import type { NativeAuthenticated, NativeSessionRecovery } from './native-browser-auth'
import { changeConversationLocators, readPreviousConversation, type PreviousConversation } from './native-previous-conversation'
import './native-strategy-workflow.css'
import { NativeAuthSurface } from './NativeAuthSurface'
import { RESEARCH_DOCUMENT_SURFACES, type NativeResearchThreadOrigin } from './native-research-workspace-model'
import { createNativeResultPresentationIntent, type NativeResultPresentationRequest } from './native-result-presentation-intent'
import { createNativeReplayReaderScope, type NativeReplayReaderFactory } from './native-replay-reader-scope'

type History = HistoryOperations['listNativeConversationHistoryV8']['response']['data']
type HistoryOwner = { sessionId: string; revision: string; etag: string; conversationId: string }
type DocumentOwner = { sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED'; conversationId: string; draftId: string }
type SourceJobScope = { owner: string; conversationId: string; draftId: string; bindingHash: string;
  strategyVersionId: string; semanticHash: string; backtestId: string }
type HistoryNavigation = { cursors: (string | undefined)[]; index: number; offset: number }
type NativeAuthIntent = 'login' | 'signup'
type NativeConnectionPlanLoginIntent = ClientConnectionPlanAuthRequest & { sourceEtag: string; sourceEpoch: number; panelGeneration: number }
type NativeLoginBinding = { sessionId: string; epoch: number; generation: number; intent: NativeAuthIntent; connectionPlan?: NativeConnectionPlanLoginIntent }
const MAX_HISTORY_CURSORS = 100
type SessionOffer = { sessionId: string; csrfToken: string; claimIntent?: NativeAuthenticated['claimIntent'] }
const STORAGE_KEY = 'tesia.native.conversation'
const CONVERSATION_OWNER_KEY = 'tesia.native.conversation-session'
const SESSION_KEY = 'tesia.native.session-binding'
const CONSULTATION_LOGIN_KEY = 'tesia.native.consultation-login-intent'
const SOURCE_INTAKE_KEY = 'tesia.native.consultation-v19.source-intake:'
const PROPOSAL_INTENT_KEY = 'tesia.native.consultation-v22.proposal-intent:'
const PROPOSAL_RESUME_KEY = 'tesia.native.consultation-v22.proposal-resume:'
type ProposalCreateIntent = { request: CreateRequest; createKey: string; proposalId: string | null;
  applyKey: string | null; applyAttempted: boolean; createAttempted?: true }
const proposalIntentKeys = (value: ProposalCreateIntent) => ['applyAttempted,applyKey,createKey,proposalId,request',
  'applyAttempted,applyKey,createAttempted,createKey,proposalId,request'].includes(Object.keys(value).sort().join(','))
type ProposalHold = 'APPROVAL_COMPANION_UNAVAILABLE' | 'API22_CLAIM_UNAVAILABLE' | 'REQUEST_UNCONFIRMED'
  | 'APPLIED_SNAPSHOT_RELOAD_UNAVAILABLE' | 'BINDING_CONFLICT' | 'PROPOSAL_FAILED'
type ProposalView = Readonly<{ owner: string; researchWorkId: string; bound: ProposalBoundDraft; snapshot: ConversationSnapshot; etag: string }>
type ProposalObservation = Readonly<{ projection: ProposalProjection | null; view: ProposalView | null; hold: ProposalHold | null }>
type ProposalCombinedClaim = Readonly<{ sourceOwner: string; owner: string; conversationId: string; turnId: string;
  researchWorkId: string; sourceSessionId: string; targetSessionId: string; revision: string; epoch: number }>

/** Captures only the original SDK-validated COMBINED response. History restore
 * must still finish before the App can expose this tuple to read-only recovery. */
export class NativeResearchProposalV14ClaimAdapter extends ConsultationV14Adapter {
  private observed: ProposalCombinedClaim | null = null
  constructor(options: ConstructorParameters<typeof ConsultationV14Adapter>[0], private readonly context: Readonly<{
    capture: () => { source: NativeSourceIntakeState | null; owner: string; epoch: number; isCurrent: () => boolean }
  }>) { super(options) }

  override async claim(command: ConsultationV14ClaimCommand, signal?: AbortSignal) {
    const captured = this.context.capture(), source = captured.source
    this.observed = null
    const response = await super.claim(command, signal)
    if (captured.isCurrent() && !signal?.aborted && source?.status === 'accepted' && source.completion
      && response.data.mode === 'COMBINED' && response.data.claimedLegacyResourceCounts.drafts >= 1
      && source.owner === JSON.stringify([command.anonymousSessionId, 'ANONYMOUS'])
      && captured.owner === JSON.stringify([command.targetSessionId, 'AUTHENTICATED'])
      && source.completion.sourceSessionId === command.anonymousSessionId) {
      this.observed = Object.freeze({ sourceOwner: source.owner, owner: captured.owner, conversationId: source.conversationId,
        turnId: source.turnId, researchWorkId: source.completion.researchWorkId, sourceSessionId: response.data.anonymousSessionId,
        targetSessionId: response.data.sessionId, revision: response.data.revision, epoch: captured.epoch })
    }
    return response
  }

  completed(source: NativeSourceIntakeState | null, owner: string, epoch: number): ProposalCombinedClaim | null {
    const observed = this.observed
    if (!source || source.status !== 'accepted' || !source.completion || !observed || observed.epoch !== epoch
      || observed.owner !== owner || source.locatorOwner !== owner || source.owner !== observed.sourceOwner
      || source.conversationId !== observed.conversationId || source.turnId !== observed.turnId
      || source.completion.researchWorkId !== observed.researchWorkId || source.completion.sourceSessionId !== observed.sourceSessionId) return null
    return observed
  }
}
const proposalBase = (snapshot: ConversationSnapshot): DraftBase => ({ conversationId: snapshot.conversationId,
  draftId: snapshot.draftId, conversationStateRevision: snapshot.conversationStateRevision,
  conversationStateHash: snapshot.conversationStateHash, draftRevision: snapshot.draftRevision, projectionHash: snapshot.projectionHash })
const sameProposalBase = (left: DraftBase, right: DraftBase) => canonicalApiV22(left) === canonicalApiV22(right)

/** Only this source-bound lifecycle owns automatic draft construction. Local
 * intents prevent redispatch; they never prove source, owner or server state. */
export class NativeResearchProposalOrchestration {
  private readonly flights = new Map<string, Promise<ProposalObservation>>()
  static shouldObserve(value: ProposalObservation, observations: number): boolean {
    return observations < 75 && (value.hold === null || value.hold === 'REQUEST_UNCONFIRMED')
      && (value.projection === null || value.projection.state === 'PENDING'
        && !['FAILED', 'CANCELLED', 'AMBIGUOUS'].includes(value.projection.executionState ?? ''))
  }
  constructor(private readonly ports: Readonly<{
    proposals: Pick<NativeResearchStrategyProposalV22Adapter, 'create' | 'read' | 'list' | 'apply' | 'getAppliedDraft' | 'getApprovalCompanion'>
    documents: Pick<ConsultationV16Adapter, 'locator'>
    conversations: Pick<ServiceConversationV03Port, 'getConversation'>
    sessions?: Pick<ConsultationV14Adapter, 'list'>
    storage: Pick<Storage, 'getItem' | 'setItem'>
    randomId: () => string
  }>) {}

  async approvalReview(input: Readonly<{ view: ProposalView; receipt: DraftValidationReceipt; challenge: ApprovalChallenge;
    isCurrent: () => boolean; signal?: AbortSignal }>): Promise<ApprovalCompanion | null> {
    try {
      const { view, receipt, challenge } = input
      if (!input.isCurrent() || input.signal?.aborted || receipt.semanticHash !== view.snapshot.semanticHash
        || challenge.semanticHash !== receipt.semanticHash || challenge.validationReceiptId !== receipt.validationReceiptId
        || !sameProposalBase(proposalBase(view.snapshot), { conversationId: challenge.conversationId, draftId: challenge.draftId,
          conversationStateRevision: challenge.conversationStateRevision, conversationStateHash: challenge.conversationStateHash,
          draftRevision: challenge.draftRevision, projectionHash: challenge.projectionHash })) return null
      const observed = await this.ports.proposals.getApprovalCompanion(view.bound.proposalId, challenge.approvalChallengeId, { signal: input.signal })
      if (!input.isCurrent() || input.signal?.aborted || canonicalApiV22(observed.proposalBoundDraft) !== canonicalApiV22(view.bound)
        || observed.approvalCompanion.validationReceiptId !== receipt.validationReceiptId
        || observed.approvalCompanion.challengeId !== challenge.approvalChallengeId
        || observed.approvalCompanion.semanticHash !== receipt.semanticHash
        || observed.approvalCompanion.issuedStrategyVersionId !== null || observed.approvalCompanion.issuedContentHash !== null) return null
      const current = await this.ports.conversations.getConversation(view.snapshot.conversationId)
      if (!input.isCurrent() || input.signal?.aborted || current.etag !== view.etag
        || !sameProposalBase(proposalBase(current.body.data), view.bound.draftBase)) return null
      return observed.approvalCompanion
    } catch { return null }
  }

  observe(input: Readonly<{ owner: string; sourceOwner: string; researchWorkId: string;
    sourceConversationId: string; sourceTurnId: string; reportText: string; csrfToken: string;
    isCurrent: () => boolean; signal?: AbortSignal; combinedClaim?: ProposalCombinedClaim; epoch?: number;
    readOnlyRecovery?: boolean }>): Promise<ProposalObservation> {
    const key = JSON.stringify([input.owner, input.sourceConversationId, input.sourceTurnId, input.researchWorkId])
    const flightKey = input.readOnlyRecovery ? `${key}:read-only` : key
    const active = this.flights.get(flightKey)
    if (active) return active
    const operation = this.observeSource(input, key).finally(() => { if (this.flights.get(flightKey) === operation) this.flights.delete(flightKey) })
    this.flights.set(flightKey, operation)
    return operation
  }

  private async observeSource(input: Parameters<NativeResearchProposalOrchestration['observe']>[0], key: string): Promise<ProposalObservation> {
    let projection: ProposalProjection | null = null
    const result = (hold: ProposalHold | null, view: ProposalView | null = null): ProposalObservation => ({ projection, view, hold })
    const current = () => { if (!input.isCurrent() || input.signal?.aborted) throw new Error('SESSION_CHANGED') }
    const claimed = input.owner !== input.sourceOwner, claim = input.combinedClaim, readOnly = input.readOnlyRecovery === true
    if (readOnly && sourceOwner(input.owner)?.[1] !== 'AUTHENTICATED') return result('API22_CLAIM_UNAVAILABLE')
    if (claimed && !readOnly && (!claim || claim.sourceOwner !== input.sourceOwner || claim.owner !== input.owner
      || claim.epoch !== input.epoch || claim.conversationId !== input.sourceConversationId || claim.turnId !== input.sourceTurnId
      || claim.researchWorkId !== input.researchWorkId || input.owner !== JSON.stringify([claim.targetSessionId, 'AUTHENTICATED'])
      || input.sourceOwner !== JSON.stringify([claim.sourceSessionId, 'ANONYMOUS']))) return result('API22_CLAIM_UNAVAILABLE')
    const storageKey = PROPOSAL_INTENT_KEY + encodeURIComponent(key)
    try {
      current()
      if (readOnly) {
        if (!this.ports.sessions) return result('API22_CLAIM_UNAVAILABLE')
        let cursor: string | undefined, restored = false
        const cursors = new Set<string>()
        for (let page = 0; page < 10; page++) {
          const history = await this.ports.sessions.list({ limit: 50, ...(cursor ? { cursor } : {}) }, input.signal)
          current()
          const matches = history.data.conversations.filter(item => item.conversationId === input.sourceConversationId && item.turnCount > 0)
          if (matches.length > 1) return result('API22_CLAIM_UNAVAILABLE')
          if (matches.length === 1) { restored = true; break }
          const next = history.data.nextCursor
          if (next === null || cursors.has(next)) break
          cursors.add(next); cursor = next
        }
        if (!restored) return result('API22_CLAIM_UNAVAILABLE')
      }
      const reportLocator = await this.ports.documents.locator('report', input.researchWorkId, { signal: input.signal })
      current()
      const reportBytes = new TextEncoder().encode(input.reportText)
      const reportDigest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', reportBytes))].map(value => value.toString(16).padStart(2, '0')).join('')
      current()
      if (reportBytes.byteLength > 65_536 || new TextDecoder('utf-8', { fatal: true }).decode(reportBytes) !== input.reportText
        || reportDigest !== reportLocator.contentSha256) return result('BINDING_CONFLICT')
      const request: CreateRequest = { apiContractVersion: '0.22.0', reportLocator: { ...reportLocator, kind: 'report' },
        sourceAPI13Locator: { conversationId: input.sourceConversationId, turnId: input.sourceTurnId } }
      const resumePending = async (candidate: ProposalProjection): Promise<{ projection: ProposalProjection; hold: ProposalHold | null }> => {
        const eligible = candidate.state === 'PENDING' && (candidate.executionState === 'COMPLETED'
          || claimed && candidate.executionState === 'QUEUED')
        if (readOnly || !eligible) return { projection: candidate, hold: null }
        const originKey = PROPOSAL_INTENT_KEY + encodeURIComponent(JSON.stringify([
          input.sourceOwner, input.sourceConversationId, input.sourceTurnId, input.researchWorkId]))
        const currentRaw = this.ports.storage.getItem(storageKey), originRaw = this.ports.storage.getItem(originKey)
        const raw = currentRaw ?? originRaw
        if (raw === null) return { projection: candidate, hold: 'REQUEST_UNCONFIRMED' }
        const original = JSON.parse(raw) as ProposalCreateIntent
        if (!proposalIntentKeys(original) || original.createAttempted !== true || original.proposalId !== candidate.proposalId
          || original.applyAttempted !== false || original.applyKey !== null
          || typeof original.createKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(original.createKey)
          || canonicalApiV22(original.request) !== canonicalApiV22(request)) return { projection: candidate, hold: 'REQUEST_UNCONFIRMED' }
        const transition = JSON.stringify({ owner: input.owner, sourceOwner: input.sourceOwner, proposalId: candidate.proposalId,
          executionState: candidate.executionState, createKey: original.createKey, request: original.request })
        const resumeKey = PROPOSAL_RESUME_KEY + encodeURIComponent(JSON.stringify([
          input.owner, input.sourceOwner, candidate.proposalId, original.createKey, candidate.executionState]))
        const attempted = this.ports.storage.getItem(resumeKey)
        let attempts = 0, lastAttemptAt = 0
        if (attempted !== null) {
          if (attempted === transition) attempts = 1 // Original marker already consumed its first attempt.
          else {
            const record = JSON.parse(attempted) as { transition: string; attempts: number; lastAttemptAt: number }
            if (Object.keys(record).sort().join(',') !== 'attempts,lastAttemptAt,transition' || record.transition !== transition
              || ![1, 2].includes(record.attempts) || !Number.isSafeInteger(record.lastAttemptAt) || record.lastAttemptAt < 0) {
              return { projection: candidate, hold: 'REQUEST_UNCONFIRMED' }
            }
            attempts = record.attempts; lastAttemptAt = record.lastAttemptAt
          }
        }
        if (attempts >= 2 || Date.now() - lastAttemptAt < 4_000) return { projection: candidate, hold: null }
        let before: Awaited<ReturnType<ServiceConversationV03Port['getConversation']>>
        try { before = await this.ports.conversations.getConversation(candidate.draftBase.conversationId) }
        catch { return { projection: candidate, hold: 'BINDING_CONFLICT' } }
        current()
        if (!before.etag || !sameProposalBase(proposalBase(before.body.data), candidate.draftBase)) return { projection: candidate, hold: 'BINDING_CONFLICT' }
        if (this.ports.storage.getItem(storageKey) !== currentRaw || this.ports.storage.getItem(originKey) !== originRaw) {
          return { projection: candidate, hold: 'REQUEST_UNCONFIRMED' }
        }
        const concurrentAttempt = this.ports.storage.getItem(resumeKey)
        if (concurrentAttempt !== attempted) return { projection: candidate, hold: null }
        // Preserve exact pre-POST custody. A lost reply never earns an automatic
        // new key or reservation. Only a fresh eligible server state, current
        // CAS/authority and the bounded cadence can consume its second attempt.
        const nextAttempt = JSON.stringify({ transition, attempts: attempts + 1, lastAttemptAt: Date.now() })
        this.ports.storage.setItem(resumeKey, nextAttempt)
        if (this.ports.storage.getItem(resumeKey) !== nextAttempt) return { projection: candidate, hold: 'REQUEST_UNCONFIRMED' }
        current()
        const replay = await this.ports.proposals.create(original.request, { csrfToken: input.csrfToken,
          idempotencyKey: original.createKey, signal: input.signal }, input.reportText)
        current()
        if (replay.proposalId !== candidate.proposalId || canonicalApiV22(replay.sourceOrigin) !== canonicalApiV22(candidate.sourceOrigin)
          || !sameProposalBase(replay.state === 'UNAPPROVED' ? replay.proposal.draftBase : replay.draftBase, candidate.draftBase)) {
          return { projection: candidate, hold: 'BINDING_CONFLICT' }
        }
        const observed = await this.ports.proposals.read(candidate.proposalId, { signal: input.signal })
        current()
        if (canonicalApiV22(observed.sourceOrigin) !== canonicalApiV22(candidate.sourceOrigin)
          || canonicalApiV22(observed.state === 'UNAPPROVED' ? observed.proposal.report : observed.reportLocator) !== canonicalApiV22(reportLocator)
          || !sameProposalBase(observed.state === 'UNAPPROVED' ? observed.proposal.draftBase : observed.draftBase, candidate.draftBase)) {
          return { projection: candidate, hold: 'BINDING_CONFLICT' }
        }
        return { projection: observed, hold: null }
      }
      if (claimed || readOnly) {
        // The COMBINED tuple permits observation only. Current-cookie server
        // reads, not the anonymous marker, authorize the existing proposal.
        const page = await this.ports.proposals.list({ sourceConversationId: input.sourceConversationId, limit: 50 }, { signal: input.signal })
        current()
        const matches = page.items.filter(item => item.sourceOrigin.sourceAPI13Locator.turnId === input.sourceTurnId
          && canonicalApiV22(item.state === 'UNAPPROVED' ? item.proposal.report : item.reportLocator) === canonicalApiV22(reportLocator))
        if (matches.length !== 1 || page.nextCursor !== null) return result('API22_CLAIM_UNAVAILABLE')
        projection = await this.ports.proposals.read(matches[0].proposalId, { signal: input.signal })
        current()
        if (projection.sourceOrigin.sourceAPI13Locator.conversationId !== input.sourceConversationId
          || projection.sourceOrigin.sourceAPI13Locator.turnId !== input.sourceTurnId
          || canonicalApiV22(projection.state === 'UNAPPROVED' ? projection.proposal.report : projection.reportLocator) !== canonicalApiV22(reportLocator)) return result('API22_CLAIM_UNAVAILABLE')
        const resumed = await resumePending(projection)
        projection = resumed.projection
        if (resumed.hold) return result(resumed.hold)
        if (projection.state !== 'UNAPPROVED') return result(readOnly ? 'API22_CLAIM_UNAVAILABLE'
          : projection.state !== 'PENDING' || ['FAILED', 'CANCELLED', 'AMBIGUOUS'].includes(projection.executionState ?? '') ? 'PROPOSAL_FAILED' : null)
        let bound: ProposalBoundDraft
        try { bound = await this.ports.proposals.getAppliedDraft(projection.proposalId, { signal: input.signal }) }
        catch (error) {
          current()
          if (readOnly) return result('API22_CLAIM_UNAVAILABLE')
          // Only the server's precise no-adjunct response permits an AUTH
          // first apply. Unknown/attempted local custody never allocates a key.
          if (!(error instanceof ApiV22Error) || error.code !== 'PROPOSAL_NOT_READY') return result('API22_CLAIM_UNAVAILABLE')
          type ClaimedIntent = ProposalCreateIntent
          const originKey = PROPOSAL_INTENT_KEY + encodeURIComponent(JSON.stringify([
            input.sourceOwner, input.sourceConversationId, input.sourceTurnId, input.researchWorkId]))
          const aliasRaw = this.ports.storage.getItem(storageKey), originRaw = this.ports.storage.getItem(originKey)
          const raw = aliasRaw ?? originRaw
          if (raw === null) return result('API22_CLAIM_UNAVAILABLE')
          const intent = JSON.parse(raw) as ClaimedIntent
          if (!proposalIntentKeys(intent) || intent.createAttempted !== undefined && intent.createAttempted !== true
            || canonicalApiV22(intent.request) !== canonicalApiV22(request) || intent.proposalId !== projection.proposalId
            || intent.applyAttempted !== false || intent.applyKey !== null || typeof intent.createKey !== 'string'
            || !/^[A-Za-z0-9_-]{16,128}$/.test(intent.createKey)) return result('API22_CLAIM_UNAVAILABLE')
          const before = await this.ports.conversations.getConversation(projection.proposal.draftBase.conversationId)
          current()
          if (!before.etag || !sameProposalBase(proposalBase(before.body.data), projection.proposal.draftBase)) return result('BINDING_CONFLICT')
          if (this.ports.storage.getItem(storageKey) !== aliasRaw || this.ports.storage.getItem(originKey) !== originRaw) return result('API22_CLAIM_UNAVAILABLE')
          const attempted = { ...intent, applyKey: this.ports.randomId(), applyAttempted: true }
          const bytes = JSON.stringify(attempted)
          this.ports.storage.setItem(storageKey, bytes)
          if (this.ports.storage.getItem(storageKey) !== bytes) return result('API22_CLAIM_UNAVAILABLE')
          current()
          const applied = await this.ports.proposals.apply(projection.proposalId, { apiContractVersion: '0.22.0',
            proposalHash: projection.proposal.proposalHash, draftBase: projection.proposal.draftBase }, {
            csrfToken: input.csrfToken, idempotencyKey: attempted.applyKey, ifMatch: before.etag, signal: input.signal })
          current()
          bound = await this.ports.proposals.getAppliedDraft(projection.proposalId, { signal: input.signal })
          current()
          if (canonicalApiV22(applied) !== canonicalApiV22(bound)) return result('BINDING_CONFLICT')
        }
        current()
        if (bound.proposalHash !== projection.proposal.proposalHash || canonicalApiV22(bound.sourceOrigin) !== canonicalApiV22(projection.sourceOrigin)
          || canonicalApiV22(bound.reportLocator) !== canonicalApiV22(reportLocator)) return result('BINDING_CONFLICT')
        const after = await this.ports.conversations.getConversation(bound.draftBase.conversationId)
        current()
        if (!after.etag || !sameProposalBase(proposalBase(after.body.data), bound.draftBase)
          || canonicalApiV22(after.body.data.draftState) !== canonicalApiV22(bound.draftState)
          || after.body.data.candidateState !== bound.candidateState || after.body.data.semanticHash !== bound.semanticHash) return result('BINDING_CONFLICT')
        return result('APPROVAL_COMPANION_UNAVAILABLE', Object.freeze({ owner: input.owner, researchWorkId: input.researchWorkId,
          bound, snapshot: after.body.data, etag: after.etag }))
      }
      type Intent = ProposalCreateIntent
      const stored = this.ports.storage.getItem(storageKey)
      let intent: Intent | null = stored === null ? null : JSON.parse(stored) as Intent
      if (intent && (!proposalIntentKeys(intent) || intent.createAttempted !== undefined && intent.createAttempted !== true
        || canonicalApiV22(intent.request) !== canonicalApiV22(request)
        || typeof intent.createKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(intent.createKey)
        || (intent.proposalId !== null && (typeof intent.proposalId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(intent.proposalId)))
        || (intent.applyKey !== null && (typeof intent.applyKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(intent.applyKey)))
        || typeof intent.applyAttempted !== 'boolean')) return result('BINDING_CONFLICT')
      const persist = (value: Intent) => {
        current()
        const bytes = JSON.stringify(value)
        this.ports.storage.setItem(storageKey, bytes)
        if (this.ports.storage.getItem(storageKey) !== bytes) throw new Error('INTENT_STORAGE_UNCONFIRMED')
        intent = value
      }
      if (intent?.proposalId) projection = await this.ports.proposals.read(intent.proposalId, { signal: input.signal })
      else {
        // Recovery is read-only. No local marker is authorization to repost.
        const page = await this.ports.proposals.list({ sourceConversationId: input.sourceConversationId, limit: 50 }, { signal: input.signal })
        current()
        const matches = page.items.filter(item => item.sourceOrigin.sourceAPI13Locator.turnId === input.sourceTurnId
          && canonicalApiV22(item.state === 'UNAPPROVED' ? item.proposal.report : item.reportLocator) === canonicalApiV22(reportLocator))
        if (matches.length > 1 || page.nextCursor !== null) return result('BINDING_CONFLICT')
        projection = matches[0] ?? null
        if (projection) { if (intent) persist({ ...intent, proposalId: projection.proposalId }) }
        else if (intent) return result('REQUEST_UNCONFIRMED')
        else {
          const fresh = { request, createKey: this.ports.randomId(), proposalId: null, applyKey: null, applyAttempted: false, createAttempted: true as const }
          persist(fresh)
          projection = await this.ports.proposals.create(request, { csrfToken: input.csrfToken, idempotencyKey: fresh.createKey, signal: input.signal }, input.reportText)
          current()
          persist({ ...fresh, proposalId: projection.proposalId })
        }
      }
      current()
      if (projection.sourceOrigin.sourceAPI13Locator.conversationId !== input.sourceConversationId
        || projection.sourceOrigin.sourceAPI13Locator.turnId !== input.sourceTurnId
        || canonicalApiV22(projection.state === 'UNAPPROVED' ? projection.proposal.report : projection.reportLocator) !== canonicalApiV22(reportLocator)) return result('BINDING_CONFLICT')
      const resumed = await resumePending(projection)
      projection = resumed.projection
      if (resumed.hold) return result(resumed.hold)
      if (projection.state !== 'UNAPPROVED') return result(projection.state !== 'PENDING'
        || ['FAILED', 'CANCELLED', 'AMBIGUOUS'].includes(projection.executionState ?? '') ? 'PROPOSAL_FAILED' : null)
      const proposed = projection.proposal
      let bound: ProposalBoundDraft | undefined
      try { bound = await this.ports.proposals.getAppliedDraft(projection.proposalId, { signal: input.signal }) }
      catch (error) {
        current()
        if (!(error instanceof ApiV22Error) || !['NOT_FOUND', 'PROPOSAL_NOT_READY'].includes(error.code)) return result('APPLIED_SNAPSHOT_RELOAD_UNAVAILABLE')
      }
      current()
      if (!bound) {
        if (intent?.applyAttempted) return result('APPLIED_SNAPSHOT_RELOAD_UNAVAILABLE')
        const before = await this.ports.conversations.getConversation(proposed.draftBase.conversationId)
        current()
        if (!sameProposalBase(proposalBase(before.body.data), proposed.draftBase) || !before.etag) return result('BINDING_CONFLICT')
        if (!intent) throw new Error('INTENT_REQUIRED')
        const applyKey = intent.applyKey ?? this.ports.randomId()
        persist({ ...intent, applyKey, applyAttempted: true })
        bound = await this.ports.proposals.apply(projection.proposalId, { apiContractVersion: '0.22.0',
          proposalHash: proposed.proposalHash, draftBase: proposed.draftBase }, {
          csrfToken: input.csrfToken, idempotencyKey: applyKey, ifMatch: before.etag, signal: input.signal })
        current()
        // Never promote a local/cache object to read authority. Re-query the
        // stored immutable adjunct through the original hash-validating SDK.
        const verified = await this.ports.proposals.getAppliedDraft(projection.proposalId, { signal: input.signal })
        current()
        if (canonicalApiV22(verified) !== canonicalApiV22(bound)) return result('BINDING_CONFLICT')
        bound = verified
      }
      if (bound.proposalHash !== proposed.proposalHash || canonicalApiV22(bound.sourceOrigin) !== canonicalApiV22(projection.sourceOrigin)
        || canonicalApiV22(bound.reportLocator) !== canonicalApiV22(reportLocator)) return result('BINDING_CONFLICT')
      const after = await this.ports.conversations.getConversation(bound.draftBase.conversationId)
      current()
      if (!after.etag || !sameProposalBase(proposalBase(after.body.data), bound.draftBase)
        || canonicalApiV22(after.body.data.draftState) !== canonicalApiV22(bound.draftState)
        || after.body.data.candidateState !== bound.candidateState || after.body.data.semanticHash !== bound.semanticHash) return result('BINDING_CONFLICT')
      return result('APPROVAL_COMPANION_UNAVAILABLE', Object.freeze({ owner: input.owner, researchWorkId: input.researchWorkId,
        bound, snapshot: after.body.data, etag: after.etag }))
    } catch (error) {
      if (error instanceof ApiV22Error || error instanceof ApiV16Error) return result(error.code === 'TRANSPORT_FAILED' ? 'REQUEST_UNCONFIRMED'
        : claimed || readOnly ? 'API22_CLAIM_UNAVAILABLE' : 'BINDING_CONFLICT')
      return result(claimed || readOnly ? 'API22_CLAIM_UNAVAILABLE' : 'REQUEST_UNCONFIRMED')
    }
  }
}
type NativeSourceIntakeState = Readonly<{
  version: 2
  /** Immutable owner of the API19 source tuple. A verified API14 claim may only add a locator alias. */
  owner: string
  locatorOwner: string
  conversationId: string
  turnId: string
  pair: 'BTC/USDT' | 'ETH/USDT'
  value: SourceIntake
  status: 'collecting' | 'uncertain' | 'accepted'
  idempotencyKey: string | null
  completion: Readonly<{
    completionCommitId: string
    receiptId: string
    researchWorkId: string
    sourceSessionId: string
  }> | null
}>
const sourceIntakeBinding = (candidate: NativeConsultationSetupCandidate) => JSON.stringify([
  candidate.owner, candidate.conversationId, candidate.turnId, candidate.setup.pair,
])
const sourceIntakeStorageKey = (value: Readonly<{ owner: string; locatorOwner?: string; conversationId: string; turnId: string; pair: string }>) =>
  `${SOURCE_INTAKE_KEY}${encodeURIComponent(JSON.stringify([value.locatorOwner ?? value.owner, value.conversationId, value.turnId, value.pair]))}`
const sourceOwner = (value: string): readonly [string, 'ANONYMOUS' | 'AUTHENTICATED'] | null => {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'string'
      && parsed[0].length >= 1 && parsed[0].length <= 160 && ['ANONYMOUS', 'AUTHENTICATED'].includes(parsed[1])
      && JSON.stringify(parsed) === value ? parsed as [string, 'ANONYMOUS' | 'AUTHENTICATED'] : null
  } catch { return null }
}
const sourceCompletion = (value: unknown): NativeSourceIntakeState['completion'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (Object.keys(item).sort().join(',') !== 'completionCommitId,receiptId,researchWorkId,sourceSessionId'
    || ![item.completionCommitId, item.receiptId, item.researchWorkId].every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(id))
    || typeof item.sourceSessionId !== 'string' || !/^session_[A-Za-z0-9_-]{12,80}$/.test(item.sourceSessionId)) return null
  return Object.freeze({ completionCommitId: item.completionCommitId as string, receiptId: item.receiptId as string,
    researchWorkId: item.researchWorkId as string, sourceSessionId: item.sourceSessionId })
}
const sourceIntakeState = (candidate: NativeConsultationSetupCandidate, value: unknown): NativeSourceIntakeState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const stored = value as Record<string, unknown>, keys = Object.keys(stored).sort().join(',')
  const legacy = stored.version === 1 && keys === 'conversationId,idempotencyKey,owner,pair,status,turnId,value,version'
  const current = stored.version === 2 && keys === 'completion,conversationId,idempotencyKey,locatorOwner,owner,pair,status,turnId,value,version'
  const locatorOwner = legacy ? stored.owner : stored.locatorOwner
  const origin = typeof stored.owner === 'string' ? sourceOwner(stored.owner) : null
  const locator = typeof locatorOwner === 'string' ? sourceOwner(locatorOwner) : null
  if ((!legacy && !current) || locatorOwner !== candidate.owner || !origin || !locator
    || !(stored.owner === locatorOwner || origin[1] === 'ANONYMOUS' && locator[1] === 'AUTHENTICATED')
    || stored.conversationId !== candidate.conversationId || stored.turnId !== candidate.turnId
    || stored.pair !== candidate.setup.pair || !['collecting', 'uncertain', 'accepted'].includes(String(stored.status))) return null
  const intake = readSourceIntake(stored.value), idempotencyKey = stored.idempotencyKey
  if (!intake || !(idempotencyKey === null || typeof idempotencyKey === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))) return null
  if (stored.status === 'collecting' && (intake.answers.length >= 5 || idempotencyKey !== null)
    || stored.status !== 'collecting' && (intake.answers.length !== 5 || idempotencyKey === null)) return null
  const completion = legacy ? null : sourceCompletion(stored.completion)
  if (!legacy && stored.completion !== null && !completion || completion && (stored.status !== 'accepted' || completion.sourceSessionId !== origin[0])) return null
  return Object.freeze({ version: 2, owner: stored.owner as string, locatorOwner: locatorOwner as string,
    conversationId: candidate.conversationId, turnId: candidate.turnId,
    pair: candidate.setup.pair, value: Object.freeze({ answers: intake.answers.map(answer => Object.freeze({ ...answer })) }),
    status: stored.status as NativeSourceIntakeState['status'], idempotencyKey, completion })
}
const readSourceIntakeState = (candidate: NativeConsultationSetupCandidate): NativeSourceIntakeState | undefined => {
  const raw = sessionStorage.getItem(sourceIntakeStorageKey({ ...candidate, pair: candidate.setup.pair }))
  if (raw === null) return Object.freeze({ version: 2, owner: candidate.owner, locatorOwner: candidate.owner,
    conversationId: candidate.conversationId, turnId: candidate.turnId, pair: candidate.setup.pair,
    value: Object.freeze({ answers: [] }), status: 'collecting', idempotencyKey: null, completion: null })
  if (new TextEncoder().encode(raw).length > 65_536) throw new Error('SOURCE_INTAKE_STORAGE_INVALID')
  const stored = sourceIntakeState(candidate, JSON.parse(raw))
  if (!stored) throw new Error('SOURCE_INTAKE_STORAGE_INVALID')
  return stored
}
const writeSourceIntakeState = (value: NativeSourceIntakeState) => {
  const key = sourceIntakeStorageKey(value), raw = JSON.stringify(value)
  sessionStorage.setItem(key, raw)
  if (sessionStorage.getItem(key) !== raw) throw new Error('SOURCE_INTAKE_STORAGE_INVALID')
}
const recoverableAcceptedSourceIntake = (researchWorkId: string, conversationId: string, locatorOwner: string,
  expectedSourceSessionId?: string): NativeSourceIntakeState | null => {
  const matches: NativeSourceIntakeState[] = []
  if (sessionStorage.length > 512) return null
  try {
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index)
      if (!key?.startsWith(SOURCE_INTAKE_KEY)) continue
      const raw = sessionStorage.getItem(key)
      if (raw === null || new TextEncoder().encode(raw).length > 65_536) return null
      const value = JSON.parse(raw) as Record<string, unknown>
      if (typeof value.locatorOwner !== 'string' || typeof value.conversationId !== 'string'
        || typeof value.turnId !== 'string' || !['BTC/USDT', 'ETH/USDT'].includes(String(value.pair))) return null
      const state = sourceIntakeState({ owner: value.locatorOwner, conversationId: value.conversationId,
        turnId: value.turnId, setup: { entryMode: null, pair: value.pair as 'BTC/USDT' | 'ETH/USDT' } }, value)
      if (!state || key !== sourceIntakeStorageKey(state)) return null
      if (state.status === 'accepted' && state.completion?.researchWorkId === researchWorkId
        && state.conversationId === conversationId) matches.push(state)
    }
  } catch { return null }
  if (matches.length < 1 || matches.some(state => {
    const origin = sourceOwner(state.owner)
    return !origin || state.completion?.sourceSessionId !== origin[0]
      || expectedSourceSessionId !== undefined && (origin[1] !== 'ANONYMOUS' || origin[0] !== expectedSourceSessionId)
  })) return null
  const canonical = (state: NativeSourceIntakeState) => JSON.stringify({ ...state, locatorOwner: state.owner })
  if (new Set(matches.map(canonical)).size !== 1) return null
  const target = matches.filter(state => state.locatorOwner === locatorOwner)
  const source = matches.filter(state => state.locatorOwner === state.owner)
  if (target.length > 1 || source.length !== 1) return null
  return target[0] ?? source[0]
}
const CONNECTION_PLAN_LOGIN_KEY = 'tesia.native.connection-plan-login-intent'
type ConsultationLoginIntent = { sourceSessionId: string; sourceEtag: string; conversationId: string; panelGeneration: number }
const connectionPlanLocation = (value: unknown): value is ConnectionPlanLocation => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'exchange,step') return false
  const plan = value as Record<string, unknown>
  return ['plan', 'checkout', 'free', 'account', 'authorize'].includes(String(plan.step))
    && planExchanges.some(([exchange]) => exchange === plan.exchange)
}
const connectionPlanRequest = (value: unknown): value is ClientConnectionPlanAuthRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'issuer,operation,plan,requestId,sourceSessionId') return false
  const request = value as Record<string, unknown>
  return request.issuer === 'client-connection-plan' && request.operation === 'signup'
    && typeof request.requestId === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(request.requestId)
    && typeof request.sourceSessionId === 'string' && /^session_[A-Za-z0-9_-]{12,80}$/.test(request.sourceSessionId)
    && connectionPlanLocation(request.plan)
}
const expected = (value: ConversationSnapshot) => ({ expectedConversationStateRevision: value.conversationStateRevision, expectedConversationStateHash: value.conversationStateHash })
const approvalMatchesDraft = (value: StrategyApproval, snapshot: ConversationSnapshot) => (
  value.sourceConversationId === snapshot.conversationId && value.sourceConversationStateRevision === snapshot.conversationStateRevision
  && value.sourceConversationStateHash === snapshot.conversationStateHash && value.sourceDraftId === snapshot.draftId
  && value.sourceDraftRevision === snapshot.draftRevision && value.sourceProjectionHash === snapshot.projectionHash
  && value.semanticHash === snapshot.semanticHash
)
const assertSameJob = (next: NativeJob, observed: NativeJob) => {
  // The SDK binds a GET to backtestId. These immutable fields additionally
  // bind later observations to the job accepted for this strategy/profile.
  for (const field of ['backtestId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'splitGroupId', 'createdAt'] as const) {
    if (next[field] !== observed[field]) throw new Error('BINDING_CONFLICT')
  }
}

/** Source strategy reads reuse the original SDKs. Local approval/view objects
 * are comparison targets, never a substitute for current server authority. */
export class NativeSourceStrategyBacktestAuthority {
  constructor(private readonly ports: Readonly<{
    owner: (conversationId: string, expected?: HistoryOwner) => Promise<HistoryOwner>
    conversations: Pick<ServiceConversationV03Port, 'getConversation'>
    proposals: Pick<NativeResearchStrategyProposalV22Adapter, 'getAppliedDraft'>
    history: (conversationId: string, cursor?: string) => Promise<History>
    job: (backtestId: string) => Promise<NativeJob>
  }>) {}
  async observe(view: ProposalView, isCurrent: () => boolean) {
    const check = () => { if (!isCurrent()) throw new Error('SESSION_CHANGED') }
    check()
    const owner = await this.ports.owner(view.snapshot.conversationId)
    check()
    if (view.owner !== JSON.stringify([owner.sessionId, 'AUTHENTICATED'])) throw new Error('BINDING_CONFLICT')
    const bound = await this.ports.proposals.getAppliedDraft(view.bound.proposalId)
    check()
    if (canonicalApiV22(bound) !== canonicalApiV22(view.bound)) throw new Error('BINDING_CONFLICT')
    const current = await this.ports.conversations.getConversation(view.snapshot.conversationId)
    check()
    if (!current.etag || current.etag !== view.etag || !sameProposalBase(proposalBase(current.body.data), view.bound.draftBase)
      || canonicalApiV22(current.body.data.draftState) !== canonicalApiV22(bound.draftState)
      || current.body.data.semanticHash !== bound.semanticHash) throw new Error('BINDING_CONFLICT')
    await this.ports.owner(owner.conversationId, owner)
    check()
    return { owner, snapshot: current.body.data, etag: current.etag }
  }
  async confirm(view: ProposalView, expectedApproval: StrategyApproval, isCurrent: () => boolean) {
    const observed = await this.observe(view, isCurrent)
    let cursor: string | undefined, revision: string | undefined
    const cursors = new Set<string>(), matches: History['rows'][number][] = []
    let complete = false
    for (let pages = 0; pages < 10; pages++) {
      const page = await this.ports.history(observed.owner.conversationId, cursor)
      if (!isCurrent()) throw new Error('SESSION_CHANGED')
      if (page.conversationId !== observed.owner.conversationId || revision && revision !== page.snapshotRevision) throw new Error('BINDING_CONFLICT')
      revision = page.snapshotRevision
      matches.push(...page.rows.filter(row => row.approval.strategyVersionId === expectedApproval.strategyVersionId))
      if (!page.nextCursor) { complete = true; break }
      if (cursors.has(page.nextCursor)) throw new Error('BINDING_CONFLICT')
      cursors.add(page.nextCursor); cursor = page.nextCursor
    }
    const jobIds = new Set<string>()
    if (!complete || matches.length === 0 || !approvalMatchesDraft(expectedApproval, observed.snapshot)) throw new Error('BINDING_CONFLICT')
    for (const row of matches) {
      if (canonicalApiV22(row.approval) !== canonicalApiV22(expectedApproval)) throw new Error('BINDING_CONFLICT')
      if (row.job === null) {
        if (matches.length !== 1) throw new Error('BINDING_CONFLICT')
      } else {
        if (jobIds.has(row.job.backtestId) || row.job.strategyVersionId !== expectedApproval.strategyVersionId
          || row.job.semanticHash !== expectedApproval.semanticHash) throw new Error('BINDING_CONFLICT')
        jobIds.add(row.job.backtestId)
      }
    }
    await this.ports.owner(observed.owner.conversationId, observed.owner)
    if (!isCurrent()) throw new Error('SESSION_CHANGED')
    return { ...observed, approval: matches[0].approval, rows: matches }
  }
  async selectJob(view: ProposalView, approval: StrategyApproval, expectedJob: NativeJob, isCurrent: () => boolean) {
    const observed = await this.confirm(view, approval, isCurrent)
    const matches = observed.rows.filter(row => row.job?.backtestId === expectedJob.backtestId)
    if (matches.length !== 1 || !matches[0].job) throw new Error('BINDING_CONFLICT')
    assertSameJob(matches[0].job, expectedJob)
    const job = await this.ports.job(expectedJob.backtestId)
    if (!isCurrent()) throw new Error('SESSION_CHANGED')
    assertSameJob(job, expectedJob)
    if (job.strategyVersionId !== observed.approval.strategyVersionId || job.semanticHash !== observed.approval.semanticHash) throw new Error('BINDING_CONFLICT')
    await this.ports.owner(observed.owner.conversationId, observed.owner)
    if (!isCurrent()) throw new Error('SESSION_CHANGED')
    return { ...observed, job }
  }
  static matchesJob(job: NativeJob, scope: SourceJobScope, view: ProposalView): boolean {
    return scope.owner === view.owner && scope.bindingHash === view.bound.bindingHash
      && scope.conversationId === view.snapshot.conversationId && scope.draftId === view.snapshot.draftId
      && scope.backtestId === job.backtestId && scope.strategyVersionId === job.strategyVersionId && scope.semanticHash === job.semanticHash
  }
}
const safeCode = (error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return ['AUTHENTICATION_REQUIRED', 'NOT_READY', 'SNAPSHOT_CHANGED', 'BINDING_CONFLICT', 'SOURCE_VERIFICATION_FAILED'].includes(code) ? code : 'REQUEST_UNCONFIRMED'
}
const authenticationRequired = (failure: unknown) => safeCode(failure) === 'AUTHENTICATION_REQUIRED'
  || Boolean(failure && typeof failure === 'object' && 'status' in failure && failure.status === 401)

// Only a validated v0.7 SUBMIT rejection may carry this presentation context.
// Transport loss, invalid envelopes and unrelated GETs remain unconfirmed.
class NativeSubmitNotReady extends Error { readonly code = 'NOT_READY' }
const nativeSubmitNotReadyCopy = '서버가 아직 실행 준비를 마치지 못해 백테스트를 시작하지 못했습니다. 요청은 그대로 보관되어 있으며 자동으로 다시 시도하지 않으니, 준비가 끝난 뒤 같은 요청으로 재개해 주세요.'

// Keep the initiating control focusable while its request is pending. The same
// disabled predicate still blocks every click, including synthetic clicks.
function WorkflowButton({ disabled, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" data-workflow-action aria-disabled={disabled}
    onClick={event => { if (!disabled) onClick?.(event) }}
    onKeyDown={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }} />
}

/** Native service-only entry. No fixture adapter fallback and no order authority. */
export type NativeServicePresentations = Pick<ComponentProps<typeof ClientServiceExperience>,
  'conversationLibrary' | 'insightPresentation' | 'sharingPresentation' | 'researchPresentation' | 'accountPresentation' | 'feedbackPresentation' | 'brokerPresentation' | 'connectionPresentation'>
export function NativeServiceApp({ presentations = {}, exchangeConnectionsEnabled = false, consultationEnabled = false, naturalLoginFlow = false, bitgetCanaryEnabled = false, copyExecutionInput, copyExecutionEnabled = false }: { presentations?: NativeServicePresentations; exchangeConnectionsEnabled?: boolean; consultationEnabled?: boolean; naturalLoginFlow?: boolean; bitgetCanaryEnabled?: boolean; copyExecutionInput?: CandidateCopyInput; copyExecutionEnabled?: boolean } = {}) {
  const { language, t } = useClientPreferences()
  const ui = (original: Parameters<typeof nativeAppUiText>[1]) => nativeAppUiText(language, original)
  const jobText = (key: NativeJobTextKey, values?: Readonly<Record<string, string | number>>) => nativeJobText(language, key, values)
  const workflowText = (key: NativeWorkflowTextKey, values?: Readonly<Record<string, string | number>>) => nativeWorkflowText(language, key, values)
  const [clients] = useState(() => {
    let csrfToken: string | null = null
    const transport = new NativeServiceTransport()
    const replayReaders = createNativeReplayReaderScope()
    const conversationTransport = createServiceV03HttpTransport({ csrfTokenProvider: () => csrfToken })
    return { getCsrf: () => csrfToken, setCsrf: (value: string | null) => { csrfToken = value; if (value === null) replayReaders.invalidate() }, transport, replayReaders, conversationTransport, native: createNativeServiceApi(transport),
      conversation: createServiceConversationV03Port(new TesiaConversationV03Client(conversationTransport)),
      session: createSdk(new TesiaApiClient(new SameOriginApiTransport())).session,
      bootstrap: createBrowserSessionBootstrap() }
  })
  const [consultation] = useState(() => new NativeConsultationV13Controller(
    new ConsultationV13Adapter({ csrfToken: () => clients.getCsrf() }), {
      documentAdapter: new ConsultationV16Adapter(),
      documentCsrfToken: () => {
        const token = clients.getCsrf()
        if (!token) throw new Error('SESSION_CHANGED')
        return token
      },
    }))
  const [sourceIntakeAdapter] = useState(() => new NativeSourceIntakeV19Adapter({ csrfToken: () => clients.getCsrf() }))
  const [researchWorkAdapter] = useState(() => new NativeResearchWorkV20Adapter())
  const [sourceBacktestProposalReads] = useState(() => new NativeResearchStrategyProposalV22Adapter())
  const [proposalOrchestration] = useState(() => new NativeResearchProposalOrchestration({
    proposals: new NativeResearchStrategyProposalV22Adapter(), documents: new ConsultationV16Adapter(), conversations: clients.conversation,
    sessions: new ConsultationV14Adapter({ csrfToken: () => clients.getCsrf() }),
    storage: { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) },
    randomId: () => crypto.randomUUID(),
  }))
  const [consultationState, setConsultationState] = useState<ConsultationV13Snapshot>(() => consultation.getSnapshot())
  useEffect(() => consultation.subscribe(setConsultationState), [consultation])
  useEffect(() => () => consultation.detach(), [consultation])
  const [phase, setPhase] = useState<InternalPocPresentation['phase']>('loading')
  const [initializing, setInitializing] = useState(true)
  const [initialConnectionFailed, setInitialConnectionFailed] = useState(false)
  const [initialHome] = useState(() => {
    // Presence selects an empty loading surface only, never authentication,
    // restored content, or permission to send. Storage errors stay neutral.
    try {
      return [STORAGE_KEY, CONVERSATION_OWNER_KEY, NATIVE_JOURNAL_KEY, NATIVE_LOGOUT_KEY]
        .every(key => sessionStorage.getItem(key) === null) && !hasStoredNativeEmailIntent()
    } catch { return false }
  })
  const [sessionState, setSessionState] = useState<'ANONYMOUS' | 'AUTHENTICATED' | null>(null)
  const [sourceIntake, setSourceIntake] = useState<NativeSourceIntakeState | null>(null)
  const sourceIntakeRef = useRef<NativeSourceIntakeState | null>(null)
  const sourceIntakeGeneration = useRef(0)
  const sourceIntakeInFlight = useRef<{ command: NativeSourceIntakeState; controller: AbortController } | null>(null)
  const [sourceIntakeSubmitting, setSourceIntakeSubmitting] = useState(false)
  const [sourceIntakeIssue, setSourceIntakeIssue] = useState(false)
  const sourceIntakeClaim = useRef<{ sourceSessionId: string; targetSessionId: string; conversationId: string; state?: NativeSourceIntakeState } | null>(null)
  const reportRecoveryInFlight = useRef(new Map<string, Promise<boolean>>())
  const reportRecoverySucceeded = useRef(new Set<string>())
  const recoverClaimedReportSource = useRef<(researchWorkId: string, sourceSessionId?: string) => Promise<boolean>>(async () => false)
  const [researchProjection, setResearchProjection] = useState<ResearchWorkProjection | null>(null)
  const [researchProjectionIssue, setResearchProjectionIssue] = useState(false)
  const [proposalView, setProposalView] = useState<ProposalView | null>(null)
  const proposalViewRef = useRef<ProposalView | null>(null)
  const [proposalHold, setProposalHold] = useState<ProposalHold | null>(null)
  const [proposalReview, setProposalReview] = useState<ApprovalCompanion | null>(null)
  const [proposalCombinedClaim, setProposalCombinedClaim] = useState<ProposalCombinedClaim | null>(null)
  const [conversation, setConversation] = useState<ConversationSnapshot | null>(null)
  // The opt-in owns only a new general-chat surface. Selecting an existing
  // server strategy conversation returns to its unchanged v0.3 controller.
  const consultationChat = consultationEnabled && conversation === null
  const consultationChatRef = useRef(consultationChat)
  useLayoutEffect(() => { consultationChatRef.current = consultationChat }, [consultationChat])
  const [documentOwner, setDocumentOwner] = useState<DocumentOwner | null>(null)
  const etag = useRef('')
  const [messages, setMessages] = useState<readonly ClientServiceMessage[]>([])
  // UI location is memory-only and keyed to the actual idempotent TURN. Never
  // add it to the SDK body/journal or claim the model consumed a report context.
  const researchDispatches = useRef(new Map<string, NativeResearchThreadOrigin>())
  const researchOrigin = (command: NativeMutationCommand) => {
    if (command.kind !== 'TURN') return undefined
    const origin = researchDispatches.current.get(command.body.clientMessageId)
    return origin?.scopeId === JSON.stringify([command.sessionId, command.sessionState, command.conversationId, command.draftId]) ? origin : undefined
  }
  // Only the currently submitted home wording is retained. This is not part of
  // the durable mutation journal, SDK body, approval or reconstructed history.
  const submittedQuestion = useRef<{ sessionId: string; clientMessageId: string; message: string; displayText: string } | null>(null)
  const displayedQuestion = (sessionId: string, clientMessageId: string, message: string) => {
    const saved = submittedQuestion.current
    return saved?.sessionId === sessionId && saved.clientMessageId === clientMessageId && saved.message === message ? saved.displayText : undefined
  }
  const [input, setInput] = useState('')
  const rowEdits = useNativeRowEdits()
  const composerRecovery = useRef<{ sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED'; conversationId: string | null; text: string } | null>(null)
  const [hasComposerRecovery, setHasComposerRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const workflowElement = useRef<HTMLElement>(null)
  const workflowFocus = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const respectUserFocus = (event: Event) => {
      if (event.target !== workflowFocus.current) workflowFocus.current = null
    }
    document.addEventListener('focusin', respectUserFocus)
    document.addEventListener('pointerdown', respectUserFocus, true)
    return () => {
      document.removeEventListener('focusin', respectUserFocus)
      document.removeEventListener('pointerdown', respectUserFocus, true)
    }
  }, [])
  useLayoutEffect(() => {
    const origin = workflowFocus.current
    if (!origin || origin.isConnected) return
    workflowFocus.current = null
    // Never move focus away from a field/dialog the user has chosen, and never
    // focus the next execution button: a held Enter must not authorize a step.
    if (document.activeElement === document.body) {
      workflowElement.current?.querySelector<HTMLElement>('[data-workflow-focus]')?.focus({ preventScroll: true })
    }
  })
  const working = useRef(false)
  const emailDispatch = useRef<object | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState('')
  const [homeInputFailure, setHomeInputFailure] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<DraftValidationReceipt | null>(null)
  const [challenge, setChallenge] = useState<ApprovalChallenge | null>(null)
  const [approval, setApproval] = useState<StrategyApproval | null>(null)
  const [job, setJob] = useState<NativeJob | null>(null)
  const [sourceJobScope, setSourceJobScope] = useState<SourceJobScope | null>(null)
  const [pollIssue, setPollIssue] = useState<{ job: NativeJob; retrying: boolean } | null>(null)
  const [refreshingJob, setRefreshingJob] = useState<NativeJob | null>(null)
  const jobPolling = useRef<{ job: NativeJob; control: ReturnType<typeof startNativeJobPolling> } | null>(null)
  // One confirmed result may remain visible while its own conversation draft
  // is edited. It is never approval, submission or current-draft authority.
  const [retainedResult, setRetainedResult] = useState<{ job: NativeJob; owner: HistoryOwner; draftId: string; sourceScope?: SourceJobScope } | null>(null)
  const [resultStatus, setResultStatus] = useState<NativeServiceResultStatus | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [historyPending, setHistoryPending] = useState(false)
  const historyOwner = useRef<HistoryOwner | null>(null)
  const [historyNavigation, setHistoryNavigation] = useState<HistoryNavigation>({ cursors: [], index: 0, offset: 0 })
  const [historyNotice, setHistoryNotice] = useState<Extract<NativeJobTextKey,
    'historyAccessLostNotice' | 'historyPositionChangedNotice' | 'historyPageFailedNotice' | 'historySnapshotChangedNotice'> | ''>('')
  const [historyNeedsRefresh, setHistoryNeedsRefresh] = useState(false)
  const [selectedHistoryOwner, setSelectedHistoryOwner] = useState<HistoryOwner | null>(null)
  const [editingNotice, setEditingNotice] = useState(false)
  const [composerRequest, setComposerRequest] = useState<object>()
  const [previousConversation, setPreviousConversation] = useState<PreviousConversation | null>(null)
  const [navigationError, setNavigationError] = useState<ObservationNavigationError | ''>('')
  const [diff, setDiff] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const pending = useRef<NativeMutationCommand | null>(null)
  const session = useRef<{ sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED' } | null>(null)
  const [accountScope, setAccountScope] = useState<string | null>(null)
  const exchangeConnectionPresentation = useExchangeConnectionPresentation(accountScope,
    sessionState === 'AUTHENTICATED', exchangeConnectionsEnabled && phase === 'ready')
  const bitgetCanary = useBitgetCanaryPresentation(accountScope, sessionState === 'AUTHENTICATED',
    bitgetCanaryEnabled && phase === 'ready' && !exchangeConnectionsEnabled)
  const gateBrokerEnabled = import.meta.env.VITE_TETH_GATE_BROKER_ENABLED === 'true'
  const gateBroker = useGateBrokerConnection(accountScope, sessionState === 'AUTHENTICATED', gateBrokerEnabled && phase === 'ready')
  const gateBrokerAuthorization = useMemo<GateBrokerAuthorizationPort | undefined>(() => gateBroker?.available
    ? { scope: gateBroker.scope, identity: `gate-broker:${gateBroker.scope}`, environment: 'production', authorize: gateBroker.connect }
    : undefined, [gateBroker?.available, gateBroker?.scope, gateBroker?.connect])
  const catalogueCopyExecution = useCandidateCopyExecution(copyExecutionInput, copyExecutionEnabled && phase === 'ready', clients.session, () => session.current, sessionState === 'AUTHENTICATED' ? accountScope : null)
  const bindSession = (value: typeof session.current) => {
    // Keep request authority in the existing ref. React state only scopes the
    // lifetime of unsent local UI; it cannot authorize a request.
    if (value?.sessionId !== session.current?.sessionId || value?.sessionState !== session.current?.sessionState) clients.replayReaders.invalidate()
    session.current = value
    setAccountScope(value?.sessionId ?? null)
  }
  const epoch = useRef(0)
  const proposalActive = conversation === null && proposalView && phase === 'ready' && accountScope && sessionState
    && proposalView.owner === JSON.stringify([accountScope, sessionState])
    && sourceIntake?.status === 'accepted' && sourceIntake.locatorOwner === proposalView.owner
    && sourceIntake.completion?.researchWorkId === proposalView.researchWorkId
    && consultationState.conversationId === sourceIntake.conversationId ? proposalView : null
  const strategyConversation = conversation ?? proposalActive?.snapshot ?? null
  const strategyOwner: DocumentOwner | null = documentOwner ?? (proposalActive && accountScope && sessionState
    ? { sessionId: accountScope, sessionState, conversationId: proposalActive.snapshot.conversationId, draftId: proposalActive.snapshot.draftId } : null)
  const sourceJobCurrent = Boolean(job && sourceJobScope && proposalActive
    && NativeSourceStrategyBacktestAuthority.matchesJob(job, sourceJobScope, proposalActive))
  const strategyJob = conversation || sourceJobCurrent ? job : null
  const [consultationPresentationEpoch, setConsultationPresentationEpoch] = useState(0)
  const [retainedConsultation, setRetainedConsultation] = useState<{ epoch: number; targetSessionId: string; messages: readonly ClientServiceMessage[] } | null>(null)
  const [proposalClaimAdapter] = useState(() => new NativeResearchProposalV14ClaimAdapter({ csrfToken: () => clients.getCsrf() }, {
    capture: () => {
      const owner = session.current, generation = epoch.current
      const source = sourceIntakeClaim.current?.state ?? sourceIntakeRef.current
      return { source, owner: JSON.stringify([owner?.sessionId, owner?.sessionState]), epoch: generation,
        isCurrent: () => generation === epoch.current && session.current?.sessionId === owner?.sessionId
          && session.current?.sessionState === owner?.sessionState
          && (sourceIntakeClaim.current?.state ?? sourceIntakeRef.current) === source }
    },
  }))
  const [consultationSession] = useState(() => new NativeConsultationSessionV14Controller(
    proposalClaimAdapter, {
      currentSession: async () => { throw new Error('SESSION_CHANGED') },
      refreshSession: async () => { throw new Error('SESSION_CHANGED') },
      restoreConversation: async () => false,
    }))
  const [consultationSessionState, setConsultationSessionState] = useState(() => consultationSession.getSnapshot())
  useEffect(() => consultationSession.subscribe(setConsultationSessionState), [consultationSession])
  useEffect(() => () => consultationSession.detach(), [consultationSession])
  useEffect(() => {
    consultationSession.bindTarget(consultationEnabled && sessionState === 'AUTHENTICATED' && phase === 'ready' ? accountScope : null)
  }, [accountScope, consultationEnabled, consultationSession, phase, sessionState])
  useEffect(() => {
    if (!consultationEnabled || phase !== 'ready' || !accountScope || !sessionState || !clients.getCsrf()) {
      consultation.unbindOwner()
      return
    }
    consultation.bindOwner(JSON.stringify([accountScope, sessionState]))
    void consultation.activate().then(async () => {
      const workId = consultation.verifiedReportResearchWorkId()
      if (workId) await recoverClaimedReportSource.current(workId)
    })
  }, [accountScope, clients, consultation, consultationEnabled, phase, sessionState])
  const setupCandidate = consultationState.setupCandidate
  const setupBinding = setupCandidate ? sourceIntakeBinding(setupCandidate) : null
  const restoreClaimedSourceIntake = (candidate: NativeConsultationSetupCandidate): NativeSourceIntakeState | undefined => {
    const claim = sourceIntakeClaim.current
    if (!claim || claim.sourceSessionId === claim.targetSessionId || claim.targetSessionId !== session.current?.sessionId
      || candidate.owner !== JSON.stringify([claim.targetSessionId, 'AUTHENTICATED']) || candidate.conversationId !== claim.conversationId) return undefined
    let source = claim.state
    if (!source) {
      const originCandidate = { ...candidate, owner: JSON.stringify([claim.sourceSessionId, 'ANONYMOUS']) }
      const raw = sessionStorage.getItem(sourceIntakeStorageKey({ ...originCandidate, pair: originCandidate.setup.pair }))
      if (raw === null || new TextEncoder().encode(raw).length > 65_536) return undefined
      source = sourceIntakeState(originCandidate, JSON.parse(raw)) ?? undefined
    }
    if (!source || source.conversationId !== candidate.conversationId || source.turnId !== candidate.turnId || source.pair !== candidate.setup.pair) return undefined
    const alias = Object.freeze({ ...source, locatorOwner: candidate.owner })
    writeSourceIntakeState(alias)
    sourceIntakeClaim.current = null
    return alias
  }
  useEffect(() => {
    const settled = sourceIntakeRef.current
    if (!setupCandidate && settled?.status === 'accepted' && settled.completion
      && phase === 'ready' && accountScope && sessionState
      && settled.locatorOwner === JSON.stringify([accountScope, sessionState])
      && consultationState.conversationId === settled.conversationId) {
      setSourceIntakeIssue(false)
      return
    }
    sourceIntakeInFlight.current?.controller.abort()
    sourceIntakeInFlight.current = null
    sourceIntakeGeneration.current++
    setSourceIntakeSubmitting(false); setSourceIntakeIssue(false)
    if (!consultationChat || phase !== 'ready' || !accountScope || !sessionState || !setupCandidate
      || setupCandidate.owner !== JSON.stringify([accountScope, sessionState])
      || consultationState.conversationId !== setupCandidate.conversationId) {
      sourceIntakeRef.current = null; setSourceIntake(null); return
    }
    try {
      const restored = restoreClaimedSourceIntake(setupCandidate) ?? readSourceIntakeState(setupCandidate)
      sourceIntakeRef.current = restored ?? null; setSourceIntake(restored ?? null)
      setSourceIntakeIssue(restored?.status === 'uncertain')
    } catch {
      sourceIntakeRef.current = null; setSourceIntake(null); setSourceIntakeIssue(true)
    }
    return () => {
      sourceIntakeGeneration.current++
      sourceIntakeInFlight.current?.controller.abort()
      sourceIntakeInFlight.current = null
    }
    // Binding primitives are the only durable SETUP presentation identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountScope, consultationChat, consultationState.conversationId, phase, sessionState, setupBinding])
  const [automaticPresentation, setAutomaticPresentation] = useState<NativeResultPresentationRequest>()
  const [presentationIntent] = useState(() => createNativeResultPresentationIntent(() => null))
  useEffect(() => {
    // The existing poller keeps observing hidden jobs and catches up on
    // return. Retire only the foreground visual invitation so that catch-up
    // cannot launch a delayed replay; never stop or mutate the server job.
    const retireHiddenPresentation = () => {
      if (document.visibilityState === 'hidden') presentationIntent.invalidate()
    }
    document.addEventListener('visibilitychange', retireHiddenPresentation)
    return () => document.removeEventListener('visibilitychange', retireHiddenPresentation)
  }, [presentationIntent])
  const presentationSessionId = strategyOwner?.sessionId, presentationSessionState = strategyOwner?.sessionState
  const presentationConversationId = strategyOwner?.conversationId, presentationDraftId = strategyOwner?.draftId
  useLayoutEffect(() => () => clients.replayReaders.invalidate(),
    [clients, sessionState, presentationSessionId, presentationSessionState, presentationConversationId, presentationDraftId])
  const createReplayReader = useCallback<NativeReplayReaderFactory>(request => {
    const owner = session.current, generation = epoch.current
    if (!owner || !clients.getCsrf()) throw new Error('NATIVE_REPLAY_DISPOSED')
    return clients.replayReaders.create(request, () => generation === epoch.current
      && owner.sessionId === session.current?.sessionId && owner.sessionState === session.current?.sessionState
      && Boolean(clients.getCsrf()))
    // These display scope values also invalidate the Result's ready/playing
    // state; reader disposal alone cannot stop an already-running renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, sessionState, presentationSessionId, presentationSessionState, presentationConversationId, presentationDraftId])
  useLayoutEffect(() => {
    presentationIntent.setScopeReader(() => {
      const bound = session.current
      return bound && presentationSessionId === bound.sessionId && presentationSessionState === bound.sessionState && presentationConversationId && presentationDraftId
        ? { sessionId: presentationSessionId, sessionState: presentationSessionState, conversationId: presentationConversationId, draftId: presentationDraftId, epoch: epoch.current } : null
    })
    return () => presentationIntent.invalidate()
  }, [presentationSessionId, presentationSessionState, presentationConversationId, presentationDraftId, presentationIntent])
  const [hasPending, setHasPending] = useState(false)
  // Display lifetime only. Once an unresolved journal has exposed recovery,
  // preserve its controls through retry/other reads until that journal clears.
  // This flag never admits, acknowledges, retries or persists a command.
  const [pendingRecoveryVisible, setPendingRecoveryVisible] = useState(false)
  if (!hasPending && pendingRecoveryVisible) setPendingRecoveryVisible(false)
  else if (hasPending && !busy && !pendingRecoveryVisible) setPendingRecoveryVisible(true)
  const [rejectedClaimKey, setRejectedClaimKey] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(() => window.location.pathname === '/auth/complete'
    && !((exchangeConnectionsEnabled || bitgetCanaryEnabled) && readExchangeTransactionLocator(window.location.href))
    && !(gateBrokerEnabled && readGateBrokerTransactionLocator(window.location.href)))
  const [loginRetained, setLoginRetained] = useState(false)
  // Presentation recovery only: a failed durable write must not discard the
  // provider controller, or let its callback imply that the host accepted it.
  const [authStorageRecovery, setAuthStorageRecovery] = useState(false)
  const [loginResume, setLoginResume] = useState(0)
  const loginGeneration = useRef(0)
  const openLoginSequence = useRef(0), openLoginInFlight = useRef(0)
  const [loginBinding, setLoginBinding] = useState<NativeLoginBinding | null>(null)
  const [connectionPlanContinuation, setConnectionPlanContinuation] = useState<ClientConnectionPlanContinuationReceipt | null>(null)
  const discardConnectionPlanLogin = () => {
    try { sessionStorage.removeItem(CONNECTION_PLAN_LOGIN_KEY) } catch { /* Fail closed: memory binding is retired below. */ }
    setLoginBinding(current => {
      if (!current?.connectionPlan) return current
      return { sessionId: current.sessionId, epoch: current.epoch, generation: current.generation, intent: current.intent }
    })
  }
  // A validated missing session on the fixed OAuth return route admits only
  // result/ACK recovery presentation. This is not a session or owner binding.
  const [returnBinding, setReturnBinding] = useState<{ epoch: number; generation: number } | null>(null)
  const returnBindingRef = useRef<typeof returnBinding>(null)
  const exchangeOwnsReturn = () => (exchangeConnectionsEnabled || bitgetCanaryEnabled) && Boolean(readExchangeTransactionLocator(window.location.href))
    || gateBrokerEnabled && Boolean(readGateBrokerTransactionLocator(window.location.href))
  const plainAuthReturn = () => window.location.pathname === '/auth/complete'
    && window.location.search === '' && window.location.hash === '' && !exchangeOwnsReturn()
  useEffect(() => {
    const invalidateReturnDispatch = () => {
      const binding = returnBindingRef.current
      if (!binding) return
      // Keep the same controller/key, including uncertain ACK context, while
      // retiring predicates captured before this navigation. No API is called.
      const next = { ...binding }
      returnBindingRef.current = next; setReturnBinding(next)
      setLoginOpen(false); setLoginRetained(true)
      // The retired observation cannot settle a loading view. Keep the
      // recovery boundary explicit without adopting its stale session result.
      setPhase(current => current === 'loading' ? 'error' : current)
    }
    const events = ['popstate', 'hashchange', 'teth:navigate']
    events.forEach(event => window.addEventListener(event, invalidateReturnDispatch))
    return () => events.forEach(event => window.removeEventListener(event, invalidateReturnDispatch))
  }, [])
  const authReceipt = useRef<{ result: SessionOffer; conversationId?: string } | null>(null)
  const acceptedAuth = useRef('')
  const [claimAvailable, setClaimAvailable] = useState(false)
  const [authNotice, setAuthNotice] = useState<{ sessionId: string; text: string } | null>(null)
  const logoutIntent = useRef<NativeLogoutCommand | null>(null)
  const [hasLogout, setHasLogout] = useState(false)
  const [logoutBoundary, setLogoutBoundary] = useState<'absent' | 'changed' | null>(null)
  const returnPresentationCurrent = () => returnBinding !== null && returnBindingRef.current === returnBinding
    && returnBinding.epoch === epoch.current && returnBinding.generation === loginGeneration.current
    && session.current === null && plainAuthReturn() && !logoutIntent.current
  const returnPanelCurrent = () => {
    if (!returnPresentationCurrent() || working.current || phase === 'loading' || pending.current || emailDispatch.current) return false
    try { return !hasStoredNativeEmailIntent() } catch { return false }
  }
  const paperGeneration = useRef(0)
  const [paperBinding, setPaperBinding] = useState<{ owner: HistoryOwner; scope: NativePaperStorageScope; epoch: number; generation: number } | null>(null)
  const closePaper = () => { paperGeneration.current++; setPaperBinding(null) }
  const smokeGeneration = useRef(0)
  const [smokeBinding, setSmokeBinding] = useState<{ owner: HistoryOwner; binding: StructuralSmokeBinding; contentHash: string; epoch: number; generation: number } | null>(null)
  const closeSmoke = () => { smokeGeneration.current++; setSmokeBinding(null) }
  const remember = (snapshot: ConversationSnapshot, nextEtag: string, persist = true) => {
    etag.current = nextEtag; setConversation(snapshot)
    // Capture the owner only alongside an observed server snapshot. Render
    // never promotes a stored locator or an auth offer into document authority.
    setDocumentOwner(session.current ? { ...session.current, conversationId: snapshot.conversationId, draftId: snapshot.draftId } : null)
    if (!persist) return
    try {
      if (session.current) sessionStorage.setItem(CONVERSATION_OWNER_KEY, session.current.sessionId)
      sessionStorage.setItem(STORAGE_KEY, snapshot.conversationId)
    } catch { /* memory-only remains usable */ }
  }
  const clearViews = (preserveComposer = false, preserveRows = false) => {
    setProposalCombinedClaim(null)
    proposalViewRef.current = null; setProposalView(null); setProposalHold(null); setProposalReview(null)
    setRetainedConsultation(null); setConsultationPresentationEpoch(epoch.current)
    setConnectionPlanContinuation(null)
    setAuthNotice(null)
    clients.replayReaders.invalidate()
    presentationIntent.invalidate(); setAutomaticPresentation(undefined)
    if (!preserveComposer && !preserveRows) rowEdits.clear()
    submittedQuestion.current = null
    // A same-session recheck may hide all views before revalidating the owner.
    // Retain only the exact pending TURN's local location for same-key replay.
    const pendingThreadId = preserveComposer && pending.current?.kind === 'TURN' ? pending.current.body.clientMessageId : undefined
    const pendingThread = pendingThreadId ? researchDispatches.current.get(pendingThreadId) : undefined
    researchDispatches.current.clear()
    if (pendingThreadId && pendingThread) researchDispatches.current.set(pendingThreadId, pendingThread)
    setHomeInputFailure(null)
    setPollIssue(null)
    setRefreshingJob(null)
    setRetainedResult(null)
    setDocumentOwner(null)
    setResultStatus(null)
    closePaper(); closeSmoke()
    if (!preserveComposer) { composerRecovery.current = null; setHasComposerRecovery(false) }
    setRejectedClaimKey(null)
    setPreviousConversation(null); setNavigationError('')
    historyOwner.current = null; setSelectedHistoryOwner(null); setEditingNotice(false)
    setHistoryNavigation({ cursors: [], index: 0, offset: 0 }); setHistoryNotice(''); setHistoryNeedsRefresh(false)
    setConversation(null); etag.current = ''; setMessages([]); setInput(''); setReceipt(null); setChallenge(null); setApproval(null); setJob(null); setHistory(null); setDiff([]); setAcknowledged(false)
  }
  const observeLogoutSession = async (command: NativeLogoutCommand, confirmed = false) => {
    const generation = epoch.current
    clients.setCsrf(null); setLogoutBoundary(null)
    const observed = await clients.session.current().catch(failure => {
      if (failure instanceof ApiResponseError && failure.status === 401 && failure.envelope.error.code === 'AUTHENTICATION_REQUIRED') return null
      throw failure
    })
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    if (!observed) {
      bindSession(null); setSessionState(null); clearViews(); setLogoutBoundary('absent')
      setPhase(confirmed ? 'logged-out' : 'error')
      setError(confirmed ? '로그아웃 응답과 현재 브라우저 세션 부재를 확인했습니다. 서버 전략을 삭제하거나 백테스트를 취소하지 않습니다.'
        : '현재 브라우저 세션이 없습니다. 로그아웃 응답과 서버의 세션 종료 여부는 확인하지 못했습니다. 기존 요청 기록은 보존했습니다.')
      return false
    }
    const value = observed.body.data
    if (value.sessionId !== command.sessionId || value.state !== command.sessionState || observed.etag !== command.ifMatch || value.revision !== command.expectedSessionRevision) {
      bindSession(null); setSessionState(null); clearViews(); setLogoutBoundary('changed'); setPhase('error')
      setError('현재 세션이 로그아웃 요청의 세션과 달라 재전송하지 않았습니다. 다른 세션의 로그아웃이나 전체 계정 종료를 확인한 것이 아닙니다. 기존 요청 기록은 보존했습니다.')
      return false
    }
    const token = await clients.session.csrf()
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    bindSession({ sessionId: value.sessionId, sessionState: command.sessionState })
    clients.setCsrf(token.body.data.csrfToken); setSessionState(command.sessionState); setPhase('ready')
    return true
  }
  const recoverSession = async (retainedReturn: typeof returnBinding = null) => {
    setAuthStorageRecovery(false)
    if (retainedReturn && (returnBindingRef.current !== retainedReturn || !returnPresentationCurrent())) throw new Error('SESSION_CHANGED')
    // Keep unsent text in memory only, never in the mutation journal/storage.
    // A failed read retains this buffer without exposing it under a new owner.
    if (input && session.current && !pending.current && !logoutIntent.current) {
      composerRecovery.current = { ...session.current, conversationId: conversation?.conversationId ?? null, text: input }
      setHasComposerRecovery(true)
    }
    const generation = ++epoch.current
    let recoveringReturn = retainedReturn ? { ...retainedReturn, epoch: generation } : null
    // Recovery unmounts the old auth flow. Its presentation-only retention
    // marker must not strand the next owner in a shell with no memory context.
    // The return-only recheck instead retains its controller/key until a fresh
    // session/CSRF and the existing owner/storage guards can be accepted.
    if (recoveringReturn) {
      returnBindingRef.current = recoveringReturn; setReturnBinding(recoveringReturn)
      setLoginRetained(true)
    } else {
      setLoginRetained(false)
      returnBindingRef.current = null; setReturnBinding(null)
    }
    clients.setCsrf(null); setPhase('loading')
    bindSession(null); setSessionState(null); clearViews(true)
    clients.transport.abort(); clients.conversationTransport.abortInFlight()
    const savedLogout = readNativeLogout()
    if (savedLogout) {
      if (recoveringReturn) {
        returnBindingRef.current = null; setReturnBinding(null); setLoginRetained(false)
        recoveringReturn = null
      }
      logoutIntent.current = savedLogout; setHasLogout(true)
      pending.current = readNativeJournal(); setHasPending(Boolean(pending.current))
      await observeLogoutSession(savedLogout)
      return // Never bootstrap or clear an uncertain logout on reload/recovery.
    }
    const emailRecovery = hasStoredNativeEmailIntent()
    if (emailRecovery && recoveringReturn) {
      returnBindingRef.current = null; setReturnBinding(null); setLoginRetained(false)
      recoveringReturn = null
    }
    const authReturn = !emailRecovery && window.location.pathname === '/auth/complete' && !exchangeOwnsReturn()
    const gateReturn = gateBrokerEnabled && Boolean(readGateBrokerTransactionLocator(window.location.href))
    if (!emailRecovery && !authReturn) {
      try { sessionStorage.removeItem(CONNECTION_PLAN_LOGIN_KEY) } catch { /* Stale UI intent remains non-authorizing. */ }
    }
    // Query/hash values are not callback authority. Malformed return URLs do
    // not fall through to anonymous creation; protected recovery stays first.
    if (authReturn && !plainAuthReturn()) throw new Error('SESSION_CHANGED')
    const existing = emailRecovery || authReturn || gateReturn ? await clients.session.current().catch(failure => {
      if (!(failure instanceof ApiResponseError) || failure.status !== 401 || failure.envelope.error.code !== 'AUTHENTICATION_REQUIRED') throw failure
      if (generation !== epoch.current || (recoveringReturn && returnBindingRef.current !== recoveringReturn)) return null
      if (emailRecovery) {
        setPhase('error'); setError('이전 이메일 요청의 세션을 확인할 수 없습니다. 새 익명 세션을 자동 발급하지 않았습니다. 새로고침으로 사라진 인증번호·CSRF는 복구할 수 없으며 기존 전략과 요청 기록은 보존했습니다.')
      } else {
        if (!plainAuthReturn()) throw new Error('SESSION_CHANGED')
        pending.current = readNativeJournal(); setHasPending(Boolean(pending.current))
        const binding = recoveringReturn ?? { epoch: generation, generation: ++loginGeneration.current }
        returnBindingRef.current = binding; setReturnBinding(binding)
        setLoginBinding(null); setLoginRetained(true); setLoginOpen(true)
        setPhase('error'); setError(pending.current
          ? '미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.' : '')
      }
      return null
    }) : null
    if (generation !== epoch.current || (recoveringReturn && returnBindingRef.current !== recoveringReturn)) return
    if ((emailRecovery || authReturn || gateReturn) && !existing) return
    if (authReturn && !plainAuthReturn()) throw new Error('SESSION_CHANGED')
    // Direct return GETs must retain the existing browser-session invariant
    // before any CSRF read or session/owner adoption; the SDK stays unchanged.
    if ((authReturn || gateReturn) && existing && existing.body.meta.resourceRevision !== existing.body.data.revision) throw new Error('SESSION_CHANGED')
    if (existing && !['ANONYMOUS', 'AUTHENTICATED'].includes(existing.body.data.state)) throw new Error('SESSION_CHANGED')
    // An untrusted email locator suppresses creation only. The existing session
    // still comes from the real SDK GET, not a stored authentication receipt.
    const result = existing ? { kind: 'EXISTING_SESSION' as const, current: { response: existing } } : await clients.bootstrap()
    const token = await clients.session.csrf()
    if (generation !== epoch.current || (recoveringReturn && returnBindingRef.current !== recoveringReturn)) return
    if (authReturn && !plainAuthReturn()) throw new Error('SESSION_CHANGED')
    const observed = result.current.response.body.data
    const current = { sessionId: observed.sessionId, sessionState: observed.state as 'ANONYMOUS' | 'AUTHENTICATED' }
    const binding = JSON.stringify(current)
    let savedCommand = readNativeJournal()
    const previousBinding = sessionStorage.getItem(SESSION_KEY)
    const changed = result.kind === 'BOOTSTRAP_CONFIRMED' || (previousBinding !== null && previousBinding !== binding)
      || (savedCommand !== null && (savedCommand.sessionId !== current.sessionId || savedCommand.sessionState !== current.sessionState))
    // A newly issued anonymous session still invalidates all prior authority.
    // Only report a replacement when this tab actually held prior context;
    // a clean first visit must retain the original home composer.
    const replacedContext = changed && (previousBinding !== null || savedCommand !== null
      || sessionStorage.getItem(STORAGE_KEY) !== null || sessionStorage.getItem(CONVERSATION_OWNER_KEY) !== null)
    if (emailRecovery && changed && savedCommand) {
      // Keep the observed AUTH owner available for explicit, freshly checked
      // logout, but never attach the old journal or draft to that owner.
      bindSession(current); setSessionState(current.sessionState)
      pending.current = savedCommand; setHasPending(true)
      setPhase('error'); setError('이메일 복구 중 세션이 달라 이전 미확정 전략 요청을 보존했습니다. 이 요청을 새 세션에 자동 연결하거나 폐기하지 않았습니다.')
      return
    }
    if (authReturn && changed && savedCommand) {
      // A valid session read does not resolve or discard a different owner's
      // pending mutation. Keep its durable journal and all business gates closed.
      pending.current = savedCommand; setHasPending(true)
      const returnScope = recoveringReturn ?? { epoch: generation, generation: ++loginGeneration.current }
      returnBindingRef.current = returnScope; setReturnBinding(returnScope)
      setLoginBinding(null); setLoginRetained(true); setLoginOpen(true)
      setPhase('error'); setError('미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.')
      return
    }
    if (changed) {
      clearNativeJournal(); savedCommand = null
      authReceipt.current = null; setClaimAvailable(false)
    }
    sessionStorage.setItem(SESSION_KEY, binding)
    if (sessionStorage.getItem(SESSION_KEY) !== binding) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
    if (recoveringReturn) { returnBindingRef.current = null; setReturnBinding(null); setLoginRetained(false) }
    bindSession(current)
    setLoginBinding({ sessionId: current.sessionId, epoch: generation, generation: loginGeneration.current, intent: 'login' })
    try { setPreviousConversation(readPreviousConversation(current.sessionId)); setNavigationError('') }
    catch { setPreviousConversation(null); setNavigationError('read') }
    clients.setCsrf(token.body.data.csrfToken)
    setSessionState(current.sessionState)
    pending.current = savedCommand; setHasPending(Boolean(savedCommand))
    const saved = savedCommand?.kind === 'CLAIM' ? null : savedCommand && 'conversationId' in savedCommand ? savedCommand.conversationId : sessionStorage.getItem(STORAGE_KEY)
    const savedOwner = sessionStorage.getItem(CONVERSATION_OWNER_KEY)
    if (current.sessionState === 'AUTHENTICATED' && savedOwner && savedOwner !== current.sessionId) setLoginOpen(true)
    // An old-session locator can support an explicit claim offer, but cannot
    // become the current conversation until the server transfers ownership.
    if (saved && !changed && (!savedOwner || savedOwner === current.sessionId) && /^[A-Za-z0-9_-]{1,160}$/.test(saved)) {
      const restored = await clients.conversation.getConversation(saved).catch(failure => { setPhase('error'); throw failure })
      if (generation !== epoch.current) return
      if (restored.body.data.conversationId !== saved) throw new Error('BINDING_CONFLICT')
      remember(restored.body.data, restored.etag)
    }
    const composer = composerRecovery.current
    if (composer) {
      if (changed || composer.sessionId !== current.sessionId || composer.sessionState !== current.sessionState || composer.conversationId !== (saved ?? null)
        || (savedOwner && savedOwner !== current.sessionId) || savedCommand) {
        composerRecovery.current = null; setHasComposerRecovery(false)
      } else {
        // A second authoritative session observation follows the draft GET.
        const confirmed = await clients.session.current().catch(failure => { setPhase('error'); throw failure })
        if (generation !== epoch.current) return
        if (confirmed.body.data.sessionId !== current.sessionId || confirmed.body.data.state !== current.sessionState
          || confirmed.body.data.revision !== observed.revision || confirmed.etag !== result.current.response.etag) {
          clients.setCsrf(null); bindSession(null); setSessionState(null); clearViews(); setPhase('error')
          throw new Error('SESSION_CHANGED')
        }
        // A newer onInput event clears/replaces the candidate; never overwrite it.
        if (composerRecovery.current === composer) {
          setInput(value => value || composer.text)
          composerRecovery.current = null; setHasComposerRecovery(false)
        }
      }
    }
    setError(savedCommand ? '확인하지 못한 요청이 있습니다. 저장 기록은 승인 증거가 아닙니다. 같은 요청으로 명시적으로 재개해주세요.'
      : replacedContext ? '세션이 변경되어 이전 요청과 승인 표시를 무효화했습니다. 서버 이력에서 상태를 확인해주세요.' : '')
    setInitialConnectionFailed(false)
    setPhase('ready')
  }
  useEffect(() => {
    let active = true
    const boundary = epoch
    void Promise.resolve().then(() => { if (active) return recoverSession() }).catch(() => { if (active) { setInitialConnectionFailed(initialHome); setPhase('error'); setError('세션 또는 복구 저장소를 확인하지 못했습니다. 서버 상태를 삭제하지 않았습니다.') } })
      .finally(() => { if (active) setInitializing(false) })
    return () => { active = false; boundary.current++; clients.setCsrf(null); clients.transport.abort(); clients.conversationTransport.abortInFlight() }
    // Session recovery is an explicit boundary, never an effect of view state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients])
  // Poll only observed jobs. An HTTP failure never becomes a fabricated FAILED job.
  useEffect(() => {
    if (!job || ['COMPLETED', 'FAILED', 'INVALID'].includes(job.state)) return
    const generation = epoch.current
    const control = startNativeJobPolling({
      read: async () => (await clients.native.jobs.call('getNativeBacktestV7', { backtestId: job.backtestId })).data,
      isCurrent: () => generation === epoch.current,
      accept: value => {
        assertSameJob(value, job)
        const display = presentationIntent.observe(value)
        if (display) setAutomaticPresentation(display)
        setPollIssue(null); setJob(value)
      },
      onFailure: retrying => setPollIssue({ job, retrying }),
      visibility: {
        hidden: () => document.visibilityState === 'hidden',
        subscribe: listener => {
          document.addEventListener('visibilitychange', listener)
          return () => document.removeEventListener('visibilitychange', listener)
        },
      },
    })
    jobPolling.current = { job, control }
    return () => { control.stop(); if (jobPolling.current?.control === control) jobPolling.current = null }
  }, [clients, job, presentationIntent])
  const reportFailure = (failure: unknown) => {
    if (!clients.getCsrf()) setPhase('error')
    if (authenticationRequired(failure)) {
      clients.setCsrf(null); setPhase('error'); setSessionState(null)
    }
    setError(failure instanceof NativeSubmitNotReady ? `NOT_READY · ${nativeSubmitNotReadyCopy}`
      : `${safeCode(failure)} · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.`)
  }
  const run = async (operation: () => Promise<void>) => {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try { await operation() }
    catch (failure) { reportFailure(failure) }
    finally { working.current = false; setBusy(false) }
  }
  const runHistory = (operation: () => Promise<void>) => run(async () => {
    setHistoryPending(true)
    try { await operation() }
    finally { setHistoryPending(false) }
  })
  const openLogin = (intent: NativeAuthIntent = 'login', planRequest?: ClientConnectionPlanAuthRequest) => {
    const sequence = ++openLoginSequence.current
    const runOpenLogin = async () => {
      // Re-entry may replace a display continuation while the first session
      // observation is pending. Business operations remain mutually excluded.
      if (working.current && openLoginInFlight.current === 0) return
      if (openLoginInFlight.current++ === 0) { working.current = true; setBusy(true); setError('') }
      try { await performOpenLogin() }
      catch (failure) { if (sequence === openLoginSequence.current) reportFailure(failure) }
      finally {
        openLoginInFlight.current--
        if (openLoginInFlight.current === 0) { working.current = false; setBusy(false) }
      }
    }
    const performOpenLogin = async () => {
    if (returnBindingRef.current) {
      if (!plainAuthReturn()) {
        setError('로그인 반환 화면을 벗어났습니다. 해당 화면으로 돌아가 세션을 다시 확인해주세요. 새 로그인을 시작하지 않았습니다.')
        setLoginRetained(true); setLoginOpen(true)
        return
      }
      if (!returnPresentationCurrent()) return
      setLoginOpen(true); setLoginRetained(true); return
    }
    if (authStorageRecovery && phase === 'error' && loginRetained && loginBinding
      && !logoutIntent.current && !pending.current && loginBinding.sessionId === session.current?.sessionId
      && loginBinding.epoch === epoch.current && loginBinding.generation === loginGeneration.current) {
      // Reopen only the retained controller's redacted recovery shell. This
      // local transition grants neither a session nor a new provider request.
      setLoginResume(value => value + 1); setLoginOpen(true); return
    }
    if (logoutIntent.current || !session.current || phase !== 'ready') return
    const owner = session.current, generation = epoch.current
    if (loginRetained) {
      // This opens only a redacted recovery shell. No previous link, provider
      // confirmation or ACK affordance is restored by this local transition.
      const retained = loginBinding
      if (!retained || retained.sessionId !== owner.sessionId || retained.epoch !== generation
        || retained.generation !== loginGeneration.current) return
      try {
        // A new entry while the same auth controller is retained replaces its
        // presentation continuation, but never restarts its provider/email work.
        const current = await clients.session.current(), value = current.body.data
        if (sequence !== openLoginSequence.current) return
        if (generation !== epoch.current || logoutIntent.current || !loginRetained
          || retained.generation !== loginGeneration.current || value.sessionId !== owner.sessionId
          || value.state !== owner.sessionState || !current.etag) throw new Error('SESSION_CHANGED')
        let connectionPlan: NativeConnectionPlanLoginIntent | undefined
        if (planRequest !== undefined) {
          if (!connectionPlanRequest(planRequest) || intent !== 'signup' || owner.sessionState !== 'ANONYMOUS'
            || planRequest.sourceSessionId !== owner.sessionId) throw new Error('SESSION_CHANGED')
          connectionPlan = { ...planRequest, sourceEtag: current.etag, sourceEpoch: generation, panelGeneration: retained.generation }
          const raw = JSON.stringify(connectionPlan)
          sessionStorage.setItem(CONNECTION_PLAN_LOGIN_KEY, raw)
          if (sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
        } else if (sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) !== null) {
          sessionStorage.removeItem(CONNECTION_PLAN_LOGIN_KEY)
          if (sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) !== null) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
        }
        setLoginBinding({ sessionId: retained.sessionId, epoch: retained.epoch, generation: retained.generation, intent,
          ...(connectionPlan ? { connectionPlan } : {}) })
        setLoginResume(value => value + 1); setLoginOpen(true)
      } catch (failure) {
        if (sequence !== openLoginSequence.current) return
        // The retained challenge remains mounted, but a stale/partially written
        // presentation hint must never survive the user's newer entry intent.
        try { sessionStorage.removeItem(CONNECTION_PLAN_LOGIN_KEY) } catch { /* Fail closed in memory below. */ }
        setLoginBinding(current => current?.sessionId === retained.sessionId && current.epoch === retained.epoch
          && current.generation === retained.generation
          ? { sessionId: current.sessionId, epoch: current.epoch, generation: current.generation, intent }
          : current)
        throw failure
      }
      return
    }
    try {
      // Closing preserves memory only. Reopening does not replay START/ACK:
      // first verify the present cookie owner with the existing validated SDK.
      const current = await clients.session.current(), value = current.body.data
      if (sequence !== openLoginSequence.current || generation !== epoch.current || logoutIntent.current) return
      const allowed = value.state === owner.sessionState
      if (value.sessionId !== owner.sessionId || !allowed || !current.etag) throw new Error('SESSION_CHANGED')
      let connectionPlan: NativeConnectionPlanLoginIntent | undefined
      if (planRequest !== undefined) {
        if (!connectionPlanRequest(planRequest) || intent !== 'signup' || owner.sessionState !== 'ANONYMOUS'
          || planRequest.sourceSessionId !== owner.sessionId) throw new Error('SESSION_CHANGED')
        connectionPlan = { ...planRequest, sourceEtag: current.etag, sourceEpoch: generation, panelGeneration: loginGeneration.current }
        const raw = JSON.stringify(connectionPlan)
        sessionStorage.setItem(CONNECTION_PLAN_LOGIN_KEY, raw)
        if (sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      } else if (sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) !== null) {
        sessionStorage.removeItem(CONNECTION_PLAN_LOGIN_KEY)
        if (sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) !== null) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      }
      const currentConsultation = consultation.getSnapshot()
      if (consultationChat && owner.sessionState === 'ANONYMOUS' && currentConsultation.conversationId) {
        const intent: ConsultationLoginIntent = { sourceSessionId: owner.sessionId, sourceEtag: current.etag,
          conversationId: currentConsultation.conversationId, panelGeneration: loginGeneration.current }
        const raw = JSON.stringify(intent)
        sessionStorage.setItem(CONSULTATION_LOGIN_KEY, raw)
        if (sessionStorage.getItem(CONSULTATION_LOGIN_KEY) !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      } else if (sessionStorage.getItem(CONSULTATION_LOGIN_KEY) !== null) {
        sessionStorage.removeItem(CONSULTATION_LOGIN_KEY)
        if (sessionStorage.getItem(CONSULTATION_LOGIN_KEY) !== null) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      }
      setLoginBinding({ sessionId: owner.sessionId, epoch: generation, generation: loginGeneration.current, intent, ...(connectionPlan ? { connectionPlan } : {}) })
      setLoginOpen(true)
    } catch (failure) {
      if (sequence !== openLoginSequence.current) return
      if (generation === epoch.current) {
        loginGeneration.current++; setLoginBinding(null); setLoginRetained(false); setLoginOpen(false)
      }
      throw failure
    }
    }
    return runOpenLogin()
  }
  const reopenReturnRoute = () => {
    const binding = returnBindingRef.current
    if (!binding || binding.epoch !== epoch.current || binding.generation !== loginGeneration.current
      || session.current || logoutIntent.current || working.current || emailDispatch.current) return
    // Explicit local navigation only. Retain the same controller and uncertain
    // ACK key; this neither creates an owner nor dispatches result/ACK/claim.
    window.history.pushState(window.history.state, '', '/auth/complete')
    window.dispatchEvent(new Event('teth:navigate'))
    setLoginRetained(true); setLoginOpen(true)
    setError(pending.current ? '미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.' : '')
  }
  const recheckReturnSession = async () => {
    if (!returnPresentationCurrent() || emailDispatch.current || hasStoredNativeEmailIntent()) throw new Error('SESSION_CHANGED')
    const binding = returnBindingRef.current
    const current = await clients.session.current().catch(failure => {
      if (!(failure instanceof ApiResponseError) || failure.status !== 401 || failure.envelope.error.code !== 'AUTHENTICATION_REQUIRED') throw failure
      return null
    })
    if (returnBindingRef.current !== binding || !returnPresentationCurrent()) return
    if (!current) {
      // A missing session is not a reason to restart the controller or create
      // an anonymous owner, including after an uncertain ACK. Reopen only.
      setLoginRetained(true); setLoginOpen(true)
      if (pending.current) setError('미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.')
      return
    }
    if (current.body.meta.resourceRevision !== current.body.data.revision) throw new Error('SESSION_CHANGED')
    // Re-observe through the existing plain-return GET/CSRF path. It does not
    // infer provider/ACK success or claim, and cannot bootstrap on this route.
    await recoverSession(binding)
  }
  const contextFor = (command: NativeMutationCommand) => {
    const csrfToken = clients.getCsrf()
    if (!csrfToken || !session.current || command.sessionId !== session.current.sessionId || command.sessionState !== session.current.sessionState) throw new Error('SESSION_REQUIRED')
    return { csrfToken, idempotencyKey: command.idempotencyKey, ...('ifMatch' in command ? { ifMatch: command.ifMatch } : {}) }
  }
  const executeCommand = async (original: NativeMutationCommand) => {
    const generation = epoch.current
    const assertCurrent = () => { if (generation !== epoch.current) throw new Error('SESSION_CHANGED') }
    let command = original
    if (command.kind === 'CREATE_TURN') {
      const created = await clients.conversation.createConversation(contextFor(command))
      assertCurrent()
      const next: NativeMutationCommand = { version: 1, kind: 'TURN', sessionId: command.sessionId, sessionState: command.sessionState,
        idempotencyKey: command.turnIdempotencyKey, conversationId: created.body.data.conversationId, draftId: created.body.data.draftId,
        ifMatch: created.etag, body: { ...expected(created.body.data), clientMessageId: command.clientMessageId, message: command.message } }
      // The second command is durable before any turn is sent. If this write
      // fails, replay the original create key, never allocate a replacement.
      writeNativeJournal(next); pending.current = next; command = next
      remember(created.body.data, created.etag)
      // A confirmed new conversation follows the user's new question choice.
      // Retire only the old optional offer; never claim or delete its strategy.
      authReceipt.current = null; setClaimAvailable(false)
    }
    const context = contextFor(command)
    const complete = () => { assertCurrent(); clearNativeJournal(); pending.current = null; setHasPending(false) }
    const assertBinding = (value: { conversationId: string; draftId: string; conversationStateRevision: string; conversationStateHash: string; draftRevision: string; projectionHash: string; semanticHash?: string }, request: Extract<NativeMutationCommand, { kind: 'VALIDATE' | 'CHALLENGE' | 'APPROVE' }>) => {
      if (value.conversationId !== request.conversationId || value.draftId !== request.draftId
        || value.conversationStateRevision !== request.body.expectedConversationStateRevision
        || value.conversationStateHash !== request.body.expectedConversationStateHash) throw new Error('BINDING_CONFLICT')
      if (!strategyConversation || strategyConversation.conversationId !== value.conversationId || strategyConversation.draftId !== value.draftId
        || strategyConversation.conversationStateRevision !== value.conversationStateRevision || strategyConversation.conversationStateHash !== value.conversationStateHash
        || strategyConversation.draftRevision !== value.draftRevision || strategyConversation.projectionHash !== value.projectionHash
        || (value.semanticHash !== undefined && value.semanticHash !== strategyConversation.semanticHash)) throw new Error('BINDING_CONFLICT')
    }
    switch (command.kind) {
      case 'CLAIM': {
        const value = await clients.session.claim({ id: command.initiatingSessionId, body: { expectedSessionRevision: command.expectedSessionRevision },
          context: { ...context, ifMatch: command.ifMatch } }).catch(failure => {
          assertCurrent()
          // Only an SDK-validated, definitive rejection can offer abandonment.
          // A transport failure, malformed response or lost ACK stays pending.
          if (failure instanceof ApiResponseError && failure.status === 400 && failure.envelope.error.code === 'BAD_REQUEST') setRejectedClaimKey(command.idempotencyKey)
          throw failure
        })
        assertCurrent()
        if (value.body.data.sessionId !== command.sessionId || value.body.data.sessionId === command.initiatingSessionId) throw new Error('BINDING_CONFLICT')
        const observed = await clients.session.current()
        assertCurrent()
        if (observed.body.data.state !== 'AUTHENTICATED' || observed.body.data.sessionId !== command.sessionId
          || observed.body.data.revision !== value.body.data.revision) throw new Error('BINDING_CONFLICT')
        const token = await clients.session.csrf()
        const restored = command.conversationId ? await clients.conversation.getConversation(command.conversationId) : null
        assertCurrent()
        if (restored && restored.body.data.conversationId !== command.conversationId) throw new Error('BINDING_CONFLICT')
        complete(); epoch.current++; clearViews()
        clients.setCsrf(token.body.data.csrfToken)
        if (restored) remember(restored.body.data, restored.etag)
        forgetNativeEmailLocator(command.initiatingSessionId)
        authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false)
        setAuthNotice({ sessionId: command.sessionId, text: restored ? '로그인 전 전략의 서버 연결을 확인했습니다. 검증과 승인은 다시 확인해주세요.'
          : '서버 인계 응답과 현재 인증 세션을 확인했습니다. 이 브라우저에는 복구할 대화 식별자가 없어 전략 내용은 확인하지 못했습니다.' })
        setError('')
        return
      }
      case 'TURN': {
        const response = await clients.conversation.createTurn(command.conversationId, command.body, context)
        assertCurrent()
        const next = response.body.data.conversation
        if (next.conversationId !== command.conversationId || next.draftId !== command.draftId) throw new Error('BINDING_CONFLICT')
        await rowEdits.verify(command, response.body.data)
        assertCurrent()
        const previous = conversation?.draftState.projection
        const changed = Object.keys(next.draftState.projection).filter(key => !previous || JSON.stringify(previous[key as keyof typeof previous]) !== JSON.stringify(next.draftState.projection[key as keyof typeof previous]))
        complete(); remember(next, response.etag); setDiff(changed)
        rowEdits.observe(command, response.body.data)
        const { clientMessageId, message } = command.body
        const researchThread = researchOrigin(command)
        researchDispatches.current.delete(clientMessageId)
        const displayText = displayedQuestion(command.sessionId, clientMessageId, message)
        // The accepted message owns its display wording now. Manual same-key
        // recovery does not pass through send's finally, so release it here too.
        if (displayText !== undefined) submittedQuestion.current = null
        const reply = next.nextQuestion?.prompt ?? (next.candidateState === 'READY_FOR_VALIDATION' ? '전략 조건을 정리했습니다. 초안과 변경 항목을 확인한 뒤 검증할 수 있습니다.' : '서버가 반환한 초안을 확인해주세요.')
        setMessages(value => [...value.filter(item => item.id !== clientMessageId && item.id !== `${clientMessageId}_reply`),
          { id: clientMessageId, role: 'user', text: message, displayText, researchThread }, { id: `${clientMessageId}_reply`, role: 'assistant', researchThread,
            text: reply, observation: captureTurnObservation(response.body.data, next.nextQuestion
              ? { text: next.nextQuestion.prompt } : { key: next.candidateState === 'READY_FOR_VALIDATION' ? 'readyReply' : 'draftReply' }) }])
        return
      }
      case 'VALIDATE': {
        const value = (await clients.conversation.validateDraft(command.draftId, command.body, context)).body.data
        assertCurrent(); assertBinding(value, command); complete()
        setChallenge(null); setAcknowledged(false)
        if (value.status === 'INVALID') { setReceipt(null); setError(`전략 검증 실패: ${value.issues.map(item => item.code).join(', ')}`) }
        else setReceipt(value)
        // One observed result per explicit request. Same-key replay replaces
        // this entry; a fresh verification remains a separate observation.
        // The private React key is never displayed or saved as a transcript.
        const observationId = `validation_${command.idempotencyKey}`
        setMessages(messages => [...messages.filter(message => message.id !== observationId), {
          id: observationId, role: 'assistant', text: '전략 검증 결과를 확인했습니다.', observation: captureValidationObservation(value),
        }])
        return
      }
      case 'CHALLENGE': {
        const value = (await clients.conversation.createApprovalChallenge(command.draftId, command.body, context)).body.data
        assertCurrent(); assertBinding(value, command)
        if (value.validationReceiptId !== command.body.validationReceiptId || value.semanticHash !== command.body.acknowledgedSemanticHash || value.consumptionState !== 'AVAILABLE') throw new Error('BINDING_CONFLICT')
        complete(); setChallenge(value); setAcknowledged(false)
        if (proposalActive && receipt) {
          const reviewed = await proposalOrchestration.approvalReview({ view: proposalActive, receipt, challenge: value,
            isCurrent: () => generation === epoch.current && proposalViewRef.current === proposalActive
              && session.current?.sessionId === command.sessionId && session.current.sessionState === command.sessionState })
          assertCurrent()
          setProposalReview(reviewed); setProposalHold(reviewed ? null : 'APPROVAL_COMPANION_UNAVAILABLE')
        }
        return
      }
      case 'APPROVE': {
        if (proposalActive && proposalHold) throw new Error('APPROVAL_COMPANION_UNAVAILABLE')
        if (proposalActive) {
          if (!receipt || !challenge || !proposalReview || proposalReview.challengeId !== command.body.approvalChallengeId) throw new Error('APPROVAL_COMPANION_UNAVAILABLE')
          const reviewed = await proposalOrchestration.approvalReview({ view: proposalActive, receipt, challenge,
            isCurrent: () => generation === epoch.current && proposalViewRef.current === proposalActive
              && session.current?.sessionId === command.sessionId && session.current.sessionState === command.sessionState })
          assertCurrent()
          if (!reviewed || canonicalApiV22(reviewed) !== canonicalApiV22(proposalReview)) {
            setProposalHold('APPROVAL_COMPANION_UNAVAILABLE'); setAcknowledged(false)
            throw new Error('APPROVAL_COMPANION_UNAVAILABLE')
          }
        }
        const value = (await clients.conversation.approveDraft(command.draftId, command.body, context)).body.data
        assertCurrent()
        assertBinding({ conversationId: value.sourceConversationId, draftId: value.sourceDraftId, conversationStateRevision: value.sourceConversationStateRevision, conversationStateHash: value.sourceConversationStateHash,
          draftRevision: value.sourceDraftRevision, projectionHash: value.sourceProjectionHash, semanticHash: value.semanticHash }, command)
        if (value.validationReceiptId !== command.body.validationReceiptId || value.approvalChallengeId !== command.body.approvalChallengeId || value.semanticHash !== command.body.acknowledgedSemanticHash) throw new Error('BINDING_CONFLICT')
        complete(); setApproval(value); setSelectedHistoryOwner(null); setEditingNotice(false)
        return
      }
      case 'SUBMIT': {
        const source = proposalActive?.snapshot.conversationId === command.conversationId ? proposalActive : null
        if (!conversation && !source) throw new Error('BINDING_CONFLICT')
        if (source) {
          if (!approval || approval.strategyVersionId !== command.body.strategyVersionId || approval.semanticHash !== command.body.expectedSemanticHash
            || source.owner !== JSON.stringify([command.sessionId, command.sessionState])) throw new Error('BINDING_CONFLICT')
          await sourceBacktestAuthority().confirm(source, approval, () => sourceBacktestCurrent(source, generation))
          assertCurrent(); contextFor(command)
        }
        // Generated v0.7 client binds strategyVersionId, semanticHash and
        // profileId to this exact request before returning the accepted job.
        const value = await clients.native.jobs.call('submitNativeBacktestV7', command.body, context).catch(failure => {
          if (failure instanceof ApiV07Error && failure.code === 'NOT_READY') throw new NativeSubmitNotReady()
          throw failure
        })
        complete(); presentationIntent.acceptSubmission(command.idempotencyKey, value.data)
        setSourceJobScope(source ? sourceJobBinding(source, value.data) : null)
        setResultStatus(null); setJob(value.data)
        return
      }
    }
  }
  // Initial dispatch and same-key recovery share this presentation boundary.
  // It never treats a pending/local journal as a server acknowledgement.
  const execute = async (command: NativeMutationCommand) => {
    const generation = epoch.current
    const request = command.kind === 'CREATE_TURN' ? command : command.kind === 'TURN' ? command.body : null
    try {
      if (request) {
        contextFor(command)
        const displayText = displayedQuestion(command.sessionId, request.clientMessageId, request.message)
        const researchThread = researchOrigin(command)
        setMessages(messages => messages.some(message => message.id === request.clientMessageId)
          ? messages.map(message => message.id === request.clientMessageId ? { ...message, delivery: 'pending' } : message) : [...messages, {
          id: request.clientMessageId, role: 'user', text: request.message, displayText, delivery: 'pending', researchThread,
        }])
      }
      await executeCommand(command)
    } catch (failure) {
      if (request && generation === epoch.current) {
        rowEdits.observe(command)
        setMessages(messages => messages.map(message => message.id === request.clientMessageId && message.delivery === 'pending'
          ? { ...message, delivery: 'uncertain' } : message))
      }
      throw failure
    }
  }
  const start = async (command: NativeMutationCommand, prepare?: () => Promise<void>, clearComposer = true) => {
    if (working.current || emailDispatch.current || pending.current || logoutIntent.current || phase !== 'ready') return
    await run(async () => {
      if (prepare) await prepare()
      // A failed durable write is fail-closed: no mutation has been sent.
      try { writeNativeJournal(command) }
      catch {
        // This catch covers the initial local journal write only, never execute
        // or a journal update after a server mutation. Readback may have failed
        // after storage accepted bytes, so do not remove or overwrite them here.
        // No dispatch has happened and the composer has not been cleared.
        // Keep its exact text and the shell's selected template chips. Writing
        // command.message here replaces the user's draft with generated text
        // and makes the shell discard those chips. The journal still owns the
        // combined request if a failed readback actually left durable bytes.
        const message = command.kind === 'CREATE_TURN' || command.kind === 'TURN'
          ? `요청 기록을 저장·확인하지 못해 이번 질문을 서버로 전송하지 않았습니다. ${command.kind === 'CREATE_TURN' ? '선택한 템플릿과 작성 내용은' : '작성한 내용은'} 유지했습니다. 저장소에 이번 요청이 남아 있을 수 있으니 세션을 다시 확인해주세요.`
          : '요청 기록을 저장·확인하지 못해 이번 요청을 서버로 전송하지 않았습니다. 저장소를 확인한 뒤 다시 시도해주세요.'
        setHomeInputFailure(command.kind === 'CREATE_TURN' ? message : null)
        setError(message)
        return
      }
      pending.current = command; setHasPending(true)
      setAuthNotice(null)
      // Only a fresh request in this component lifetime earns a visual stamp.
      // A same-key uncertain retry may retain it; a restored journal has none.
      if (command.kind === 'SUBMIT') {
        presentationIntent.beginSubmission(command.idempotencyKey)
        setAutomaticPresentation(undefined)
      }
      if (command.kind === 'CREATE_TURN' || command.kind === 'TURN') {
        // Quick replies send their own text, not the separate unsent composer.
        if (clearComposer) setInput('')
        setReceipt(null); setChallenge(null); setAcknowledged(false)
      }
      await execute(command)
    })
  }
  const base = () => {
    if (!session.current) throw new Error('SESSION_REQUIRED')
    return { version: 1 as const, ...session.current, idempotencyKey: crypto.randomUUID() }
  }
  const draftBase = (snapshot: ConversationSnapshot) => ({ ...base(), conversationId: snapshot.conversationId, draftId: snapshot.draftId,
    ifMatch: proposalActive?.snapshot === snapshot ? proposalActive.etag : etag.current })
  const executeLogout = async (command: NativeLogoutCommand) => {
    if (!await observeLogoutSession(command)) return
    const generation = epoch.current
    const token = clients.getCsrf()
    if (!token) throw new Error('SESSION_REQUIRED')
    const response = await clients.session.logout({ context: { csrfToken: token, idempotencyKey: command.idempotencyKey, ifMatch: command.ifMatch } })
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    const value = response.body.data
    if (value.sessionId !== command.sessionId || value.state !== 'REVOKED' || BigInt(value.revision) !== BigInt(command.expectedSessionRevision) + 1n) throw new Error('BINDING_CONFLICT')
    // Cookie headers are browser-owned. A new tab may have replaced the cookie;
    // never call the current session logged out without a separate observation.
    await observeLogoutSession(command, true)
  }
  const logout = () => run(async () => {
    if (logoutIntent.current) { await executeLogout(logoutIntent.current); return }
    if (sessionState !== 'AUTHENTICATED' || !['ready', 'error'].includes(phase)) return
    const generation = epoch.current, bound = session.current
    const current = await clients.session.current()
    if (generation !== epoch.current) return
    if (!bound || current.body.data.sessionId !== bound.sessionId || current.body.data.state !== 'AUTHENTICATED') {
      clients.setCsrf(null); setSessionState(null); setPhase('error'); throw new Error('SESSION_CHANGED')
    }
    const command: NativeLogoutCommand = { version: 1, kind: 'LOGOUT', sessionId: bound.sessionId, sessionState: 'AUTHENTICATED',
      idempotencyKey: crypto.randomUUID(), ifMatch: current.etag!, expectedSessionRevision: current.body.data.revision }
    // Separate from business mutations: logging out never deletes their journal.
    writeNativeLogout(command); logoutIntent.current = command; setHasLogout(true)
    forgetNativeEmailLocator()
    epoch.current++; clients.transport.abort(); clients.conversationTransport.abortInFlight()
    clearViews(); authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false)
    await executeLogout(command)
  })
  const newSessionAfterLogout = () => run(async () => {
    const command = logoutIntent.current
    if (!command || !logoutBoundary) return
    // Recheck on the explicit boundary; no absent-session inference revokes any
    // server session. Original business request bytes remain in detached storage.
    if (await observeLogoutSession(command)) return
    detachNativeJournalAfterLogout()
    sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(CONVERSATION_OWNER_KEY)
    logoutIntent.current = null; setHasLogout(false); setLogoutBoundary(null)
    pending.current = null; setHasPending(false); acceptedAuth.current = ''
    // A new, explicitly selected session gets its own one-shot bootstrap.
    // Recovery of an ambiguous bootstrap never resets that factory.
    clients.bootstrap = createBrowserSessionBootstrap()
    await recoverSession()
    setError('')
  })
  const recordSessionOffer = (result: SessionOffer, confirmation: 'ACK_CONFIRMED' | 'EMAIL_CONFIRMED' | 'HANDOFF_UNVERIFIED'): void => {
    if (logoutIntent.current) { setError('로그아웃 요청을 확인하는 동안 로그인 인계와 전략 연결을 진행하지 않습니다. 현재 세션을 다시 확인해주세요.'); return }
    if (pending.current) { setError('미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.'); return }
    const identity = `${confirmation}:${result.sessionId}:${result.claimIntent?.initiatingSessionId}:${result.claimIntent?.expectedSessionRevision}`
    if (acceptedAuth.current === identity) return
    const offerEpoch = epoch.current
    // The login panel has verified the cookie round trip. This callback only
    // records an offer. A verified consultation login consumes the user's
    // original, durable continuation intent once; Draft-only claim stays explicit.
    try {
      const sameAuthenticatedOwner = confirmation === 'HANDOFF_UNVERIFIED' && session.current?.sessionId === result.sessionId && session.current.sessionState === 'AUTHENTICATED'
      const savedOwner = sessionStorage.getItem(CONVERSATION_OWNER_KEY)
      // A locator only offers a choice. Its pre-login owner must match; an
      // unrelated stored draft never inherits the current anonymous session.
      const initiatingOwner = result.claimIntent?.initiatingSessionId
      let consultationIntent: ConsultationLoginIntent | null = null
      let loginIntentRaw: string | null = null
      const dropLoginHint = () => {
        try {
          if (loginIntentRaw !== null && sessionStorage.getItem(CONSULTATION_LOGIN_KEY) === loginIntentRaw) {
            sessionStorage.removeItem(CONSULTATION_LOGIN_KEY)
            return sessionStorage.getItem(CONSULTATION_LOGIN_KEY) === null
          }
        } catch { /* A retry locator is not login authority. */ }
        return false
      }
      try {
        loginIntentRaw = consultationEnabled && confirmation !== 'HANDOFF_UNVERIFIED'
          ? sessionStorage.getItem(CONSULTATION_LOGIN_KEY) : null
        const value = loginIntentRaw && new TextEncoder().encode(loginIntentRaw).length <= 4_096
          ? JSON.parse(loginIntentRaw) as ConsultationLoginIntent : null
        if (value && Object.keys(value).sort().join(',') === 'conversationId,panelGeneration,sourceEtag,sourceSessionId'
          && typeof value.conversationId === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value.conversationId)
          && value.sourceSessionId === initiatingOwner && value.sourceEtag === result.claimIntent?.initiatingSessionEtag
          && Number.isSafeInteger(value.panelGeneration) && value.panelGeneration >= 0
          && (returnPanelCurrent() || loginBinding?.sessionId === initiatingOwner
            && loginBinding.epoch === epoch.current && loginBinding.generation === value.panelGeneration
            && session.current?.sessionState === 'ANONYMOUS' && session.current.sessionId === initiatingOwner
            && consultation.getSnapshot().conversationId === value.conversationId)) consultationIntent = value
      } catch { /* Invalid continuation hints must not reject a verified login. */ }
      if (!consultationIntent) dropLoginHint()
      let connectionPlanReceipt: ClientConnectionPlanContinuationReceipt | null = null
      let planIntentRaw: string | null = null
      const dropPlanHint = () => {
        try {
          if (planIntentRaw !== null && sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) === planIntentRaw) {
            sessionStorage.removeItem(CONNECTION_PLAN_LOGIN_KEY)
            return sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY) === null
          }
        } catch { /* A presentation continuation is never login authority. */ }
        return false
      }
      try {
        planIntentRaw = sessionStorage.getItem(CONNECTION_PLAN_LOGIN_KEY)
        const value = confirmation !== 'HANDOFF_UNVERIFIED' && planIntentRaw && new TextEncoder().encode(planIntentRaw).length <= 4_096
          ? JSON.parse(planIntentRaw) as NativeConnectionPlanLoginIntent : null
        const inMemory = loginBinding?.connectionPlan
        const samePanel = returnPanelCurrent() || Boolean(inMemory && loginBinding
          && loginBinding.sessionId === value?.sourceSessionId && loginBinding.epoch === epoch.current
          && loginBinding.generation === value?.panelGeneration && inMemory.requestId === value?.requestId
          && inMemory.sourceEpoch === value?.sourceEpoch && inMemory.sourceEtag === value?.sourceEtag)
        if (value && Object.keys(value).sort().join(',') === 'issuer,operation,panelGeneration,plan,requestId,sourceEpoch,sourceEtag,sourceSessionId'
          && connectionPlanRequest({ issuer: value.issuer, operation: value.operation, requestId: value.requestId,
            sourceSessionId: value.sourceSessionId, plan: value.plan })
          && typeof value.sourceEtag === 'string' && /^"[A-Za-z0-9_-]{16,128}"$/.test(value.sourceEtag)
          && Number.isSafeInteger(value.sourceEpoch) && value.sourceEpoch >= 0
          && Number.isSafeInteger(value.panelGeneration) && value.panelGeneration >= 0 && samePanel
          && value.sourceSessionId === initiatingOwner && value.sourceEtag === result.claimIntent?.initiatingSessionEtag
          && dropPlanHint()) connectionPlanReceipt = { issuer: value.issuer, operation: value.operation, requestId: value.requestId,
            sourceSessionId: value.sourceSessionId, targetSessionId: result.sessionId, plan: value.plan }
      } catch { /* Invalid/stale presentation hints are discarded below. */ }
      if (!connectionPlanReceipt) dropPlanHint()
      // Preserve only this tab's unsent wording across a verified login offer.
      // It is neither a conversation claim nor permission to send under AUTH.
      // Session-only recovery, foreign locators and stale panels keep clearing.
      const unsentInput = confirmation !== 'HANDOFF_UNVERIFIED' && (phase === 'ready' || (phase === 'error' && authStorageRecovery))
        && session.current?.sessionState === 'ANONYMOUS' && session.current.sessionId === initiatingOwner
        && result.claimIntent?.initiatingSessionEtag && loginBinding?.sessionId === initiatingOwner
        && loginBinding.epoch === epoch.current && loginBinding.generation === loginGeneration.current
        && (!savedOwner || savedOwner === initiatingOwner) && (!conversation || documentOwner?.sessionId === initiatingOwner)
        ? input : ''
      const observed = conversation && documentOwner && documentOwner.sessionId === initiatingOwner
        && documentOwner.conversationId === conversation.conversationId ? conversation.conversationId : undefined
      const stored = savedOwner === initiatingOwner ? sessionStorage.getItem(STORAGE_KEY) : null
      const candidate = observed ?? stored
      const saved = initiatingOwner && candidate && /^[A-Za-z0-9_-]{1,160}$/.test(candidate) ? candidate : undefined
      const current = { sessionId: result.sessionId, sessionState: 'AUTHENTICATED' as const }
      const binding = JSON.stringify(current)
      // No owner/epoch/controller teardown until the locator is durable.
      // A partial write remains an untrusted locator, never login authority.
      sessionStorage.setItem(SESSION_KEY, binding)
      if (sessionStorage.getItem(SESSION_KEY) !== binding) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      let continuationReady = false
      if (consultationIntent) {
        try {
          consultationSession.offer({ anonymousSessionId: consultationIntent.sourceSessionId,
            anonymousIfMatch: consultationIntent.sourceEtag, targetSessionId: result.sessionId, conversationId: consultationIntent.conversationId })
          // Verified ACK/email consumes one explicit login intent, not an AUTH
          // GET or a storage hint. Lost claim responses remain same-key retries.
          continuationReady = dropLoginHint()
          if (!continuationReady) consultationSession.markUnconfirmed()
        } catch { /* Preserve an existing/corrupt record for explicit recovery, without rolling back login. */ }
      }
      const claimSource = sourceIntakeRef.current
      sourceIntakeClaim.current = continuationReady && consultationIntent
        ? { sourceSessionId: consultationIntent.sourceSessionId, targetSessionId: result.sessionId,
          conversationId: consultationIntent.conversationId,
          ...(claimSource && claimSource.owner === JSON.stringify([consultationIntent.sourceSessionId, 'ANONYMOUS'])
            && claimSource.locatorOwner === claimSource.owner && claimSource.conversationId === consultationIntent.conversationId
            ? { state: claimSource } : {}) }
        : null
      const retained = consultationIntent && session.current?.sessionId === consultationIntent.sourceSessionId
        && consultation.getSnapshot().conversationId === consultationIntent.conversationId ? consultation.getSnapshot().messages : null
      clearNativeJournal()
      epoch.current++; clients.transport.abort(); clients.conversationTransport.abortInFlight()
      clients.setCsrf(null); bindSession(null); clearViews()
      pending.current = null; setHasPending(false); setAuthStorageRecovery(false)
      bindSession(current); clients.setCsrf(result.csrfToken); setSessionState('AUTHENTICATED'); setPhase('ready')
      if (connectionPlanReceipt) setConnectionPlanContinuation(connectionPlanReceipt)
      if (consultationIntent) {
        if (retained) setRetainedConsultation({ epoch: epoch.current, targetSessionId: result.sessionId, messages: retained })
      }
      if (unsentInput) setInput(unsentInput)
      if (sameAuthenticatedOwner) setLoginBinding({ sessionId: current.sessionId, epoch: epoch.current, generation: loginGeneration.current, intent: loginBinding?.intent ?? 'login' })
      else { setLoginBinding(null); setLoginOpen(false); setLoginRetained(false) }
      authReceipt.current = { result, ...(saved ? { conversationId: saved } : {}) }; acceptedAuth.current = identity; setClaimAvailable(Boolean(saved && result.claimIntent?.initiatingSessionEtag))
      setAuthNotice({ sessionId: result.sessionId, text: confirmation === 'HANDOFF_UNVERIFIED'
        ? '현재 인증 세션만 확인했습니다. 공급자 인증·로그인 확정 응답·전략 인계는 미확인입니다. 별도 연결 요청은 서버가 최종 확인합니다.'
        : !saved ? '로그인을 확인했습니다.'
          : result.claimIntent?.initiatingSessionEtag ? '로그인을 확인했습니다. 로그인 전 전략은 아직 연결하거나 승인하지 않았습니다.'
            : '현재 인증 세션은 확인했지만 로그인 전 세션의 사전조건을 복구하지 못해 전략 연결을 차단했습니다. 인증 세션 ETag로 대체하지 않습니다.' })
      setError('')
      if (continuationReady) void continueConsultationSession()
    } catch {
      // Preserve a still-current provider controller for an explicit retry.
      // Email keeps its existing error/recheck presentation, not provider ACK UI.
      const recoverable = epoch.current === offerEpoch
      setAuthStorageRecovery(recoverable && confirmation !== 'EMAIL_CONFIRMED')
      clients.setCsrf(null); setPhase('error')
      setSessionState(recoverable && confirmation !== 'EMAIL_CONFIRMED' ? session.current?.sessionState ?? null : null)
      setError('로그인 후 복구 저장소를 확인하지 못했습니다. 전략 연결과 승인은 실행하지 않았습니다.')
    }
  }
  const assertRecordedSessionOffer = (result: SessionOffer, confirmation: 'ACK_CONFIRMED' | 'EMAIL_CONFIRMED' | 'HANDOFF_UNVERIFIED') => {
    const identity = `${confirmation}:${result.sessionId}:${result.claimIntent?.initiatingSessionId}:${result.claimIntent?.expectedSessionRevision}`
    if (acceptedAuth.current !== identity || session.current?.sessionId !== result.sessionId
      || session.current.sessionState !== 'AUTHENTICATED' || clients.getCsrf() !== result.csrfToken) throw new Error('SESSION_CHANGED')
  }
  const authenticated = (result: NativeAuthenticated): void => {
    if (result.verification !== 'COOKIE_BOUND_SESSION_ROUND_TRIP') { setError('로그인 확인 근거가 일치하지 않아 전략 연결을 차단했습니다.'); return }
    recordSessionOffer(result, 'ACK_CONFIRMED')
    assertRecordedSessionOffer(result, 'ACK_CONFIRMED')
  }
  const sessionRecovered = (result: NativeSessionRecovery): void => {
    if (result.verification !== 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED') { setError('세션 복구 근거가 일치하지 않아 전략 연결을 차단했습니다.'); return }
    recordSessionOffer(result, 'HANDOFF_UNVERIFIED')
    assertRecordedSessionOffer(result, 'HANDOFF_UNVERIFIED')
  }
  const emailAuthenticated = (result: NativeEmailAuthenticated): void => {
    if (result.verification !== 'EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP') { setError('이메일 로그인 확인 근거가 일치하지 않아 전략 연결을 차단했습니다.'); return }
    recordSessionOffer(result, 'EMAIL_CONFIRMED')
    assertRecordedSessionOffer(result, 'EMAIL_CONFIRMED')
  }
  const claim = async () => {
    const offered = authReceipt.current
    if (!offered?.conversationId || !offered.result.claimIntent?.initiatingSessionEtag || session.current?.sessionId !== offered.result.sessionId || phase !== 'ready') return
    const generation = epoch.current
    await start({ ...base(), kind: 'CLAIM', initiatingSessionId: offered.result.claimIntent.initiatingSessionId,
      // Claim's If-Match belongs to the pre-login ANONYMOUS resource, not the
      // current authenticated session. Consume only its observed server ETag.
      expectedSessionRevision: offered.result.claimIntent.expectedSessionRevision, ifMatch: offered.result.claimIntent.initiatingSessionEtag,
      conversationId: offered.conversationId }, async () => {
      // Only a new explicit claim gets this preflight. Pending same-key replay
      // continues through execute with its existing in-memory CSRF context.
      const assertOffer = () => { if (generation !== epoch.current || authReceipt.current !== offered || logoutIntent.current) throw new Error('SESSION_CHANGED') }
      const rejectBinding = (): never => {
        clients.setCsrf(null); bindSession(null); setSessionState(null); setPhase('error')
        authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false); setLoginRetained(false)
        clearViews(); epoch.current++; throw new Error('SESSION_CHANGED')
      }
      const current = await clients.session.current(); assertOffer()
      if (current.body.data.state !== 'AUTHENTICATED' || current.body.data.sessionId !== offered.result.sessionId || !current.etag) rejectBinding()
      const token = await clients.session.csrf(), confirmed = await clients.session.current(); assertOffer()
      if (confirmed.body.data.state !== 'AUTHENTICATED' || confirmed.body.data.sessionId !== current.body.data.sessionId
        || confirmed.body.data.revision !== current.body.data.revision || confirmed.etag !== current.etag) rejectBinding()
      clients.setCsrf(token.body.data.csrfToken)
    })
  }
  const continueConsultationSession = async () => {
    const owner = session.current, generation = epoch.current
    if (!owner || owner.sessionState !== 'AUTHENTICATED' || logoutIntent.current || pending.current
      || consultationSession.getSnapshot().busy) return
    const assertCurrent = () => {
      if (generation !== epoch.current || session.current?.sessionId !== owner.sessionId
        || session.current.sessionState !== owner.sessionState || logoutIntent.current) throw new Error('SESSION_CHANGED')
    }
    const observe = async (signal?: AbortSignal) => {
      const assertObservation = () => { assertCurrent(); signal?.throwIfAborted() }
      assertObservation()
      const observed = await clients.session.current(); assertObservation()
      if (observed.body.data.sessionId !== owner.sessionId || observed.body.data.state !== 'AUTHENTICATED'
        || observed.body.meta.resourceRevision !== observed.body.data.revision || !observed.etag) throw new Error('SESSION_CHANGED')
      const token = await clients.session.csrf(); assertObservation()
      const confirmed = await clients.session.current(); assertObservation()
      if (confirmed.body.data.sessionId !== observed.body.data.sessionId || confirmed.body.data.state !== observed.body.data.state
        || confirmed.body.meta.resourceRevision !== confirmed.body.data.revision
        || confirmed.body.data.revision !== observed.body.data.revision || confirmed.etag !== observed.etag) throw new Error('SESSION_CHANGED')
      clients.setCsrf(token.body.data.csrfToken)
      return { sessionId: confirmed.body.data.sessionId, state: confirmed.body.data.state, revision: confirmed.body.data.revision }
    }
    if (!consultationSession.setPorts({ currentSession: observe, refreshSession: observe,
      restoreConversation: async (conversationId, targetSessionId, anonymousSessionId) => {
        assertCurrent()
        if (owner.sessionId !== targetSessionId) return false
        consultation.bindOwner(JSON.stringify([targetSessionId, 'AUTHENTICATED']))
        const restored = await consultation.restoreConversation(conversationId); assertCurrent()
        if (!restored || !await consultation.restoreClaimedDocumentAnchors(
          JSON.stringify([anonymousSessionId, 'ANONYMOUS']), conversationId)) return false
        assertCurrent()
        const reportWorkId = consultation.verifiedReportResearchWorkId()
        if (reportWorkId && !await recoverClaimedReportSource.current(reportWorkId, anonymousSessionId)) return false
        assertCurrent()
        const candidate = consultation.getSnapshot().setupCandidate
        if (candidate) try {
          const alias = restoreClaimedSourceIntake(candidate)
          if (alias) { sourceIntakeRef.current = alias; setSourceIntake(alias) }
        } catch { setSourceIntakeIssue(true) }
        return true
      } })) return
    const restored = await consultationSession.claim()
    if (generation !== epoch.current || session.current?.sessionId !== owner.sessionId || session.current.sessionState !== owner.sessionState) return
    if (restored) {
      // claim() true includes current AUTH recheck plus history/anchor restore;
      // COMBINED comes only from the separately captured typed server reply.
      setProposalCombinedClaim(proposalClaimAdapter.completed(sourceIntakeRef.current,
        JSON.stringify([owner.sessionId, owner.sessionState]), generation))
      setRetainedConsultation(null); setError('')
    }
    else {
      if (consultationSession.getSnapshot().issue === 'request-refused') sourceIntakeClaim.current = null
      setError(consultationSession.getSnapshot().issue === 'request-refused'
        ? 'REQUEST_UNCONFIRMED · 서버가 요청을 확정적으로 거절했습니다. 이 로컬 요청 기록만 폐기할 수 있으며 서버 이력은 삭제하지 않습니다.'
        : 'REQUEST_UNCONFIRMED · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.')
    }
  }
  const discardRejectedClaim = () => run(async () => {
    const command = pending.current, generation = epoch.current
    if (command?.kind !== 'CLAIM' || command.idempotencyKey !== rejectedClaimKey) return
    const current = await clients.session.current()
    if (generation !== epoch.current) return
    if (current.body.data.state !== 'AUTHENTICATED' || current.body.data.sessionId !== command.sessionId) {
      clients.setCsrf(null); setSessionState(null); setPhase('error')
      throw new Error('SESSION_CHANGED')
    }
    const token = await clients.session.csrf()
    if (generation !== epoch.current) return
    // This explicit action discards a rejected local request only. No server
    // resource is deleted, claimed, approved or recreated by this handler.
    sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(CONVERSATION_OWNER_KEY)
    clearNativeJournal(); pending.current = null; setHasPending(false)
    epoch.current++; clearViews(); clients.setCsrf(token.body.data.csrfToken)
    authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false); setError(''); setPhase('ready')
  })
  const send = async (text: string, source: 'composer' | 'quick-reply' = 'composer', displayText?: string, researchThread?: NativeResearchThreadOrigin) => {
    if (!text.trim() || working.current || pending.current || busy || hasPending || hasLogout || approval || job || phase !== 'ready') return
    const clientMessageId = `client_message_${crypto.randomUUID()}`
    if (researchThread) {
      if (!conversation || !documentOwner || !session.current
        || documentOwner.sessionId !== session.current.sessionId || documentOwner.sessionState !== sessionState
        || researchThread.scopeId !== JSON.stringify([documentOwner.sessionId, documentOwner.sessionState, conversation.conversationId, conversation.draftId])) return
      const supplied = presentations.researchPresentation?.scope === accountScope && presentations.researchPresentation.data.scopeId === researchThread.scopeId
        ? presentations.researchPresentation.data : undefined
      const ids: readonly string[] = [...RESEARCH_DOCUMENT_SURFACES.map(item => item.id), ...(supplied?.documents ?? []).map(item => item.id), ...(supplied?.typedDocuments ?? []).map(item => item.id)]
      if (!ids.includes(researchThread.documentId)) return
      researchDispatches.current.set(clientMessageId, { ...researchThread })
    }
    if (!conversation && session.current && displayText?.trim() && displayText !== text) {
      submittedQuestion.current = { sessionId: session.current.sessionId, clientMessageId, message: text, displayText }
    }
    try {
      await start(conversation ? { ...draftBase(conversation), kind: 'TURN', body: { ...expected(conversation), clientMessageId, message: text } }
        : { ...base(), kind: 'CREATE_TURN', turnIdempotencyKey: crypto.randomUUID(), clientMessageId, message: text }, undefined, source === 'composer')
    } finally {
      // start may install a pending command after the synchronous null guard.
      const command = pending.current as NativeMutationCommand | null
      const pendingId = command?.kind === 'CREATE_TURN' ? command.clientMessageId : command?.kind === 'TURN' ? command.body.clientMessageId : null
      if (pendingId !== clientMessageId && submittedQuestion.current?.clientMessageId === clientMessageId) submittedQuestion.current = null
      if (pendingId !== clientMessageId) researchDispatches.current.delete(clientMessageId)
    }
  }
  const documentQuestionTarget = (researchThread: NativeResearchThreadOrigin) => {
    const owner = session.current
    if (!owner || !consultationEnabled || phase !== 'ready' || !clients.getCsrf()) return null
    if (conversation && documentOwner
      && documentOwner.sessionId === owner.sessionId && documentOwner.sessionState === owner.sessionState
      && documentOwner.conversationId === conversation.conversationId && documentOwner.draftId === conversation.draftId
      && researchThread.scopeId === JSON.stringify([owner.sessionId, owner.sessionState, conversation.conversationId, conversation.draftId])
      && researchThread.documentId === 'plan') {
      return { kind: 'plan' as const, documentId: conversation.draftId }
    }
    if (proposalActive && proposalActive.owner === JSON.stringify([owner.sessionId, owner.sessionState])
      && researchThread.scopeId === proposalActive.researchWorkId && researchThread.documentId === 'plan') {
      return { kind: 'plan' as const, documentId: proposalActive.snapshot.draftId }
    }
    const candidate = consultation.getSnapshot().setupCandidate
    const acceptedSource = sourceIntake?.status === 'accepted' ? sourceIntake : null
    const completion = acceptedSource?.completion ?? null
    if (acceptedSource && completion && researchProjection?.state === 'COMPLETED'
      && researchProjection.researchWorkId === completion.researchWorkId
      && consultation.getSnapshot().conversationId === acceptedSource.conversationId
      && (!candidate || acceptedSource.locatorOwner === candidate.owner && acceptedSource.conversationId === candidate.conversationId
        && acceptedSource.turnId === candidate.turnId && acceptedSource.pair === candidate.setup.pair)
      && acceptedSource.locatorOwner === JSON.stringify([owner.sessionId, owner.sessionState])
      && researchThread.scopeId === completion.researchWorkId && researchThread.documentId === 'report') {
      return { kind: 'report' as const, documentId: completion.researchWorkId }
    }
    return null
  }
  const sendConsultation = async (text: string, displayText?: string, clearComposer = true, researchThread?: NativeResearchThreadOrigin) => {
    const documentTarget = researchThread ? documentQuestionTarget(researchThread) : null
    if ((researchThread && !documentTarget) || (!consultationChat && !documentTarget)
      || phase !== 'ready' || !session.current || !clients.getCsrf()
      || consultationState.availability !== 'available' || consultationState.busy
      || emailBusy || hasPending || hasLogout || (consultationSession.getSnapshot().available && consultationSession.getSnapshot().issue !== 'request-refused')
      || retainedConsultation?.epoch === epoch.current && retainedConsultation.targetSessionId === session.current?.sessionId) return false
    const owner = { ...session.current }
    const accepted = documentTarget && researchThread
      ? await consultation.sendDocumentQuestion({ ...documentTarget, text, researchThread })
      : await consultation.send(text, displayText)
    const currentDocumentTarget = researchThread ? documentQuestionTarget(researchThread) : null
    if (accepted && clearComposer && session.current?.sessionId === owner.sessionId
      && session.current.sessionState === owner.sessionState && consultation.getSnapshot().conversationId !== null
      && (documentTarget ? JSON.stringify(currentDocumentTarget) === JSON.stringify(documentTarget) : consultationChatRef.current)) setInput('')
    return accepted
  }
  const refreshConsultationMutationAuthority = async () => {
    const owner = session.current, generation = epoch.current
    if (!owner || phase !== 'ready') throw new Error('SESSION_CHANGED')
    const observed = await clients.session.current()
    if (generation !== epoch.current || session.current?.sessionId !== owner.sessionId || session.current.sessionState !== owner.sessionState
      || observed.body.data.sessionId !== owner.sessionId || observed.body.data.state !== owner.sessionState
      || observed.body.meta.resourceRevision !== observed.body.data.revision || !observed.etag) throw new Error('SESSION_CHANGED')
    const token = await clients.session.csrf(), confirmed = await clients.session.current()
    if (generation !== epoch.current || session.current?.sessionId !== owner.sessionId || session.current.sessionState !== owner.sessionState
      || confirmed.body.data.sessionId !== observed.body.data.sessionId || confirmed.body.data.state !== observed.body.data.state
      || confirmed.body.data.revision !== observed.body.data.revision || confirmed.etag !== observed.etag) throw new Error('SESSION_CHANGED')
    clients.setCsrf(token.body.data.csrfToken)
    return { owner, generation, revision: confirmed.body.data.revision }
  }
  recoverClaimedReportSource.current = async (researchWorkId, expectedSourceSessionId) => {
    const owner = session.current, conversationId = consultation.getSnapshot().conversationId
    if (!owner || !conversationId || phase !== 'ready' || !clients.getCsrf()) return false
    const locatorOwner = JSON.stringify([owner.sessionId, owner.sessionState])
    const attempt = JSON.stringify([locatorOwner, conversationId, researchWorkId])
    if (reportRecoverySucceeded.current.has(attempt)) {
      const current = sourceIntakeRef.current?.locatorOwner === locatorOwner
        && sourceIntakeRef.current.completion?.researchWorkId === researchWorkId
      if (current) return true
      reportRecoverySucceeded.current.delete(attempt)
    }
    const existing = reportRecoveryInFlight.current.get(attempt)
    if (existing) return existing
    const recovery = (async () => {
      const source = recoverableAcceptedSourceIntake(researchWorkId, conversationId, locatorOwner, expectedSourceSessionId)
      if (!source || !source.idempotencyKey || !source.completion) { setSourceIntakeIssue(true); return false }
      try {
        const authority = await refreshConsultationMutationAuthority()
        if (authority.owner.sessionId !== owner.sessionId || authority.owner.sessionState !== owner.sessionState
          || consultation.verifiedReportResearchWorkId() !== researchWorkId) throw new Error('SESSION_CHANGED')
        const completed = await sourceIntakeAdapter.complete(source.conversationId, source.turnId, source.value.answers, source.idempotencyKey)
        if (authority.generation !== epoch.current || session.current?.sessionId !== owner.sessionId
          || session.current.sessionState !== owner.sessionState
          || consultation.getSnapshot().conversationId !== conversationId || consultation.verifiedReportResearchWorkId() !== researchWorkId
          || completed.completionCommitId !== source.completion.completionCommitId
          || completed.sourceIntakeReceipt.receiptId !== source.completion.receiptId
          || completed.researchWorkIntent.researchWorkId !== source.completion.researchWorkId
          || completed.sourceIntakeReceipt.sourceSessionId !== source.completion.sourceSessionId) throw new Error('SESSION_CHANGED')
        const alias = Object.freeze({ ...source, locatorOwner })
        const key = sourceIntakeStorageKey(alias), raw = JSON.stringify(alias), stored = sessionStorage.getItem(key)
        if (stored !== null && stored !== raw) throw new Error('SOURCE_INTAKE_STORAGE_INVALID')
        if (stored === null) writeSourceIntakeState(alias)
        if (sessionStorage.getItem(key) !== raw) throw new Error('SOURCE_INTAKE_STORAGE_INVALID')
        sourceIntakeRef.current = alias; setSourceIntake(alias); setSourceIntakeIssue(false)
        return true
      } catch { setSourceIntakeIssue(true); return false }
    })()
    reportRecoveryInFlight.current.set(attempt, recovery)
    try {
      const recovered = await recovery
      if (recovered) reportRecoverySucceeded.current.add(attempt)
      return recovered
    } finally {
      if (reportRecoveryInFlight.current.get(attempt) === recovery) reportRecoveryInFlight.current.delete(attempt)
    }
  }
  const sourceIntakeCurrent = (expected: NativeSourceIntakeState, generation = sourceIntakeGeneration.current) => {
    const candidate = consultation.getSnapshot().setupCandidate, owner = session.current
    const bindingCurrent = candidate !== null
      ? sourceIntakeBinding(candidate) === JSON.stringify([expected.locatorOwner, expected.conversationId, expected.turnId, expected.pair])
      : expected.status === 'accepted' && expected.completion !== null
        && consultation.getSnapshot().conversationId === expected.conversationId
    return generation === sourceIntakeGeneration.current && sourceIntakeRef.current === expected && bindingCurrent
      && owner !== null && expected.locatorOwner === JSON.stringify([owner.sessionId, owner.sessionState])
  }
  const acceptSourceIntakeState = (next: NativeSourceIntakeState) => {
    writeSourceIntakeState(next)
    sourceIntakeRef.current = next; setSourceIntake(next)
  }
  const submitSourceIntake = async (command: NativeSourceIntakeState) => {
    if (sourceIntakeInFlight.current || !(command.status === 'uncertain' || command.status === 'accepted' && command.completion === null)
      || command.idempotencyKey === null || !sourceIntakeCurrent(command)) return
    const generation = sourceIntakeGeneration.current
    const flight = { command, controller: new AbortController() }
    sourceIntakeInFlight.current = flight; setSourceIntakeSubmitting(true); setSourceIntakeIssue(false)
    try {
      const authority = await refreshConsultationMutationAuthority()
      if (authority.generation !== epoch.current || !sourceIntakeCurrent(command, generation)) throw new Error('SESSION_CHANGED')
      const completed = await sourceIntakeAdapter.complete(command.conversationId, command.turnId, command.value.answers, command.idempotencyKey, flight.controller.signal)
      if (!sourceIntakeCurrent(command, generation)) return
      acceptSourceIntakeState(Object.freeze({ ...command, status: 'accepted', completion: Object.freeze({
        completionCommitId: completed.completionCommitId,
        receiptId: completed.sourceIntakeReceipt.receiptId,
        researchWorkId: completed.researchWorkIntent.researchWorkId,
        sourceSessionId: completed.sourceIntakeReceipt.sourceSessionId,
      }) }))
      setSourceIntakeIssue(false)
    } catch (error) {
      if (sourceIntakeCurrent(command, generation)) {
        if (error instanceof NativeSourceIntakeV19Error && error.code === 'SOURCE_INTAKE_INVALID') {
          acceptSourceIntakeState(Object.freeze({ ...command, value: Object.freeze({ answers: [] }), status: 'collecting', idempotencyKey: null, completion: null }))
        }
        setSourceIntakeIssue(true)
      }
    } finally {
      if (sourceIntakeInFlight.current === flight) {
        sourceIntakeInFlight.current = null
        if (generation === sourceIntakeGeneration.current) setSourceIntakeSubmitting(false)
      }
    }
  }
  const pickNativeSourceIntake: ClientServiceSourceIntake['onPick'] = (key, index, recommended) => {
    const current = sourceIntakeRef.current, candidate = consultation.getSnapshot().setupCandidate
    if (!current || !candidate || current.status !== 'collecting' || sourceIntakeSubmitting || !sourceIntakeCurrent(current)) return false
    const value = pickSourceIntake(current.value, key, index, recommended)
    if (!value) return false
    try {
      const complete = value.answers.length === 5
      const next: NativeSourceIntakeState = Object.freeze({ ...current, value: Object.freeze({ answers: value.answers.map(answer => Object.freeze({ ...answer })) }),
        status: complete ? 'uncertain' : 'collecting', idempotencyKey: complete ? `source_intake_${crypto.randomUUID()}` : null, completion: null })
      acceptSourceIntakeState(next); setSourceIntakeIssue(false)
      if (complete) void submitSourceIntake(next)
      return true
    } catch {
      setSourceIntakeIssue(true)
      return false
    }
  }
  const restartNativeSourceIntake = () => {
    const current = sourceIntakeRef.current
    if (!current || sourceIntakeSubmitting || !sourceIntakeCurrent(current)) return
    try {
      acceptSourceIntakeState(Object.freeze({ ...current, value: Object.freeze({ answers: [] }), status: 'collecting', idempotencyKey: null, completion: null }))
      setSourceIntakeIssue(false)
    } catch { setSourceIntakeIssue(true) }
  }
  const resumeSourceIntake = async () => {
    const current = sourceIntakeRef.current
    if (current?.status === 'uncertain' || current?.status === 'accepted' && current.completion === null) await submitSourceIntake(current)
  }
  useEffect(() => {
    if (sourceIntake?.status === 'accepted' && sourceIntake.completion === null && sourceIntake.idempotencyKey
      && sourceIntakeCurrent(sourceIntake)) void submitSourceIntake(sourceIntake)
    // Reload recovery replays only the persisted API19 idempotency key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceIntake])
  useEffect(() => {
    const accepted = sourceIntake, completion = accepted?.completion
    if (!accepted || accepted.status !== 'accepted' || !completion || !sourceIntakeCurrent(accepted) || phase !== 'ready') {
      setResearchProjection(null); setResearchProjectionIssue(false); return
    }
    const controller = new AbortController(), generation = sourceIntakeGeneration.current
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, observations = 0
    setResearchProjection(Object.freeze({ researchWorkId: completion.researchWorkId, state: 'QUEUED' }))
    setResearchProjectionIssue(false)
    const poll = async () => {
      if (disposed || !sourceIntakeCurrent(accepted, generation)) return
      try {
        const projection = await researchWorkAdapter.read(completion.researchWorkId, controller.signal)
        if (disposed || !sourceIntakeCurrent(accepted, generation) || projection.researchWorkId !== completion.researchWorkId) return
        setResearchProjection(projection); setResearchProjectionIssue(false)
        if (['COMPLETED', 'FAILED', 'CANCELLED', 'AMBIGUOUS'].includes(projection.state)) return
        observations++
        if (observations >= 150) { setResearchProjectionIssue(true); return }
        timer = setTimeout(() => { void poll() }, 4_000)
      } catch (error) {
        if (disposed || controller.signal.aborted || error instanceof ApiV20Error && error.code === 'ABORTED') return
        if (!sourceIntakeCurrent(accepted, generation)) return
        setResearchProjectionIssue(true)
        const retryable = error instanceof ApiV20Error
          && ['TRANSPORT_FAILED', 'RATE_LIMITED', 'INTERNAL_ERROR'].includes(error.code)
        observations++
        if (retryable && observations < 150) timer = setTimeout(() => { void poll() }, 4_000)
      }
    }
    void poll()
    return () => { disposed = true; controller.abort(); if (timer !== undefined) clearTimeout(timer) }
    // Primitive binding changes retire the old GET and its late response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, researchWorkAdapter, sourceIntake?.completion?.researchWorkId, sourceIntake?.locatorOwner,
    sourceIntake?.conversationId, sourceIntake?.turnId, sourceIntake?.pair, setupBinding])
  useEffect(() => {
    const accepted = sourceIntake, report = researchProjection
    const owner = session.current, generation = epoch.current, sourceGeneration = sourceIntakeGeneration.current
    if (!consultationChat || phase !== 'ready' || !owner || !accepted || accepted.status !== 'accepted'
      || !accepted.completion || report?.state !== 'COMPLETED' || report.researchWorkId !== accepted.completion.researchWorkId
      || !sourceIntakeCurrent(accepted, sourceGeneration)) {
      proposalViewRef.current = null; setProposalView(null); setProposalHold(null); setProposalReview(null); return
    }
    const controller = new AbortController()
    let disposed = false, observations = 0, timer: ReturnType<typeof setTimeout> | undefined
    const current = () => !disposed && generation === epoch.current && sourceIntakeCurrent(accepted, sourceGeneration)
      && session.current?.sessionId === owner.sessionId && session.current.sessionState === owner.sessionState
    const observe = async () => {
      if (!current()) return
      try {
        const readOnlyRecovery = accepted.owner !== accepted.locatorOwner && proposalCombinedClaim === null
        if (readOnlyRecovery) {
          const claimState = consultationSession.getSnapshot(), history = consultation.getSnapshot()
          if (owner.sessionState !== 'AUTHENTICATED' || claimState.available || claimState.busy
            || history.availability !== 'available' || history.busy || history.conversationId !== accepted.conversationId) {
            proposalViewRef.current = null; setProposalView(null); setProposalHold('API22_CLAIM_UNAVAILABLE'); return
          }
        }
        const authority = readOnlyRecovery ? await refreshConsultationReadAuthority() : await refreshConsultationMutationAuthority()
        if (!current() || authority.generation !== generation) return
        if (proposalCombinedClaim && BigInt(authority.revision) < BigInt(proposalCombinedClaim.revision)) {
          setProposalHold('API22_CLAIM_UNAVAILABLE'); return
        }
        const csrfToken = readOnlyRecovery ? '' : clients.getCsrf()
        if (csrfToken === null) throw new Error('SESSION_CHANGED')
        const value = await proposalOrchestration.observe({ owner: accepted.locatorOwner, sourceOwner: accepted.owner,
          researchWorkId: report.researchWorkId, sourceConversationId: accepted.conversationId,
          sourceTurnId: accepted.turnId, reportText: report.reportText, csrfToken, isCurrent: current, signal: controller.signal,
          ...(proposalCombinedClaim ? { combinedClaim: proposalCombinedClaim, epoch: generation } : readOnlyRecovery ? { readOnlyRecovery: true } : {}) })
        if (!current()) return
        if (proposalViewRef.current?.bound.bindingHash !== value.view?.bound.bindingHash) {
          setProposalReview(null); setReceipt(null); setChallenge(null); setAcknowledged(false)
        }
        proposalViewRef.current = value.view; setProposalView(value.view); setProposalHold(value.hold)
        setResearchProjectionIssue(Boolean(value.hold && value.hold !== 'APPROVAL_COMPANION_UNAVAILABLE'))
        if (NativeResearchProposalOrchestration.shouldObserve(value, observations++)) timer = setTimeout(() => { void observe() }, 4_000)
      } catch { if (current()) { setProposalHold('REQUEST_UNCONFIRMED'); setResearchProjectionIssue(true) } }
    }
    // StrictMode's setup/cleanup replay cannot dispatch either mutation.
    queueMicrotask(() => { if (current()) void observe() })
    return () => { disposed = true; controller.abort(); if (timer !== undefined) clearTimeout(timer) }
    // Immutable source/report and owner changes retire every late response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, consultationChat, accountScope, sessionState, proposalOrchestration, proposalCombinedClaim, researchProjection?.researchWorkId,
    researchProjection?.state, sourceIntake?.owner, sourceIntake?.locatorOwner, sourceIntake?.conversationId,
    sourceIntake?.turnId, sourceIntake?.completion?.researchWorkId, consultationState.availability,
    consultationState.busy, consultationSessionState.available, consultationSessionState.busy])
  const resumeConsultationPending = async () => {
    try {
      const authority = await refreshConsultationMutationAuthority()
      if (authority.generation !== epoch.current || session.current?.sessionId !== authority.owner.sessionId
        || session.current.sessionState !== authority.owner.sessionState) throw new Error('SESSION_CHANGED')
      if (consultation.getSnapshot().canResumeDocumentPending) await consultation.resumeDocumentPending()
      else await consultation.resumePending()
    }
    catch { setError('세션 또는 복구 저장소를 확인하지 못했습니다. 서버 상태를 삭제하지 않았습니다.') }
  }
  const refreshConsultationReadAuthority = async () => {
    const owner = session.current, generation = epoch.current
    if (!owner || phase !== 'ready') throw new Error('SESSION_CHANGED')
    const observed = await clients.session.current()
    if (generation !== epoch.current || session.current?.sessionId !== owner.sessionId || session.current.sessionState !== owner.sessionState
      || observed.body.data.sessionId !== owner.sessionId || observed.body.data.state !== owner.sessionState
      || observed.body.meta.resourceRevision !== observed.body.data.revision || !observed.etag) throw new Error('SESSION_CHANGED')
    return { owner, generation, revision: observed.body.data.revision }
  }
  const resumeConsultationObservation = async () => {
    try {
      const authority = await refreshConsultationReadAuthority()
      if (authority.generation !== epoch.current || session.current?.sessionId !== authority.owner.sessionId
        || session.current.sessionState !== authority.owner.sessionState) throw new Error('SESSION_CHANGED')
      await consultation.resumeObservation()
    }
    catch { setError('세션 또는 복구 저장소를 확인하지 못했습니다. 서버 상태를 삭제하지 않았습니다.') }
  }
  const discardConsultationPending = async () => {
    try {
      const authority = await refreshConsultationReadAuthority()
      if (authority.generation !== epoch.current || session.current?.sessionId !== authority.owner.sessionId
        || session.current.sessionState !== authority.owner.sessionState) throw new Error('SESSION_CHANGED')
      const claim = consultationSession.getSnapshot()
      if (claim.canDiscard && claim.targetSessionId === authority.owner.sessionId) {
        if (!consultationSession.discardPending()) throw new Error('SESSION_CHANGED')
        setRetainedConsultation(null); setError('')
      } else if (!consultation.discardPending()) throw new Error('SESSION_CHANGED')
    }
    catch { setError('세션 또는 복구 저장소를 확인하지 못했습니다. 서버 상태를 삭제하지 않았습니다.') }
  }
  const stopConsultation = async () => {
    if (retainedConsultation?.epoch === epoch.current && retainedConsultation.targetSessionId === session.current?.sessionId) return
    try {
      const authority = await refreshConsultationMutationAuthority()
      if (authority.generation !== epoch.current || session.current?.sessionId !== authority.owner.sessionId
        || session.current.sessionState !== authority.owner.sessionState) throw new Error('SESSION_CHANGED')
      await consultation.stop()
    }
    catch { setError('세션 또는 복구 저장소를 확인하지 못했습니다. 서버 상태를 삭제하지 않았습니다.') }
  }
  const sendRow = async (scope: string, key: string, label: string) => {
    const row = rowEdits.read(scope, key)
    if (!row?.text.trim()) return
    if (!conversation || !session.current || rowEditScope({ ...session.current, conversationId: conversation.conversationId, draftId: conversation.draftId }) !== scope
      || working.current || emailDispatch.current || pending.current || logoutIntent.current || busy || hasPending || hasLogout || approval || job || phase !== 'ready') {
      rowEdits.mark(scope, key, 'notSent'); return
    }
    if (row.revision !== conversation.conversationStateRevision) { rowEdits.mark(scope, key, 'stale'); return }
    const clientMessageId = `client_message_row_${crypto.randomUUID()}`
    // A visible row label supplies context, not a generated DraftPatch/evidence.
    const message = `${label}: ${row.text}`
    if (message.length > 4000) { rowEdits.mark(scope, key, 'tooLong'); return }
    rowEdits.begin(scope, key, label, clientMessageId, message, conversation.projectionHash, conversation.draftRevision)
    try {
      await start({ ...draftBase(conversation), kind: 'TURN', body: { ...expected(conversation), clientMessageId, message } }, undefined, false)
    } finally {
      // Guards and a failed durable write can resolve start without dispatch.
      // Successful/uncertain responses are observed only in execute above.
      const latest = rowEdits.read(scope, key)
      if (latest?.request?.id === clientMessageId && latest.status === 'sending') rowEdits.mark(scope, key, 'notSent')
    }
  }
  const validate = async () => {
    if (!strategyConversation) return
    setReceipt(null); setChallenge(null); setAcknowledged(false)
    if (proposalActive) { setProposalReview(null); setProposalHold('APPROVAL_COMPANION_UNAVAILABLE') }
    await start({ ...draftBase(strategyConversation), kind: 'VALIDATE', body: expected(strategyConversation) })
  }
  const prepareApproval = async () => {
    if (sessionState !== 'AUTHENTICATED') { await openLogin(); return }
    if (!strategyConversation || !receipt) return
    await start({ ...draftBase(strategyConversation), kind: 'CHALLENGE', body: { ...expected(strategyConversation), validationReceiptId: receipt.validationReceiptId, acknowledgedSemanticHash: receipt.semanticHash } })
  }
  const approve = async () => {
    if (proposalActive && proposalHold) return
    if (!acknowledged || !strategyConversation || !receipt || !challenge || sessionState !== 'AUTHENTICATED') return
    if (receipt.validationReceiptId !== challenge.validationReceiptId || receipt.semanticHash !== challenge.semanticHash) return
    await start({ ...draftBase(strategyConversation), kind: 'APPROVE', body: { ...expected(strategyConversation), validationReceiptId: receipt.validationReceiptId,
      approvalChallengeId: challenge.approvalChallengeId, acknowledgedSemanticHash: receipt.semanticHash } })
  }
  const submit = async () => {
    if (!approval || !strategyConversation) return
    await start({ ...base(), kind: 'SUBMIT', conversationId: strategyConversation.conversationId, body: { strategyVersionId: approval.strategyVersionId,
      expectedSemanticHash: approval.semanticHash, profileId: 'INTERNAL_POC_FULL' } }, selectedHistoryOwner && !proposalActive ? async () => {
      await confirmHistoryDraft(selectedHistoryOwner, approval)
    } : undefined)
  }
  const observeHistoryOwner = async (conversationId: string, expectedOwner?: HistoryOwner): Promise<HistoryOwner> => {
    const generation = epoch.current, bound = session.current
    if (!bound || bound.sessionState !== 'AUTHENTICATED') throw new Error('HISTORY_REQUIRES_AUTHENTICATION')
    const invalidate = () => { epoch.current++; clients.setCsrf(null); bindSession(null); setSessionState(null); clearViews(); setPhase('error') }
    const response = await clients.session.current().catch(failure => {
      if (generation === epoch.current && failure instanceof ApiResponseError && failure.status === 401) invalidate()
      throw failure
    }), current = response.body.data
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    if (current.state !== 'AUTHENTICATED' || current.sessionId !== bound.sessionId || typeof response.etag !== 'string'
      || (expectedOwner && (current.sessionId !== expectedOwner.sessionId || current.revision !== expectedOwner.revision || response.etag !== expectedOwner.etag || conversationId !== expectedOwner.conversationId))) {
      invalidate()
      throw new Error('SESSION_CHANGED')
    }
    return { sessionId: current.sessionId, revision: current.revision, etag: response.etag, conversationId }
  }
  const sourceBacktestCurrent = (view: ProposalView, generation: number) => {
    const source = sourceIntakeRef.current, owner = session.current
    return generation === epoch.current && proposalViewRef.current?.bound.bindingHash === view.bound.bindingHash
      && proposalViewRef.current.etag === view.etag && owner?.sessionState === 'AUTHENTICATED'
      && view.owner === JSON.stringify([owner.sessionId, owner.sessionState]) && source?.completion?.researchWorkId === view.researchWorkId
      && sourceIntakeCurrent(source, sourceIntakeGeneration.current)
  }
  const sourceBacktestAuthority = () => new NativeSourceStrategyBacktestAuthority({ owner: observeHistoryOwner,
    conversations: clients.conversation, proposals: sourceBacktestProposalReads,
    history: async (conversationId, cursor) => (await clients.native.history.call('listNativeConversationHistoryV8', {
      conversationId, limit: 50, ...(cursor ? { cursor } : {}),
    })).data, job: async backtestId => (await clients.native.jobs.call('getNativeBacktestV7', { backtestId })).data })
  const sourceJobBinding = (view: ProposalView, value: NativeJob): SourceJobScope => ({ owner: view.owner,
    conversationId: view.snapshot.conversationId, draftId: view.snapshot.draftId, bindingHash: view.bound.bindingHash,
    strategyVersionId: value.strategyVersionId, semanticHash: value.semanticHash, backtestId: value.backtestId })
  const adoptStrategyRead = (value: ConversationSnapshot, valueEtag: string, source: ProposalView | null) => {
    if (!source) { remember(value, valueEtag); return }
    const view = Object.freeze({ ...source, snapshot: value, etag: valueEtag })
    proposalViewRef.current = view; setProposalView(view)
  }
  const confirmHistoryDraft = async (owner: HistoryOwner, value: StrategyApproval) => {
    const generation = epoch.current
    const source = proposalActive?.snapshot.conversationId === owner.conversationId ? proposalActive : null
    if (source) {
      const verified = await sourceBacktestAuthority().confirm(source, value, () => sourceBacktestCurrent(source, generation))
      if (verified.owner.sessionId !== owner.sessionId || verified.owner.revision !== owner.revision || verified.owner.etag !== owner.etag) throw new Error('SESSION_CHANGED')
      adoptStrategyRead(verified.snapshot, verified.etag, source)
      return
    }
    await observeHistoryOwner(owner.conversationId, owner)
    const current = await clients.conversation.getConversation(owner.conversationId)
    await observeHistoryOwner(owner.conversationId, owner)
    if (generation !== epoch.current || current.body.data.conversationId !== owner.conversationId) throw new Error('BINDING_CONFLICT')
    if (!approvalMatchesDraft(value, current.body.data)) {
      remember(current.body.data, current.etag); setApproval(null); setSelectedHistoryOwner(null); setReceipt(null); setChallenge(null); setAcknowledged(false)
      throw Object.assign(new Error('SNAPSHOT_CHANGED'), { code: 'SNAPSHOT_CHANGED' })
    }
    remember(current.body.data, current.etag)
  }
  const loadHistory = (direction: 'first' | 'next' | 'previous' = 'first') => runHistory(async () => {
    if (!strategyConversation || logoutIntent.current || phase !== 'ready') return
    if (session.current?.sessionState !== 'AUTHENTICATED') {
      setError('로그인 후 실행 이력을 확인할 수 있습니다. 현재 전략 초안과 검증 상태는 유지합니다.')
      return
    }
    if (direction !== 'first' && (!history || history.conversationId !== strategyConversation.conversationId || !historyOwner.current || historyNeedsRefresh)) return
    if (direction === 'next' && !history?.nextCursor) return
    if (direction === 'previous' && historyNavigation.index <= 0) return
    const cursor = direction === 'first' ? undefined : direction === 'next' ? history!.nextCursor
      : historyNavigation.cursors[historyNavigation.index - 1]
    const generation = epoch.current
    if (proposalActive) await sourceBacktestAuthority().observe(proposalActive, () => sourceBacktestCurrent(proposalActive, generation))
    const owner = await observeHistoryOwner(strategyConversation.conversationId, direction === 'first' ? undefined : historyOwner.current ?? undefined)
    let value: History
    try {
      value = (await clients.native.history.call('listNativeConversationHistoryV8', { conversationId: strategyConversation.conversationId, limit: 50, ...(cursor ? { cursor } : {}) })).data
    } catch (failure) {
      if (generation !== epoch.current) return
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : ''
      if (code === 'AUTHENTICATION_REQUIRED' || code === 'FORBIDDEN') {
        historyOwner.current = null; setHistory(null); setHistoryNavigation({ cursors: [], index: 0, offset: 0 })
        setHistoryNotice('historyAccessLostNotice')
        throw failure
      }
      const refresh = ['SNAPSHOT_CHANGED', 'CURSOR_INVALID', 'SOURCE_VERIFICATION_FAILED'].includes(code)
      setHistoryNeedsRefresh(required => required || refresh)
      setHistoryNotice(refresh ? 'historyPositionChangedNotice' : 'historyPageFailedNotice')
      return
    }
    await observeHistoryOwner(strategyConversation.conversationId, owner)
    if (generation !== epoch.current) return
    if (direction !== 'first' && history?.snapshotRevision !== value.snapshotRevision) {
      setHistoryNeedsRefresh(true); setHistoryNotice('historySnapshotChangedNotice')
      return
    }
    let navigation: HistoryNavigation = { cursors: [undefined], index: 0, offset: 0 }
    if (direction === 'previous') navigation = { ...historyNavigation, index: historyNavigation.index - 1 }
    if (direction === 'next') {
      // Only opaque request positions, never cached rows or durable authority.
      const cursors = [...historyNavigation.cursors.slice(0, historyNavigation.index + 1), cursor]
      const dropped = Math.max(0, cursors.length - MAX_HISTORY_CURSORS)
      navigation = { cursors: cursors.slice(dropped), index: cursors.length - dropped - 1, offset: historyNavigation.offset + dropped }
    }
    historyOwner.current = owner
    setHistory(value); setHistoryNavigation(navigation); setHistoryNotice(''); setHistoryNeedsRefresh(false)
  })
  const selectHistoryRow = (row: History['rows'][number], onSelected?: () => void) => runHistory(async () => {
    const owner = historyOwner.current, generation = epoch.current
    if (!owner || !strategyConversation || !history?.rows.includes(row) || historyNeedsRefresh || pending.current || logoutIntent.current || phase !== 'ready'
      || history.conversationId !== strategyConversation.conversationId || row.approval.sourceConversationId !== strategyConversation.conversationId) return
    let selectedApproval = row.approval, selectedJob = row.job
    if (proposalActive) {
      const verified: Awaited<ReturnType<NativeSourceStrategyBacktestAuthority['confirm']>> & { job?: NativeJob } = row.job ? await sourceBacktestAuthority().selectJob(proposalActive, row.approval, row.job,
        () => sourceBacktestCurrent(proposalActive, generation)) : await sourceBacktestAuthority().confirm(proposalActive, row.approval,
        () => sourceBacktestCurrent(proposalActive, generation))
      if (verified.owner.sessionId !== owner.sessionId || verified.owner.revision !== owner.revision || verified.owner.etag !== owner.etag) throw new Error('SESSION_CHANGED')
      selectedApproval = verified.approval
      selectedJob = verified.job ?? null
      adoptStrategyRead(verified.snapshot, verified.etag, proposalActive)
      setSourceJobScope(selectedJob ? sourceJobBinding(proposalActive, selectedJob) : null)
    } else if (row.job) await observeHistoryOwner(strategyConversation.conversationId, owner)
    else await confirmHistoryDraft(owner, row.approval)
    if (generation !== epoch.current) return
    closePaper(); closeSmoke()
    presentationIntent.invalidate(); setAutomaticPresentation(undefined)
    setReceipt(null); setChallenge(null); setAcknowledged(false)
    setRetainedResult(null)
    setApproval(selectedApproval)
    setResultStatus(previous => previous?.backtestId === selectedJob?.backtestId ? previous : null)
    setJob(selectedJob); setSelectedHistoryOwner(owner); setEditingNotice(false)
    onSelected?.()
  })
  const editCurrentDraft = async () => {
    let confirmed = false
    await run(async () => {
      if (!strategyConversation || (!approval && !job) || pending.current || logoutIntent.current || phase !== 'ready') return
      const generation = epoch.current
      const source = proposalActive
      const verified = source ? await sourceBacktestAuthority().observe(source, () => sourceBacktestCurrent(source, generation)) : null
      const owner = await observeHistoryOwner(strategyConversation.conversationId, selectedHistoryOwner ?? undefined)
      const current = await clients.conversation.getConversation(strategyConversation.conversationId)
      await observeHistoryOwner(strategyConversation.conversationId, owner)
      if (generation !== epoch.current) return
      if (current.body.data.conversationId !== strategyConversation.conversationId || current.body.data.draftId !== strategyConversation.draftId
        || verified && (!sameProposalBase(proposalBase(current.body.data), proposalBase(verified.snapshot)) || current.etag !== verified.etag)) throw new Error('BINDING_CONFLICT')
      if (job?.state === 'COMPLETED' && resultStatus?.backtestId === job.backtestId && resultStatus.reportReady) {
        let retainedJob: NativeJob = job
        if (source) {
          if (!approval || !sourceJobScope || !NativeSourceStrategyBacktestAuthority.matchesJob(job, sourceJobScope, source)) throw new Error('BINDING_CONFLICT')
          retainedJob = (await sourceBacktestAuthority().selectJob(source, approval, job, () => sourceBacktestCurrent(source, generation))).job
        }
        setRetainedResult({ job: retainedJob, owner, draftId: strategyConversation.draftId, ...(sourceJobScope ? { sourceScope: sourceJobScope } : {}) })
      }
      // Leave the active job, not its server lifetime. A confirmed completed
      // result can remain read-only, separate from the editable draft. Epoch fences
      // a poll already in flight before React cleans up the previous job effect.
      if (source) { presentationIntent.invalidate(); clients.replayReaders.invalidate() }
      else epoch.current++
      adoptStrategyRead(current.body.data, current.etag, source)
      setSourceJobScope(null)
      setApproval(null); setResultStatus(null); setJob(null); setSelectedHistoryOwner(null); setReceipt(null); setChallenge(null); setAcknowledged(false); setDiff([])
      setEditingNotice(true)
      confirmed = true
    })
    return confirmed
  }
  const editFromResult = async () => {
    if (working.current || emailDispatch.current) return
    const origin = window.location.href
    const trigger = document.activeElement
    const frame = trigger?.closest('.native-analysis-layout')
    const navigation = new AbortController()
    let moved = false
    const cancelNavigation = () => { moved = true }
    const choseControl = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest('button,a[href],[role="tab"],input,textarea,select,[contenteditable="true"]') : null
      if (target && target !== trigger) moved = true
    }
    // A slow server read must not pull the user back from a later navigation.
    // Cancel presentation only; the SDK operation retains its original lifetime.
    // AT/voice activation can emit a click without pointer or keyboard events.
    // Registration happens after this action's document capture phase.
    // Scrolling/reading is not a request to abandon the edit destination.
    document.addEventListener('click', choseControl, { capture: true, signal: navigation.signal })
    document.addEventListener('focusin', choseControl, { capture: true, signal: navigation.signal })
    window.addEventListener('popstate', cancelNavigation, { signal: navigation.signal })
    window.addEventListener('hashchange', cancelNavigation, { signal: navigation.signal })
    try {
      const confirmed = await editCurrentDraft()
      if (confirmed && !moved && frame?.isConnected && window.location.href === origin) setComposerRequest({})
    } finally { navigation.abort() }
  }
  const refreshJob = async () => {
    if (!job || working.current) return
    const generation = epoch.current
    if (jobPolling.current?.job === job) {
      // A status GET does not own the conversation's mutation lock. Only this
      // refresh control waits; navigation can retire the observation normally.
      setRefreshingJob(job)
      try {
        const outcome = await jobPolling.current.control.refresh()
        if (generation === epoch.current && outcome?.ok === false) {
          if (!clients.getCsrf()) setPhase('error')
          if (authenticationRequired(outcome.failure)) {
            // Preserve the pre-existing manual GET authentication boundary without
            // placing an unrelated background read under the mutation busy lock.
            clients.setCsrf(null); setPhase('error'); setSessionState(null)
            setError('AUTHENTICATION_REQUIRED · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.')
          }
        }
      }
      finally { if (generation === epoch.current) setRefreshingJob(current => current === job ? null : current) }
      return
    }
    await run(async () => {
      const value = await clients.native.jobs.call('getNativeBacktestV7', { backtestId: job.backtestId })
      if (generation === epoch.current) {
        assertSameJob(value.data, job)
        const display = presentationIntent.observe(value.data)
        if (display) setAutomaticPresentation(display)
        setJob(value.data)
      }
    })
  }
  const openPaper = () => run(async () => {
    if (!approval || !conversation || pending.current || logoutIntent.current || phase !== 'ready' || sessionState !== 'AUTHENTICATED') return
    closePaper(); closeSmoke()
    const generation = epoch.current
    const owner = await observeHistoryOwner(conversation.conversationId, selectedHistoryOwner ?? undefined)
    await confirmHistoryDraft(owner, approval)
    if (generation !== epoch.current) return
    setPaperBinding({ owner, epoch: generation, generation: ++paperGeneration.current,
      scope: { sessionId: owner.sessionId, strategyVersionId: approval.strategyVersionId,
        semanticHash: approval.semanticHash, strategyVersionContentHash: approval.strategyVersionContentHash } })
  })
  const paperCurrent = (binding: NonNullable<typeof paperBinding>) => binding.epoch === epoch.current
    && binding.generation === paperGeneration.current && binding.owner.sessionId === session.current?.sessionId
    && session.current.sessionState === 'AUTHENTICATED' && !pending.current && !logoutIntent.current && !working.current
  const verifyPaperOwner = async (binding: NonNullable<typeof paperBinding>, mutation: boolean) => {
    if (!paperCurrent(binding)) throw new Error('PAPER_NATIVE_OWNER_CHANGED')
    try {
      await observeHistoryOwner(binding.owner.conversationId, binding.owner)
      const token = mutation ? (await clients.session.csrf()).body.data.csrfToken : ''
      await observeHistoryOwner(binding.owner.conversationId, binding.owner)
      if (!paperCurrent(binding)) throw new Error('PAPER_NATIVE_OWNER_CHANGED')
      return token
    } catch (failure) {
      // This child read is outside run(). If its fresh owner check invalidated
      // the app, retain an explanation after the child has been unmounted.
      if (!session.current && epoch.current === binding.epoch + 1) setError('현재 로그인이 변경되어 Paper 내용을 숨겼습니다. 이전 요청 기록과 서버 실행을 삭제하거나 취소하지 않았습니다.')
      throw failure
    }
  }
  const openSmoke = () => run(async () => {
    if (!approval || !conversation || pending.current || logoutIntent.current || phase !== 'ready' || sessionState !== 'AUTHENTICATED') return
    closeSmoke(); closePaper()
    const generation = epoch.current
    const owner = await observeHistoryOwner(conversation.conversationId, selectedHistoryOwner ?? undefined)
    await confirmHistoryDraft(owner, approval)
    const profileContentHash = readApiAdapterConfig(document).structuralSmokeProfileContentHash
    if (generation !== epoch.current) return
    // Fixed field order is also the module journal namespace. Never spread
    // caller input or a stored response into this four-field binding.
    const binding = { sessionId: owner.sessionId, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash, profileContentHash }
    setSmokeBinding({ owner, binding, contentHash: approval.strategyVersionContentHash, epoch: generation, generation: ++smokeGeneration.current })
  })
  const smokeCurrent = (binding: NonNullable<typeof smokeBinding>) => binding.epoch === epoch.current
    && binding.generation === smokeGeneration.current && binding.owner.sessionId === session.current?.sessionId
    && session.current.sessionState === 'AUTHENTICATED' && !pending.current && !logoutIntent.current
  // Parent activity is temporary dispatch unavailability, not ownership loss.
  // The Panel still includes it in the existing module's per-read/write fence.
  const smokeDispatchAvailable = () => !working.current
  const verifySmokeOwner = async (binding: NonNullable<typeof smokeBinding>) => {
    if (!smokeCurrent(binding)) throw new Error('SMOKE_CONTEXT_CHANGED')
    try {
      await observeHistoryOwner(binding.owner.conversationId, binding.owner)
      if (!smokeCurrent(binding)) throw new Error('SMOKE_CONTEXT_CHANGED')
    } catch (failure) {
      if (!session.current && epoch.current === binding.epoch + 1) setError('현재 로그인이 변경되어 구조 시험 내용을 숨겼습니다. 이전 요청 기록과 서버 작업을 삭제하거나 취소하지 않았습니다.')
      throw failure
    }
  }
  const observeNavigationOwner = async (expectedOwner?: { sessionId: string; state: string; revision: string; etag: string }) => {
    const generation = epoch.current, bound = session.current
    if (!bound) throw new Error('SESSION_CHANGED')
    const invalidate = () => { epoch.current++; clients.setCsrf(null); bindSession(null); setSessionState(null); setPreviousConversation(null); clearViews(); setPhase('error') }
    const response = await clients.session.current().catch(failure => {
      if (generation === epoch.current && failure instanceof ApiResponseError && failure.status === 401) invalidate()
      throw failure
    }), value = response.body.data
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    if (value.sessionId !== bound.sessionId || value.state !== bound.sessionState || typeof response.etag !== 'string'
      || (expectedOwner && (value.sessionId !== expectedOwner.sessionId || value.state !== expectedOwner.state || value.revision !== expectedOwner.revision || response.etag !== expectedOwner.etag))) {
      invalidate(); throw new Error('SESSION_CHANGED')
    }
    return { sessionId: value.sessionId, state: value.state, revision: value.revision, etag: response.etag }
  }
  const navigateConversation = async (restore: boolean): Promise<boolean> => {
    let accepted = false
    await run(async () => {
      if (pending.current || logoutIntent.current || phase !== 'ready') return
      const bound = session.current, generation = epoch.current
      if (!bound) return
      const target = restore ? previousConversation : null
      if (restore && (!target || target.sessionId !== bound.sessionId || target.conversationId === conversation?.conversationId)) return
      if (!restore && !conversation) return
      setNavigationError('')
      const owner = await observeNavigationOwner()
      let restored: Awaited<ReturnType<typeof clients.conversation.getConversation>> | null = null
      try { if (target) restored = await clients.conversation.getConversation(target.conversationId) }
      finally { await observeNavigationOwner(owner) }
      if (generation !== epoch.current) return
      if (restored && restored.body.data.conversationId !== target!.conversationId) throw new Error('BINDING_CONFLICT')
      const prior = conversation ? { sessionId: bound.sessionId, conversationId: conversation.conversationId } : null
      try { changeConversationLocators(target, prior) }
      catch (failure) {
        setNavigationError(failure instanceof Error && failure.message === 'PREVIOUS_CONVERSATION_ROLLBACK_UNCONFIRMED'
          ? 'rollback' : 'write')
        return
      }
      epoch.current++; clearViews(false, true); setError(''); setPreviousConversation(prior)
      if (restored) remember(restored.body.data, restored.etag, false)
      accepted = true
    })
    return accepted
  }
  const snapshot = strategyConversation?.draftState.projection
  const rejectedClaim = hasPending && rejectedClaimKey !== null
  const historyPreviousDisabled = busy || hasLogout || historyNavigation.index === 0 || historyNeedsRefresh
  const historyFirstDisabled = busy || hasLogout
  const historyNextDisabled = busy || hasLogout || historyNeedsRefresh
  // One controller, one visible list. The source history hub may display this
  // subset, but it cannot create account-wide records or bypass row guards.
  const renderHistory = (onSelected?: () => void) => strategyConversation && <>
    {history && <section className="native-history-panel" aria-label={jobText('historyTitle')}>
      {!onSelected && <h3>{jobText('historyTitle')}</h3>}
      <p className="native-history-page">{jobText('historyPage', { page: historyNavigation.offset + historyNavigation.index + 1 })}</p>
      <p className="native-history-help">{jobText('historyPageSizeNotice')}</p>
      <p className="native-history-help">{jobText('historySnapshotNotice')}</p>
      {historyNavigation.offset > 0 && <p>{jobText('historyCursorLimitNotice')}</p>}
      {historyNeedsRefresh && <p>{jobText('historyRefreshRequiredNotice')}</p>}
      <NativeHistoryList rows={history.rows}
        selectedRow={selectedHistoryOwner && approval
          ? { strategyVersionId: approval.strategyVersionId, backtestId: job?.backtestId ?? null } : undefined}
        getSelectionDisabled={row => busy || hasPending || hasLogout || historyNeedsRefresh || (!row.job && !approvalMatchesDraft(row.approval, strategyConversation))}
        getSelectionNotice={row => !row.job && !approvalMatchesDraft(row.approval, strategyConversation)
          ? jobText('historyApprovalMismatchNotice') : undefined}
        onSelect={row => void selectHistoryRow(row, onSelected)} />
      <nav className="native-history-navigation" aria-label={jobText('historyNavigationLabel')}>
        <button className="g-qchip" aria-disabled={historyPreviousDisabled} onClick={() => { if (!historyPreviousDisabled) void loadHistory('previous') }}>{jobText('historyPrevious')}</button>
        <button className="g-qchip" aria-disabled={historyFirstDisabled} onClick={() => { if (!historyFirstDisabled) void loadHistory() }}>{jobText('historyFirst')}</button>
        {history.nextCursor && <button className="g-qchip" aria-disabled={historyNextDisabled} onClick={() => { if (!historyNextDisabled) void loadHistory('next') }}>{jobText('historyNext')}</button>}
      </nav>
    </section>}
  </>
  // Only this exact pre-dispatch CREATE error belongs beside the unchanged
  // home composer. A later session warning must keep its existing workflow.
  const inlineHomeFailure = Boolean(error && error === homeInputFailure && phase === 'ready' && !hasPending)
  // Initial connection failure is not a conversation. Only the mount catch
  // creates this hint; confirmed recovery retires it. Later authority failures
  // and pending commands retain their existing recovery workflow.
  const initialHomeFailure = initialConnectionFailed && initialHome && !conversation && !hasPending && !hasLogout
    && !loginOpen && !loginRetained && !claimAvailable
  const showRecoveryWorkflow = Boolean((error && !inlineHomeFailure && !initialHomeFailure)
    || (hasPending && (!busy || pendingRecoveryVisible)) || hasLogout)
  const healthyAuthNotice = authNotice && authNotice.sessionId === accountScope && phase === 'ready'
    && sessionState === 'AUTHENTICATED' && !error && !hasPending && !hasLogout ? authNotice : null
  const workflow = strategyConversation ? <section className="native-strategy-workflow" aria-label={workflowText('summary')} ref={workflowElement}
    onClickCapture={event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-workflow-action]')
      if (target && target.getAttribute('aria-disabled') !== 'true') workflowFocus.current = document.activeElement === target ? target : null
    }}
    onFocusCapture={event => { if (event.target !== workflowFocus.current) workflowFocus.current = null }}>
    <h2>{workflowText('draft')}</h2>
    <dl className="native-workflow-rows">
      <div className="native-workflow-row"><dt>{workflowText('target')}</dt><dd>{snapshot?.market?.symbol ?? workflowText('pairUnset')} · {snapshot?.clock?.timeframe ?? workflowText('timeframeUnset')} · {nativeWorkflowLeverage(language, snapshot?.execution?.leverage)}</dd></div>
      <div className="native-workflow-row"><dt>{nativeStrategyText(language, 'entries')}</dt><dd>{snapshot?.entryRules.map(rule => {
        const description = describeCondition(rule.condition, snapshot.features, language)
        return [description.text, ...description.warnings].join('\n')
      }).join('\n') || nativeStrategyText(language, 'unknown')}</dd></div>
      <div className="native-workflow-row"><dt>{nativeStrategyText(language, 'exits')}</dt><dd>{snapshot?.exitRules.map(rule => `${nativeStrategyText(language, rule.kind === 'stop_loss' ? 'stopLoss' : 'takeProfit')} ${formatFractionPercent(rule.distanceFraction, language)}`).join(' · ') || nativeStrategyText(language, 'unknown')}</dd></div>
      <div className="native-workflow-row"><dt>{workflowText('orderAmount')}</dt><dd>{snapshot?.positionSizing?.amount ?? workflowText('unset')} USDT</dd></div>
    </dl>
    <p className="native-workflow-note">{workflowText('changes', { changes: diff.length ? diff.join(', ') : workflowText('noChanges') })}</p>
    <details className="native-workflow-source"><summary>{workflowText('source')}</summary><pre tabIndex={0}>{JSON.stringify(proposalActive ? { projection: snapshot, proposalBoundDraft: proposalActive.bound, approvalCompanion: proposalReview } : snapshot, null, 2)}</pre></details>
    {strategyConversation.unresolvedCapabilityBlockers.length > 0 && <p className="native-workflow-notice" role="alert">{workflowText('blockers', { reasons: strategyConversation.unresolvedCapabilityBlockers.map(item => item.reasonCode).join(', ') })}</p>}
    <div className="native-workflow-actions">
      {!approval && <WorkflowButton className={`native-workflow-button ${receipt ? 'is-secondary' : 'is-primary'}`} disabled={busy || hasPending || strategyConversation.candidateState !== 'READY_FOR_VALIDATION'} onClick={() => void validate()}>{workflowText('validate')}</WorkflowButton>}
    </div>
    {receipt && !approval && <div className="native-workflow-stage"><p className="native-workflow-note" tabIndex={-1} data-workflow-focus>{workflowText('validated', { expiresAt: receipt.expiresAt })}</p>
      {!challenge ? <div className="native-workflow-actions"><WorkflowButton className="native-workflow-button is-primary" disabled={busy || hasPending} onClick={() => void prepareApproval()}>{workflowText(sessionState === 'AUTHENTICATED' ? 'reviewApproval' : 'loginContinue')}</WorkflowButton></div> : <>
        <label className="native-workflow-consent"><input type="checkbox" checked={acknowledged} disabled={busy || hasPending || Boolean(proposalActive && proposalHold)} onChange={event => setAcknowledged(event.target.checked)} /><span>{workflowText('consent')}</span></label>
        <p className="native-workflow-note">{workflowText('costs')}</p>
        <p className="native-workflow-binding">{workflowText('approvalTarget')} <code>{challenge.semanticHash}</code></p>
        <div className="native-workflow-actions"><WorkflowButton className="native-workflow-button is-primary" disabled={!acknowledged || busy || hasPending || Boolean(proposalActive && proposalHold)} onClick={() => void approve()}>{workflowText('approve')}</WorkflowButton></div>
      </>}
    </div>}
    {approval && <div className="native-workflow-stage"><p className="native-workflow-binding" tabIndex={-1} data-workflow-focus>{workflowText('approvedVersion')} <code>{approval.strategyVersionId}</code></p>
      {!strategyJob && <div className="native-workflow-actions"><WorkflowButton className="native-workflow-button is-primary" disabled={busy || hasPending} onClick={() => void submit()}>{workflowText('submit')}</WorkflowButton></div>}
    </div>}
    <div className="native-workflow-utilities">
      <div className="native-workflow-actions">
        {approval && sessionState === 'AUTHENTICATED' && <button className="native-workflow-button is-secondary" disabled={busy || hasPending || hasLogout || phase !== 'ready'} onClick={() => void openPaper()}>{workflowText('paper')}</button>}
        {approval && sessionState === 'AUTHENTICATED' && <button className="native-workflow-button is-secondary" disabled={busy || hasPending || hasLogout || phase !== 'ready'} onClick={() => void openSmoke()}>{workflowText('smoke')}</button>}
        {(approval || job) && <button className="native-workflow-button is-text" disabled={busy || hasPending || hasLogout || phase !== 'ready'} onClick={() => void editCurrentDraft()}>{workflowText('edit')}</button>}
      </div>
      {(approval || job) && <p className="native-workflow-note">{workflowText('editNotice')}</p>}
      {editingNotice && <p className="native-workflow-notice" role="status">{workflowText('editingReady')}</p>}
      {selectedHistoryOwner && approval && <p className="native-workflow-note" data-native-history-selection tabIndex={-1} role="status">{jobText('historySelectedApprovalNotice', { approved: approval.sourceDraftRevision, current: strategyConversation.draftRevision })}</p>}
      <div className="native-workflow-actions"><button className="native-workflow-button is-text" disabled={busy || hasLogout} onClick={() => void loadHistory()}>{jobText('historyOpen')}</button></div>
    </div>
  </section> : showRecoveryWorkflow ? <section aria-label={workflowText('recoveryLabel')}><h2>{workflowText('recoveryTitle')}</h2><p>{workflowText('recoveryNotice')}</p></section>
    : claimAvailable ? <section aria-label={ui('로그인 전 전략 연결')}><p>{ui('원하면 로그인 전 전략을 이어서 연구할 수 있습니다. 연결은 선택사항이며 승인이나 실행에 동의하는 것이 아닙니다.')}</p>
      <button disabled={busy || hasPending || phase !== 'ready'} onClick={() => void claim()}>{ui('로그인 전 전략 연결')}</button></section> : null
  const panelCurrent = () => loginBinding !== null && loginBinding.epoch === epoch.current && loginBinding.generation === loginGeneration.current
    && loginBinding.sessionId === session.current?.sessionId && !logoutIntent.current
  const acceptReturnSession = (value: NativeAuthenticated | NativeSessionRecovery, recovered: boolean) => {
    // The unchanged host guard returns void on refusal. Make refusal observable
    // to the panel instead of letting a refused callback mark login confirmed.
    if (!returnPanelCurrent()) throw new Error('SESSION_CHANGED')
    const confirmation = recovered ? 'HANDOFF_UNVERIFIED' : 'ACK_CONFIRMED'
    if (recovered) sessionRecovered(value as NativeSessionRecovery)
    else authenticated(value as NativeAuthenticated)
    const identity = `${confirmation}:${value.sessionId}:${value.claimIntent?.initiatingSessionId}:${value.claimIntent?.expectedSessionRevision}`
    if (acceptedAuth.current !== identity || session.current?.sessionId !== value.sessionId
      || session.current.sessionState !== 'AUTHENTICATED' || clients.getCsrf() !== value.csrfToken) throw new Error('SESSION_CHANGED')
    returnBindingRef.current = null; setReturnBinding(null)
  }
  const researchEntries = useMemo(() => observedResearchEntries(messages.flatMap(message => message.observation ? [message.observation] : []), language), [messages, language])
  const strategyEditor = documentOwner && conversation ? {
        rows: rowEdits.store[rowEditScope(documentOwner)] ?? {},
        disabled: busy || emailBusy || hasPending || hasLogout || Boolean(approval || job),
        onOpen: (key: string, open: boolean) => rowEdits.open(rowEditScope(documentOwner), key, conversation.conversationStateRevision, open),
        onChange: (key: string, text: string) => rowEdits.change(rowEditScope(documentOwner), key, text, conversation.conversationStateRevision),
        onSubmit: (key: string, label: string) => { void sendRow(rowEditScope(documentOwner), key, label) },
      } : undefined
  const renderResearch = (actions: ReactNode) => strategyConversation ? <NativeStrategyDocument snapshot={strategyConversation} researchPlan editor={strategyEditor} planActions={actions} /> : null
  const strategyDocument = phase === 'ready' && !hasLogout && strategyConversation && strategyOwner
    && strategyOwner.sessionState === sessionState
    && strategyOwner.conversationId === strategyConversation.conversationId && strategyOwner.draftId === strategyConversation.draftId
    ? { identity: proposalActive?.researchWorkId ?? JSON.stringify([strategyOwner.sessionId, strategyOwner.sessionState, strategyOwner.conversationId, strategyOwner.draftId]),
      content: renderResearch(null), renderResearch } : undefined
  const currentResultStatus = resultStatus?.backtestId === (strategyJob?.backtestId ?? retainedResult?.job.backtestId) ? resultStatus : null
  const resultStateKeys = { loading: 'resultChecking', ready: 'resultReady', error: 'resultNeedsCheck' } as const satisfies Record<NativeServiceResultStatus['state'], NativeJobTextKey>
  const jobPresentation = job ? describeNativeJob(job, language) : null
  const conversationNotice = strategyDocument && strategyJob ? <span data-native-result-status={currentResultStatus?.state}>
    {jobPresentation?.label}{jobPresentation?.invalidReason && <> · {jobPresentation.invalidReason.label}</>}
    {strategyJob.state === 'COMPLETED' && <> · {jobText(resultStateKeys[currentResultStatus?.state ?? 'loading'])}</>}
  </span> : undefined
  const observeResultStatus = useCallback((status: NativeServiceResultStatus) => {
    if (phase !== 'ready' || hasLogout || status.backtestId !== (strategyJob?.backtestId ?? retainedResult?.job.backtestId)) return
    setResultStatus(previous => previous?.backtestId === status.backtestId && previous.state === status.state && previous.label === status.label && previous.reportReady === status.reportReady ? previous : status)
  }, [phase, hasLogout, strategyJob?.backtestId, retainedResult?.job.backtestId])
  const retainedMatches = retainedResult && strategyOwner && strategyConversation
    && strategyOwner.sessionState === 'AUTHENTICATED' && sessionState === 'AUTHENTICATED'
    && retainedResult.owner.sessionId === strategyOwner.sessionId
    && retainedResult.owner.conversationId === strategyConversation.conversationId
    && retainedResult.draftId === strategyConversation.draftId
    && (conversation || proposalActive && retainedResult.sourceScope
      && NativeSourceStrategyBacktestAuthority.matchesJob(retainedResult.job, retainedResult.sourceScope, proposalActive))
  const analysisJob = phase === 'ready' && !hasLogout && strategyConversation && strategyOwner
    ? strategyJob?.state === 'COMPLETED' && strategyJob.resultAvailable ? strategyJob : retainedMatches ? retainedResult.job : null : null
  const authSurface = (loginOpen || loginRetained) && loginBinding !== null && sessionState !== null
    && (phase !== 'error' || (authStorageRecovery && loginBinding.sessionId === accountScope)) && !hasLogout && <NativeAuthSurface open={loginOpen}><NativeLoginPanel
    key={`${loginBinding.sessionId}:${sessionState}:${loginBinding.generation}`} hidden={!loginOpen} resumeToken={loginResume} intent={loginBinding.intent}
    onAuthenticated={value => { if (!panelCurrent()) throw new Error('SESSION_CHANGED'); authenticated(value) }}
    onSessionRecovered={value => { if (!panelCurrent()) throw new Error('SESSION_CHANGED'); sessionRecovered(value) }}
    enabledProviders={import.meta.env.VITE_TETH_AUTH_GOOGLE_ONLY === 'true' ? ['GOOGLE'] : undefined}
    emailAvailable={import.meta.env.VITE_TETH_AUTH_GOOGLE_ONLY !== 'true'}
    sourceLayout naturalFlow={naturalLoginFlow} returning={sessionState === 'AUTHENTICATED'} expectedSessionId={loginBinding.sessionId} isCurrent={panelCurrent}
    onEmailAuthenticated={value => { if (!panelCurrent()) throw new Error('SESSION_CHANGED'); emailAuthenticated(value) }}
    canEmailDispatch={!busy && !hasPending && !hasLogout && phase === 'ready'} acquireEmailDispatch={() => {
      if (working.current || emailDispatch.current || pending.current || logoutIntent.current || phase !== 'ready' || !panelCurrent()) return null
      const owner = {}; emailDispatch.current = owner; setEmailBusy(true)
      return () => { if (emailDispatch.current === owner) { emailDispatch.current = null; setEmailBusy(false) } }
    }}
    onClose={retain => { if (!retain) discardConnectionPlanLogin(); setLoginRetained(Boolean(retain)); setLoginOpen(false); closeClientSettingsRoute() }} /></NativeAuthSurface>
  const returnAuthSurface = returnBinding !== null && (loginOpen || loginRetained) && sessionState === null && !hasLogout && <NativeAuthSurface open={loginOpen}>
    {!plainAuthReturn() && <section className="cs-native-login ca-auth native-provider-login" aria-label={ui('로그인 반환 복구')}>
      <button type="button" data-native-auth-close className="au-x" aria-label={t('common.close')} onClick={() => { setLoginRetained(true); setLoginOpen(false); closeClientSettingsRoute() }}>✕</button>
      <p className="native-auth-status au-err" role="alert">{ui('로그인 반환 화면을 벗어났습니다. 해당 화면으로 돌아가 세션을 다시 확인해주세요. 새 로그인을 시작하지 않았습니다.')}</p>
      <button type="button" className="au-btn primary" disabled={busy || emailBusy} onClick={reopenReturnRoute}>{ui('로그인 반환 화면으로 돌아가기')}</button>
    </section>}
    <NativeLoginPanel
    key={`return:${returnBinding.generation}`} hidden={!loginOpen || !plainAuthReturn()} returnOnly
    onAuthenticated={value => acceptReturnSession(value, false)} onSessionRecovered={value => acceptReturnSession(value, true)}
    enabledProviders={import.meta.env.VITE_TETH_AUTH_GOOGLE_ONLY === 'true' ? ['GOOGLE'] : undefined}
    emailAvailable={import.meta.env.VITE_TETH_AUTH_GOOGLE_ONLY !== 'true'}
    sourceLayout naturalFlow={naturalLoginFlow} isCurrent={returnPanelCurrent} canEmailDispatch={false} acquireEmailDispatch={() => null}
    recoveryBlocked={hasPending ? ui('미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.') : undefined}
    onRecheckSession={() => { void run(recheckReturnSession) }} recheckDisabled={busy || emailBusy}
    onEmailAuthenticated={() => { throw new Error('SESSION_CHANGED') }}
    onClose={() => { setLoginRetained(true); setLoginOpen(false); closeClientSettingsRoute() }} />
  </NativeAuthSurface>
  const consultationClaimAvailable = consultationSessionState.targetSessionId === accountScope
    && (consultationSessionState.available || consultationSessionState.canDiscard)
  const acceptedResearch = sourceIntake?.status === 'accepted' && sourceIntake.completion
    && consultationState.conversationId === sourceIntake.conversationId
    && (!setupCandidate || sourceIntake.locatorOwner === setupCandidate.owner && sourceIntake.conversationId === setupCandidate.conversationId
      && sourceIntake.turnId === setupCandidate.turnId && sourceIntake.pair === setupCandidate.setup.pair)
    && sourceIntake.locatorOwner === JSON.stringify([accountScope, sessionState]) ? sourceIntake : null
  const currentResearchProjection = acceptedResearch && researchProjection?.researchWorkId === acceptedResearch.completion?.researchWorkId
    ? researchProjection : acceptedResearch ? { researchWorkId: acceptedResearch.completion!.researchWorkId, state: 'QUEUED' as const } : null
  const documentQuestionScope = currentResearchProjection?.state === 'COMPLETED'
    ? currentResearchProjection.researchWorkId : strategyDocument?.identity ?? null
  const presentationConsultationMessages = strategyDocument && conversation && documentOwner
    && session.current?.sessionState === 'AUTHENTICATED' && sessionState === 'AUTHENTICATED'
    && session.current.sessionId === documentOwner.sessionId
    ? consultationState.messages.map(message => {
      const thread = message.researchThread
      if (!thread || thread.documentId !== 'plan' || thread.scopeId === strategyDocument.identity) return message
      try {
        const source = JSON.parse(thread.scopeId) as unknown
        if (!Array.isArray(source) || source.length !== 4 || typeof source[0] !== 'string' || source[0].length < 1
          || source[0] === documentOwner.sessionId || source[1] !== 'ANONYMOUS'
          || source[2] !== conversation.conversationId || source[3] !== conversation.draftId) return message
        return { ...message, researchThread: { ...thread, scopeId: strategyDocument.identity } }
      } catch { return message }
    }) : consultationState.messages
  const documentConsultationMessages = !consultationChat && documentQuestionScope
    ? presentationConsultationMessages.filter(message => message.researchThread?.scopeId === documentQuestionScope) : []
  const documentConsultationCurrent = documentConsultationMessages.length > 0
  const documentConsultationBusy = Boolean(documentQuestionScope) && consultationState.busy
  const consultationRecoveryVisible = consultationChat || documentConsultationCurrent || consultationClaimAvailable
    || consultationState.canResumeDocumentPending || consultationState.canDiscardPending || consultationState.canResumeObservation
  const consultationError = consultationClaimAvailable && consultationSessionState.issue !== null
    ? consultationSessionState.issue === 'request-refused' && consultationSessionState.available
      ? 'REQUEST_UNCONFIRMED · 서버가 요청을 확정적으로 거절했습니다. 이 로컬 요청 기록만 폐기할 수 있으며 서버 이력은 삭제하지 않습니다.'
      : consultationSessionState.available
        ? 'REQUEST_UNCONFIRMED · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.'
        : 'REQUEST_UNCONFIRMED · 저장 기록을 확인하지 못해 이 화면에서 재개할 수 없습니다. 세션과 서버 이력을 확인해주세요.'
    : consultationChat && consultationState.issue === 'unavailable'
    ? nativeShellText(language, 'unavailable')
    : consultationRecoveryVisible
      && consultationState.issue === 'request-unconfirmed'
      ? consultationState.canResumePending || consultationState.canResumeDocumentPending
        ? 'REQUEST_UNCONFIRMED · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.'
        : consultationState.canDiscardPending
          ? 'REQUEST_UNCONFIRMED · 서버가 요청을 확정적으로 거절했습니다. 이 로컬 요청 기록만 폐기할 수 있으며 서버 이력은 삭제하지 않습니다.'
          : 'REQUEST_UNCONFIRMED · 저장 기록을 확인하지 못해 이 화면에서 재개할 수 없습니다. 세션과 서버 이력을 확인해주세요.' : ''
  const sourceIntakeError = (sourceIntakeIssue && sourceIntake || researchProjectionIssue)
    ? 'REQUEST_UNCONFIRMED · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.' : ''
  const displayError = error || sourceIntakeError || consultationError
  const consultationClaimPending = consultationClaimAvailable && consultationSessionState.available && consultationSessionState.issue !== 'request-refused'
  const retainedConsultationMessages = retainedConsultation?.epoch === consultationPresentationEpoch
    && retainedConsultation.targetSessionId === accountScope ? retainedConsultation.messages : null
  const legacyMessageIds = new Set(messages.map(message => message.id))
  const displayBusy = consultationChat ? consultationState.busy || consultationSessionState.busy : busy || documentConsultationBusy
  const displayMessages = consultationChat ? retainedConsultationMessages ?? consultationState.messages
    : [...messages, ...documentConsultationMessages.filter(message => !legacyMessageIds.has(message.id))]
  const sourceResearchPresentation = accountScope && acceptedResearch && currentResearchProjection ? {
    scope: accountScope,
    openIdentity: acceptedResearch.completion!.researchWorkId,
    data: {
      scopeId: acceptedResearch.completion!.researchWorkId,
      status: currentResearchProjection.state === 'COMPLETED' ? 'completed' as const
        : currentResearchProjection.state === 'FAILED' || currentResearchProjection.state === 'AMBIGUOUS' ? 'failed' as const
          : currentResearchProjection.state === 'CANCELLED' ? 'stopped' as const : 'running' as const,
      ...(currentResearchProjection.state === 'COMPLETED' ? {
        documents: [{ id: 'report', title: 'Final Report', content: <>{currentResearchProjection.reportText}</> }],
        view: { activeDocumentId: 'report', openDocumentIds: ['plan', 'activity', 'report'] },
      } : {}),
    },
  } : undefined
  return <ClientServiceExperience sessionRecoveryNeeded={returnBinding !== null || loginOpen || loginRetained || emailBusy || hasPending || hasLogout} loadingHome={(initializing && initialHome) || initialHomeFailure} accountScope={accountScope} composerRequest={composerRequest} state={{ phase, sessionState, messages: displayMessages, input, busy: displayBusy, source: 'service', recovery: null,
    inputDisabled: displayBusy || consultationClaimPending || retainedConsultationMessages !== null || emailBusy || hasPending || hasLogout || phase !== 'ready' || (!consultationChat && Boolean(approval || job)), quickReplies: consultationChat ? [] : conversation?.nextQuestion?.options ?? [],
    workflow: consultationChat && !proposalActive ? null : hasLogout ? <section aria-label={ui('로그아웃 요청')}><h2>{ui('로그아웃 요청 확인')}</h2><p>{ui('이전 세션의 요청 기록은 로그인 권한이나 서버 처리 결과가 아닙니다.')}</p></section> : workflow,
    outcome: consultationChat && !sourceJobCurrent ? null : <>{smokeBinding && approval && smokeBinding.binding.strategyVersionId === approval.strategyVersionId
      && smokeBinding.binding.semanticHash === approval.semanticHash && smokeBinding.contentHash === approval.strategyVersionContentHash
      && sessionState === 'AUTHENTICATED' && phase === 'ready' && !hasLogout && !hasPending && <NativeStructuralSmokePanel
        key={`${smokeBinding.generation}:${smokeBinding.binding.sessionId}:${smokeBinding.binding.strategyVersionId}`}
        binding={smokeBinding.binding} isCurrent={() => smokeCurrent(smokeBinding)} canDispatch={smokeDispatchAvailable} verifyOwner={() => verifySmokeOwner(smokeBinding)} onClose={closeSmoke} />}
      {paperBinding && approval && paperBinding.scope.strategyVersionId === approval.strategyVersionId
      && paperBinding.scope.semanticHash === approval.semanticHash && paperBinding.scope.strategyVersionContentHash === approval.strategyVersionContentHash
      && sessionState === 'AUTHENTICATED' && phase === 'ready' && !hasLogout && !hasPending && <NativePaperPanel
        key={`${paperBinding.generation}:${paperBinding.scope.sessionId}:${paperBinding.scope.strategyVersionId}`}
        scope={paperBinding.scope} isCurrent={() => paperCurrent(paperBinding)} verifyOwner={mutation => verifyPaperOwner(paperBinding, mutation)} onClose={closePaper} />}
      {strategyJob && <section className="native-job-section" aria-label={jobText('jobProgressRegion')} data-native-job-state={strategyJob.state}>
      <NativeJobActivity job={strategyJob} />
      {pollIssue?.job === job && <p className="native-job-problem" role={pollIssue.retrying ? 'status' : 'alert'} data-native-polling={pollIssue.retrying ? 'retrying' : 'stopped'}>{jobText(pollIssue.retrying ? 'pollingRetryNotice' : 'pollingStoppedNotice')}</p>}
      <button className="g-qchip native-job-refresh" disabled={busy || refreshingJob === job} onClick={() => void refreshJob()}>{jobText('jobRefresh')}</button>
    </section>}
      </>,
    // The journal exists during every normal request. Its presence alone is
    // not an error: show recovery after dispatch settles, or immediately when
    // an explicit error/logout boundary requires attention.
    issue: (displayError || (hasPending && (!busy || pendingRecoveryVisible)) || hasLogout || (returnBinding !== null && !plainAuthReturn())) && <div role="alert"><p>{rejectedClaim && phase === 'ready' ? ui('서버가 전략 연결 요청을 거절했습니다(BAD_REQUEST). 이 요청 기록만 폐기하고 현재 로그인으로 새 대화를 시작할 수 있습니다. 기존 서버 전략은 삭제하지 않습니다.') : displayError ? nativeAppNotice(language, displayError) : (returnBinding !== null && !plainAuthReturn() ? ui('로그인 반환 화면을 벗어났습니다. 해당 화면으로 돌아가 세션을 다시 확인해주세요. 새 로그인을 시작하지 않았습니다.') : ui('서버 응답을 확인하고 있습니다. 새 요청을 만들지 않습니다.'))}</p>
      {returnBinding !== null && !plainAuthReturn() && <button disabled={busy || emailBusy || hasLogout} onClick={reopenReturnRoute}>{ui('로그인 반환 화면으로 돌아가기')}</button>}
      {hasComposerRecovery && <p>{ui('전송하지 않은 입력은 이 화면의 메모리에 임시 보관했습니다. 같은 세션·대화를 다시 확인하면 작성란에 복원하며 자동 전송하지 않습니다. 페이지 새로고침이나 닫기 후에는 보존되지 않습니다.')}</p>}
      {hasLogout && <><p>{ui('로그아웃은 서버 전략 삭제나 진행 중인 백테스트 취소가 아닙니다. 확인하지 못한 기존 요청은 서버에서 계속될 수 있으며 기록은 보존합니다.')}</p>
        <button disabled={busy || phase !== 'ready' || logoutBoundary !== null} onClick={() => void logout()}>{ui('같은 로그아웃 요청으로 재개')}</button>
        {logoutBoundary && <button disabled={busy} onClick={() => void newSessionAfterLogout()}>{ui('이전 요청 기록을 보존하고 현재 브라우저에서 새 대화 시작')}</button>}</>}
      {hasPending && !hasLogout && <button disabled={busy || phase !== 'ready' || rejectedClaim} onClick={() => { if (pending.current) void run(() => execute(pending.current!)) }}>{ui('같은 요청으로 재개')}</button>}
      {consultationRecoveryVisible && (consultationState.canResumePending || consultationState.canResumeDocumentPending || consultationClaimPending && consultationSessionState.issue !== null) && !hasPending && <button disabled={displayBusy || phase !== 'ready'} onClick={() => { void (consultationClaimPending ? continueConsultationSession() : resumeConsultationPending()) }}>{ui('같은 요청으로 재개')}</button>}
      {consultationChat && sourceIntakeIssue && sourceIntake?.status === 'uncertain' && !hasPending
        && <button disabled={displayBusy || sourceIntakeSubmitting || phase !== 'ready'} onClick={() => { void resumeSourceIntake() }}>{ui('같은 요청으로 재개')}</button>}
      {consultationRecoveryVisible && (consultationState.canDiscardPending || consultationClaimAvailable && consultationSessionState.canDiscard) && !hasPending && <button disabled={displayBusy || phase !== 'ready'} onClick={() => { void discardConsultationPending() }}>{nativeExecutionUiText(language, '이 로컬 요청 기록만 폐기')}</button>}
      {consultationRecoveryVisible && consultationState.canResumeObservation && !consultationState.canResumePending && !consultationState.canResumeDocumentPending && !consultationState.canDiscardPending && !hasPending
        && <button disabled={displayBusy || phase !== 'ready'} onClick={() => { void resumeConsultationObservation() }}>{nativeExecutionUiText(language, '진행 자동 확인 재개')}</button>}
      {rejectedClaim && <button disabled={busy || phase !== 'ready'} onClick={() => void discardRejectedClaim()}>{ui('연결 요청 기록을 폐기하고 현재 로그인으로 새 대화 시작')}</button>}</div>,
    onInput: value => { composerRecovery.current = null; setHasComposerRecovery(false); setInput(value) },
    onSend: async (value, displayText, researchThread) => {
      if (researchThread) await sendConsultation(value, displayText, true, researchThread)
      else if (consultationChat) await sendConsultation(value, displayText)
      else await send(value, 'composer', displayText)
    },
    canStop: (consultationChat || documentConsultationCurrent) && !consultationClaimPending && retainedConsultationMessages === null && consultationState.canStop,
    onStop: consultationChat || documentConsultationCurrent ? () => { void stopConsultation() } : undefined,
    onReset: () => {
      if (working.current || pending.current || logoutIntent.current || displayBusy || hasPending || hasLogout || consultationClaimPending || retainedConsultationMessages !== null || phase !== 'ready') {
        setError('확인하지 못한 요청을 먼저 재개하거나 이력에서 확인해주세요.'); return false
      }
      if (consultationChat) {
        const accepted = consultation.reset()
        if (accepted) setInput('')
        return accepted
      }
      // No server conversation exists yet: this is only a return to the home
      // composer, not a locator transition or implicit conversation creation.
      if (!conversation) return true
      return navigateConversation(false)
    }, onRecover: healthyAuthNotice ? undefined
      : () => {
        if (phase === 'logged-out' && logoutBoundary) void newSessionAfterLogout()
        else void run(async () => {
          if (returnBindingRef.current && !plainAuthReturn()) {
            setError('로그인 반환 화면을 벗어났습니다. 해당 화면으로 돌아가 세션을 다시 확인해주세요. 새 로그인을 시작하지 않았습니다.')
            return
          }
          if (logoutIntent.current || hasStoredNativeEmailIntent() || !returnBindingRef.current) await recoverSession()
          else await recheckReturnSession()
        })
      },
    onLogout: sessionState === 'AUTHENTICATED' && !hasLogout ? logout : undefined,
  }} nativeAccounts strategyDocument={sourceResearchPresentation && !proposalActive ? undefined : strategyDocument} conversationNotice={conversationNotice} authSurface={returnAuthSurface || authSurface}
    sourceIntake={sourceIntake && setupCandidate && sourceIntake.locatorOwner === setupCandidate.owner
      && sourceIntake.conversationId === setupCandidate.conversationId && sourceIntake.turnId === setupCandidate.turnId
      && sourceIntake.pair === setupCandidate.setup.pair ? {
        messageId: `${sourceIntake.turnId}_reply`, turnId: sourceIntake.turnId, value: sourceIntake.value,
        active: sourceIntake.status === 'collecting' && !sourceIntakeSubmitting && !displayBusy && phase === 'ready',
        onPick: pickNativeSourceIntake, onRestart: restartNativeSourceIntake,
      } : undefined}
    analysisPresentationBlocked={loginOpen || claimAvailable || Boolean(paperBinding || smokeBinding) || hasLogout || phase !== 'ready'}
    conversationLibrary={presentations.conversationLibrary} insightPresentation={presentations.insightPresentation}
    sharingPresentation={presentations.sharingPresentation} catalogueCopyExecution={catalogueCopyExecution} accountPresentation={accountPresentationBound(presentations.accountPresentation, accountScope) ? presentations.accountPresentation : bitgetCanary?.account} feedbackPresentation={presentations.feedbackPresentation} onConnectionClose={gateBroker?.requested ? gateBroker.close : bitgetCanary?.close} brokerPresentation={presentations.brokerPresentation ?? bitgetCanary?.broker} connectionPresentation={gateBroker?.requested ? gateBroker.connection : presentations.connectionPresentation ?? exchangeConnectionPresentation ?? bitgetCanary?.connection}
    gateBrokerAuthorization={gateBrokerAuthorization}
    researchPresentation={sourceResearchPresentation ?? (strategyDocument && presentations.researchPresentation?.scope === accountScope && presentations.researchPresentation.data.scopeId === strategyDocument.identity ? presentations.researchPresentation : strategyDocument && accountScope ? { scope: accountScope, data: {
      scopeId: strategyDocument.identity,
      entries: researchEntries,
      // Accepted TURN/VALIDATE records do not prove completion of a multi-agent
      // research run. Keep that state unasserted until its producer exists.
      status: 'unavailable',
    } } : undefined)}
    resultActivityKey={`${analysisJob?.backtestId ?? ''}:${currentResultStatus?.state ?? ''}`}
    analysisIdentity={analysisJob?.backtestId}
    analysisBinding={proposalActive && analysisJob && (analysisJob === strategyJob ? sourceJobScope : retainedResult?.sourceScope) ? {
      owner: proposalActive.owner, sourceConversationId: proposalActive.bound.sourceOrigin.sourceAPI13Locator.conversationId,
      researchWorkId: proposalActive.researchWorkId, strategyVersionId: analysisJob.strategyVersionId,
      semanticHash: analysisJob.semanticHash, backtestId: analysisJob.backtestId,
      reportReady: currentResultStatus?.backtestId === analysisJob.backtestId && currentResultStatus.reportReady,
    } : undefined}
    clarification={!hasLogout && phase === 'ready' && !approval && !job && conversation?.nextQuestion
      ? { prompt: conversation.nextQuestion.prompt, identity: `${conversation.conversationId}:${conversation.conversationStateRevision}:${conversation.nextQuestion.questionId}` } : null}
    historyFeedback={historyNotice && <p className="native-workflow-notice native-history-feedback" role="alert">{jobText(historyNotice)}</p>}
    navigationFeedback={navigationError && <p className="client-service-recovery" role="alert">{nativeObservationNavigationErrors[language][navigationError]}</p>}
    executionHistory={!hasLogout && strategyConversation && strategyOwner && phase === 'ready' && sessionState === 'AUTHENTICATED'
      ? { disabled: busy || hasPending, pending: historyPending, onLoad: () => { void loadHistory() }, render: renderHistory } : undefined}
    analysis={analysisJob && <>
      {analysisJob !== job && <div className="native-retained-result-notice" role="status">{workflowText('priorResult')} <span>{analysisJob.strategyVersionId}</span></div>}
      <NativeServiceResult key={analysisJob.backtestId} api={clients.native} job={analysisJob} embedded previous={analysisJob !== job} onStatusChange={observeResultStatus}
        createReplayReader={createReplayReader}
        automaticPresentation={analysisJob === job ? automaticPresentation : undefined}
        onEditDraft={analysisJob === job ? () => { void editFromResult() } : undefined}
        editDisabled={busy || emailBusy || hasPending || hasLogout || phase !== 'ready' || resultStatus?.backtestId !== analysisJob.backtestId || !resultStatus.reportReady} />
    </>}
    connectionPlanContinuation={connectionPlanContinuation}
    onConnectionPlanContinuationConsumed={requestId => setConnectionPlanContinuation(current => current?.requestId === requestId ? null : current)}
    onLogin={(intent, request) => { void openLogin(intent === 'signup' ? 'signup' : 'login', request) }} onHistory={() => { if (!hasLogout) void loadHistory() }} onQuickReply={async (value, researchThread) => {
      if (researchThread) await sendConsultation(value, undefined, true, researchThread)
      else if (consultationChat) await sendConsultation(value)
      else await send(value, 'quick-reply')
    }}
    marketQuestionActions={consultationChat && accountScope ? { scope: accountScope, submit: async (answer, signal) => {
      if (signal.aborted) return false
      const message = displayMessages.find(candidate => candidate.id === answer.binding.messageId)
      const block = message?.responseBlocks?.find(candidate => candidate.kind === 'market-question'
        && candidate.presentation.binding.observationId === answer.binding.observationId)
      if (!block || block.kind !== 'market-question') return false
      const text = nativeInvestmentQuestionUserText(block.presentation, answer)
      return text !== null && !signal.aborted && await sendConsultation(text, undefined, false) === true
    } } : undefined}
    followupActions={consultationChat && accountScope ? { scope: accountScope, activate: async (selection, signal) => {
      if (signal.aborted || selection.kind !== 'question') return false
      const message = displayMessages.find(candidate => candidate.id === selection.binding.messageId)
      const block = message?.responseBlocks?.find(candidate => candidate.kind === 'followups'
        && candidate.presentation.binding.observationId === selection.binding.observationId)
      if (!block || block.kind !== 'followups'
        || !block.presentation.questions.some(question => JSON.stringify(question) === JSON.stringify(selection.item))) return false
      return await sendConsultation(selection.item.text, undefined, false) === true
    } } : undefined}
    conversationNavigation={<>{healthyAuthNotice && <p className="sr-only" data-native-auth-notice role="status">{nativeAppNotice(language, healthyAuthNotice.text)}</p>}
      {!hasLogout && phase === 'ready' && sessionState !== null && (navigationError || (previousConversation && previousConversation.conversationId !== conversation?.conversationId)) && <section className="client-service-recovery" aria-label={nativeObservationCopy[language].previousLabel}>
      {previousConversation && previousConversation.conversationId !== conversation?.conversationId && <>
        <button className="g-qchip" type="button" disabled={busy || hasPending} onClick={() => void navigateConversation(true)}>{nativeObservationCopy[language].previousAction}</button>
        <p>{nativeObservationCopy[language].previousNote}</p>
      </>}
      {navigationError && <p role="alert">{nativeObservationNavigationErrors[language][navigationError]}</p>}
    </section>}</>}
    />
}
