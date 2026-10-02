// Generated concrete native wire types. Not server/source authority.
export type ApiV070NativeJobSubmitNativeBacktestRequest = (ApiV010BacktestJobSubmitBacktestRequest) & ({"profileId"?:"INTERNAL_POC_FULL"});
export type ApiV070NativeJobNativeAcceptedEnvelope = (ApiV070NativeJobNativeJobEnvelope) & ({"data"?:{"state"?:"QUEUED"}});
export type ApiV070NativeJobNativeJobRequest = {"backtestId":ApiV060CommonBacktestId};
export type ApiV070NativeJobNativeJobEnvelope = {"meta":ApiV070CommonResponseMeta;"data":ApiV070NativeJobNativeJob};
export type ApiV070CommonErrorEnvelope = {"meta":ApiV070CommonResponseMeta;"error":{"code":ApiV070CommonErrorCode;"message":"Native job request failed."}};
export type ApiV010BacktestJobSubmitBacktestRequest = {"strategyVersionId":string;"expectedSemanticHash":ApiV010CommonSha256;"profileId":"STRUCTURAL_SMOKE" | "INTERNAL_POC_FULL"};
export type ApiV060CommonBacktestId = string;
export type ApiV070CommonResponseMeta = {"apiContractVersion":"0.7.0";"requestId":ApiV010CommonRequestId;"traceId":ApiV010CommonTraceId;"resourceRevision":(ApiV010CommonRevision) | (null)};
export type ApiV070NativeJobNativeJob = {"backtestId":ApiV060CommonBacktestId;"splitGroupId":string;"strategyVersionId":string;"semanticHash":ApiV010CommonSha256;"profileId":"INTERNAL_POC_FULL";"profileContentHash":ApiV010CommonSha256;"revision":ApiV010CommonRevision;"createdAt":ApiV010CommonCanonicalTimestamp;"updatedAt":ApiV010CommonCanonicalTimestamp} & ({state:"COMPLETED";resultAvailable:true;nativeReportBinding:(ApiV060CommonReportBinding) & ({"evidenceClass"?:"SOURCE_BOUND_PROJECTION"});invalidReason?:never} | {state:"INVALID";resultAvailable:false;nativeReportBinding?:never;invalidReason:ApiV010BacktestJobInvalidReason} | {state:"QUEUED" | "PREPARING_DATA" | "VALIDATING" | "REPLAYING" | "VERIFYING" | "TERMINAL_READY" | "FAILED";resultAvailable:false;nativeReportBinding?:never;invalidReason?:never});
export type ApiV070CommonErrorCode = "BAD_REQUEST" | "AUTHENTICATION_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CSRF_INVALID" | "ORIGIN_INVALID" | "IDEMPOTENCY_KEY_INVALID" | "IDEMPOTENCY_IN_PROGRESS" | "IDEMPOTENCY_KEY_REUSED" | "APPROVAL_BINDING_CONFLICT" | "NOT_READY" | "BINDING_CONFLICT" | "SOURCE_VERIFICATION_FAILED" | "INTERNAL_ERROR";
export type ApiV010CommonSha256 = string;
export type ApiV010CommonRequestId = string;
export type ApiV010CommonTraceId = string;
export type ApiV010CommonRevision = ApiV010CommonUInt64String;
export type ApiV010CommonCanonicalTimestamp = string;
export type ApiV060CommonReportBinding = {"jobId":ApiV060CommonIdentifier;"backtestId":ApiV060CommonBacktestId;"splitGroupId":ApiV060CommonIdentifier;"sourceBundleContentHash":ApiV060CommonSha256;"projectionContentHash":ApiV060CommonSha256;"nativeEnvelopeContentHash":ApiV060CommonSha256;"terminalSealContentHash":ApiV060CommonSha256;"terminalSealArtifactSha256":ApiV060CommonSha256;"terminalBindingContentHash":ApiV060CommonSha256;"jobAuthorBindingContentHash":ApiV060CommonSha256;"sourceClass":"PRIVATE_ACTUAL_REPLAY";"evidenceClass":"SYNTHETIC_CONTRACT_FIXTURE" | "SOURCE_BOUND_PROJECTION";"rights":"NO_PUBLIC_REDISTRIBUTION";"publicRedistributionAllowed":false;"currentMmrVerified":false;"liquidationCheckStatus":"UNAVAILABLE"};
export type ApiV010BacktestJobInvalidReason = "DATA_CONTRACT_INVALID" | "STRATEGY_CONTRACT_INVALID" | "ASSUMPTION_CONTRACT_INVALID" | "RUNTIME_RESULT_INVALID" | "VERIFICATION_FAILED";
export type ApiV010CommonUInt64String = string;
export type ApiV060CommonIdentifier = string;
export type ApiV060CommonSha256 = string;
export interface Operations {submitNativeBacktestV7:{request:ApiV070NativeJobSubmitNativeBacktestRequest;response:ApiV070NativeJobNativeAcceptedEnvelope};getNativeBacktestV7:{request:ApiV070NativeJobNativeJobRequest;response:ApiV070NativeJobNativeJobEnvelope}}
