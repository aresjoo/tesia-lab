import type { ClientResponseBlock } from '../components/ClientResponseSequence'
import type { ResearchActivityStep } from '../components/ClientResearchActivity'
import type { ConversationTurn, DraftPatchOperation, DraftValidationFailure, DraftValidationReceipt } from './contracts/generated/api-v0.3/types'
import type { ClientLanguage } from '../client-preferences'
import { nativeObservationCopy, type ObservationCopyKey } from './native-observation-copy'

type CopyToken = { key: ObservationCopyKey; args: readonly (string | number)[] }
type ObservedText = readonly (string | CopyToken)[]
type ObservedStep = Omit<ResearchActivityStep, 'title' | 'detail' | 'publicSummary'> & {
  title: ObservedText; detail: ObservedText; publicSummary?: ObservedText
}
/** Display-only, memory-only primitives captured after SDK/owner validation.
 * No AST, response object, closures, locale copies or execution authority. */
export type NativeResearchObservation = {
  id: string; label: ObservedText; status: 'done' | 'failed'; steps: readonly ObservedStep[]; reply: ObservedText
}
const copy = (key: ObservationCopyKey, ...args: (string | number)[]): CopyToken => ({ key, args })
const lines = (values: readonly ObservedText[]): ObservedText => values.flatMap((value, index) => index ? ['\n', ...value] : value)
export function observationResponseBlocks(observation: NativeResearchObservation, language: ClientLanguage): readonly ClientResponseBlock[] {
  const render = (parts: ObservedText) => parts.map(part => typeof part === 'string' ? part
    : nativeObservationCopy[language][part.key].replace(/\{(\d+)\}/g, (_, index: string) => String(part.args[Number(index)]))).join('')
  return [{ id: `${observation.id}:work`, kind: 'work', activity: {
    label: render(observation.label), status: observation.status,
    steps: observation.steps.map(step => ({ ...step, title: render(step.title), detail: render(step.detail),
      publicSummary: step.publicSummary === undefined ? undefined : render(step.publicSummary) })),
  } }, { id: `${observation.id}:text`, kind: 'text', text: render(observation.reply), status: 'done' }]
}

// Read-only observations of SDK-validated responses. The controller still owns
// owner/binding checks, request ordering and recovery; these are not wire events,
// compiler reasoning, approval authority or a reconstructed execution timeline.
const identity = (parts: readonly (string | number)[]) => JSON.stringify(parts)
const patchTarget = (patch: DraftPatchOperation) => Object.values(patch.target).join(' / ')
const revision = (value: { conversationStateRevision: string; draftRevision: string }) =>
  copy('revision', value.conversationStateRevision, value.draftRevision)

export function captureTurnObservation(turn: ConversationTurn, reply: { text: string } | { key: 'readyReply' | 'draftReply' }): NativeResearchObservation {
  const compiler = turn.compilerTurnResult
  const merge = turn.mergeResult
  const id = identity(['native-turn', turn.conversation.conversationId, turn.conversation.draftId, turn.turnId,
    turn.conversation.conversationStateRevision, turn.conversation.draftRevision, compiler.status, merge?.status ?? 'NO_MERGE'])
  const steps: ObservedStep[] = []
  if (compiler.status === 'PATCH_PROPOSED') {
    steps.push({ id: `${id}:compiler`, title: [copy('proposed')], status: 'done',
      detail: [revision(turn.conversation), '\n', copy('proposals', compiler.draftPatch.patches.length, compiler.draftPatch.baseDraftVersion), '\n', copy('proposalOnly'), ...(merge === null ? ['\n', copy('missingMerge')] : [])],
      publicSummary: lines(compiler.draftPatch.patches.map((patch, index) =>
        [copy('proposal', index + 1), `${patch.op} · ${patchTarget(patch)} · ${patch.reasonCode}\n`, copy('evidence'), patch.evidenceSpan.text])) })
  } else if (compiler.status === 'CLARIFICATION_REQUIRED') {
    steps.push({ id: `${id}:compiler`, title: [copy('question')], status: 'done',
      detail: [revision(turn.conversation), '\n', copy('target'), compiler.question.targetField, ' · ', copy('reason'), compiler.question.reasonCode],
      publicSummary: [[compiler.question.prompt, ...compiler.question.options].join('\n')] })
  } else {
    steps.push({ id: `${id}:compiler`, title: [copy('scope')], status: 'failed',
      detail: [revision(turn.conversation), '\n', copy('reason'), compiler.reasonCode], publicSummary: [compiler.message] })
  }
  if (merge) {
    steps.push({ id: `${id}:merge`, title: [merge.status === 'APPLIED' ? copy('applied', merge.appliedPatchCount) : copy('rejected')],
      status: merge.status === 'APPLIED' ? 'done' : 'failed',
      detail: lines([[copy('draftRevision', merge.baseDraftRevision, merge.resultDraftRevision)],
        [copy('count', merge.appliedPatchCount)],
        ...merge.issues.map(issue => [`${issue.code} · `, copy('path'), issue.instancePath, issue.patchIndex === undefined ? '' : ` · patchIndex: ${issue.patchIndex}`])]) })
  }
  const needsAttention = compiler.status === 'UNSUPPORTED' || merge?.status === 'REJECTED'
  const label = merge?.status === 'REJECTED' ? 'rejectedLabel' : compiler.status === 'UNSUPPORTED' ? 'unsupportedLabel'
    : compiler.status === 'CLARIFICATION_REQUIRED' ? 'questionLabel'
    : merge?.status === 'APPLIED' ? 'appliedLabel' : 'proposed'
  return { id, label: [copy(label)], status: needsAttention ? 'failed' : 'done', steps,
    reply: ['text' in reply ? reply.text : copy(reply.key)] }
}

export function captureValidationObservation(result: DraftValidationReceipt | DraftValidationFailure): NativeResearchObservation {
  const valid = result.status === 'VALID'
  const id = identity(['native-validation', result.conversationId, result.draftId, result.conversationStateRevision,
    result.draftRevision, result.status, valid ? result.validationReceiptId : 'INVALID'])
  const detail = valid
    ? [revision(result), '\n', copy('issued'), result.issuedAt, '\n', copy('expires'), result.expiresAt, '\n', copy('receipt'), result.validationReceiptId]
    : lines([[revision(result)], ...result.issues.map(issue => [issue.code, ' · ', copy('path'), issue.path])])
  return { id, label: [copy(valid ? 'valid' : 'invalid')], status: valid ? 'done' : 'failed',
    steps: [{ id: `${id}:validation`, title: [copy(valid ? 'passed' : 'failed')], status: valid ? 'done' : 'failed', detail }],
    reply: [copy(valid ? 'validNote' : 'invalidNote')] }
}

export function turnResponseBlocks(turn: ConversationTurn, replyText: string): readonly ClientResponseBlock[] {
  return observationResponseBlocks(captureTurnObservation(turn, { text: replyText }), 'ko')
}
export function validationResponseBlocks(result: DraftValidationReceipt | DraftValidationFailure): readonly ClientResponseBlock[] {
  return observationResponseBlocks(captureValidationObservation(result), 'ko')
}
