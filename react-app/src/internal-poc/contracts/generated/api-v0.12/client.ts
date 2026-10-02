// Generated injected transport client. No network global or credential storage.
import type {StartRequest,CatalogResponse,TransactionResponse,ConnectionsResponse,DisconnectResponse,ErrorEnvelope,ErrorCode,DeepReadonly} from './types.js';
import {strictParseApiV12,snapshotApiV12,validateApiV12,freezeApiV12} from './validator.js';
const operationManifest={"apiContractVersion":"0.12.0","maxRequestBytes":8192,"maxResponseBytes":262144,"operations":[{"method":"GET","name":"catalog","path":"/api/v1/exchange-connections/catalog","response":"CatalogResponse"},{"method":"POST","name":"start","path":"/api/v1/exchange-connections/transactions","request":"StartRequest","response":"TransactionResponse"},{"method":"GET","name":"transaction","path":"/api/v1/exchange-connections/transactions/{transactionId}","response":"TransactionResponse"},{"method":"GET","name":"connections","path":"/api/v1/exchange-connections/","response":"ConnectionsResponse"},{"method":"DELETE","name":"disconnect","path":"/api/v1/exchange-connections/{connectionId}","response":"DisconnectResponse"},{"method":"DELETE","name":"cancel","path":"/api/v1/exchange-connections/transactions/{transactionId}","response":"TransactionResponse"}],"statusByCode":{"ACCOUNT_CONFLICT":409,"AUTHENTICATION_REQUIRED":401,"BAD_REQUEST":400,"CSRF_INVALID":403,"FORBIDDEN":403,"INTERNAL_ERROR":500,"NOT_FOUND":404,"ORIGIN_INVALID":403,"PERMISSION_REJECTED":403,"PROVIDER_FAILED":502,"PROVIDER_UNAVAILABLE":503,"RATE_LIMITED":429,"TRANSACTION_EXPIRED":410,"TRANSACTION_REPLAYED":409}};
const statusByCode:Record<string,number>={"ACCOUNT_CONFLICT":409,"AUTHENTICATION_REQUIRED":401,"BAD_REQUEST":400,"CSRF_INVALID":403,"FORBIDDEN":403,"INTERNAL_ERROR":500,"NOT_FOUND":404,"ORIGIN_INVALID":403,"PERMISSION_REJECTED":403,"PROVIDER_FAILED":502,"PROVIDER_UNAVAILABLE":503,"RATE_LIMITED":429,"TRANSACTION_EXPIRED":410,"TRANSACTION_REPLAYED":409};
export interface ExchangeConnectionsTransport {
 request(input:Readonly<{method:'GET'|'POST'|'DELETE';path:string;headers:Readonly<Record<string,string>>;body?:string;credentials:'include';redirect:'manual';cache:'no-store'}>):Promise<{status:number;headers:ReadonlyArray<readonly [string,string]>;body:string}>;
}
export class ApiV12Error extends Error {
 constructor(public readonly code:ErrorCode|'INVALID_REQUEST'|'INVALID_RESPONSE'|'TRANSPORT_FAILED',public readonly status=0){super(code);this.name='ApiV12Error';}
}
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$(?![\s\S])/.test(value);
export class TesiaExchangeConnectionsV12Client {
 constructor(private readonly transport:ExchangeConnectionsTransport){}
 catalog():Promise<DeepReadonly<CatalogResponse>>{return this.call('catalog');}
 start(request:StartRequest,csrfToken:string):Promise<DeepReadonly<TransactionResponse>>{return this.call('start',undefined,request,csrfToken);}
 transaction(transactionId:string):Promise<DeepReadonly<TransactionResponse>>{return this.call('transaction',transactionId);}
 connections():Promise<DeepReadonly<ConnectionsResponse>>{return this.call('connections');}
 cancel(transactionId:string,csrfToken:string):Promise<DeepReadonly<TransactionResponse>>{return this.call('cancel',transactionId,undefined,csrfToken);}
 disconnect(connectionId:string,csrfToken:string):Promise<DeepReadonly<DisconnectResponse>>{return this.call('disconnect',connectionId,undefined,csrfToken);}
 private async call<T>(name:string,identifier?:string,request?:StartRequest,csrfToken?:string):Promise<DeepReadonly<T>>{
  let input:Parameters<ExchangeConnectionsTransport['request']>[0],captured:StartRequest|undefined;
  const op=operationManifest.operations.find(value=>value.name===name)!;
  try{
   let path:string=op.path;
   if(path.includes('{')){if(!id(identifier))throw Error();path=path.replace(/\{(?:transactionId|connectionId)\}/,identifier);}
   const headers:Record<string,string>={Accept:'application/json'};
   const method=op.method as 'GET'|'POST'|'DELETE';
   if(method!=='GET'){
    if(typeof csrfToken!=='string'||!/^[A-Za-z0-9_-]{16,256}$(?![\s\S])/.test(csrfToken))throw Error();
    headers['X-CSRF-Token']=csrfToken;
   }
   let body:string|undefined;
   if(name==='start'){
    captured=snapshotApiV12(request,true) as StartRequest;
    if(!validateApiV12(captured,'StartRequest'))throw Error();
    body=JSON.stringify(captured);headers['Content-Type']='application/json';
   }
   input=Object.freeze({method,path,headers:Object.freeze(headers),...(body===undefined?{}:{body}),credentials:'include',redirect:'manual',cache:'no-store'});
  }catch{throw new ApiV12Error('INVALID_REQUEST');}
  let response:Awaited<ReturnType<ExchangeConnectionsTransport['request']>>;
  try{response=await this.transport.request(input);}catch{throw new ApiV12Error('TRANSPORT_FAILED');}
  let body:any,status:number;
  try{
   status=response.status;
   if(!Number.isInteger(status)||status<200||status>599||status>=300&&status<400)throw Error();
   if(!Array.isArray(response.headers))throw Error();
   const headers=new Map<string,string>();
   for(const pair of response.headers){
    if(!Array.isArray(pair)||pair.length!==2)throw Error();
    const [name,value]=pair;
    if(typeof name!=='string'||typeof value!=='string'||!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)||/[\r\n]/.test(value))throw Error();
    const key=name.toLowerCase();
    if(['content-type','cache-control','location','www-authenticate'].includes(key)){if(headers.has(key))throw Error();headers.set(key,value);}
   }
   if(headers.get('cache-control')!=='no-store'||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get('content-type')??'')||headers.has('location')||headers.has('www-authenticate'))throw Error();
   body=strictParseApiV12(response.body);
  }catch{throw new ApiV12Error('INVALID_RESPONSE');}
  if(status!==200){
   if(!validateApiV12(body,'ErrorEnvelope')||statusByCode[(body as ErrorEnvelope).error.code]!==status)throw new ApiV12Error('INVALID_RESPONSE',status);
   throw new ApiV12Error((body as ErrorEnvelope).error.code,status);
  }
  if(!validateApiV12(body,op.response))throw new ApiV12Error('INVALID_RESPONSE',status);
  if(captured!==undefined&&body.data.exchangeId!==captured.exchangeId||name==='transaction'&&body.data.transactionId!==identifier||name==='cancel'&&(body.data.transactionId!==identifier||!['cancelled','expired'].includes(body.data.status))||name==='disconnect'&&body.data.connectionId!==identifier)throw new ApiV12Error('INVALID_RESPONSE',status);
  return freezeApiV12(body) as DeepReadonly<T>;
 }
}
