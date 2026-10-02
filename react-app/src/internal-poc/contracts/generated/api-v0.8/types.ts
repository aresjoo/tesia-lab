// Generated private native history wire types. Not server snapshot authority.
export type ApiV080NativeConversationHistoryNativeConversationHistoryRequest = {"conversationId":string;"limit"?:number;"cursor"?:ApiV080CommonCursor};
export type ApiV080NativeConversationHistoryNativeConversationHistoryEnvelope = {"meta":ApiV080CommonResponseMeta;"data":ApiV080NativeConversationHistoryNativeConversationHistory};
export type ApiV080CommonErrorEnvelope = {"meta":ApiV080CommonResponseMeta;"error":{"code":ApiV080CommonErrorCode;"message":"Native history request failed."}};
export type ApiV080CommonCursor = string;
export type ApiV080CommonResponseMeta = {"apiContractVersion":"0.8.0";"requestId":ApiV010CommonRequestId;"traceId":ApiV010CommonTraceId;"resourceRevision":ApiV030CommonRevision};
export type ApiV080NativeConversationHistoryNativeConversationHistory = {"conversationId":string;"snapshotRevision":ApiV030CommonRevision;"limit":number;"rows":Array<ApiV080NativeConversationHistoryNativeConversationHistoryRow>;"nextCursor"?:ApiV080CommonCursor};
export type ApiV080CommonErrorCode = "BAD_REQUEST" | "AUTHENTICATION_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "NOT_READY" | "SNAPSHOT_CHANGED" | "CURSOR_INVALID" | "BINDING_CONFLICT" | "SOURCE_VERIFICATION_FAILED" | "INTERNAL_ERROR";
export type ApiV010CommonRequestId = string;
export type ApiV010CommonTraceId = string;
export type ApiV030CommonRevision = string;
export type ApiV080NativeConversationHistoryNativeConversationHistoryRow = {"approval":ApiV030StrategyApprovalStrategyApproval;"job":(null) | (ApiV070NativeJobNativeJob)};
export type ApiV030StrategyApprovalStrategyApproval = {"strategyVersionId":string;"strategyVersionContentHash":ApiV030CommonSha256;"sourceConversationId":string;"sourceConversationStateRevision":ApiV030CommonRevision;"sourceConversationStateHash":ApiV030CommonSha256;"sourceDraftId":string;"sourceDraftRevision":ApiV030CommonRevision;"sourceProjectionHash":ApiV030CommonSha256;"semanticHash":ApiV030CommonSha256;"validationReceiptId":string;"approvalChallengeId":string;"issuanceReceiptId":string;"issuedAt":ApiV030CommonCanonicalTimestamp};
export type ApiV070NativeJobNativeJob = {"backtestId":ApiV060CommonBacktestId;"splitGroupId":string;"strategyVersionId":string;"semanticHash":ApiV010CommonSha256;"profileId":"INTERNAL_POC_FULL";"profileContentHash":ApiV010CommonSha256;"revision":ApiV010CommonRevision;"createdAt":ApiV010CommonCanonicalTimestamp;"updatedAt":ApiV010CommonCanonicalTimestamp} & ({state:"COMPLETED";resultAvailable:true;nativeReportBinding:(ApiV060CommonReportBinding) & ({"evidenceClass"?:"SOURCE_BOUND_PROJECTION"});invalidReason?:never} | {state:"INVALID";resultAvailable:false;nativeReportBinding?:never;invalidReason:ApiV010BacktestJobInvalidReason} | {state:"QUEUED" | "PREPARING_DATA" | "VALIDATING" | "REPLAYING" | "VERIFYING" | "TERMINAL_READY" | "FAILED";resultAvailable:false;nativeReportBinding?:never;invalidReason?:never});
export type ApiV030CommonSha256 = string;
export type ApiV030CommonCanonicalTimestamp = string;
export type ApiV060CommonBacktestId = string;
export type ApiV010CommonSha256 = string;
export type ApiV010CommonRevision = ApiV010CommonUInt64String;
export type ApiV010CommonCanonicalTimestamp = string;
export type ApiV060CommonReportBinding = {"jobId":ApiV060CommonIdentifier;"backtestId":ApiV060CommonBacktestId;"splitGroupId":ApiV060CommonIdentifier;"sourceBundleContentHash":ApiV060CommonSha256;"projectionContentHash":ApiV060CommonSha256;"nativeEnvelopeContentHash":ApiV060CommonSha256;"terminalSealContentHash":ApiV060CommonSha256;"terminalSealArtifactSha256":ApiV060CommonSha256;"terminalBindingContentHash":ApiV060CommonSha256;"jobAuthorBindingContentHash":ApiV060CommonSha256;"sourceClass":"PRIVATE_ACTUAL_REPLAY";"evidenceClass":"SYNTHETIC_CONTRACT_FIXTURE" | "SOURCE_BOUND_PROJECTION";"rights":"NO_PUBLIC_REDISTRIBUTION";"publicRedistributionAllowed":false;"currentMmrVerified":false;"liquidationCheckStatus":"UNAVAILABLE"};
export type ApiV010BacktestJobInvalidReason = "DATA_CONTRACT_INVALID" | "STRATEGY_CONTRACT_INVALID" | "ASSUMPTION_CONTRACT_INVALID" | "RUNTIME_RESULT_INVALID" | "VERIFICATION_FAILED";
export type ApiV010CommonUInt64String = string;
export type ApiV060CommonIdentifier = string;
export type ApiV060CommonSha256 = string;
export interface Operations {listNativeConversationHistoryV8:{request:ApiV080NativeConversationHistoryNativeConversationHistoryRequest;response:ApiV080NativeConversationHistoryNativeConversationHistoryEnvelope}}
