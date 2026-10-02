import { useRef, useState } from 'react'
import type { ConversationTurn } from './contracts/generated/api-v0.3/types'
import type { NativeMutationCommand } from './native-mutation-journal'

export type RowEditStatus = 'sending' | 'uncertain' | 'notSent' | 'applied' | 'clarification' | 'unsupported' | 'rejected' | 'proposed' | 'stale' | 'tooLong'
export type RowEdit = { text: string; revision: string; open: boolean; status?: RowEditStatus; detail?: string; label?: string; submittedText?: string;
  request?: { id: string; text: string; message: string; projectionHash: string; draftRevision: string } }
type Store = Readonly<Record<string, Readonly<Record<string, RowEdit>>>>
export const rowEditScope = (owner: { sessionId: string; sessionState: string; conversationId: string; draftId: string }) =>
  JSON.stringify([owner.sessionId, owner.sessionState, owner.conversationId, owner.draftId])

/** Presentation-only, owner-bound memory. No patches, credentials or new journal.
 * Completion is observed at the existing verified TURN boundary, including
 * same-key recovery. A resolved send Promise is never evidence of application.
 */
export function useNativeRowEdits() {
  const [store, setStore] = useState<Store>({})
  const current = useRef<Store>({})
  const write = (value: Store) => { current.current = value; setStore(value) }
  const update = (scope: string, key: string, row: RowEdit) => write({ ...current.current, [scope]: { ...current.current[scope], [key]: row } })
  const change = (scope: string, key: string, text: string, revision: string, open = true) => {
    update(scope, key, { ...current.current[scope]?.[key], text, revision, open, status: undefined, detail: undefined })
  }
  const open = (scope: string, key: string, revision: string, value: boolean) => {
    update(scope, key, { ...(current.current[scope]?.[key] ?? { text: '', revision }), open: value })
  }
  const read = (scope: string, key: string) => current.current[scope]?.[key]
  const mark = (scope: string, key: string, status: RowEditStatus) => {
    const row = read(scope, key)
    if (row) update(scope, key, { ...row, status })
  }
  const begin = (scope: string, key: string, label: string, id: string, message: string, projectionHash: string, draftRevision: string) => {
    const row = read(scope, key)
    if (!row) return
    update(scope, key, { ...row, label, submittedText: row.text, status: 'sending', detail: undefined, request: { id, text: row.text, message, projectionHash, draftRevision } })
  }
  const match = (command: NativeMutationCommand) => command.kind === 'TURN'
    ? Object.entries(current.current[rowEditScope(command)] ?? {}).find(([, row]) => row.request?.id === command.body.clientMessageId && row.request.message === command.body.message) : undefined
  const verify = async (command: NativeMutationCommand, result: ConversationTurn) => {
    const request = match(command)?.[1].request
    if (command.kind !== 'TURN' || (!request && !command.body.clientMessageId.startsWith('client_message_row_'))) return
    // Existing unicode_nfc_codepoint_v1 source meaning, not a new wire schema.
    // The existing clientMessageId carries presentation origin through the
    // unchanged journal, so reload must not bypass source-text verification.
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(command.body.message.normalize('NFC')))
    const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
    if (result.compilerTurnResult.source.textSha256 !== hash) throw new Error('BINDING_CONFLICT')
    if (request && ((result.mergeResult && (result.mergeResult.beforeProjectionHash !== request.projectionHash || String(result.mergeResult.baseDraftRevision) !== request.draftRevision))
      || (result.mergeResult?.status !== 'APPLIED' && (result.conversation.projectionHash !== request.projectionHash || result.conversation.draftRevision !== request.draftRevision)))) throw new Error('BINDING_CONFLICT')
  }
  const observe = (command: NativeMutationCommand, result?: ConversationTurn) => {
    if (command.kind !== 'TURN') return
    const entry = match(command)
    if (!entry) return
    const [key, row] = entry
    const status: RowEditStatus = !result ? 'uncertain' : result.mergeResult?.status === 'APPLIED' ? 'applied'
      : result.mergeResult?.status === 'REJECTED' ? 'rejected' : result.compilerTurnResult.status === 'CLARIFICATION_REQUIRED' ? 'clarification'
      : result.compilerTurnResult.status === 'UNSUPPORTED' ? 'unsupported' : 'proposed'
    // Don't erase a newer local draft or infer a particular field was applied.
    const text = status === 'applied' && row.text === row.request?.text ? '' : row.text
    update(rowEditScope(command), key, { ...row, text, status,
      revision: result?.conversation.conversationStateRevision ?? row.revision,
      detail: result?.compilerTurnResult.status === 'CLARIFICATION_REQUIRED' ? result.compilerTurnResult.question.prompt
        : result?.compilerTurnResult.status === 'UNSUPPORTED' ? result.compilerTurnResult.message : undefined,
      request: result ? undefined : row.request })
  }
  return { store, read, change, open, mark, begin, verify, observe, clear: () => write({}) }
}
