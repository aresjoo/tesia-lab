// Generated read-only client. Injected transport only; no session mutation or key storage.
import type {AccountResponse,ErrorEnvelope,ErrorCode,DeepReadonly} from './types.js';
import {strictParseApiV17,validateApiV17,freezeApiV17} from './validator.js';
const statusByCode:Record<string,number>={"ACCOUNT_CONFLICT":409,"AUTHENTICATION_REQUIRED":401,"BAD_REQUEST":400,"CSRF_INVALID":403,"FORBIDDEN":403,"INTERNAL_ERROR":500,"NOT_FOUND":404,"ORIGIN_INVALID":403,"PERMISSION_REJECTED":403,"PROVIDER_FAILED":502,"PROVIDER_UNAVAILABLE":503,"RATE_LIMITED":429,"TRANSACTION_EXPIRED":410,"TRANSACTION_REPLAYED":409};
export interface BitgetAccountTransport {
 request(input:Readonly<{method:'GET';path:string;headers:Readonly<Record<string,string>>;credentials:'include';redirect:'manual';cache:'no-store';signal?:AbortSignal}>):Promise<{status:number;headers:ReadonlyArray<readonly [string,string]>;body:string}>;
}
export class ApiV17Error extends Error {
 constructor(public readonly code:ErrorCode|'INVALID_REQUEST'|'INVALID_RESPONSE'|'TRANSPORT_FAILED'|'ABORTED',public readonly status=0){super(code);this.name='ApiV17Error';}
}
export class TesiaBitgetAccountV17Client {
 constructor(private readonly transport:BitgetAccountTransport){}
 async account(connectionId:string,options:Readonly<{signal?:AbortSignal}>={}):Promise<DeepReadonly<AccountResponse>>{
  let signal:AbortSignal|undefined;
  try{
   if(typeof connectionId!=='string'||!/^[A-Za-z0-9_-]{16,128}$(?![\s\S])/.test(connectionId))throw Error();
   if(!options||typeof options!=='object'||Object.getPrototypeOf(options)!==Object.prototype)throw Error();
   const descriptors=Object.getOwnPropertyDescriptors(options);
   if(Reflect.ownKeys(descriptors).some(key=>key!=='signal'))throw Error();
   if(descriptors.signal){if(!Object.hasOwn(descriptors.signal,'value'))throw Error();signal=descriptors.signal.value as AbortSignal|undefined;}
   if(signal!==undefined&&(typeof AbortSignal==='undefined'||!(signal instanceof AbortSignal)))throw Error();
  }catch{throw new ApiV17Error('INVALID_REQUEST');}
  if(signal?.aborted)throw new ApiV17Error('ABORTED');
  const input=Object.freeze({method:'GET' as const,path:'/api/v1/exchange-connections/'+connectionId+'/account',headers:Object.freeze({Accept:'application/json'}),credentials:'include' as const,redirect:'manual' as const,cache:'no-store' as const,...(signal===undefined?{}:{signal})});
  let response:Awaited<ReturnType<BitgetAccountTransport['request']>>;
  try{response=await this.transport.request(input);}catch{throw new ApiV17Error(signal?.aborted?'ABORTED':'TRANSPORT_FAILED');}
  if(signal?.aborted)throw new ApiV17Error('ABORTED');
  let body:any,status:number;
  try{
   status=response.status;
   if(!Number.isInteger(status)||status<200||status>599||status>=300&&status<400)throw Error();
   if(!Array.isArray(response.headers))throw Error();
   const headers=new Map<string,string>();
   for(const pair of response.headers){
    if(!Array.isArray(pair)||pair.length!==2)throw Error();const [name,value]=pair;
    if(typeof name!=='string'||typeof value!=='string'||!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)||/[\r\n]/.test(value))throw Error();
    const key=name.toLowerCase();
    if(['content-type','cache-control','location','www-authenticate'].includes(key)){if(headers.has(key))throw Error();headers.set(key,value);}
   }
   if(headers.get('cache-control')!=='no-store'||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get('content-type')??'')||headers.has('location')||headers.has('www-authenticate'))throw Error();
   body=strictParseApiV17(response.body);
  }catch{throw new ApiV17Error('INVALID_RESPONSE');}
  if(status!==200){
   if(!validateApiV17(body,'ErrorEnvelope')||statusByCode[(body as ErrorEnvelope).error.code]!==status)throw new ApiV17Error('INVALID_RESPONSE',status);
   throw new ApiV17Error((body as ErrorEnvelope).error.code,status);
  }
  if(!validateApiV17(body,'AccountResponse')||body.data.connectionId!==connectionId)throw new ApiV17Error('INVALID_RESPONSE',status);
  return freezeApiV17(body) as DeepReadonly<AccountResponse>;
 }
}
