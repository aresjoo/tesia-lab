// Generated Apple browser client. Provider callback is server-only.
import type {ApiV04Transport,OperationId,OperationInputMap,OperationOutputMap,ApiCallResult,TransportRequest,TransportResponse,ErrorCode} from './types.js';
import {record,exact,validMeta,validContext,validTransaction,validResult,validAcknowledgement,validAuthorization,epochMicros,values} from './validator.js';
const POLICY:Readonly<Record<string,Readonly<Record<string,number>>>>={
  "acknowledgeAppleAuthResultV4": {
    "AUTHENTICATION_REQUIRED": 401,
    "AUTH_BINDING_CONFLICT": 409,
    "AUTH_RESULT_EXPIRED": 410,
    "AUTH_TRANSACTION_EXPIRED": 410,
    "BAD_REQUEST": 400,
    "CSRF_INVALID": 403,
    "IDEMPOTENCY_IN_PROGRESS": 409,
    "IDEMPOTENCY_KEY_INVALID": 400,
    "IDEMPOTENCY_KEY_REUSED": 409,
    "INTERNAL_ERROR": 500,
    "INVALID_STATE_TRANSITION": 409,
    "NOT_FOUND": 404,
    "ORIGIN_INVALID": 403,
    "PRECONDITION_FAILED": 412,
    "PRECONDITION_REQUIRED": 428
  },
  "createAppleAuthTransactionV4": {
    "AUTHENTICATION_REQUIRED": 401,
    "AUTH_BINDING_CONFLICT": 409,
    "AUTH_TRANSACTION_CONFLICT": 409,
    "AUTH_TRANSACTION_EXPIRED": 410,
    "BAD_REQUEST": 400,
    "CSRF_INVALID": 403,
    "IDEMPOTENCY_IN_PROGRESS": 409,
    "IDEMPOTENCY_KEY_INVALID": 400,
    "IDEMPOTENCY_KEY_REUSED": 409,
    "INTERNAL_ERROR": 500,
    "INVALID_STATE_TRANSITION": 409,
    "ORIGIN_INVALID": 403,
    "PRECONDITION_FAILED": 412,
    "PRECONDITION_REQUIRED": 428
  },
  "getAppleAuthResultV4": {
    "AUTHENTICATION_REQUIRED": 401,
    "AUTH_BINDING_CONFLICT": 409,
    "AUTH_RESULT_EXPIRED": 410,
    "AUTH_RESULT_NOT_READY": 409,
    "AUTH_TRANSACTION_EXPIRED": 410,
    "INTERNAL_ERROR": 500,
    "NOT_FOUND": 404,
    "ORIGIN_INVALID": 403
  }
}
;
export class ApiV04ResponseError extends Error {constructor(readonly status:number,readonly code:ErrorCode|'INVALID_API_V04_RESPONSE'){super(code);}}
function invalid(status:number):never{throw new ApiV04ResponseError(status,'INVALID_API_V04_RESPONSE');}
function requestFor(operation:OperationId,input:unknown):TransportRequest{
 const common={credentials:'include' as const,redirect:'manual' as const};
 if(operation==='getAppleAuthResultV4'){if(input!==undefined)throw new Error('INVALID_OPERATION_INPUT');return{...common,method:'GET',path:'/api/v4/auth/apple/results/current',headers:{}};}
 if(operation!=='createAppleAuthTransactionV4'&&operation!=='acknowledgeAppleAuthResultV4')throw new Error('INVALID_OPERATION_INPUT');
 if(!record(input)||!exact(input,operation==='createAppleAuthTransactionV4'?['context']:['context','resultId'])||!validContext(input.context))throw new Error('INVALID_OPERATION_INPUT');
 const context=input.context as {csrfToken:string;idempotencyKey:string;ifMatch:string};
 if(operation==='acknowledgeAppleAuthResultV4'&&(typeof input.resultId!=='string'||!/^oauth_result_[A-Za-z0-9_-]{12,80}$/.test(input.resultId)))throw new Error('INVALID_OPERATION_INPUT');
 return{...common,method:'POST',path:operation==='createAppleAuthTransactionV4'?'/api/v4/auth/apple/transactions':`/api/v4/auth/apple/results/${String(input.resultId)}/acknowledgements`,headers:{'X-CSRF-Token':context.csrfToken,'Idempotency-Key':context.idempotencyKey,'If-Match':context.ifMatch}};
}
function responseBody(operation:OperationId,response:TransportResponse):OperationOutputMap[OperationId]{
 if(values(response.headers,'Cache-Control').length!==1||values(response.headers,'Cache-Control')[0]!=='no-store')invalid(response.status);
 const body=response.body;
 if(response.status>=400){
  if(!record(body)||!exact(body,['meta','error'])||!validMeta(body.meta)||!record(body.error)||!exact(body.error,['code','message'])||body.error.message!=='Authentication request failed.'||typeof body.error.code!=='string'||POLICY[operation]?.[body.error.code]!==response.status)invalid(response.status);
  throw new ApiV04ResponseError(response.status,body.error.code as ErrorCode);
 }
 if(operation==='createAppleAuthTransactionV4'){if(response.status!==201||!validTransaction(body)||!validAuthorization(body.data.authorizationRedirect))invalid(response.status);return body;}
 const etags=values(response.headers,'ETag');if(etags.length!==1||!/^"[A-Za-z0-9_-]{16,128}"$/.test(etags[0]??''))invalid(response.status);
 if(operation==='getAppleAuthResultV4'){
  if(response.status!==200||!validResult(body))invalid(response.status);
  const issued=epochMicros(body.data.issuedAt),expiry=epochMicros(body.data.expiresAt),tx=epochMicros(body.data.transactionExpiresAt);
  if(issued===null||expiry===null||tx===null||tx<=issued||expiry!==(issued+60_000_000n<tx?issued+60_000_000n:tx))invalid(response.status);return body;
 }
 if(response.status!==200||!validAcknowledgement(body))invalid(response.status);
 const data=body.data,issued=epochMicros(data.session.issuedAt),expiry=epochMicros(data.session.expiresAt);
 if(data.session.sessionId===data.handoffReservation.initiatingSessionId||issued===null||expiry===null||expiry<=issued)invalid(response.status);
 return body;
}
export class TesiaAppleAuthV04Client {
 constructor(private readonly transport:ApiV04Transport){}
 async callWithResponse<K extends OperationId>(operation:K,input:OperationInputMap[K]):Promise<ApiCallResult<OperationOutputMap[K]>>{
  const request=requestFor(operation,input); let response:TransportResponse;
  try{response=await this.transport.request(request);}catch{throw new Error('AUTH_TRANSPORT_FAILED');}
  const body=responseBody(operation,response) as OperationOutputMap[K];
  // Browser-available safe headers only; never expose raw transport headers or Set-Cookie.
  const headers:Record<string,string>={'Cache-Control':'no-store'};const etag=values(response.headers,'ETag')[0];if(etag!==undefined)headers.ETag=etag;
  return{status:response.status,headers,body};
 }
 async call<K extends OperationId>(operation:K,input:OperationInputMap[K]):Promise<OperationOutputMap[K]>{return(await this.callWithResponse(operation,input)).body;}
}
