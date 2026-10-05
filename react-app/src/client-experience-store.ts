/** Local UI projection of tesia-lab; intake cards follow T8 (observed at 621cbed).
 * NOT a conversation/API contract or a declaration of whole-source parity.
 * Only non-secret conversation fixtures are persisted, never credentials.
 * Source-authored fallback copy is kept separate from future service events.
 */
import { forgetMockResearchPreview, getMockResearchPreview } from './mock-research-preview'
import { intakePercentage, intakeWithoutTake, namedIntakePercentages, namedIntakeRsi } from './client-intake-input'
import { intakeChoiceValue } from './client-intake-card'
import { forgetResearchDocumentMemory } from './client-research-cache'
import { forgetDelegationUiMemory, readDelegationUi, resolveDelegationProgress, saveDelegationUi } from './client-delegation-fixtures'
import { prepareSharedCopy, type SharedCopyRequest } from './client-shared-copy'
import { decodeSharedFollow, type SharedFollowRecord } from './client-shared-follow'
import { clientResearchAutoTitle } from './client-research-label'
import { decodeInlineInput, inlineInput, inlinePending, readInlineRecords, type InlineBacktestInput, type InlineBacktestRecord } from './client-inline-backtest'
import { evaluateDelegation } from './client-delegation-engine'
import { SOURCE_USER_STRATEGY_PASS_SCORE } from './client-user-strategy'
import { canOpenBaseResearch, canRestoreBaseResearch, researchScope, researchScopes } from './client-research-lifecycle'
import { readFollowupActions, type FollowupAction, type FollowupSelection } from './client-followup-presentation'
import { canContinuePreview, CONTINUE_RESPONSE_PROMPT, type ContinueResponseRequest } from './client-continuation'
import { readStoredMarketResponse, type StoredMarketResponse } from './client-stored-market-response'
import type { MarketQuestionAnswer, MarketQuestionPresentation, MarketQuestionViewState } from './client-market-question-presentation'
import { decodeMarketQuestionState } from './client-market-question-state'
import { marketBindingKey, type MarketResponseBinding } from './client-market-response-presentation'
import { marketQuestionText } from './client-market-question-copy'
import type { ClientLanguage } from './client-preferences'
import type { MarketChartBlock, MarketChartRequest } from './client-market-chart-presentation'
import { canRetryPreview, type RetryResponseRequest } from './client-response-retry'
import { canAdvanceResponseSequence, readStoredResponseSequence, responseSequenceText, type StoredResponseSequence } from './client-stored-response-sequence'
import { commonTurn, readCommonBacktest, type CommonBacktestPreview } from './client-common-backtest-preview'
import { commonSelectionVisible, responseStrategyForTurn } from './client-response-strategy'
import { readSourceIntake, pickSourceIntake, sourceIntakePreview, type SourceIntake, type SourceIntakeKey } from './client-source-intake'
import { replyConditionalOrderPreview, readMockConditionalOrderPending, type MockConditionalOrderPending } from './client-conditional-order-response-preview'
import { canAdmitMockConditionalOrderTurn } from './client-conditional-order-turn-binding'
import { createCommonRevisionDirection, readCommonRevisionDirection, replyCommonRevisionDirection, commonRevisionDirectionQuestion, type CommonRevisionDirection } from './client-common-revision-direction'
import { completedCommonRevisionSource, exampleCommonProposal, readCommonRevision, restoreCommonRevisions, COMMON_PREVIEW_REVISION, commonRevisionComparison, commonResultContext, readCommonResultContext, type CommonResultContext, type CommonRevision } from './client-common-revision'

