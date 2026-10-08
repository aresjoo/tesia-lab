export type Id = string;
export type Sequence = number;
export type Limit = number;
export type Timestamp = string;
export type Text = string;
export type Cursor = string;
export type State = "QUEUED" | "DISPATCHING" | "COMPLETED" | "FAILED" | "CANCELLED" | "AMBIGUOUS";
export type TerminalState = "COMPLETED" | "FAILED" | "CANCELLED" | "AMBIGUOUS";
export type FailureCode = "PROVIDER_REJECTED" | "PROVIDER_UNAVAILABLE" | "TIMEOUT" | "OUTPUT_REJECTED" | "CANCELLED" | "DISPATCH_UNCONFIRMED" | "INTERNAL_ERROR";
export type Usage = {
    readonly "status": "UNKNOWN" | "REPORTED";
    readonly "inputTokens": (number) | (null);
    readonly "outputTokens": (number) | (null);
};
export type Capabilities = {
    readonly "available": boolean;
    readonly "reason": ("DISABLED" | "NOT_CONFIGURED" | "NOT_READY") | (null);
    readonly "maxTextChars": 16000;
    readonly "maxPageItems": 100;
    readonly "researchEvents": "OBSERVATIONS_ONLY";
    readonly "executionAuthority": false;
};
export type CapabilitiesRequest = Readonly<Record<string, never>>;
export type CreateRequest = {
    readonly "conversationId": (Id) | (null);
    readonly "clientMessageId": Id;
    readonly "text": Text;
};
export type TurnRequest = {
    readonly "turnId": Id;
};
export type EventsRequest = {
    readonly "turnId": Id;
    readonly "after": Sequence;
    readonly "limit"?: Limit;
};
export type HistoryRequest = {
    readonly "conversationId": Id;
    readonly "limit"?: Limit;
    readonly "cursor"?: Cursor;
};
export type CancelRequest = {
    readonly "turnId": Id;
};
export type Turn = {
    readonly "turnId": Id;
    readonly "conversationId": Id;
    readonly "clientMessageId": Id;
    readonly "state": State;
    readonly "createdAt": Timestamp;
    readonly "updatedAt": Timestamp;
    readonly "userText": Text;
    readonly "answerText": string;
    readonly "lastSequence": Sequence;
    readonly "terminalSequence": (number) | (null);
    readonly "cancelRequested": boolean;
    readonly "usage": Usage;
    readonly "failureCode": (FailureCode) | (null);
};
export type AnswerDelta = {
    readonly "type": "answer_delta";
    readonly "text": string;
};
export type ToolObservation = {
    readonly "type": "tool_observation";
    readonly "toolCallId": Id;
    readonly "tool": "web_search" | "web_fetch" | "market_data";
    readonly "state": "STARTED" | "COMPLETED" | "FAILED";
    readonly "failureCode": (FailureCode) | (null);
};
export type SourceObservation = {
    readonly "type": "source_observation";
    readonly "sourceId": Id;
    readonly "title": string;
    readonly "href": string;
};
export type UsageObservation = {
    readonly "type": "usage";
    readonly "usage": Usage;
};
export type Terminal = {
    readonly "type": "terminal";
    readonly "state": TerminalState;
    readonly "usage": Usage;
    readonly "failureCode": (FailureCode) | (null);
};
export type Event = {
    readonly "turnId": Id;
    readonly "sequence": number;
    readonly "observedAt": Timestamp;
    readonly "payload": (AnswerDelta) | (ToolObservation) | (SourceObservation) | (UsageObservation) | (Terminal);
};
export type Events = {
    readonly "turnId": Id;
    readonly "after": Sequence;
    readonly "nextSequence": Sequence;
    readonly "events": ReadonlyArray<Event>;
    readonly "hasMore": boolean;
    readonly "terminal": boolean;
    readonly "limit": Limit;
};
export type History = {
    readonly "conversationId": Id;
    readonly "snapshotId": Id;
    readonly "offset": Sequence;
    readonly "limit": Limit;
    readonly "totalCount": Sequence;
    readonly "turns": ReadonlyArray<Turn>;
    readonly "nextCursor": (Cursor) | (null);
};
export type Cancel = {
    readonly "turn": Turn;
    readonly "accepted": boolean;
};
export type ErrorCode = "BAD_REQUEST" | "AUTHENTICATION_REQUIRED" | "FORBIDDEN" | "CSRF_INVALID" | "ORIGIN_INVALID" | "NOT_FOUND" | "IDEMPOTENCY_KEY_REUSED" | "CLIENT_MESSAGE_ID_REUSED" | "TURN_IN_PROGRESS" | "CURSOR_INVALID" | "BUDGET_EXCEEDED" | "RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "INTERNAL_ERROR";
export type ErrorEnvelope = {
    readonly "apiContractVersion": "0.13.0";
    readonly "error": {
        readonly "code": ErrorCode;
        readonly "message": "Consultation request failed.";
    };
};
export type CapabilitiesEnvelope = {
    readonly "apiContractVersion": "0.13.0";
    readonly "data": Capabilities;
};
export type TurnEnvelope = {
    readonly "apiContractVersion": "0.13.0";
    readonly "data": Turn;
};
export type EventsEnvelope = {
    readonly "apiContractVersion": "0.13.0";
    readonly "data": Events;
};
export type HistoryEnvelope = {
    readonly "apiContractVersion": "0.13.0";
    readonly "data": History;
};
export type CancelEnvelope = {
    readonly "apiContractVersion": "0.13.0";
    readonly "data": Cancel;
};
export interface Operations {
    readonly getConsultationCapabilitiesV13: {
        readonly request: CapabilitiesRequest;
        readonly response: CapabilitiesEnvelope;
    };
    readonly createConsultationTurnV13: {
        readonly request: CreateRequest;
        readonly response: TurnEnvelope;
    };
    readonly getConsultationTurnV13: {
        readonly request: TurnRequest;
        readonly response: TurnEnvelope;
    };
    readonly listConsultationEventsV13: {
        readonly request: EventsRequest;
        readonly response: EventsEnvelope;
    };
    readonly listConsultationHistoryV13: {
        readonly request: HistoryRequest;
        readonly response: HistoryEnvelope;
    };
    readonly cancelConsultationTurnV13: {
        readonly request: CancelRequest;
        readonly response: CancelEnvelope;
    };
}
