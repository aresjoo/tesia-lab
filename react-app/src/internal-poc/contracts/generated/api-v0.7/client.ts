
import {strictParseApiV07,validateApiV07} from './validator.js';
import type {Operations} from './types.js';
const operations=[{"operationId":"submitNativeBacktestV7","method":"POST","path":"/api/v7/backtests","requestSchema":"native-job.schema.json#/$defs/SubmitNativeBacktestRequest","responseSchema":"native-job.schema.json#/$defs/NativeAcceptedEnvelope","headers":["X-CSRF-Token","Idempotency-Key"],"successStatus":202,"successEtagRequired":true},{"operationId":"getNativeBacktestV7","method":"GET","path":"/api/v7/backtests/{backtestId}","pathField":"backtestId","requestSchema":"native-job.schema.json#/$defs/NativeJobRequest","responseSchema":"native-job.schema.json#/$defs/NativeJobEnvelope","headers":[],"successStatus":200,"successEtagRequired":true}] as const;
const errors:Record<string,number>={"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"CSRF_INVALID":403,"ORIGIN_INVALID":403,"IDEMPOTENCY_KEY_INVALID":400,"IDEMPOTENCY_IN_PROGRESS":409,"IDEMPOTENCY_KEY_REUSED":409,"APPROVAL_BINDING_CONFLICT":409,"NOT_READY":409,"BINDING_CONFLICT":409,"SOURCE_VERIFICATION_FAILED":409,"INTERNAL_ERROR":500};
const etagPattern="^\"[A-Za-z0-9_-]{16,128}\"$",idempotencyPattern="^[A-Za-z0-9_-]{16,128}$";
export interface Transport{
 request(request:{method:'GET'|'POST';path:string;headers:Readonly<Record<string,string>>;body?:string;credentials:'include';redirect:'manual';cache:'no-store'}):Promise<{status:number;headers:Record<string,string>;body:string}>;
}
export interface MutationCredentials{csrfToken:string;idempotencyKey:string}
export class ApiV07Error extends Error{constructor(readonly code:string){super(code);this.name='ApiV07Error';}}
export class TesiaNativeJobsV07Client{
 constructor(private readonly transport:Transport){}
 async call<K extends keyof Operations>(operation:K,request:Operations[K]['request'],mutation?:MutationCredentials):Promise<Operations[K]['response']>{
  const op=operations.find(x=>x.operationId===operation);
  let values:Record<string,unknown>;
  const headers:Record<string,string>={Accept:'application/json'};
  try{
   const snapshot=JSON.stringify(request);
   if(!op||!await validateApiV07(request,op.requestSchema))throw Error();
   values=strictParseApiV07(snapshot) as Record<string,unknown>;
   if(!await validateApiV07(values,op.requestSchema))throw Error();
   if(op.method==='POST'){
    if(!mutation||Object.keys(mutation).sort().join(',')!=='csrfToken,idempotencyKey'||typeof mutation.csrfToken!=='string'||mutation.csrfToken.length<16||mutation.csrfToken.length>256||typeof mutation.idempotencyKey!=='string'||!new RegExp(idempotencyPattern).test(mutation.idempotencyKey))throw Error();
    headers['X-CSRF-Token']=mutation.csrfToken;headers['Idempotency-Key']=mutation.idempotencyKey;headers['Content-Type']='application/json';
   }else if(mutation!==undefined)throw Error();
  }catch{throw new ApiV07Error('BAD_REQUEST');}
  const path=op!.method==='GET'?op!.path.replace('{backtestId}',encodeURIComponent(String(values.backtestId))):op!.path;
  let response:Awaited<ReturnType<Transport['request']>>;
  try{response=await this.transport.request({method:op!.method,path,headers,...(op!.method==='POST'?{body:JSON.stringify(values)}:{}),credentials:'include',redirect:'manual',cache:'no-store'});}catch{throw new ApiV07Error('TRANSPORT_FAILED');}
  let body:any;
  try{
   const controls=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='cache-control');
   if(controls.length!==1||controls[0]![1].toLowerCase()!=='no-store'||typeof response.body!=='string')throw Error();
   body=strictParseApiV07(response.body);
  }catch{throw new ApiV07Error('INVALID_RESPONSE');}
  if(response.status!==op!.successStatus){
   if(!await validateApiV07(body,'common.schema.json#/$defs/ErrorEnvelope')||errors[body.error.code]!==response.status)throw new ApiV07Error('INVALID_RESPONSE');
   throw new ApiV07Error(body.error.code);
  }
  const etags=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='etag');
  if(etags.length!==1||!new RegExp(etagPattern).test(etags[0]![1])||!await validateApiV07(body,op!.responseSchema))throw new ApiV07Error('INVALID_RESPONSE');
  const data=body.data;
  if(op!.method==='POST'){
   if(data.strategyVersionId!==values.strategyVersionId||data.semanticHash!==values.expectedSemanticHash||data.profileId!==values.profileId)throw new ApiV07Error('BINDING_CONFLICT');
  }else if(data.backtestId!==values.backtestId)throw new ApiV07Error('BINDING_CONFLICT');
  return body as Operations[K]['response'];
 }
}