export type ConversationPhase = 'mode' | 'pair' | 'timeframe' | 'risk' | 'take' | 'plan'
export type ConversationViewport = { top: number; spacer: number; follow: boolean; questionKey: string }
export type ClientTurn = {
  id: string; question: string; answer: string; fullAnswer: string
  /** Local source-preview interpretation, distinct from the user's visible words. */
  requestText?: string
  /** Explicit Mock producer owner for conditional-order display only, never execution authority. */
  conditionalOrderOwner?: string | null
  /** Bounded public Mock clarification only, never a service/tool observation. */
  conditionalOrderPending?: MockConditionalOrderPending
  startedAt: number; finishedAt?: number; status: 'running' | 'done' | 'stopped' | 'failed'
  suggestions: string[]; phase: ConversationPhase
  /** Source-authored local preview actions, not executable model/tool instructions. */
  followupActions?: FollowupAction[]
  followupsConsumed?: true
  /** Preview transcript lineage only; not server conversation/retry authority. */
  continuationOf?: string
  /** Local new-request lineage. Not a provider idempotency/recovery key. */
  retryOf?: string
  /** Explicit local display observations only, not a service response or authority. */
  marketResponse?: StoredMarketResponse
  /** Ordered public display observations, never private reasoning or wire authority. */
  responseSequence?: StoredResponseSequence
  /** A damaged observed transcript must never resume as a synthetic fixture. */
  responseSequenceInvalid?: true
  /** Local receipt time of a final preview proposal, NOT provider completion time. */
  strategyObservedAt?: number
  /** The source renders the accepted selection summary instead of a duplicate bubble. */
  marketQuestionOf?: string
  inlineRequest?: InlineBacktestInput
  inlineStopped?: true
  /** Latest common-backtest journey. Absent on preserved historical inline results. */
  backtestFlow?: 'common'
  /** Visited UI only; never a completed/approved backtest or execution grant. */
  commonBacktestOpened?: true
  commonRevision?: CommonRevision
  /** Ask direction before creating a display-only one-condition proposal. */
  commonRevisionDirection?: CommonRevisionDirection
  commonRevisionDirectionInvalid?: true
  commonRevisionOf?: string
  commonRevisionInvalid?: true
  commonResultContext?: CommonResultContext
  commonResultContextInvalid?: true
  /** Client-authored questions in this conversation, never a model/SDK result. */
  sourceIntake?: SourceIntake
  sourceIntakeInvalid?: true
}
export type ClientSession = {
  id: string; title: string; renamed: boolean; idea: string; draft: string
  pair: string; mode: 'dip' | 'trend' | ''; timeframe: string; risk: string; takeProfit: string
  /** Raw explicit local-preview RSI; engine normalization is visible in the card. */
  requestedRsi?: number
  rsiUnresolved?: true
  researchStatus: '초안' | '진행 중' | '검토 필요'
  paper?: boolean
  pinned?: boolean
  phase: ConversationPhase; turns: ClientTurn[]; updatedAt: number
  workspace: 'conversation' | 'research' | 'delegation'; tradingReady: boolean
  conversationViewport?: ConversationViewport
  inlineResults?: InlineBacktestRecord[]
  commonBacktest?: CommonBacktestPreview
  /** Selects a stored source-preview result, never an execution authorization. */
  inlineConnectionTurnId?: string
  /** A discarded selection requires explicit result selection, not cache resume. */
  inlineConnectionRecovery?: true
  researchPlanTurnId?: string
  researchPlanTurnIds?: string[]
  researchPlanRecovery?: true
  /** Source-preview provenance only; never a published strategy or execution grant. */
  sharedCopy?: { owner: string; nick: string; confirmedAt: number; returnId: string | null; active: boolean; followId?: string }
}
type Snapshot = { sessions: ClientSession[]; sharedFollows: SharedFollowRecord[]; currentId: string | null; homeDraft: string; storageError: boolean; recoveryWarning?: boolean }
const KEY = 'teth-client-experience'
const INLINE_COMMIT_UNCERTAIN = '저장 여부를 확인할 수 없어요. 새로고침해 저장된 기록을 확인해주세요.'
/** User-facing local-state errors; never forward arbitrary storage exceptions. */
export class InlineConnectionError extends Error {}
const validTurn = (x: unknown): x is ClientTurn => {
  if (!x || typeof x !== 'object') return false
  const t = x as ClientTurn
  return typeof t.id === 'string' && typeof t.question === 'string' && typeof t.answer === 'string' && typeof t.fullAnswer === 'string' && Number.isFinite(t.startedAt) && ['running','done','stopped','failed'].includes(t.status) && Array.isArray(t.suggestions) && t.suggestions.every(s => typeof s === 'string')
}
const validSession = (x: unknown): x is ClientSession => {
  if (!x || typeof x !== 'object') return false
  const s = x as ClientSession
  return ['id','title','idea','draft','pair','mode','phase','timeframe','risk'].every(k => typeof s[k as keyof ClientSession] === 'string') && Array.isArray(s.turns) && ['conversation','research','delegation'].includes(s.workspace) && Number.isFinite(s.updatedAt)
}
function passingInlineRecord(records: readonly InlineBacktestRecord[], turnId: unknown): InlineBacktestRecord | undefined {
  if (typeof turnId !== 'string' || !turnId) return
  const record = records.find(item => item.turnId === turnId)
  if (!record) return
  try {
    const score = evaluateDelegation(record.parameters, 5_000_000).score
    return Number.isFinite(score) && score >= SOURCE_USER_STRATEGY_PASS_SCORE ? record : undefined
  } catch { return }
}
function read(): Snapshot {
  try {
    const x = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (x && Array.isArray(x.sessions)) {
      // A damaged record must not discard unrelated conversations or the home draft.
      let recoveryWarning = x.recoveryWarning === true
      const inlineSelectionSessions = new Set<string>()
      const sessions: ClientSession[] = x.sessions.filter(validSession).map((s: ClientSession): ClientSession => {
        const validTurns = s.turns.filter(validTurn)
        if (validTurns.length !== s.turns.length) recoveryWarning = true
        const priorStoppedIds = new Set<string>()
        const priorRetryQuestions = new Map<string, { question: string; requestText: string }>()
        const priorQuestionSummaries = new Map<string, Set<string>>()
        let turns = validTurns.map((turn, index): ClientTurn => {
          if (turn.commonRevisionDirection !== undefined || turn.commonRevisionDirectionInvalid !== undefined) {
            const direction = turn.commonRevisionDirectionInvalid ? undefined : readCommonRevisionDirection(turn.commonRevisionDirection, validTurns.slice(0, index))
            if (!direction || turn.status !== 'done' || turn.commonRevision || turn.inlineRequest || turn.responseSequence || turn.responseSequenceInvalid || turn.sourceIntake || turn.marketResponse) {
              recoveryWarning = true
              turn = { ...turn, commonRevisionDirection: undefined, commonRevisionDirectionInvalid: true, suggestions: [] }
            } else turn = { ...turn, commonRevisionDirection: direction, commonRevisionDirectionInvalid: undefined }
          }
          if (turn.conditionalOrderPending !== undefined) {
            const pending = readMockConditionalOrderPending(turn.conditionalOrderPending)
            if (!pending || !Object.hasOwn(turn, 'conditionalOrderOwner') || !canAdmitMockConditionalOrderTurn(turn, turn.conditionalOrderOwner ?? null)) {
              recoveryWarning = true
              turn = { ...turn, conditionalOrderPending: undefined, suggestions: [] }
            } else turn = { ...turn, conditionalOrderPending: pending }
          }
          if (turn.sourceIntake !== undefined || turn.sourceIntakeInvalid !== undefined) {
            const intake = turn.sourceIntakeInvalid !== undefined ? undefined : readSourceIntake(turn.sourceIntake)
            const expected = intake && sourceIntakePreview(intake)
            const bound = intake && turn.status === 'done' && !turn.responseSequence && !turn.responseSequenceInvalid && !turn.marketResponse
              && (expected ? JSON.stringify(decodeInlineInput(turn.inlineRequest)) === JSON.stringify(expected.input) && turn.backtestFlow === 'common' : turn.inlineRequest === undefined)
            if (!bound) {
              recoveryWarning = true
              turn = { ...turn, sourceIntake: undefined, sourceIntakeInvalid: true, inlineRequest: undefined, backtestFlow: undefined, suggestions: [] }
            } else turn = { ...turn, sourceIntake: intake, sourceIntakeInvalid: undefined }
          }
          if (turn.continuationOf !== undefined && (typeof turn.continuationOf !== 'string'
            || !priorStoppedIds.has(turn.continuationOf))) {
            recoveryWarning = true
            turn = { ...turn, continuationOf: undefined }
          }
          if (turn.retryOf !== undefined) {
            const prior = typeof turn.retryOf === 'string' ? priorRetryQuestions.get(turn.retryOf) : undefined
            if (!prior || prior.question !== turn.question || prior.requestText !== (turn.requestText ?? turn.question)) {
              recoveryWarning = true
              turn = { ...turn, retryOf: undefined }
            }
          }
          if (turn.status === 'stopped' || turn.status === 'failed') priorStoppedIds.add(turn.id)
          if (canRetryPreview(turn)) priorRetryQuestions.set(turn.id, { question: turn.question,
            requestText: typeof turn.requestText === 'string' ? turn.requestText : turn.question })
          if (turn.marketResponse !== undefined) {
            const response = readStoredMarketResponse(turn.marketResponse, s.id, turn.id)
            if (!response) recoveryWarning = true
            turn = { ...turn, marketResponse: response ?? undefined }
          }
          if (turn.responseSequence !== undefined || turn.responseSequenceInvalid !== undefined) {
            const response = turn.responseSequenceInvalid === undefined
              ? readStoredResponseSequence(turn.responseSequence, s.id, turn.id, turn.marketResponse) : null
            if (response) {
              const answer = responseSequenceText(response)
              turn = { ...turn, responseSequence: response, responseSequenceInvalid: undefined,
                answer, fullAnswer: answer, status: response.status }
            } else {
              recoveryWarning = true
              turn = { ...turn, responseSequence: undefined, responseSequenceInvalid: true,
                status: turn.status === 'running' ? 'stopped' : turn.status }
            }
          }
          if (turn.marketQuestionOf !== undefined && (typeof turn.marketQuestionOf !== 'string'
            || !priorQuestionSummaries.get(turn.marketQuestionOf)?.has(turn.question))) {
            recoveryWarning = true
            turn = { ...turn, marketQuestionOf: undefined }
          }
          if (turn.marketResponse && turn.status === 'done') {
            priorQuestionSummaries.set(turn.id, new Set(turn.marketResponse.blocks.flatMap(block =>
              block.kind === 'market-question' && block.presentation.state?.accepted ? [block.presentation.state.accepted.text] : [])))
          }
          if (turn.followupsConsumed !== undefined && turn.followupsConsumed !== true) {
            recoveryWarning = true
            turn = { ...turn, followupsConsumed: undefined }
          }
          if (turn.followupActions !== undefined) {
            const actions = readFollowupActions(turn.followupActions)
            if (!actions) recoveryWarning = true
            turn = { ...turn, followupActions: actions }
          }
          if (turn.inlineRequest !== undefined) {
            const request = decodeInlineInput(turn.inlineRequest)
            if (!request) recoveryWarning = true
            turn = { ...turn, inlineRequest: request, inlineStopped: turn.inlineStopped === true ? true : undefined }
            if (turn.backtestFlow !== undefined && turn.backtestFlow !== 'common') {
              recoveryWarning = true
              turn = { ...turn, backtestFlow: undefined, inlineStopped: true }
            }
            if (request && !turn.responseSequence && (!Number.isSafeInteger(turn.startedAt) || turn.startedAt < 0
              || turn.status === 'done' && (!Number.isSafeInteger(turn.finishedAt) || turn.finishedAt! < turn.startedAt))) {
              recoveryWarning = true
              turn = { ...turn, inlineStopped: true }
            }
          }
          if (turn.responseSequence?.strategyProposal && !responseStrategyForTurn(turn)) {
            recoveryWarning = true
            turn = { ...turn, inlineStopped: true, commonBacktestOpened: undefined }
          }
          // Invalid optional visit metadata must not discard the strategy turn.
          if (turn.commonBacktestOpened !== undefined && (turn.commonBacktestOpened !== true || !commonTurn(turn) || !decodeInlineInput(turn.inlineRequest))) {
            recoveryWarning = true
            turn = { ...turn, commonBacktestOpened: undefined }
          }
          // Optional search metadata must not discard an otherwise valid turn.
          if (turn.requestText !== undefined && typeof turn.requestText !== 'string') {
            recoveryWarning = true
            turn = { ...turn, requestText: undefined }
          }
          // Only the latest local fixture turn can stream. Preserve incomplete
          // text in inconsistent older records without inventing a completion.
          if (!turn.responseSequence && !turn.responseSequenceInvalid && turn.status === 'running' && (index !== validTurns.length - 1 || (!turn.fullAnswer && !turn.suggestions.length))) {
            recoveryWarning = true
            return { ...turn, status: 'stopped', finishedAt: Number.isFinite(turn.finishedAt) ? turn.finishedAt : turn.startedAt }
          }
          return turn
        })
        turns=turns.map(turn=>{
          if(turn.commonResultContext===undefined&&turn.commonResultContextInvalid===undefined)return turn
          const context=turn.commonResultContextInvalid===undefined?readCommonResultContext(turn.commonResultContext):undefined
          if(context)return {...turn,commonResultContext:context}
          recoveryWarning=true
          return {...turn,commonResultContext:undefined,commonResultContextInvalid:true}
        })
        const revisions = restoreCommonRevisions(turns)
        turns = revisions.turns
        recoveryWarning ||= revisions.invalid
        const inline = readInlineRecords(s.inlineResults, turns)
        const commonBacktest = readCommonBacktest(s.commonBacktest, turns)
        if (s.commonBacktest !== undefined && !commonBacktest) recoveryWarning = true
        recoveryWarning ||= inline.invalid
        // A discarded completed result must not silently re-run on reload.
        const recoveredTurns = inline.invalid ? turns.map(t => t.status === 'done' && t.backtestFlow !== 'common' && t.inlineRequest && !inline.records.some(r => r.turnId === t.id) ? { ...t, inlineStopped: true as const } : t) : turns
        const { inlineConnectionTurnId, inlineConnectionRecovery, researchPlanTurnId, researchPlanTurnIds, researchPlanRecovery, ...rest } = s
        const hasResearchSelection = Object.hasOwn(s, 'researchPlanTurnId')
        const validResearchSelection = typeof researchPlanTurnId === 'string' && inline.records.some(record => record.turnId === researchPlanTurnId)
        const researchRecovery = hasResearchSelection && !validResearchSelection || researchPlanRecovery === true
        // Observation/cleanup identities survive damaged result content. They
        // cannot supply plan conditions, but may still own a running replay.
        const visitedPlans = Array.isArray(researchPlanTurnIds) ? [...new Set(researchPlanTurnIds.filter(id => typeof id === 'string' && id.trim()))] : []
        if (researchPlanTurnIds !== undefined && (!Array.isArray(researchPlanTurnIds) || researchPlanTurnIds.length !== visitedPlans.length)) recoveryWarning = true
        if (typeof researchPlanTurnId === 'string' && researchPlanTurnId.trim() && !visitedPlans.includes(researchPlanTurnId)) visitedPlans.push(researchPlanTurnId)
        if (validResearchSelection && !visitedPlans.includes(researchPlanTurnId!)) visitedPlans.push(researchPlanTurnId!)
        if (researchRecovery) recoveryWarning = true
        const hasSelector = Object.hasOwn(s, 'inlineConnectionTurnId')
        if (hasSelector || inlineConnectionRecovery === true) inlineSelectionSessions.add(s.id)
        const validSelector = hasSelector && s.sharedCopy?.active !== true && Boolean(passingInlineRecord(inline.records, inlineConnectionTurnId))
        const selectionRecovery = hasSelector && !validSelector || inlineConnectionRecovery === true
        if (selectionRecovery) recoveryWarning = true
        const invalidRsi = s.requestedRsi !== undefined && (typeof s.requestedRsi !== 'number' || !Number.isFinite(s.requestedRsi))
          || s.rsiUnresolved !== undefined && s.rsiUnresolved !== true
        if (invalidRsi) recoveryWarning = true
        return { ...rest, commonBacktest, ...(validSelector ? { inlineConnectionTurnId } : {}),
          requestedRsi: typeof s.requestedRsi === 'number' && Number.isFinite(s.requestedRsi) ? s.requestedRsi : undefined,
          rsiUnresolved: invalidRsi || s.rsiUnresolved === true ? true : undefined,
          ...(validResearchSelection ? { researchPlanTurnId } : {}),
          ...(visitedPlans.length ? { researchPlanTurnIds: visitedPlans } : {}),
          ...(researchRecovery ? { researchPlanRecovery: true as const } : {}),
          ...(selectionRecovery ? { inlineConnectionRecovery: true as const } : {}),
          workspace: selectionRecovery || researchRecovery ? 'conversation' : s.workspace,
          turns: recoveredTurns, ...(Object.hasOwn(s, 'inlineResults') || inline.records.length ? { inlineResults: inline.records } : {}), takeProfit: typeof s.takeProfit === 'string' ? s.takeProfit : '', researchStatus: ['초안','진행 중','검토 필요'].includes(s.researchStatus) ? s.researchStatus : '초안' }
      })
      const candidates: unknown[] = Object.hasOwn(x, 'sharedFollows')
        ? Array.isArray(x.sharedFollows) ? x.sharedFollows : []
        : sessions.flatMap(s => {
          if (!s.sharedCopy || inlineSelectionSessions.has(s.id)) return []
          const ui = readDelegationUi(s.id)
          if (!ui || ui.recoveryRequired || ui.inlineResult) return []
          return [{ id: s.sharedCopy.followId ?? s.id, owner: s.sharedCopy.owner, nick: s.sharedCopy.nick,
            asset: ui.answers.asset?.label, parameters: ui.pendingParameters ?? ui.parameters,
            budgetIndex: ui.answers.budget?.index, confirmedAt: s.sharedCopy.confirmedAt, sessionId: s.id, active: s.sharedCopy.active }]
        })
      if (Object.hasOwn(x, 'sharedFollows') && !Array.isArray(x.sharedFollows)) recoveryWarning = true
      if (!Object.hasOwn(x, 'sharedFollows')) candidates.sort((a, b) => (decodeSharedFollow(b)?.confirmedAt ?? -1) - (decodeSharedFollow(a)?.confirmedAt ?? -1))
      const sharedFollows: SharedFollowRecord[] = [], ids = new Set<string>()
      for (const candidate of candidates) {
        const record = decodeSharedFollow(candidate)
        if (!record || ids.has(record.id)) { recoveryWarning = true; continue }
        ids.add(record.id); sharedFollows.push(record)
      }
      // Recovery chooses the newest explicit assignment per owner, never more
      // than one current follow. Inactive/deleted lists never revive old metadata.
      const activeByOwner = new Map<string, SharedFollowRecord>()
      for (const record of sharedFollows) if (record.active) {
        const prior = activeByOwner.get(record.owner)
        if (!prior || record.confirmedAt > prior.confirmedAt) activeByOwner.set(record.owner, record)
      }
      for (const record of sharedFollows) if (record.active && activeByOwner.get(record.owner) !== record) { record.active = false; recoveryWarning = true }
      // Legacy candidates are newest-first to select the latest valid duplicate.
      // Normalize only after that choice; explicit arrays retain their source order.
      if (!Object.hasOwn(x, 'sharedFollows')) sharedFollows.reverse()
      return { sessions, sharedFollows, currentId: typeof x.currentId === 'string' && sessions.some(s => s.id === x.currentId) ? x.currentId : null, homeDraft: typeof x.homeDraft === 'string' ? x.homeDraft : '', storageError: false, recoveryWarning: recoveryWarning || sessions.length !== x.sessions.length }
    }
  } catch { return { sessions: [], sharedFollows: [], currentId: null, homeDraft: '', storageError: true } }
  return { sessions: [], sharedFollows: [], currentId: null, homeDraft: '', storageError: false }
}

