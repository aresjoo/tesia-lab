// Generated API20 observation types; no owner, worker, billing, strategy or order authority.
export type ResearchWorkState='QUEUED'|'DISPATCHING'|'STREAMING'|'COMPLETED'|'FAILED'|'CANCELLED'|'AMBIGUOUS';
export type ErrorCode='BAD_REQUEST'|'AUTHENTICATION_REQUIRED'|'FORBIDDEN'|'NOT_FOUND'|'RATE_LIMITED'|'INTERNAL_ERROR';
export type ActiveOrUnsuccessfulProjection={readonly researchWorkId:string;readonly state:Exclude<ResearchWorkState,'COMPLETED'>};
export type CompletedProjection={readonly researchWorkId:string;readonly state:'COMPLETED';readonly reportText:string};
export type ResearchWorkProjection=ActiveOrUnsuccessfulProjection|CompletedProjection;
export type ProjectionEnvelope={readonly apiContractVersion:'0.20.0';readonly data:ResearchWorkProjection};
export type ErrorEnvelope={readonly apiContractVersion:'0.20.0';readonly error:{readonly code:ErrorCode;readonly message:string}};
export type DeepReadonly<T>=T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
