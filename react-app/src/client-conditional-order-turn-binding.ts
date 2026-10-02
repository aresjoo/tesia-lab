import type { ClientTurn } from './client-experience-store'

function completedScopedMockTurn(turn: ClientTurn, owner: string | null): boolean {
  return turn.status === 'done'
    && !turn.responseSequence && !turn.responseSequenceInvalid
    && !turn.sourceIntake && !turn.sourceIntakeInvalid && !turn.marketResponse
    && !turn.commonRevisionInvalid && !turn.commonResultContextInvalid
    && (!turn.commonRevision || turn.commonRevision.owner === owner)
    && (!turn.commonResultContext || turn.commonResultContext.owner === owner)
}

/** Admission to the local Mock display store only; never order authority.
 * An explicit null marker is the guest owner, not a missing owner marker. */
export function canAdmitMockConditionalOrderTurn(turn: ClientTurn, owner: string | null): boolean {
  return completedScopedMockTurn(turn, owner)
    && Object.hasOwn(turn, 'conditionalOrderOwner') && turn.conditionalOrderOwner === owner
}

/** Eligible for a legacy-tag availability notice, never store admission.
 * The renderer preserves raw answers for all other turns, including foreign,
 * incomplete and observed responses; these predicates do not parse or clean. */
export function canDisplayLegacyConditionalOrderTurn(turn: ClientTurn, owner: string | null): boolean {
  return completedScopedMockTurn(turn, owner) && !Object.hasOwn(turn, 'conditionalOrderOwner')
}
