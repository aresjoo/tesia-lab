// Generated API16 document-question types; no producer, provider, strategy or order authority.
export type DocumentKind='plan'|'hypothesis'|'strategy'|'backtest'|'critic'|'stress'|'holdout'|'report'|'connect'|'run'|'live';
export type TurnState='QUEUED'|'DISPATCHING'|'COMPLETED'|'FAILED'|'CANCELLED'|'AMBIGUOUS';
export type ErrorCode='BAD_REQUEST'|'AUTHENTICATION_REQUIRED'|'FORBIDDEN'|'CSRF_INVALID'|'ORIGIN_INVALID'|'NOT_FOUND'|'CLIENT_MESSAGE_ID_REUSED'|'TURN_IN_PROGRESS'|'IDEMPOTENCY_KEY_REUSED'|'DOCUMENT_REFERENCE_INVALID'|'DOCUMENT_REVISION_CONFLICT'|'DOCUMENT_TOO_LARGE'|'BUDGET_EXCEEDED'|'RATE_LIMITED'|'PROVIDER_UNAVAILABLE'|'INTERNAL_ERROR';
export type ProducerLocator={readonly producerServiceId:string;readonly kind:DocumentKind;readonly documentId:string;readonly revision:number;readonly contentSha256:string};
export type ProducerLocatorEnvelope={readonly apiContractVersion:'0.16.0';readonly data:ProducerLocator};
export type ReferenceMintRequest={readonly apiContractVersion:'0.16.0';readonly locator:ProducerLocator};
export type DocumentSnapshot={readonly documentRef:string;readonly producerServiceId:string;readonly kind:DocumentKind;readonly documentId:string;readonly revision:number;readonly contentSha256:string};
export type ReferenceEnvelope={readonly apiContractVersion:'0.16.0';readonly data:DocumentSnapshot};
export type DocumentQuestionRequest={readonly apiContractVersion:'0.16.0';readonly clientMessageId:string;readonly text:string;readonly documentRef:string};
export type DocumentQuestionAdmission={readonly conversationId:string;readonly turnId:string;readonly clientMessageId:string;readonly documentRef:string;readonly state:'QUEUED'};
export type DocumentQuestionEnvelope={readonly apiContractVersion:'0.16.0';readonly data:DocumentQuestionAdmission};
export type DocumentQuestionTurnProjection={readonly conversationId:string;readonly turnId:string;readonly clientMessageId:string;readonly documentRef:string;readonly producerServiceId:string;readonly kind:DocumentKind;readonly documentId:string;readonly revision:number;readonly contentSha256:string;readonly state:TurnState};
export type DocumentQuestionTurnEnvelope={readonly apiContractVersion:'0.16.0';readonly data:DocumentQuestionTurnProjection};
export type DocumentQuestionHistory={readonly items:ReadonlyArray<DocumentQuestionTurnProjection>;readonly nextCursor:string|null};
export type DocumentQuestionHistoryEnvelope={readonly apiContractVersion:'0.16.0';readonly data:DocumentQuestionHistory};
export type ErrorEnvelope={readonly apiContractVersion:'0.16.0';readonly error:{readonly code:ErrorCode;readonly message:string}};
export type DeepReadonly<T>=T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
