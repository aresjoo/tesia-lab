
import {strictParseApiV09,snapshotApiV09,validateApiV09} from './validator.js';
import type {EmailChallengeRequest,EmailVerificationRequest,EmailChallengeEnvelope,EmailVerificationEnvelope} from './types.js';
const operations=[{"kind":"MUTATION","method":"POST","browserCallable":true,"headers":["Origin","Host","Sec-Fetch-Site","Content-Type","X-CSRF-Token","Idempotency-Key","If-Match"],"successEtagRequired":true,"requestPolicy":"EXACT_SAME_ORIGIN_COOKIE_CSRF_IDEMPOTENCY_ANONYMOUS_ETAG","replayPolicy":"EXACT_BODY_COOKIE_BOUND_NO_NEW_SEND_OR_AUTH","operationId":"createEmailChallengeV9","path":"/api/v9/auth/email/challenges","pathField":null,"requestSchema":"identity-session.schema.json#/$defs/EmailChallengeRequest","responseSchema":"identity-session.schema.json#/$defs/EmailChallengeEnvelope","successStatus":201,"errorStatusByCode":{"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"CSRF_INVALID":403,"ORIGIN_INVALID":403,"PRECONDITION_REQUIRED":428,"PRECONDITION_FAILED":412,"IDEMPOTENCY_KEY_INVALID":400,"IDEMPOTENCY_IN_PROGRESS":409,"IDEMPOTENCY_KEY_REUSED":409,"AUTH_TRANSACTION_CONFLICT":409,"AUTH_BINDING_CONFLICT":409,"RATE_LIMITED":429,"MAIL_DISABLED":503,"INTERNAL_ERROR":500}},{"kind":"MUTATION","method":"POST","browserCallable":true,"headers":["Origin","Host","Sec-Fetch-Site","Content-Type","X-CSRF-Token","Idempotency-Key","If-Match"],"successEtagRequired":true,"requestPolicy":"EXACT_SAME_ORIGIN_COOKIE_CSRF_IDEMPOTENCY_ANONYMOUS_ETAG","replayPolicy":"EXACT_BODY_COOKIE_BOUND_NO_NEW_SEND_OR_AUTH","operationId":"verifyEmailChallengeV9","path":"/api/v9/auth/email/challenges/{challengeId}/verifications","pathField":"challengeId","requestSchema":"identity-session.schema.json#/$defs/EmailVerificationRequest","responseSchema":"identity-session.schema.json#/$defs/EmailVerificationEnvelope","successStatus":200,"errorStatusByCode":{"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"CSRF_INVALID":403,"ORIGIN_INVALID":403,"PRECONDITION_REQUIRED":428,"PRECONDITION_FAILED":412,"IDEMPOTENCY_KEY_INVALID":400,"IDEMPOTENCY_IN_PROGRESS":409,"IDEMPOTENCY_KEY_REUSED":409,"AUTH_TRANSACTION_CONFLICT":409,"AUTH_BINDING_CONFLICT":409,"CHALLENGE_EXPIRED":410,"CODE_INVALID":400,"RATE_LIMITED":429,"INTERNAL_ERROR":500}}] as const;
const errors:Record<string,number>={"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"CSRF_INVALID":403,"ORIGIN_INVALID":403,"PRECONDITION_REQUIRED":428,"PRECONDITION_FAILED":412,"IDEMPOTENCY_KEY_INVALID":400,"IDEMPOTENCY_IN_PROGRESS":409,"IDEMPOTENCY_KEY_REUSED":409,"AUTH_TRANSACTION_CONFLICT":409,"AUTH_BINDING_CONFLICT":409,"CHALLENGE_EXPIRED":410,"CODE_INVALID":400,"RATE_LIMITED":429,"MAIL_DISABLED":503,"INTERNAL_ERROR":500};
const etag="^\"[A-Za-z0-9_-]{16,128}\"$",keyPattern="^[A-Za-z0-9_-]{16,128}$",csrfPattern="^[!-~]{16,256}$",challengePattern="^email_challenge_[A-Za-z0-9_-]{12,80}$";
export interface VersionedMutationContext{csrfToken:string;idempotencyKey:string;ifMatch:string}
export interface Transport{
 request(request:{method:'POST';path:string;headers:Readonly<Record<string,string>>;body:string;credentials:'include';redirect:'manual';cache:'no-store'}):Promise<{status:number;headers:Record<string,string>;body:string}>;
}
export interface ApiCallResult<T>{status:number;headers:Readonly<Record<string,string>>;body:T}
export class ApiV09Error extends Error{constructor(readonly status:number,readonly code:string){super(code);this.name='ApiV09Error';}}
type Input={context:VersionedMutationContext;body:EmailChallengeRequest}|{context:VersionedMutationContext;body:EmailVerificationRequest;challengeId:string};
const exact=(value:unknown,keys:string[]):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const match=(pattern:string,value:unknown):boolean=>typeof value==='string'&&new RegExp(pattern.replace(/\$$/,'$(?![\\s\\S])')).test(value);
export class TesiaEmailAuthV09Client{
 constructor(private readonly transport:Transport){}
 async callWithResponse(operation:string,input:Input):Promise<ApiCallResult<EmailChallengeEnvelope|EmailVerificationEnvelope>>{
  const op=operations.find(item=>item.operationId===operation);let request:any;
  try{
   request=snapshotApiV09(input);
   if(!op||!exact(request,op.pathField?['context','body','challengeId']:['context','body'])||!exact(request.context,['csrfToken','idempotencyKey','ifMatch'])||!match(csrfPattern,request.context.csrfToken)||!match(keyPattern,request.context.idempotencyKey)||!match(etag,request.context.ifMatch)||!await validateApiV09(request.body,op.requestSchema)||(op.pathField&&!match(challengePattern,request.challengeId)))throw Error();
  }catch{throw new ApiV09Error(0,'INVALID_OPERATION_INPUT');}
  const safe=request as {context:VersionedMutationContext;body:EmailChallengeRequest|EmailVerificationRequest;challengeId?:string};
  const path=op!.pathField?op!.path.replace('{challengeId}',encodeURIComponent(safe.challengeId!)):op!.path;
  let response:Awaited<ReturnType<Transport['request']>>;
  try{response=await this.transport.request({method:'POST',path,body:JSON.stringify(safe.body),headers:{'Content-Type':'application/json','X-CSRF-Token':safe.context.csrfToken,'Idempotency-Key':safe.context.idempotencyKey,'If-Match':safe.context.ifMatch},credentials:'include',redirect:'manual',cache:'no-store'});}catch{throw new ApiV09Error(0,'AUTH_TRANSPORT_FAILED');}
  let body:any;
  try{
   const controls=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='cache-control');
   if(!Number.isInteger(response.status)||response.status<100||response.status>599||controls.length!==1||controls[0]![1]!=='no-store'||typeof response.body!=='string')throw Error();
   body=strictParseApiV09(response.body);
  }catch{throw new ApiV09Error(0,'INVALID_RESPONSE');}
  if(response.status!==op!.successStatus){
   if(!await validateApiV09(body,'common.schema.json#/$defs/ErrorEnvelope')||!Object.hasOwn(op!.errorStatusByCode,body.error.code)||errors[body.error.code]!==response.status)throw new ApiV09Error(response.status,'INVALID_RESPONSE');
   throw new ApiV09Error(response.status,body.error.code);
  }
  const etags=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='etag');
  if(etags.length!==1||!match(etag,etags[0]![1])||!await validateApiV09(body,op!.responseSchema))throw new ApiV09Error(response.status,'INVALID_RESPONSE');
  if((op!.pathField?body.data.handoffReservation.initiatingSessionEtag:body.data.initiatingSessionEtag)!==safe.context.ifMatch)throw new ApiV09Error(response.status,'AUTH_BINDING_CONFLICT');
  if(op!.pathField&&body.data.challengeId!==request.challengeId)throw new ApiV09Error(response.status,'AUTH_BINDING_CONFLICT');
  return{status:response.status,headers:{'Cache-Control':'no-store',ETag:etags[0]![1]},body};
 }
 async createChallenge(context:VersionedMutationContext,body:EmailChallengeRequest):Promise<ApiCallResult<EmailChallengeEnvelope>>{return await this.callWithResponse('createEmailChallengeV9',{context,body}) as ApiCallResult<EmailChallengeEnvelope>;}
 async verifyChallenge(challengeId:string,context:VersionedMutationContext,body:EmailVerificationRequest):Promise<ApiCallResult<EmailVerificationEnvelope>>{return await this.callWithResponse('verifyEmailChallengeV9',{challengeId,context,body}) as ApiCallResult<EmailVerificationEnvelope>;}
}
