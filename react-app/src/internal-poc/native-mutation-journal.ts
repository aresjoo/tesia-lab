import type { ApprovalChallengeRequest, ConversationTurnRequest, StrategyApprovalRequest, ValidateDraftRequest } from './contracts/generated/api-v0.3/types'
import type { Operations } from './contracts/generated/api-v0.7/types'

export const NATIVE_JOURNAL_KEY = 'tesia.native.pending-command'
type Base = { version: 1; sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED'; idempotencyKey: string }
type DraftCommand = Base & { conversationId: string; draftId: string; ifMatch: string }
export type NativeLogoutCommand = Base & { kind: 'LOGOUT'; ifMatch: string; expectedSessionRevision: string }
export type NativeMutationCommand =
  | (Base & { kind: 'CREATE_TURN'; turnIdempotencyKey: string; clientMessageId: string; message: string })
  | (DraftCommand & { kind: 'TURN'; body: ConversationTurnRequest })
  | (DraftCommand & { kind: 'VALIDATE'; body: ValidateDraftRequest })
  | (DraftCommand & { kind: 'CHALLENGE'; body: ApprovalChallengeRequest })
  | (DraftCommand & { kind: 'APPROVE'; body: StrategyApprovalRequest })
  | (Base & { kind: 'SUBMIT'; conversationId: string; body: Operations['submitNativeBacktestV7']['request'] })
  | (Base & { kind: 'CLAIM'; initiatingSessionId: string; expectedSessionRevision: string; ifMatch: string; conversationId?: string })

// This validates the private storage container only. Request semantics and
// authority remain owned by the generated SDK and authenticated server.
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',')
function checked(value: unknown): NativeMutationCommand | NativeLogoutCommand {
  if (!object(value) || value.version !== 1 || typeof value.kind !== 'string') throw new Error('NATIVE_JOURNAL_INVALID')
  const base = ['version', 'kind', 'sessionId', 'sessionState', 'idempotencyKey']
  if (!['ANONYMOUS', 'AUTHENTICATED'].includes(String(value.sessionState))) throw new Error('NATIVE_JOURNAL_INVALID')
  const bodies: Record<string, string[]> = {
    TURN: ['expectedConversationStateRevision', 'expectedConversationStateHash', 'clientMessageId', 'message'],
    VALIDATE: ['expectedConversationStateRevision', 'expectedConversationStateHash'],
    CHALLENGE: ['expectedConversationStateRevision', 'expectedConversationStateHash', 'validationReceiptId', 'acknowledgedSemanticHash'],
    APPROVE: ['expectedConversationStateRevision', 'expectedConversationStateHash', 'validationReceiptId', 'approvalChallengeId', 'acknowledgedSemanticHash'],
    SUBMIT: ['strategyVersionId', 'expectedSemanticHash', 'profileId'],
  }
  const keys = value.kind === 'LOGOUT' ? [...base, 'ifMatch', 'expectedSessionRevision']
    : value.kind === 'CLAIM' ? [...base, 'initiatingSessionId', 'expectedSessionRevision', 'ifMatch', ...(Object.hasOwn(value, 'conversationId') ? ['conversationId'] : [])]
    : value.kind === 'CREATE_TURN' ? [...base, 'turnIdempotencyKey', 'clientMessageId', 'message']
    : value.kind === 'SUBMIT' ? [...base, 'conversationId', 'body']
      : bodies[value.kind] ? [...base, 'conversationId', 'draftId', 'ifMatch', 'body'] : []
  if (!exact(value, keys) || Object.entries(value).some(([key, item]) => key !== 'version' && key !== 'body' && (typeof item !== 'string' || !item.length))) throw new Error('NATIVE_JOURNAL_INVALID')
  if (value.kind === 'LOGOUT' && !/^[1-9][0-9]*$/.test(String(value.expectedSessionRevision))) throw new Error('NATIVE_JOURNAL_INVALID')
  if (!['CREATE_TURN', 'CLAIM', 'LOGOUT'].includes(value.kind) && (!object(value.body) || !exact(value.body, bodies[value.kind]) || Object.values(value.body).some(item => typeof item !== 'string' || !item.length))) throw new Error('NATIVE_JOURNAL_INVALID')
  return value as NativeMutationCommand | NativeLogoutCommand
}

export function readNativeJournal(): NativeMutationCommand | null {
  try {
    const raw = sessionStorage.getItem(NATIVE_JOURNAL_KEY)
    if (raw === null) return null
    if (raw.length > 32768) throw new Error('NATIVE_JOURNAL_INVALID')
    const value = checked(JSON.parse(raw))
    if (value.kind === 'LOGOUT') throw new Error('NATIVE_JOURNAL_INVALID')
    return value
  } catch { throw new Error('NATIVE_JOURNAL_UNAVAILABLE') }
}

export function writeNativeJournal(command: NativeMutationCommand): void {
  try {
    const raw = JSON.stringify(checked(command))
    if (raw.length > 32768) throw new Error('NATIVE_JOURNAL_INVALID')
    sessionStorage.setItem(NATIVE_JOURNAL_KEY, raw)
    if (sessionStorage.getItem(NATIVE_JOURNAL_KEY) !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
  } catch { throw new Error('NATIVE_JOURNAL_UNAVAILABLE') }
}

export function clearNativeJournal(): void {
  try {
    sessionStorage.removeItem(NATIVE_JOURNAL_KEY)
    if (sessionStorage.getItem(NATIVE_JOURNAL_KEY) !== null) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
  } catch { throw new Error('NATIVE_JOURNAL_UNAVAILABLE') }
}

export const NATIVE_LOGOUT_KEY = 'tesia.native.pending-logout'
export function readNativeLogout(): NativeLogoutCommand | null {
  try {
    const raw = sessionStorage.getItem(NATIVE_LOGOUT_KEY)
    if (raw === null) return null
    if (raw.length > 32768) throw new Error('NATIVE_JOURNAL_INVALID')
    const value = checked(JSON.parse(raw))
    if (value.kind !== 'LOGOUT') throw new Error('NATIVE_JOURNAL_INVALID')
    return value
  } catch { throw new Error('NATIVE_JOURNAL_UNAVAILABLE') }
}
export function writeNativeLogout(command: NativeLogoutCommand): void {
  try {
    const raw = JSON.stringify(checked(command))
    if (raw.length > 32768) throw new Error('NATIVE_JOURNAL_INVALID')
    sessionStorage.setItem(NATIVE_LOGOUT_KEY, raw)
    if (sessionStorage.getItem(NATIVE_LOGOUT_KEY) !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
  } catch { throw new Error('NATIVE_JOURNAL_UNAVAILABLE') }
}
// Detach only on an explicit new-session action. Keep the old request bytes for
// investigation; they must never be replayed with a different browser session.
export function detachNativeJournalAfterLogout(): void {
  try {
    const command = readNativeJournal()
    if (command) {
      const raw = sessionStorage.getItem(NATIVE_JOURNAL_KEY)!
      const key = `tesia.native.detached-request.${command.idempotencyKey}`
      const previous = sessionStorage.getItem(key)
      if (previous !== null && previous !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      const detached = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).filter(key => key?.startsWith('tesia.native.detached-request.'))
      if (previous === null && detached.length >= 10) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      sessionStorage.setItem(key, raw)
      if (sessionStorage.getItem(key) !== raw) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      clearNativeJournal()
    }
    sessionStorage.removeItem(NATIVE_LOGOUT_KEY)
    if (sessionStorage.getItem(NATIVE_LOGOUT_KEY) !== null) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
  } catch { throw new Error('NATIVE_JOURNAL_UNAVAILABLE') }
}
