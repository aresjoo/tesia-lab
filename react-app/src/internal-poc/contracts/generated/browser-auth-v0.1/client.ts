// Generated browser-observable Google client. Callback is server-only.
import type {GoogleAuthTransactionEnvelope,GoogleAuthResultEnvelope,GoogleAuthAcknowledgementEnvelope,VersionedMutationContext,ApiCallResult,TransportRequest,TransportResponse,ApiV02Transport,OperationInputMap,OperationOutputMap} from './google/types.js';
import {record,exact,validContext,validMeta,validTransaction,validResult,validAcknowledgement,epochMicros,values,ETAG,POLICY,ERROR_CODES} from './google/validator.js';
import {TesiaAppleAuthV04Client} from './apple/client.js';
import type {ApiV04Transport} from './apple/types.js';

export type GoogleBrowserOperationId='createGoogleAuthTransactionV2'|'getGoogleAuthResultV2'|'acknowledgeGoogleAuthResultV2';
export type BrowserAuthTransport=ApiV02Transport;
export class BrowserAuthError extends Error {
 constructor(readonly status:number,readonly code:string){super(code);this.name='BrowserAuthError';}
}
function invalid(status:number):never{throw new BrowserAuthError(status,'INVALID_BROWSER_AUTH_RESPONSE');}
function requestFor(operation:GoogleBrowserOperationId,input:unknown):TransportRequest{
 const common={credentials:'include' as const,redirect:'manual' as const};
 if(operation==='getGoogleAuthResultV2'){
  if(input!==undefined)throw new BrowserAuthError(0,'INVALID_OPERATION_INPUT');
  return{...common,method:'GET',path:'/api/v2/auth/google/results/current',headers:{}};
 }
 if(operation!=='createGoogleAuthTransactionV2'&&operation!=='acknowledgeGoogleAuthResultV2')throw new BrowserAuthError(0,'INVALID_OPERATION_INPUT');
 const start=operation==='createGoogleAuthTransactionV2';
 if(!record(input)||!exact(input,start?['context']:['resultId','context'])||!validContext(input.context))throw new BrowserAuthError(0,'INVALID_OPERATION_INPUT');
 if(!start&&(typeof input.resultId!=='string'||!/^oauth_result_[A-Za-z0-9_-]{12,80}$/.test(input.resultId)))throw new BrowserAuthError(0,'INVALID_OPERATION_INPUT');
 const context=input.context as VersionedMutationContext;
 return{...common,method:'POST',path:start?'/api/v2/auth/google/transactions':`/api/v2/auth/google/results/${String(input.resultId)}/acknowledgements`,headers:{'X-CSRF-Token':context.csrfToken,'Idempotency-Key':context.idempotencyKey,'If-Match':context.ifMatch}};
}
function validate(operation:GoogleBrowserOperationId,response:TransportResponse):OperationOutputMap[GoogleBrowserOperationId]{
 const status=response.status;
 if(!Number.isInteger(status)||status<100||status>599)invalid(0);
 const cache=values(response.headers,'Cache-Control');if(cache.length!==1||cache[0]!=='no-store')invalid(status);
 const body=response.body;
 if(status>=400){
  if(!record(body)||!exact(body,['meta','error'])||!validMeta(body.meta)||!record(body.error))invalid(status);
  const detail=body.error;
  if(!(exact(detail,['code','message'])||exact(detail,['code','message','field']))||typeof detail.code!=='string'||!ERROR_CODES.has(detail.code as never)||typeof detail.message!=='string'||detail.message.length<1||detail.message.length>240||(Object.hasOwn(detail,'field')&&(typeof detail.field!=='string'||detail.field.length>160||!/^\/(?:[A-Za-z0-9_~-]+\/?)*$/.test(detail.field)))||POLICY[operation][detail.code]!==status)invalid(status);
  throw new BrowserAuthError(status,detail.code);
 }
 if(operation==='createGoogleAuthTransactionV2'){
  if(status!==201||!validTransaction(body))invalid(status);
  return body;
 }
 const etags=values(response.headers,'ETag');if(etags.length!==1||!ETAG.test(etags[0]??''))invalid(status);
 if(operation==='getGoogleAuthResultV2'){
  if(status!==200||!validResult(body))invalid(status);
  const issued=epochMicros(body.data.issuedAt),expiry=epochMicros(body.data.expiresAt),tx=epochMicros(body.data.transactionExpiresAt);
  if(issued===null||expiry===null||tx===null||tx<=issued||expiry!==(issued+60_000_000n<tx?issued+60_000_000n:tx))invalid(status);
  return body;
 }
 if(status!==200||!validAcknowledgement(body))invalid(status);
 const issued=epochMicros(body.data.session.issuedAt),expiry=epochMicros(body.data.session.expiresAt);
 if(issued===null||expiry===null||expiry<=issued||body.data.session.sessionId===body.data.handoffReservation.initiatingSessionId)invalid(status);
 return body;
}
export class TesiaBrowserGoogleAuthClient{
 constructor(private readonly transport:BrowserAuthTransport){}
 async callWithResponse<K extends GoogleBrowserOperationId>(operation:K,input:OperationInputMap[K]):Promise<ApiCallResult<OperationOutputMap[K]>>{
  const request=requestFor(operation,input);let response:TransportResponse;
  try{response=await this.transport.request(request);}catch{throw new BrowserAuthError(0,'AUTH_TRANSPORT_FAILED');}
  try{
   const body=validate(operation,response) as OperationOutputMap[K];
   const headers:Record<string,string>={'Cache-Control':'no-store'};
   const etag=values(response.headers,'ETag');
   if(etag.length>0){if(etag.length!==1||!ETAG.test(etag[0]??''))invalid(response.status);headers.ETag=etag[0]!;}
   return{status:response.status,headers,body};
  }catch(error){if(error instanceof BrowserAuthError)throw error;throw new BrowserAuthError(0,'INVALID_BROWSER_AUTH_RESPONSE');}
 }
 async call<K extends GoogleBrowserOperationId>(operation:K,input:OperationInputMap[K]):Promise<OperationOutputMap[K]>{return(await this.callWithResponse(operation,input)).body;}
}
export interface GoogleBrowserAuthPort{
 createTransaction(context:VersionedMutationContext):Promise<ApiCallResult<GoogleAuthTransactionEnvelope>>;
 getCurrentResult():Promise<ApiCallResult<GoogleAuthResultEnvelope>>;
 acknowledgeResult(resultId:string,context:VersionedMutationContext):Promise<ApiCallResult<GoogleAuthAcknowledgementEnvelope>>;
}
export function createGoogleBrowserAuthPort(transport:BrowserAuthTransport):GoogleBrowserAuthPort{
 const client=new TesiaBrowserGoogleAuthClient(transport);
 return{createTransaction:context=>client.callWithResponse('createGoogleAuthTransactionV2',{context}),getCurrentResult:()=>client.callWithResponse('getGoogleAuthResultV2',undefined),acknowledgeResult:(resultId,context)=>client.callWithResponse('acknowledgeGoogleAuthResultV2',{resultId,context})};
}
export function createAppleBrowserAuthPort(transport:ApiV04Transport){
 const client=new TesiaAppleAuthV04Client(transport);
 return{createTransaction:(context:VersionedMutationContext)=>client.callWithResponse('createAppleAuthTransactionV4',{context}),getCurrentResult:()=>client.callWithResponse('getAppleAuthResultV4',undefined),acknowledgeResult:(resultId:string,context:VersionedMutationContext)=>client.callWithResponse('acknowledgeAppleAuthResultV4',{resultId,context})};
}