// Source gConvInterpret → gAskMode/gAskPair/gAskTf/gAskRisk/gMakePlan.
function sourceReply(s: ClientSession, question: string): { answer: string; suggestions: string[]; phase: ConversationPhase; inlineRequest?: InlineBacktestInput } {
  question = intakeChoiceValue(s.phase, question)
  const beforeInput = JSON.stringify(inlineInput(s))
  const rsi = namedIntakeRsi(question)
  if (rsi.kind === 'unresolved') s.rsiUnresolved = true
  else if (rsi.kind === 'value') { s.requestedRsi = rsi.requested; s.rsiUnresolved = undefined }
  const rsiNotice = { answer: '명확한 매수 진입 기준을 입력해 주세요. 예: RSI 30 미만에서 반등 매수.', suggestions: [], phase: s.phase }
  if (s.phase === 'plan') {
    const prior = { risk: s.risk, takeProfit: s.takeProfit, mode: s.mode }
    const before = beforeInput
    if (question === '조건을 직접 수정할게요') return { answer: '바꾸고 싶은 조건을 적어주십시오. 예를 들어 "손절 -5%로", "익절 없이", "추세 진입으로"처럼요. 적용 후 다시 검증하겠습니다.', suggestions: [], phase: 'plan' }
    const recommend = question === '추천 설정으로 다시 검증'
    const edits = namedIntakePercentages(question)
    if (edits.risk !== undefined) s.risk = `−${edits.risk}%`
    if (edits.take !== undefined) s.takeProfit = `+${edits.take}%`
    if (intakeWithoutTake(question)) s.takeProfit = '미설정'
    if (/^추세\s*진입(?:으로)?[.!]?$/.test(question.trim())) s.mode = 'trend'
    if (/^반등\s*매수(?:로)?[.!]?$/.test(question.trim())) s.mode = 'dip'
    // Keep other explicit edits as draft, but never validate with an unresolved RSI.
    if (s.rsiUnresolved) return rsiNotice
    if (recommend) { s.risk = '−5%'; s.mode = 'trend'; if (s.takeProfit === '미설정') s.takeProfit = '+12%' }
    const request = inlineInput(s)
    if (request && (recommend || JSON.stringify(request) !== before)) return {
      answer: recommend ? '손실 제한 -5%, 추세 필터, 익절 기준을 추천값으로 조정했어요. 과거를 다시 돌려 볼까요?' : '조건을 정리했습니다. 과거를 다시 돌려 볼까요?',
      suggestions: [], phase: 'plan', inlineRequest: request,
    }
    if (!request) Object.assign(s, prior)
    return { answer: '바꾸고 싶은 조건을 적어주십시오. 예를 들어 "손절 -5%로", "익절 없이", "추세 진입으로"처럼요. 적용 후 다시 검증하겠습니다.', suggestions: [], phase: 'plan' }
  }
  const before = [s.mode, s.pair, s.timeframe, s.risk, s.takeProfit].join('|')
  if (/이더|eth/i.test(question)) s.pair = 'ETH/USDT'
  else if (/비트|btc/i.test(question)) s.pair = 'BTC/USDT'
  if (/떨어|하락|급락|반등|저가|눌림|물타|내려/.test(question)) s.mode = 'dip'
  else if (/오르|추세|상승|돌파/.test(question)) s.mode = 'trend'
  if (/하루|일봉/.test(question)) s.timeframe = '일봉'
  else if (/1시간|한 시간/.test(question)) s.timeframe = '1시간봉'
  // Explicitly named conditions can answer more than one pending question,
  // even after the first turn. Bare numbers still belong to the active field.
  const intents = namedIntakePercentages(question)
  const risk = intents.risk ?? (s.phase === 'risk' ? intakePercentage(question, 'risk') : undefined)
  const take = intents.take ?? (s.phase === 'take' ? intakePercentage(question, 'take') : undefined)
  if (risk !== undefined) s.risk = `−${risk}%`
  if (take !== undefined) s.takeProfit = `+${take}%`
  if (s.phase === 'take' && intakeWithoutTake(question)) s.takeProfit = '미설정'
  if (s.rsiUnresolved) return rsiNotice
  const said = [intents.risk !== undefined ? `손절 -${intents.risk}%` : '', intents.take !== undefined ? `익절 +${intents.take}%` : ''].filter(Boolean)
  let lead = s.turns.length ? '' : `아이디어를 확인했습니다.${s.pair ? ` 대상은 ${s.pair}로 이해했습니다.` : ''}${said.length ? ` 말씀하신 ${said.join('와 ')}는 그대로 반영해두겠습니다.` : ''} 검증 가능한 조건으로 만들기 위해 몇 가지를 확인합니다.\n\n`
  if (s.turns.length && said.length) lead = `말씀하신 ${said.join('와 ')}는 그대로 반영해두겠습니다.\n\n`
  if (question.trim() === '추천' && s.phase === 'pair') {
    s.pair = 'BTC/USDT'
    lead = '거래량과 데이터 안정성 기준으로 BTC/USDT를 권장합니다.\n\n'
  } else if (question.trim() === '추천' && s.phase === 'timeframe') {
    s.timeframe = '1시간봉'
    lead = '반등형 조건에는 1시간봉이 균형점입니다.\n\n'
  } else if (s.turns.length && before === [s.mode, s.pair, s.timeframe, s.risk, s.takeProfit].join('|')) {
    lead = '아래에서 골라주십시오. 원하는 답이 없으면 비슷하게 적어주셔도 됩니다.\n\n'
  }
  if (/차이 설명/.test(question)) lead = '반등 매수는 과매도 후 회복을 노립니다, 거래가 적고 느립니다. 추세 진입은 상승 확인 후 따라갑니다, 거래가 잦고 빠릅니다.\n\n'
  // The source now asks inside the card. Do not repeat the old chip prompt
  // above it; an empty acknowledgement is valid while awaiting that card.
  if (!s.mode) return { answer: lead.trim(), suggestions: ['내려왔을 때 반등 매수', '오르는 흐름에 진입', '차이 설명'], phase: 'mode' }
  if (!s.pair) return { answer: lead.trim(), suggestions: ['BTC/USDT', 'ETH/USDT', '추천'], phase: 'pair' }
  if (!s.timeframe) return { answer: lead.trim(), suggestions: ['1시간', '하루 1회', '추천'], phase: 'timeframe' }
  if (!s.risk) return { answer: lead.trim(), suggestions: ['−2%', '−3% (표준)', '−5%'], phase: 'risk' }
  if (!s.takeProfit) return { answer: lead.trim(), suggestions: ['익절 +8% 설정', '익절 없이 진행'], phase: 'take' }
  const request = inlineInput(s)
  return { answer: lead + (request ? '조건을 정리했습니다. 과거를 다시 돌려 볼까요?' : '검증 조건을 다시 확인해주세요. 손절과 익절 비율을 직접 수정할 수 있어요.'), suggestions: [], phase: 'plan', inlineRequest: request }
}

function emptyConversation(idea: string): ClientSession {
  return { id: crypto.randomUUID(), title: '새 전략', renamed: false, idea, draft: '', pair: '', mode: '', timeframe: '', risk: '', takeProfit: '', researchStatus: '초안', phase: 'mode', turns: [], updatedAt: Date.now(), workspace: 'conversation', tradingReady: false }
}
function appendLocalQuestion(session: ClientSession, text: string, shown: string, clearDraft: boolean, flow: 'common' | 'inline'): ClientSession {
  const next = { ...session, draft: clearDraft ? '' : session.draft, updatedAt: Date.now() }
  const reply = sourceReply(next, text)
  next.phase = reply.phase
  if (reply.inlineRequest && flow === 'inline') reply.answer = '조건을 정리했습니다. 화면 이동 없이 여기서 바로 과거 데이터로 검증하겠습니다.'
  next.turns = [...session.turns, { id: crypto.randomUUID(), question: shown, ...(shown !== text ? { requestText: text } : {}), answer: '', fullAnswer: reply.answer, suggestions: reply.suggestions, phase: reply.phase, inlineRequest: reply.inlineRequest, ...(reply.inlineRequest && flow === 'common' ? { backtestFlow: 'common' as const } : {}), status: 'running', startedAt: Date.now() }]
  return next
}

/** Small, deterministic public Mock grammar. Existing strategy state is preserved. */
function appendConditionalOrderQuestion(session: ClientSession, text: string, shown: string, clearDraft: boolean, owner: string | null): ClientSession | null {
  const previous = session.turns.at(-1)
  const pending = previous && canAdmitMockConditionalOrderTurn(previous, owner) ? readMockConditionalOrderPending(previous.conditionalOrderPending) : null
  const reply = replyConditionalOrderPreview(text, pending)
  if (!reply) return null
  const now = Date.now()
  return { ...session, workspace: 'conversation', draft: clearDraft ? '' : session.draft, updatedAt: now,
    turns: [...session.turns.map(turn => turn === previous && pending ? { ...turn, followupsConsumed: true as const } : turn), {
      id: crypto.randomUUID(), question: shown, ...(shown !== text ? { requestText: text } : {}),
      answer: reply.answer, fullAnswer: reply.answer, suggestions: [...(reply.kind === 'ask' ? reply.suggestions : [])],
      phase: session.phase, status: 'done', startedAt: now, finishedAt: now, conditionalOrderOwner: owner,
      ...(reply.pending ? { conditionalOrderPending: reply.pending } : {}),
    }] }
}

function appendSourceIntake(session: ClientSession, label: string): ClientSession {
  const now = Date.now()
  return { ...session, workspace: 'conversation', updatedAt: now, turns: [...session.turns, {
    id: crypto.randomUUID(), question: label, answer: '', fullAnswer: '', suggestions: [], phase: 'plan',
    status: 'done', startedAt: now, finishedAt: now, sourceIntake: { answers: [] },
  }] }
}

