export type Id = string;
export type SessionId = string;
export type Revision = string;
export type Counter = number;
export type Timestamp = string;
export type Cursor = string;
export type Limit = number;
export type State = "QUEUED" | "DISPATCHING" | "COMPLETED" | "FAILED" | "CANCELLED" | "AMBIGUOUS";
export type ClaimBody = {
    readonly "expectedSessionRevision": Revision;
};
export type ClaimRequest = {
    readonly "anonymousSessionId": SessionId;
    readonly "expectedSessionRevision": Revision;
};
export type LegacyResourceCounts = {
    readonly "conversations": Counter;
    readonly "messages": Counter;
    readonly "drafts": Counter;
    readonly "patches": Counter;
    readonly "validations": Counter;
    readonly "idempotencyRecords": Counter;
};
export type ConsultationResourceCounts = {
    readonly "conversations": Counter;
    readonly "turns": Counter;
    readonly "events": Counter;
    readonly "idempotencyRecords": Counter;
};
export type Claim = {
    readonly "anonymousSessionId": SessionId;
    readonly "sessionId": SessionId;
    readonly "state": "AUTHENTICATED";
    readonly "revision": Revision;
    readonly "mode": "CONSULTATION_ONLY" | "COMBINED";
    readonly "grantScope": "CONSULTATION_V13";
    readonly "claimedLegacyResourceCounts": LegacyResourceCounts;
    readonly "claimedConsultationResourceCounts": ConsultationResourceCounts;
    readonly "oldSessionRevoked": true;
};
export type ConversationSummary = {
    readonly "conversationId": Id;
    readonly "createdAt": Timestamp;
    readonly "updatedAt": Timestamp;
    readonly "turnCount": Counter;
    readonly "lastTurnId": (Id) | (null);
    readonly "lastTurnState": (State) | (null);
};
export type ConversationListRequest = {
    readonly "cursor"?: Cursor;
    readonly "limit"?: Limit;
};
export type ConversationList = {
    readonly "snapshotId": Id;
    readonly "offset": Counter;
    readonly "limit": Limit;
    readonly "totalCount": Counter;
    readonly "conversations": ReadonlyArray<ConversationSummary>;
    readonly "nextCursor": (Cursor) | (null);
};
export type ErrorCode = "BAD_REQUEST" | "AUTHENTICATION_REQUIRED" | "FORBIDDEN" | "CSRF_INVALID" | "ORIGIN_INVALID" | "NOT_FOUND" | "IDEMPOTENCY_KEY_REUSED" | "SESSION_REVISION_CONFLICT" | "HANDOFF_INVALID" | "CLAIM_CONFLICT" | "CURSOR_INVALID" | "RATE_LIMITED" | "INTERNAL_ERROR";
export type Error = {
    readonly "code": ErrorCode;
    readonly "message": "Consultation session request failed.";
};
export type ClaimEnvelope = {
    readonly "apiContractVersion": "0.14.0";
    readonly "data": Claim;
};
export type ConversationListEnvelope = {
    readonly "apiContractVersion": "0.14.0";
    readonly "data": ConversationList;
};
export type ErrorEnvelope = {
    readonly "apiContractVersion": "0.14.0";
    readonly "error": Error;
};
export interface Operations {
    readonly claimConsultationSessionV14: {
        readonly request: ClaimRequest;
        readonly response: ClaimEnvelope;
    };
    readonly listConsultationConversationsV14: {
        readonly request: ConversationListRequest;
        readonly response: ConversationListEnvelope;
    };
}