export function createClientExperienceStore(options: { localBacktestFlow?: (requestOwner?: string | null) => 'common' | 'inline' } = {}) {
  // Direct-store compatibility does not select the public shell's source mode.
  // Resolve before publishing a request, including before creating its session.
  let localBacktestFlow = options.localBacktestFlow
  const localFlow = (requestOwner?: string | null) => {
    let flow: 'common' | 'inline'
    try { flow = localBacktestFlow ? localBacktestFlow(requestOwner) : 'common' }
    catch { throw new InlineConnectionError('응답 경로를 확인하지 못했어요. 작성한 내용은 유지됩니다.') }
    if (flow !== 'common' && flow !== 'inline') throw new InlineConnectionError('응답 경로를 확인하지 못했어요. 작성한 내용은 유지됩니다.')
    return flow
  }
  const appendQuestion = (session: ClientSession, text: string, shown: string, clearDraft: boolean, requestOwner?: string | null) =>
    appendLocalQuestion(session, text, shown, clearDraft, localFlow(requestOwner))
  let snapshot = read()
  const viewports = new Map<string, ConversationViewport>()
  for (const session of snapshot.sessions) {
    const view = session.conversationViewport
    if (view && Number.isFinite(view.top) && view.top >= 0 && Number.isFinite(view.spacer) && view.spacer >= 0 && typeof view.follow === 'boolean' && typeof view.questionKey === 'string') viewports.set(session.id, view)
  }
  const listeners = new Set<() => void>()
  let saveTimer: number | undefined
  // Only an unverifiable new inline handoff enters quarantine. Until a fresh
  // store reads the durable state, never overwrite it with this older snapshot.
  let uncertainInlineCommit = false
  function persist() {
    window.clearTimeout(saveTimer)
    if (uncertainInlineCommit) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...snapshot, sessions: snapshot.sessions.map(s => ({ ...s, conversationViewport: viewports.get(s.id) })), storageError: false }))
      if (snapshot.storageError) { snapshot = { ...snapshot, storageError: false }; listeners.forEach(fn => fn()) }
    }
    catch { if (!snapshot.storageError) { snapshot = { ...snapshot, storageError: true }; listeners.forEach(fn => fn()) } }
  }
  function emit(next: Snapshot, immediate = false) {
    snapshot = next
    listeners.forEach(fn => fn())
    window.clearTimeout(saveTimer)
    if (immediate) persist()
    else saveTimer = window.setTimeout(persist, 250)
  }
  function update(id: string, fn: (s: ClientSession) => ClientSession, immediate = false) {
    emit({ ...snapshot, sessions: snapshot.sessions.map(s => s.id === id ? fn(s) : s) }, immediate)
  }
  function prepareFollowCommit(next: Snapshot, verifyInlineWrite = false, failureMessage = '검증 결과를 연결하지 못했어요. 기록은 대화에 남아 있으니 다시 시도해주세요.'): () => void {
    // Unlike ordinary debounced edits, explicit transitions publish only after durable
    // storage succeeds. A failure preserves snapshot identity and emits nothing.
    if (uncertainInlineCommit) throw new InlineConnectionError(INLINE_COMMIT_UNCERTAIN)
    const raw = JSON.stringify({ ...next, sessions: next.sessions.map(s => ({ ...s, conversationViewport: viewports.get(s.id) })), storageError: false })
    const previousRaw = verifyInlineWrite ? sessionStorage.getItem(KEY) : undefined
    try { sessionStorage.setItem(KEY, raw) }
    catch (error) { if (!verifyInlineWrite) throw error }
    if (verifyInlineWrite) {
      let readback: string | null
      try { readback = sessionStorage.getItem(KEY) }
      catch {
        uncertainInlineCommit = true; window.clearTimeout(saveTimer)
        throw new InlineConnectionError(INLINE_COMMIT_UNCERTAIN)
      }
      if (readback !== raw) {
        if (readback !== previousRaw) { uncertainInlineCommit = true; window.clearTimeout(saveTimer) }
        throw new InlineConnectionError(uncertainInlineCommit ? INLINE_COMMIT_UNCERTAIN : failureMessage)
      }
    }
    return () => {
      window.clearTimeout(saveTimer)
      snapshot = { ...next, storageError: false }
      listeners.forEach(fn => fn())
    }
  }
  function findFollow(owner: string, id: string): SharedFollowRecord {
    const record = snapshot.sharedFollows.find(item => item.id === id && item.owner === owner)
    if (!record || !decodeSharedFollow(record)) throw new Error('따라가는 전략을 다시 확인해주세요.')
    return record
  }
  function revisionSource(id:string,expected:CommonBacktestPreview,owner:string|null){
    const session=snapshot.sessions.find(s=>s.id===id)
    if(uncertainInlineCommit||snapshot.storageError||!session||snapshot.currentId!==id
      ||session.turns.some(t=>t.status==='running')||inlinePending(session)
      ||session.sharedCopy&&session.sharedCopy.owner!==owner
      ||!commonSelectionVisible(session,owner)
      ||!completedCommonRevisionSource(session,expected))throw new InlineConnectionError('현재 대화의 검증 결과를 다시 확인해주세요.')
    return session
  }
  function revisionRun(session:ClientSession,proposal:ClientTurn,label:string,settings:Pick<CommonBacktestPreview,'period'|'amount'>=proposal.commonRevision!.base,skipReplay=false){
    const revision=proposal.commonRevision!,now=Date.now(),id=crypto.randomUUID()
    const nextTurn:ClientTurn={id,question:label,answer:'',fullAnswer:'',suggestions:[],phase:'plan',status:'done',startedAt:now,finishedAt:now,
      inlineRequest:structuredClone(revision.proposal),backtestFlow:'common',commonBacktestOpened:true,commonRevisionOf:proposal.id}
    const params=revision.proposal.parameters
    const next={...session,workspace:'conversation' as const,updatedAt:now,pair:revision.proposal.pair,timeframe:revision.proposal.timeframe,
      mode:params.trendFilter?'trend' as const:'dip' as const,risk:`${params.sl}%`,takeProfit:params.tp===null?'미설정':`${params.tp}%`,phase:'plan' as const,turns:[...session.turns,nextTurn],
      requestedRsi: revision.proposal.requestedRsi ?? params.rsiTh, rsiUnresolved: undefined,
      commonBacktest:{turnId:id,period:settings.period,amount:settings.amount,startedAt:now,...(skipReplay?{skipped:true as const}:{})}}
    prepareFollowCommit({...snapshot,sessions:snapshot.sessions.map(s=>s.id===session.id?next:s)},true)()
    return id
  }
  function storedQuestion(id: string, turnId: string, owner: string | null, binding: MarketResponseBinding) {
    const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
    const turn = target?.turns.at(-1)
    // A failed ordinary draft/viewport save is retryable. Question changes and
    // submissions still verify durable readback before publishing; an uncertain
    // commit remains quarantined. Do not deadlock an intact question on that flag.
    if (uncertainInlineCommit || !target || target.id !== id || target.workspace !== 'conversation'
      || !turn || turn.id !== turnId || turn.status !== 'done' || inlinePending(target)
      || turn.marketResponse?.owner !== owner || target.sharedCopy && target.sharedCopy.owner !== owner) return null
    const response = turn.marketResponse
    const block = response.blocks.find(item => item.kind === 'market-question' && marketBindingKey(item.presentation.binding) === marketBindingKey(binding))
    if (!block || block.kind !== 'market-question' || block.presentation.state?.closed || block.presentation.state?.accepted) return null
    return { target, turn, response, block }
  }
  function questionState(p: MarketQuestionPresentation): MarketQuestionViewState {
    return p.state ?? { index: 0, picks: p.steps.map(() => []), direct: p.steps.map(() => false), closed: false, accepted: null }
  }
  function effectiveFollow(record: SharedFollowRecord, now: number): SharedFollowRecord {
    if (!record.active) return record
    const session = snapshot.sessions.find(s => s.id === record.sessionId)
    if (!session?.sharedCopy || session.sharedCopy.active !== true || session.sharedCopy.owner !== record.owner
      || (session.sharedCopy.followId ?? session.id) !== record.id) return record
    const ui = resolveDelegationProgress(readDelegationUi(session.id), now)
    if (!ui || ui.recoveryRequired || ui.inlineResult || ui.workStep !== 5) return record
    return decodeSharedFollow({ ...record, parameters: ui.pendingParameters ?? ui.parameters, budgetIndex: ui.answers.budget?.index }) ?? record
  }
  function researchProgress(session: ClientSession, now = Date.now()): ClientSession['researchStatus'] {
    const scopes = researchScopes(session).map(id => {
      const preview = getMockResearchPreview(`restored:${id}`)
      preview.tick(now)
      return { id, state: preview.getSnapshot() }
    })
    if (scopes.some(({ state }) => state.recoveryRequired)) return session.researchStatus
    if (scopes.some(({ state }) => state.status === 'playing' || state.status === 'paused')) return '진행 중'
    if (session.researchStatus !== '초안' && scopes.some(({ state }) => state.status === 'completed')) return '검토 필요'
    return scopes.find(item => item.id === researchScope(session))?.state.status === 'completed' ? '검토 필요' : '초안'
  }
  function copyReturnId(owner: string): string | null {
    const visited = new Set<string>()
    let id = snapshot.currentId
    while (id !== null) {
      if (visited.has(id)) return null
      visited.add(id)
      const session = snapshot.sessions.find(s => s.id === id)
      if (!session) return null
      if (session.sharedCopy?.owner !== owner) return session.id
      id = typeof session.sharedCopy.returnId === 'string' ? session.sharedCopy.returnId : null
    }
    return null
  }
  const store = {
    // Shell observation binding only; existing records are never rewritten.
    setLocalBacktestFlow: (flow: NonNullable<typeof options.localBacktestFlow>) => { localBacktestFlow = flow },
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    getSnapshot: () => snapshot,
    commitUncertain: () => uncertainInlineCommit,
    // sk-ask tfStart: a new run action is a conversation request, not the
    // legacy fixed questionnaire or permission to execute a trade.
    requestStrategyConversation: (id: string, owner: string | null, label: string, expectedTurnId: string) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId), turn = target?.turns.at(-1)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id
        || !['conversation', 'research'].includes(target.workspace) || !turn || turn.id !== expectedTurnId || turn.status !== 'done'
        || target.turns.some(t => t.status === 'running') || inlinePending(target)
        || target.sharedCopy && target.sharedCopy.owner !== owner
        || turn.commonResultContextInvalid || turn.commonResultContext && turn.commonResultContext.owner !== owner
        || !label.trim() || label.length > 1000) return false
      const next = appendQuestion({ ...target, workspace: 'conversation' }, label, label, false)
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true)()
      return true
    },
    // Historical fixed questionnaires can be resumed/redone explicitly. They
    // are never created as the default path for a new strategy/run action.
    restartSourceIntake: (id: string, owner: string | null, label: string, expectedTurnId: string, previousIntakeId: string) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const previous = target?.turns.slice().reverse().find(t => t.sourceIntake || t.sourceIntakeInvalid)
      const tail = target?.turns.at(-1)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !previous?.sourceIntake || previous.sourceIntakeInvalid || previous.id !== previousIntakeId
        || !tail || tail.id !== expectedTurnId || target.turns.some(t => t.status === 'running') || inlinePending(target)
        || tail.commonResultContextInvalid || tail.commonResultContext && tail.commonResultContext.owner !== owner
        || target.sharedCopy && target.sharedCopy.owner !== owner || !label.trim()) return false
      const next = appendSourceIntake(target, label)
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true)()
      return true
    },
    pickSourceIntake: (id: string, turnId: string, owner: string | null, key: SourceIntakeKey, index: number, recommended: boolean) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const turn = target?.turns.slice().reverse().find(t => t.sourceIntake || t.sourceIntakeInvalid)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !turn || turn.id !== turnId || !turn.sourceIntake || turn.sourceIntakeInvalid || turn.status !== 'done'
        || target.turns.some(t => t.status === 'running') || inlinePending(target)
        || target.sharedCopy && target.sharedCopy.owner !== owner) return false
      const intake = pickSourceIntake(turn.sourceIntake, key, index, recommended)
      if (!intake) return false
      const preview = sourceIntakePreview(intake)
      const next = { ...target, updatedAt: Date.now(), turns: target.turns.map(t => t === turn ? {
        ...turn, sourceIntake: intake, ...(preview ? { inlineRequest: preview.input, backtestFlow: 'common' as const } : {}),
      } : t) }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true)()
      return true
    },
    flush: persist,
    dismissRecovery: () => emit({ ...snapshot, recoveryWarning: false }, true),
    conversationViewport: (id: string) => viewports.get(id),
    saveConversationViewport: (id: string, view: ConversationViewport) => {
      if (!snapshot.sessions.some(s => s.id === id)) return
      viewports.set(id, view)
      // Scroll changes do not rerender the conversation or write on every frame.
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(persist, 250)
    },
    home: () => emit({ ...snapshot, currentId: null }, true),
    select: (id: string) => { if (snapshot.sessions.some(s => s.id === id)) emit({ ...snapshot, currentId: id }, true) },
    draft: (text: string) => snapshot.currentId ? update(snapshot.currentId, s => ({ ...s, draft: text })) : emit({ ...snapshot, homeDraft: text }),
    rename: (id: string, title: string) => { if (title.trim()) update(id, s => ({ ...s, title: title.trim().slice(0, 120), renamed: true }), true) },
    pin: (id: string) => update(id, s => ({ ...s, pinned: s.pinned !== true }), true),
    remove: (id: string) => {
      if (uncertainInlineCommit) return false
      const target = snapshot.sessions.find(s => s.id === id)
      if (!target) return false
      viewports.delete(id)
      const scopes = researchScopes(target)
      scopes.forEach(scope => { forgetResearchDocumentMemory(scope); forgetMockResearchPreview(`restored:${scope}`) })
      forgetDelegationUiMemory(id)
      forgetMockResearchPreview(id)
      forgetMockResearchPreview(`restored:${id}`)
      let cleaned = true
      try {
        for (const prefix of ['teth-client-research-documents:', 'teth-research-preview:', 'teth-research-preview:restored:', 'teth:client-delegation:']) sessionStorage.removeItem(prefix + id)
        for (const scope of scopes.filter(scope => scope !== id)) {
          sessionStorage.removeItem(`teth-client-research-documents:${scope}`)
          sessionStorage.removeItem(`teth-research-preview:restored:${scope}`)
        }
      } catch { cleaned = false }
      emit({ ...snapshot, sessions: snapshot.sessions.filter(s => s.id !== id), currentId: snapshot.currentId === id ? null : snapshot.currentId }, true)
      return cleaned && !snapshot.storageError
    },
    researchStatus: (id: string, researchStatus: ClientSession['researchStatus']) => { if (snapshot.sessions.find(s => s.id === id)?.researchStatus !== researchStatus) update(id, s => ({ ...s, researchStatus }), true) },
    syncResearchStatus: (id: string) => {
      if (uncertainInlineCommit) return
      const target = snapshot.sessions.find(s => s.id === id)
      if (!target) return
      const status = researchProgress(target)
      if (target.researchStatus !== status) update(id, s => ({ ...s, researchStatus: status }), true)
    },
    openBaseResearch: (id: string, owner: string | null) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      if (snapshot.storageError) throw new Error('기존 대화 기록을 확인한 뒤 다시 시도해주세요.')
      const target = snapshot.sessions.find(s => s.id === id)
      if (!target || snapshot.currentId !== id || !canOpenBaseResearch(target)) throw new Error('현재 대화의 연구 계획을 다시 확인해주세요.')
      if (target.sharedCopy && target.sharedCopy.owner !== owner) throw new Error('현재 계정의 전략 기록을 다시 확인해주세요.')
      if (!canRestoreBaseResearch(target)) throw new Error('저장된 연구 진행을 확인할 수 없어요. 새로고침 후 다시 확인해주세요.')
      const next = { ...target, workspace: 'research' as const }
      delete next.researchPlanTurnId
      // Explicitly selecting the validated base resolves only the broken
      // selection. Visited inline scopes still own their clocks and locks.
      delete next.researchPlanRecovery
      next.researchStatus = researchProgress(next)
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true, '연구 계획을 열지 못했어요. 현재 대화는 유지됩니다.')()
    },
    openResearchPlan: (id: string, turnId: string, owner: string | null) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      if (snapshot.storageError) throw new Error('기존 대화 기록을 확인한 뒤 다시 시도해주세요.')
      const target = snapshot.sessions.find(s => s.id === id)
      if (!target || snapshot.currentId !== id) throw new Error('현재 대화의 연구 계획을 다시 확인해주세요.')
      if (target.sharedCopy && target.sharedCopy.owner !== owner) throw new Error('현재 계정의 전략 기록을 다시 확인해주세요.')
      if (!readInlineRecords(target.inlineResults, target.turns).records.some(record => record.turnId === turnId)) throw new Error('계획에 사용할 검증 결과를 다시 확인해주세요.')
      const next = { ...target, researchPlanTurnId: turnId, researchPlanRecovery: undefined,
        researchPlanTurnIds: [...new Set([...(target.researchPlanTurnIds ?? []), turnId])], workspace: 'research' as const }
      next.researchStatus = researchProgress(next)
      const publish = prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true)
      publish()
    },
    startResearch: (id: string, expectedScope: string, owner: string | null, now = Date.now()) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      if (snapshot.storageError) throw new Error('기존 대화 기록을 확인한 뒤 다시 시도해주세요.')
      const target = snapshot.sessions.find(s => s.id === id)
      if (!target || snapshot.currentId !== id || target.workspace !== 'research' || researchScope(target) !== expectedScope || target.researchPlanRecovery) throw new Error('현재 대화의 연구 계획을 다시 확인해주세요.')
      if (target.researchPlanTurnId && !readInlineRecords(target.inlineResults, target.turns).records.some(record => record.turnId === target.researchPlanTurnId)) throw new Error('계획에 사용할 검증 결과를 다시 확인해주세요.')
      if (target.sharedCopy && target.sharedCopy.owner !== owner) throw new Error('현재 계정의 전략 기록을 다시 확인해주세요.')
      if (!Number.isFinite(now)) throw new Error('연구 시작 시간을 다시 확인해주세요.')
      // Observe all visited plans before admission, including hidden views and
      // starts whose experience save failed. React effects are not the lock.
      for (const candidate of snapshot.sessions) {
        for (const scope of researchScopes(candidate)) {
          const replay = getMockResearchPreview(`restored:${scope}`)
          replay.tick(now)
          if (replay.getSnapshot().recoveryRequired) throw new Error('저장된 연구 진행을 확인할 수 없어요. 새로고침 후 다시 확인해주세요.')
          if (scope !== expectedScope && ['playing', 'paused'].includes(replay.getSnapshot().status)) {
            throw new Error(`다른 연구가 진행 중이에요: ${candidate.title || '이름 없는 전략'}. 완료 후 시작할 수 있어요`)
          }
        }
      }
      const replay = getMockResearchPreview(`restored:${expectedScope}`)
      replay.start(now)
      update(id, s => ({ ...s, researchStatus: researchProgress(s, now) }), true)
      return true
    },
    paper: (id: string, paper: boolean) => { if (Boolean(snapshot.sessions.find(s => s.id === id)?.paper) !== paper) update(id, s => ({ ...s, paper }), true) },
    startCommonRevisionDirection: (id: string, expected: CommonBacktestPreview, owner: string | null, question: string, language: ClientLanguage = 'ko') => {
      const session = revisionSource(id, expected, owner)
      if (session.sharedCopy) throw new InlineConnectionError('복사한 공개 전략은 규칙을 고칠 수 없습니다.')
      const last = session.turns.at(-1)
      if (last?.commonRevisionDirection && !last.followupsConsumed && last.commonRevisionDirection.owner === owner
        && JSON.stringify(last.commonRevisionDirection.base) === JSON.stringify(expected)) return last.id
      const direction = createCommonRevisionDirection(session, expected, owner)
      if (!direction) throw new InlineConnectionError('수정할 검증 결과를 다시 확인해주세요.')
      const now = Date.now(), answer = commonRevisionDirectionQuestion(direction, language).answer
      const turn: ClientTurn = { id: crypto.randomUUID(), question, answer, fullAnswer: answer, suggestions: [], phase: 'plan',
        status: 'done', startedAt: now, finishedAt: now, commonResultContext: commonResultContext(session, owner), commonRevisionDirection: direction }
      const next: ClientSession = { ...session, workspace: 'conversation', updatedAt: now, turns: [...session.turns, turn] }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(item => item === session ? next : item) }, true)()
      return turn.id
    },
    submitCommonRevisionDirection: (id: string, turnId: string, owner: string | null, text: string, displayText = text) => {
      const session = snapshot.sessions.find(item => item.id === snapshot.currentId), turn = session?.turns.at(-1)
      if (!session || session.id !== id || session.workspace !== 'conversation' || !turn || turn.id !== turnId
        || turn.status !== 'done' || turn.followupsConsumed || turn.commonRevisionDirectionInvalid
        || !turn.commonRevisionDirection || turn.commonRevisionDirection.owner !== owner) return false
      revisionSource(id, turn.commonRevisionDirection.base, owner)
      const direction = readCommonRevisionDirection(turn.commonRevisionDirection, session.turns.slice(0, -1))
      if (!direction) return false
      const reply = replyCommonRevisionDirection(direction, text)
      if (!reply) return false
      const now = Date.now(), proposal: ClientTurn = { id: crypto.randomUUID(), question: displayText.trim() || text,
        ...(displayText !== text ? { requestText: text } : {}), answer: '', fullAnswer: reply.description, suggestions: [], phase: 'plan',
        status: 'running', startedAt: now, commonResultContext: commonResultContext(session, owner),
        commonRevision: { owner, base: structuredClone(direction.base), before: structuredClone(direction.before),
          proposal: reply.proposal, dataRevision: direction.dataRevision, kind: 'proposal' } }
      const next: ClientSession = { ...session, draft: '', updatedAt: now,
        turns: [...session.turns.map(item => item === turn ? { ...item, followupsConsumed: true as const } : item), proposal] }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(item => item === session ? next : item) }, true, '수정 방향을 저장하지 못했어요. 작성한 내용은 유지됩니다.')()
      return true
    },
    startCommonRevision:(id:string,expected:CommonBacktestPreview,owner:string|null,question:string,answer:string)=>{
      const session=revisionSource(id,expected,owner)
      if(session.sharedCopy)throw new InlineConnectionError('복사한 공개 전략은 규칙을 고칠 수 없습니다.')
      const last=session.turns.at(-1)
      if(last?.status==='done'&&last.commonRevision&&last.commonRevision.owner===owner&&JSON.stringify(last.commonRevision.base)===JSON.stringify(expected))return last.id
      const before=decodeInlineInput(session.turns.find(t=>t.id===expected.turnId)?.inlineRequest)!
      const now=Date.now(),turn:ClientTurn={id:crypto.randomUUID(),question,answer:'',fullAnswer:answer,suggestions:[],phase:'plan',status:'running',startedAt:now,
        commonResultContext:commonResultContext(session,owner),
        commonRevision:{owner,base:structuredClone(expected),before,proposal:exampleCommonProposal(before),dataRevision:COMMON_PREVIEW_REVISION,kind:'proposal'}}
      const next={...session,workspace:'conversation' as const,updatedAt:now,turns:[...session.turns,turn]}
      prepareFollowCommit({...snapshot,sessions:snapshot.sessions.map(s=>s.id===id?next:s)},true)()
      return turn.id
    },
    startCommonAlternative:(id:string,expected:CommonBacktestPreview,owner:string|null,question:string)=>{
      const source=revisionSource(id,expected,owner)
      const context=commonResultContext(source,owner)
      // Carry only the asset. The displayed result is context, not instructions
      // to silently reuse its entry, timeframe or exit rules in a new strategy.
      const next=appendQuestion({...emptyConversation(question),pair:context.input.pair},'다른 방식의 전략을 함께 만들어 주세요',question,false)
      next.turns[0]={...next.turns[0],commonResultContext:context}
      prepareFollowCommit({...snapshot,sessions:[next,...snapshot.sessions],currentId:next.id},true)()
      return next.id
    },
    applyCommonRevision:(id:string,turnId:string,owner:string|null,label:string,skipReplay=false)=>{
      const session=snapshot.sessions.find(s=>s.id===id),turn=session?.turns.find(t=>t.id===turnId)
      if(!session||!turn?.commonRevision||turn.status!=='done'||turn.commonRevision.owner!==owner||session.sharedCopy
        ||session.turns.at(-1)?.id!==turnId||!readCommonRevision(turn.commonRevision,session.turns.slice(0,session.turns.indexOf(turn))))throw new InlineConnectionError('현재 대화의 수정 제안을 다시 확인해주세요.')
      revisionSource(id,turn.commonRevision.base,owner)
      return revisionRun(session,turn,label,undefined,skipReplay)
    },
    revertCommonRevision:(id:string,expected:CommonBacktestPreview,owner:string|null,label:string,skipReplay=false)=>{
      const session=revisionSource(id,expected,owner),comparison=commonRevisionComparison(session)
      if(session.sharedCopy||!comparison||comparison.revision.owner!==owner)throw new InlineConnectionError('이전 규칙을 다시 확인해주세요.')
      const before=decodeInlineInput(session.turns.find(t=>t.id===expected.turnId)?.inlineRequest)!,now=Date.now()
      const proposal:ClientTurn={id:crypto.randomUUID(),question:label,answer:'',fullAnswer:'',suggestions:[],phase:'plan',status:'done',startedAt:now,finishedAt:now,
        commonRevision:{owner,base:structuredClone(expected),before,proposal:comparison.revision.before,dataRevision:COMMON_PREVIEW_REVISION,kind:'revert'}}
      return revisionRun({...session,turns:[...session.turns,proposal]},proposal,label,comparison.before.state,skipReplay)
    },
    workspace: (id: string, workspace: ClientSession['workspace']) => update(id, s => ({ ...s, workspace }), true),
    tradingReady: (id: string) => update(id, s => ({ ...s, tradingReady: true }), true),
    commonBacktest: (id: string, next: CommonBacktestPreview, owner: string | null = null) => {
      const session = snapshot.sessions.find(item => item.id === id)
      if (!session || snapshot.currentId !== id || snapshot.storageError || session.turns.some(turn => turn.status === 'running')) throw new InlineConnectionError('현재 대화의 전략 조건을 다시 확인해주세요.')
      if (!commonTurn(session.turns.find(turn => turn.id === next.turnId))) throw new InlineConnectionError('완료된 전략 조건을 다시 확인해주세요.')
      if (!commonSelectionVisible({ ...session, commonBacktest: next }, owner)) throw new InlineConnectionError('현재 계정의 전략 기록을 다시 확인해주세요.')
      const decoded = readCommonBacktest(next, session.turns)
      if (!decoded) throw new InlineConnectionError('백테스트 조건을 다시 확인해주세요.')
      const previous = session.commonBacktest
      if (previous?.turnId === decoded.turnId && previous.period === decoded.period && previous.amount === decoded.amount) {
        if (JSON.stringify(previous) === JSON.stringify(decoded) && session.turns.find(turn => turn.id === decoded.turnId)?.commonBacktestOpened) return true
        // A rapid second Run must not restart a replay that was already saved.
        if (previous.startedAt !== undefined && decoded.startedAt !== undefined && previous.startedAt !== decoded.startedAt) return true
      }
      const publish = prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(item => item === session ? { ...item, commonBacktest: decoded,
        turns: item.turns.map(turn => turn.id === decoded.turnId ? { ...turn, commonBacktestOpened: true as const } : turn),
      } : item) }, true)
      publish()
      return true
    },
    connectInlineResult: (sessionId: string, turnId: string, owner: string | null) => {
      if (uncertainInlineCommit) throw new InlineConnectionError(INLINE_COMMIT_UNCERTAIN)
      if (snapshot.storageError) throw new InlineConnectionError('기존 대화 기록을 확인한 뒤 다시 시도해주세요.')
      const session = snapshot.sessions.find(item => item.id === sessionId)
      if (!session || snapshot.currentId !== sessionId) throw new InlineConnectionError('현재 대화의 검증 결과를 다시 확인해주세요.')
      const inline = readInlineRecords(session.inlineResults, session.turns)
      if (session.turns.some(turn => turn.status === 'running') || inlinePending({ ...session, inlineResults: inline.records })) throw new InlineConnectionError('응답이 끝난 뒤 다시 시도해주세요. 기존 대화는 유지됩니다.')
      if (!passingInlineRecord(inline.records, turnId)) throw new InlineConnectionError('실행 기준을 통과한 검증 결과를 다시 확인해주세요.')
      const copy = session.sharedCopy
      if (copy && (typeof owner !== 'string' || !owner.trim() || copy.owner !== owner)) throw new InlineConnectionError('현재 계정의 전략 기록을 다시 확인해주세요.')
      const record = copy?.active === true ? snapshot.sharedFollows.find(item => item.id === (copy.followId ?? session.id)
        && item.owner === owner && item.sessionId === session.id && item.active === true) : undefined
      if (copy?.active === true && (!record || !decodeSharedFollow(record))) throw new InlineConnectionError('따라가는 전략이 바뀌었어요. 현재 기록을 다시 확인해주세요.')
      if (!session.inlineConnectionRecovery && session.inlineConnectionTurnId === turnId && session.workspace === 'delegation' && copy?.active !== true) return true
      const detached = record ? { ...effectiveFollow(record, Date.now()), active: false } : undefined
      const next: Snapshot = { ...snapshot,
        sessions: snapshot.sessions.map(item => item === session ? { ...item, inlineConnectionTurnId: turnId, inlineConnectionRecovery: undefined, workspace: 'delegation',
          ...(copy ? { sharedCopy: { ...copy, active: false } } : {}) } : item),
        sharedFollows: record && detached ? snapshot.sharedFollows.map(item => item === record ? detached : item) : snapshot.sharedFollows }
      const publish = prepareFollowCommit(next, true)
      publish()
      return true
    },
    copySharedStrategy: (owner: string, request: SharedCopyRequest, followId?: string) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      if (typeof owner !== 'string' || !owner.trim()) throw new Error('로그인 후 다시 시도해주세요.')
      if (snapshot.storageError) throw new Error('기존 대화 기록을 확인한 뒤 다시 시도해주세요.')
      if (snapshot.sessions.find(s => s.id === snapshot.currentId)?.turns.some(t => t.status === 'running')) throw new Error('응답이 끝난 뒤 다시 시도해주세요. 기존 대화는 유지됩니다.')
      const now = Date.now()
      const saved = followId === undefined ? undefined : effectiveFollow(findFollow(owner, followId), now)
      const expected = request?.expectedFollow
      if (saved) {
        // The modal may outlive a recommendation's completion or a replacement
        // job. Compare the entire confirmed base before preparing or allocating.
        if (!expected || typeof expected !== 'object' || Array.isArray(expected)
          || expected.sessionId !== saved.sessionId || expected.budgetIndex !== saved.budgetIndex
          || !expected.parameters || typeof expected.parameters !== 'object' || Array.isArray(expected.parameters)
          || !(['sl', 'tp', 'rsiTh', 'trendFilter', 'startI', 'endI'] as const).every(key => expected.parameters[key] === saved.parameters[key])) {
          throw new Error('전략 조건이 바뀌었어요. 설정 창을 다시 열어 확인해주세요.')
        }
      } else if (expected !== undefined) throw new Error('새 전략 복제에는 이전 검증 조건을 사용할 수 없어요.')
      const { row, ui } = saved ? prepareSharedCopy(request, now, saved) : prepareSharedCopy(request, now)
      const id = crypto.randomUUID()
      if (snapshot.sessions.some(s => s.id === id)) throw new Error('새 검증을 준비하지 못했어요. 다시 시도해주세요.')
      const duplicate = saved ?? snapshot.sharedFollows.filter(item => item.owner === owner).map(item => effectiveFollow(item, now)).find(item => item.nick === row.nick && item.asset === row.asset
        && item.budgetIndex === request.budgetIndex && (['sl', 'tp', 'rsiTh', 'trendFilter', 'startI', 'endI'] as const).every(key => item.parameters[key] === ui.parameters![key]))
      const record = decodeSharedFollow({ id: duplicate?.id ?? crypto.randomUUID(), owner, nick: row.nick, asset: row.asset,
        parameters: ui.parameters, budgetIndex: request.budgetIndex, confirmedAt: now, sessionId: id, active: true })
      if (!record || !duplicate && snapshot.sharedFollows.some(item => item.id === record.id)) throw new Error('복제 기록을 준비하지 못했어요. 다시 시도해주세요.')
      const nextSession: ClientSession = {
        id, title: `${row.nick} · ${row.asset}`, renamed: true, idea: `${row.nick} (${row.asset}) 전략 따라하기`, draft: '',
        pair: row.asset === '비트코인' ? 'BTC/USDT' : row.asset === '이더리움' ? 'ETH/USDT' : row.asset === '테슬라' ? 'TSLA' : 'NASDAQ',
        mode: 'dip', timeframe: '일봉', risk: `${request.sl}%`, takeProfit: request.tp === null ? '미설정' : `+${request.tp}%`,
        researchStatus: '초안', phase: 'plan', turns: [], updatedAt: now, workspace: 'delegation', tradingReady: false,
        sharedCopy: { owner, nick: row.nick, confirmedAt: now, returnId: copyReturnId(owner), active: true, followId: record.id },
      }
      const sharedFollows = snapshot.sharedFollows.map(item => item.id === record.id ? record : item.owner === owner && item.active ? { ...effectiveFollow(item, now), active: false } : item)
      if (!duplicate) sharedFollows.push(record)
      const next = { ...snapshot, sessions: [nextSession, ...snapshot.sessions], sharedFollows, currentId: id }
      // Prepare both records before publishing the new selection. Existing sessions
      // and drafts remain untouched if either storage write fails.
      let publish: () => void
      try {
        if (!saveDelegationUi(id, ui)) throw new Error('copy storage unavailable')
        publish = prepareFollowCommit(next)
      } catch {
        forgetDelegationUiMemory(id)
        try { sessionStorage.removeItem(`teth:client-delegation:${id}`) } catch { /* Unreferenced new UUID only; never remove prior records. */ }
        throw new Error('복제 조건을 저장하지 못했어요. 선택한 조건은 유지됩니다. 다시 시도해주세요.')
      }
      publish()
      return id
    },
    archiveSharedFollow: (owner: string, id: string) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      const record = findFollow(owner, id)
      if (!record.active) return true
      const archived = { ...effectiveFollow(record, Date.now()), active: false }
      let publish: () => void
      try { publish = prepareFollowCommit({ ...snapshot, sharedFollows: snapshot.sharedFollows.map(item => item === record ? archived : item) }) }
      catch { throw new Error('따라가는 전략을 보관하지 못했어요. 다시 시도해주세요.') }
      publish()
      return true
    },
    removeSharedFollow: (owner: string, id: string) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      const record = findFollow(owner, id)
      if (record.active) throw new Error('보관된 전략만 삭제할 수 있어요.')
      let publish: () => void
      try { publish = prepareFollowCommit({ ...snapshot, sharedFollows: snapshot.sharedFollows.filter(item => item !== record) }) }
      catch { throw new Error('따라가는 전략을 삭제하지 못했어요. 다시 시도해주세요.') }
      publish()
      return true
    },
    detachSharedCopy: (id: string) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      const session = snapshot.sessions.find(s => s.id === id), copy = session?.sharedCopy
      if (!session || !copy || copy.active !== true) return false
      const record = snapshot.sharedFollows.find(item => item.id === (copy.followId ?? session.id) && item.owner === copy.owner && item.sessionId === session.id)
      // Always release this session's copy provenance, but a reset from an older
      // verification must not detach or overwrite the replacement follow/job.
      const detached = record ? { ...effectiveFollow(record, Date.now()), active: false } : undefined
      let publish: () => void
      try { publish = prepareFollowCommit({ ...snapshot,
        sharedFollows: record && detached ? snapshot.sharedFollows.map(item => item === record ? detached : item) : snapshot.sharedFollows,
        sessions: snapshot.sessions.map(s => s === session ? { ...s, sharedCopy: { ...copy, active: false } } : s) }) }
      catch { throw new Error('복제 조건을 해제하지 못했어요. 다시 시도해주세요.') }
      publish()
      return true
    },
    stop: (id: string) => update(id, s => ({ ...s, turns: s.turns.map(t => {
      if (t.status === 'running') {
        const now = Date.now()
        // Local preview stop is a display interruption, never a server cancel.
        const responseSequence: StoredResponseSequence | undefined = t.responseSequence && {
          ...t.responseSequence, status: 'stopped', blocks: t.responseSequence.blocks.map(block =>
            block.kind === 'text' && block.status === 'streaming' ? { ...block, status: 'interrupted' as const }
              : block.kind === 'work' && block.activity.status === 'running' ? { ...block, activity: { ...block.activity,
                status: 'stopped' as const, finishedAt: Math.max(now, block.activity.startedAt ?? now),
                steps: block.activity.steps.map(step => step.status === 'running' ? { ...step, status: 'stopped' as const } : step),
              } } : block),
        }
        return { ...t, status: 'stopped' as const, finishedAt: now, ...(responseSequence ? { responseSequence } : {}) }
      }
      return t === s.turns.at(-1) && inlinePending(s) ? { ...t, inlineStopped: true as const } : t
    }) }), true),
    // Source T3: insight/shared/terminal transfers start an independent context.
    // Commit first so denied storage cannot discard the origin page or drafts.
    startConversation: (question: string, displayQuestion = question) => {
      if (uncertainInlineCommit) throw new Error(INLINE_COMMIT_UNCERTAIN)
      const text = question.trim()
      if (!text) throw new Error('질문을 입력해주세요.')
      if (snapshot.storageError) throw new Error('기존 대화 기록을 확인한 뒤 다시 시도해주세요.')
      const selected = snapshot.sessions.find(s => s.id === snapshot.currentId)
      if (selected && (selected.turns.some(t => t.status === 'running') || inlinePending(selected))) throw new Error('이전 답변을 마무리하는 중이에요. 끝나면 다시 눌러주세요.')
      const shown = displayQuestion.trim() || text
      const next = appendQuestion(emptyConversation(shown), text, shown, false)
      let publish: () => void
      try { publish = prepareFollowCommit({ ...snapshot, sessions: [next, ...snapshot.sessions], currentId: next.id }) }
      catch { throw new Error('새 대화를 저장하지 못했어요. 작성한 내용은 유지됩니다. 다시 시도해주세요.') }
      publish()
      return next.id
    },
    changeMarketQuestion: (id: string, turnId: string, owner: string | null, binding: MarketResponseBinding, state: MarketQuestionViewState) => {
      const found = storedQuestion(id, turnId, owner, binding)
      if (!found) return false
      const nextState = decodeMarketQuestionState(state, found.block.presentation)
      // Only explicit submit can turn a draft selection into an accepted answer.
      if (!nextState || nextState.accepted) return false
      const marketResponse = { ...found.response,
        writingObservationId: nextState.free === undefined && !nextState.closed && nextState.direct[nextState.index] ? binding.observationId
          : found.response.writingObservationId === binding.observationId ? undefined : found.response.writingObservationId,
        blocks: found.response.blocks.map(block => block === found.block ? { ...block, presentation: { ...block.presentation, state: nextState } } : block) }
      const next = { ...found.target, turns: found.target.turns.map(turn => turn === found.turn ? { ...turn, marketResponse } : turn) }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === found.target ? next : s) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    submitMarketQuestion: (id: string, turnId: string, owner: string | null, answer: MarketQuestionAnswer, language: ClientLanguage = 'ko') => {
      const found = storedQuestion(id, turnId, owner, answer.binding)
      if (!found || !answer.text.trim() || !['selection', 'delegate'].includes(answer.mode)) return false
      const initial = questionState(found.block.presentation)
      if (answer.mode === 'delegate' && answer.rows.length) return false
      const nextState = decodeMarketQuestionState({ ...initial, closed: answer.mode === 'delegate', accepted: answer.mode === 'selection' ? answer : null }, found.block.presentation)
      if (!nextState) return false
      const expectedText = answer.mode === 'delegate' ? marketQuestionText(language, 'delegateText')
        : nextState.accepted!.rows.map(row => `${row.title ? `${row.title}: ` : ''}${row.labels.join(', ')}`).join(' / ') + marketQuestionText(language, 'suffix')
      if (answer.text !== expectedText || answer.text.length > 1000 || answer.mode === 'selection' && !initial.free?.[initial.index]?.trim() && (initial.direct[initial.index] || !initial.picks[initial.index].length)) return false
      const marketResponse = { ...found.response,
        writingObservationId: found.response.writingObservationId === answer.binding.observationId ? undefined : found.response.writingObservationId,
        blocks: found.response.blocks.map(block => block === found.block ? { ...block, presentation: { ...block.presentation, state: nextState } } : block) }
      const preserved = { ...found.target, turns: found.target.turns.map(turn => turn === found.turn ? { ...turn, marketResponse, followupsConsumed: true as const } : turn) }
      const next = appendQuestion(preserved, answer.text, answer.text, false)
      if (answer.mode === 'selection') next.turns = next.turns.map(turn => turn === next.turns.at(-1) ? { ...turn, marketQuestionOf: turnId } : turn)
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === found.target ? next : s) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    /** Atomically retain the observed work/text order even when another page or
     * conversation is selected. Nothing here creates an AI/tool observation. */
    applyResponseSequence: (id: string, turnId: string, owner: string | null, expectedRevision: number, value: unknown, marketValue?: unknown) => {
      const target = snapshot.sessions.find(s => s.id === id), turn = target?.turns.at(-1)
      if (uncertainInlineCommit || snapshot.storageError || !target || !turn || turn.id !== turnId
        || turn.responseSequenceInvalid || target.sharedCopy && target.sharedCopy.owner !== owner
        || turn.commonBacktestOpened || target.commonBacktest?.turnId === turnId
        || turn.sourceIntake || turn.sourceIntakeInvalid || turn.commonRevision || turn.commonRevisionInvalid || turn.commonRevisionOf
        || turn.commonRevisionDirection || turn.commonRevisionDirectionInvalid || Object.hasOwn(turn, 'conditionalOrderOwner')
        || target.inlineResults?.some(record => record.turnId === turnId)
        || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
        || (turn.responseSequence?.revision ?? 0) !== expectedRevision
        || !turn.responseSequence && !['running', 'done'].includes(turn.status)) return false
      let marketResponse = turn.marketResponse
      if (marketValue !== undefined) {
        const supplied = readStoredMarketResponse(marketValue, id, turnId)
        if (!supplied || supplied.owner !== owner) return false
        if (marketResponse) {
          if (marketResponse.owner !== owner) return false
          // Existing card state is owned by its established update/selection
          // paths. Appending text must not reset selections or old chart data.
          if (supplied.blocks.some(block => {
            const old = marketResponse!.blocks.find(item => item.id === block.id)
            return old && JSON.stringify(old) !== JSON.stringify(block)
          })) return false
          marketResponse = { ...marketResponse, blocks: [...marketResponse.blocks,
            ...supplied.blocks.filter(block => !marketResponse!.blocks.some(item => item.id === block.id))] }
        } else marketResponse = supplied
        // Individually valid batches can collide across batches (for example
        // two question cards sharing an observation). Persist only a complete
        // envelope that the reload decoder will accept unchanged.
        const merged = readStoredMarketResponse(marketResponse, id, turnId)
        if (!merged) return false
        marketResponse = merged
      }
      const sequence = readStoredResponseSequence(value, id, turnId, marketResponse)
      if (!sequence || sequence.owner !== owner || sequence.revision !== expectedRevision + 1
        || turn.responseSequence && !canAdvanceResponseSequence(turn.responseSequence, sequence)) return false
      const answer = responseSequenceText(sequence)
      const observedAt = Date.now(), proposal = sequence.strategyProposal
      if (proposal && (!Number.isSafeInteger(turn.startedAt) || turn.startedAt < 0 || turn.startedAt > observedAt)) return false
      const next = { ...target, updatedAt: observedAt, turns: target.turns.map(t => t === turn ? {
        ...t, responseSequence: sequence, ...(marketResponse ? { marketResponse } : {}), answer, fullAnswer: answer,
        status: sequence.status, finishedAt: undefined,
        inlineRequest: proposal?.input, backtestFlow: proposal ? 'common' as const : undefined,
        inlineStopped: undefined, strategyObservedAt: proposal ? observedAt : undefined,
        suggestions: [], followupActions: undefined,
      } : t) }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true,
        '응답 기록을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    /** Retain supplied display facts without producing or fetching market data.
     * Like explicit followups, publication requires an exact durable read-back. */
    storeMarketResponse: (id: string, turnId: string, owner: string | null, value: unknown) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const turn = target?.turns.find(t => t.id === turnId)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !turn || turn.status !== 'done' || target.sharedCopy && target.sharedCopy.owner !== owner) return false
      const response = readStoredMarketResponse(value, id, turnId)
      if (!response || response.owner !== owner) return false
      if (turn.responseSequence && !readStoredResponseSequence(turn.responseSequence, id, turnId, response)) return false
      const next = { ...target, turns: target.turns.map(t => t === turn ? { ...t, marketResponse: response } : t) }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    /** Commit a supplied chart observation only to the still-current request.
     * This is local display state, not a market API or data producer. */
    applyMarketChartResponse: (id: string, turnId: string, owner: string | null, request: MarketChartRequest, value: unknown) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const turn = target?.turns.find(t => t.id === turnId)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !turn || turn.status !== 'done' || turn.marketResponse?.owner !== owner
        || target.sharedCopy && target.sharedCopy.owner !== owner
        || request?.binding?.scopeId !== JSON.stringify([owner, id]) || request.binding.messageId !== turnId
        || !marketBindingKey(request.binding) || !Number.isSafeInteger(request.resolutionSeconds) || request.resolutionSeconds < 1) return false
      const response = turn.marketResponse
      const matches = response.blocks.filter((block): block is MarketChartBlock => block.kind === 'market-chart'
        && marketBindingKey(block.presentation.binding) === marketBindingKey(request.binding)
        && block.presentation.seriesId === request.seriesId && block.presentation.asset === request.asset
        && block.presentation.availableResolutions.includes(request.resolutionSeconds))
      if (matches.length !== 1) return false
      const previous = matches[0]
      // Reuse the unknown-input decoder; never spread supplier objects into state.
      const decoded = readStoredMarketResponse({ version: 1, owner,
        blocks: [{ id: previous.id, kind: 'market-chart', presentation: value }] }, id, turnId)?.blocks[0]
      if (!decoded || decoded.kind !== 'market-chart' || decoded.presentation.state !== 'ready' || !decoded.presentation.view
        || decoded.presentation.seriesId !== request.seriesId || decoded.presentation.asset !== request.asset
        || decoded.presentation.resolutionSeconds !== request.resolutionSeconds) return false
      const marketResponse = { ...response, blocks: response.blocks.map(block => block === previous ? decoded : block) }
      const next = { ...target, turns: target.turns.map(t => t === turn ? { ...t, marketResponse } : t) }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    /** A fresh local preview request after an empty failure/stop. Never an
     * automatic retry, a service request, or permission to repeat an order. */
    retryPreview: (id: string, turnId: string, owner: string | null, request: RetryResponseRequest) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const turn = target?.turns.at(-1)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !turn || turn.id !== turnId || !canRetryPreview(turn) || inlinePending(target)
        || turn.commonRevisionInvalid || turn.commonRevision && turn.commonRevision.owner !== owner
        || turn.commonResultContextInvalid || turn.commonResultContext && turn.commonResultContext.owner !== owner
        || target.turns.some(t => t.status === 'running') || target.sharedCopy && target.sharedCopy.owner !== owner
        || request.binding.scopeId !== JSON.stringify([owner, id]) || request.binding.messageId !== turnId
        || request.binding.observationId !== `${turnId}:${turn.status}` || request.question !== turn.question) return false
      // The request was already interpreted before it stopped. Re-parsing a
      // context-dependent answer such as "추천" in the advanced phase would
      // mutate the next trading condition. Replay only the prepared fixture.
      const retry: ClientTurn = { id: crypto.randomUUID(), retryOf: turn.id, question: turn.question,
        ...(turn.commonResultContext ? { commonResultContext: structuredClone(turn.commonResultContext) } : {}),
        ...(turn.commonRevision ? { commonRevision: structuredClone(turn.commonRevision) } : {}),
        ...(turn.requestText !== undefined ? { requestText: turn.requestText } : {}),
        answer: '', fullAnswer: turn.fullAnswer, status: 'running', startedAt: Date.now(), phase: turn.phase,
        suggestions: [...turn.suggestions], ...(turn.followupActions ? { followupActions: structuredClone(turn.followupActions) } : {}),
        ...(turn.inlineRequest ? { inlineRequest: structuredClone(turn.inlineRequest), backtestFlow: turn.backtestFlow } : {}) }
      const next = { ...target, updatedAt: Date.now(), turns: [...target.turns, retry] }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    /** Public fixture only. A fresh explicit preview turn keeps its stopped
     * predecessor intact. This does not call/resume an AI service or alter it. */
    continuePreview: (id: string, turnId: string, owner: string | null, request: ContinueResponseRequest) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const turn = target?.turns.at(-1)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !turn || turn.id !== turnId || !canContinuePreview(turn)
        || turn.commonRevisionInvalid || turn.commonRevision && turn.commonRevision.owner !== owner
        || turn.commonResultContextInvalid || turn.commonResultContext && turn.commonResultContext.owner !== owner
        || target.turns.some(t => t.status === 'running') || inlinePending(target)
        || target.sharedCopy && target.sharedCopy.owner !== owner
        || request.binding.scopeId !== JSON.stringify([owner, id]) || request.binding.messageId !== turnId
        || request.binding.observationId !== `${turnId}:interrupted` || request.partialText !== turn.answer
        || request.prompt !== CONTINUE_RESPONSE_PROMPT) return false
      const now = Date.now()
      const continuation: ClientTurn = { id: crypto.randomUUID(), continuationOf: turn.id, question: CONTINUE_RESPONSE_PROMPT,
        ...(turn.commonResultContext ? { commonResultContext: structuredClone(turn.commonResultContext) } : {}),
        ...(turn.commonRevision ? { commonRevision: structuredClone(turn.commonRevision) } : {}),
        answer: '', fullAnswer: turn.fullAnswer.slice(turn.answer.length), status: 'running', startedAt: now,
        phase: turn.phase, suggestions: [...turn.suggestions], followupActions: turn.followupActions?.map(action => ({ ...action })),
        ...(turn.inlineRequest ? { inlineRequest: structuredClone(turn.inlineRequest), backtestFlow: turn.backtestFlow } : {}) }
      const next = { ...target, updatedAt: now, turns: [...target.turns, continuation] }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(s => s === target ? next : s) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    // A source followup is consumed only after exact read-back. In particular,
    // denied storage must not hide the list, append a turn, or lose the draft.
    activateFollowup: (id: string, turnId: string, owner: string | null, selection: FollowupSelection) => {
      const target = snapshot.sessions.find(s => s.id === snapshot.currentId)
      const turn = target?.turns.at(-1)
      if (uncertainInlineCommit || snapshot.storageError || !target || target.id !== id || target.workspace !== 'conversation'
        || !turn || turn.id !== turnId || turn.status !== 'done' || turn.followupsConsumed || target.turns.some(t => t.status === 'running') || inlinePending(target)
        || target.sharedCopy && target.sharedCopy.owner !== owner
        || turn.commonResultContextInvalid || turn.commonResultContext && turn.commonResultContext.owner !== owner
        || selection.binding.scopeId !== JSON.stringify([owner, id]) || selection.binding.messageId !== turnId
        || selection.binding.observationId !== `${turnId}:next`) return false
      let next: ClientSession
      if (selection.kind === 'question') {
        const index = turn.suggestions.slice(0, 3).findIndex((text, i) => selection.item.id === `next-${i}` && selection.item.label === text && selection.item.text === text)
        if (index < 0) return false
        next = canAdmitMockConditionalOrderTurn(turn, owner) && turn.conditionalOrderPending
          ? appendConditionalOrderQuestion(target, selection.item.text, selection.item.text, false, owner) ?? appendQuestion(target, selection.item.text, selection.item.text, false)
          : appendQuestion(target, selection.item.text, selection.item.text, false)
      } else {
        const action = turn.followupActions?.find(item => item.id === selection.item.id && item.type === selection.item.type && item.label === selection.item.label)
        if (!action || action.saved) return false
        if (action.type === 'alert') next = { ...target, turns: target.turns.map(item => item === turn ? { ...turn, followupActions: turn.followupActions!.map(a => a === action ? { ...a, saved: true } : a) } : item) }
        else if (action.type === 'delegate_trade' || action.type === 'auto_trade') {
          const consumed = { ...target, turns: target.turns.map(item => item === turn ? { ...turn, followupsConsumed: true as const } : item) }
          next = appendQuestion(consumed, action.label, action.label, false)
        }
        else next = appendQuestion(target, action.label, action.label, false)
      }
      prepareFollowCommit({ ...snapshot, sessions: snapshot.sessions.map(item => item === target ? next : item) }, true, '요청을 저장하지 못했어요. 현재 대화는 유지됩니다.')()
      return true
    },
    send: (question: string, source: 'composer' | 'suggestion' = 'composer', displayQuestion = question, conditionalPreviewOwner?: string | null, localBacktestOwner?: string | null) => {
      const text = question.trim()
      if (!text) return
      const shown = displayQuestion.trim() || text
      const session = snapshot.sessions.find(s => s.id === snapshot.currentId)
      if (session && (session.turns.some(t => t.status === 'running') || inlinePending(session))) return
      if (conditionalPreviewOwner !== undefined) {
        const original = session
        const next = appendConditionalOrderQuestion(session ?? emptyConversation(shown), text, shown, source === 'composer', conditionalPreviewOwner)
        if (next) {
          if (uncertainInlineCommit || snapshot.storageError || session?.sharedCopy && session.sharedCopy.owner !== conditionalPreviewOwner) throw new InlineConnectionError('현재 대화 기록을 확인한 뒤 다시 시도해주세요.')
          prepareFollowCommit({ ...snapshot, sessions: original ? snapshot.sessions.map(item => item === original ? next : item) : [next, ...snapshot.sessions],
            currentId: next.id, homeDraft: !original && source === 'composer' ? '' : snapshot.homeDraft }, true, '예약 조건을 저장하지 못했어요. 작성한 내용은 유지됩니다.')()
          return
        }
      }
      const flow = localFlow(localBacktestOwner)
      const next = appendLocalQuestion(session ?? emptyConversation(shown), text, shown, source === 'composer', flow)
      if (!session) emit({ ...snapshot, sessions: [next, ...snapshot.sessions], currentId: next.id,
        homeDraft: source === 'composer' ? '' : snapshot.homeDraft }, true)
      else update(next.id, () => next, true)
    },
    tick: (now: number) => {
      let changed = false
      let settled = false
      const allocated = [...snapshot.sessions]
      const sessions = snapshot.sessions.map(s => {
        // Keep the research list current even while its document is unmounted.
        if (s.researchStatus === '진행 중') {
          const status = researchProgress(s, now)
          if (status !== s.researchStatus) { s = { ...s, researchStatus: status }; changed = true; settled = true }
        }
        const turn = s.turns.at(-1)
        // Ordered observations belong to their supplying source, not this
        // fixture clock. Even a long background gap cannot invent completion.
        if (turn?.responseSequence || turn?.responseSequenceInvalid) return s
        if (turn?.status === 'done' && inlinePending(s) && turn.finishedAt !== undefined && now >= turn.finishedAt + 1100) {
          changed = true; settled = true
          return { ...s, inlineResults: [...(s.inlineResults ?? []), { ...turn.inlineRequest!, turnId: turn.id,
            ordinal: Math.max(0, ...(s.inlineResults ?? []).map(r => r.ordinal)) + 1, completedAt: turn.finishedAt + 1100 }] }
        }
        if (!turn || turn.status !== 'running') return s
        const length = Math.max(0, Math.floor((now - turn.startedAt - 1800) / 26))
        const answer = turn.fullAnswer.slice(0, length)
        const done = now - turn.startedAt >= 1800 && answer === turn.fullAnswer
        if (answer === turn.answer && !done) return s
        changed = true
        settled ||= done
        // Auto titles follow confirmed conditions; user-renamed titles stay untouched.
        const title = done ? clientResearchAutoTitle(s, allocated) : s.title
        allocated[allocated.findIndex(item => item.id === s.id)] = { ...s, title }
        return { ...s, title, turns: s.turns.map(t => t.id === turn.id ? { ...t, answer, status: done ? 'done' as const : 'running' as const, finishedAt: done ? t.startedAt + 1800 + t.fullAnswer.length * 26 : undefined } : t) }
      })
      // Terminal transitions are durable immediately; only streaming is batched.
      if (changed) emit({ ...snapshot, sessions }, settled)
    },
  }
  return store
}
