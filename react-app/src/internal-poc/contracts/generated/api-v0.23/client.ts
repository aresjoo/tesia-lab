// Generated same-origin client. Trusted session, grant, custody and permissions remain host authority.
import type {StartRequest,CancelRequest,StartResponse,TransactionResponse,CancelResponse,ConnectionListResponse,AccountResponse,ErrorEnvelope,ErrorCode,SchemaName,DeepReadonly} from './types.js';
import {snapshotApiV23,strictParseApiV23,validateApiV23,freezeApiV23} from './validator.js';
export type ReadOptions=Readonly<{signal?:AbortSignal}>;
export type MutationOptions=Readonly<{csrfToken:string;signal?:AbortSignal}>;
export type ApiV23TransportInput=Readonly<{method:'GET'|'POST';path:string;headers:Readonly<Record<string,string>>;body?:string;credentials:'include';mode:'same-origin';redirect:'manual';cache:'no-store';signal?:AbortSignal}>;
export interface GateBrokerV23Transport {request(input:ApiV23TransportInput):Promise<{status:number;headers:ReadonlyArray<readonly [string,string]>;body:string}>}
export class ApiV23Error extends Error {constructor(public readonly code:ErrorCode|'INVALID_REQUEST'|'INVALID_RESPONSE'|'TRANSPORT_FAILED'|'ABORTED',public readonly status=0){super(code);this.name='ApiV23Error'}}
const base='/api/v1/gate-broker-connections';
function descriptors(value:unknown,allowed:readonly string[]):Record<string,PropertyDescriptor>{if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error();const found=Object.getOwnPropertyDescriptors(value);for(const key of Reflect.ownKeys(found)){if(typeof key!=='string'||!allowed.includes(key))throw Error();const part=found[key]!;if(!part.enumerable||!Object.hasOwn(part,'value'))throw Error()}return found}
function options(value:ReadOptions|MutationOptions,mutation=false):{headers:Record<string,string>;signal?:AbortSignal}{const found=descriptors(value,mutation?['csrfToken','signal']:['signal']),headers:Record<string,string>={Accept:'application/json'};if(mutation){const token:unknown=found.csrfToken?.value;if(typeof token!=='string'||!/^[\x21-\x7e]{1,512}$(?![\s\S])/.test(token))throw Error();headers['Content-Type']='application/json';headers['X-CSRF-Token']=token}const signal=found.signal?.value;if(signal!==undefined&&(typeof AbortSignal==='undefined'||!(signal instanceof AbortSignal)))throw Error();return signal===undefined?{headers}:{headers,signal}}
function input(method:'GET'|'POST',path:string,opts:{headers:Record<string,string>;signal?:AbortSignal},body?:string):ApiV23TransportInput{return Object.freeze({method,path,headers:Object.freeze(opts.headers),credentials:'include' as const,mode:'same-origin' as const,redirect:'manual' as const,cache:'no-store' as const,...(body===undefined?{}:{body}),...(opts.signal===undefined?{}:{signal:opts.signal})})}
function transactionId(value:unknown):value is string{return typeof value==='string'&&/^[0-9a-f]{32}$(?![\s\S])/.test(value)}
function connectionId(value:unknown):value is string{return typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$(?![\s\S])/.test(value)}
export class TesiaGateBrokerV23Client {
 constructor(private readonly transport:GateBrokerV23Transport){}
 private async send<T>(request:ApiV23TransportInput,schema:SchemaName,echo:(value:any)=>boolean):Promise<DeepReadonly<T>> {
  const signal=request.signal;if(signal?.aborted)throw new ApiV23Error('ABORTED');
  let response:Awaited<ReturnType<GateBrokerV23Transport['request']>>;
  try{response=await this.transport.request(request)}catch{throw new ApiV23Error(signal?.aborted?'ABORTED':'TRANSPORT_FAILED')}
  if(signal?.aborted)throw new ApiV23Error('ABORTED');
  let value:any,status:number;
  try{
   status=response.status;if(!Number.isInteger(status)||status<200||status>599||status>=300&&status<400)throw Error();
   if(!Array.isArray(response.headers)||response.headers.length>256)throw Error();const headers=new Map<string,string>();
   for(const pair of response.headers){if(!Array.isArray(pair)||pair.length!==2)throw Error();const [name,entry]=pair;if(typeof name!=='string'||typeof entry!=='string'||name.length>256||entry.length>8192||!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)||/[\r\n]/.test(entry))throw Error();const key=name.toLowerCase();if(['content-type','cache-control','referrer-policy','location','www-authenticate'].includes(key)){if(headers.has(key))throw Error();headers.set(key,entry)}}
   if(headers.get('cache-control')!=='no-store'||headers.get('referrer-policy')!=='no-referrer'||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get('content-type')??'')||headers.has('location')||headers.has('www-authenticate'))throw Error();
   value=strictParseApiV23(response.body);
  }catch{throw new ApiV23Error('INVALID_RESPONSE')}
  if(status!==200){if(status<400||!validateApiV23(value,'ErrorEnvelope'))throw new ApiV23Error('INVALID_RESPONSE',status);throw new ApiV23Error((value as ErrorEnvelope).error.code,status)}
  try{if(!validateApiV23(value,schema)||!echo(value))throw Error()}catch{throw new ApiV23Error('INVALID_RESPONSE',status)}
  if(signal?.aborted)throw new ApiV23Error('ABORTED');return freezeApiV23(value) as DeepReadonly<T>;
 }
 async start(request:StartRequest,opts:MutationOptions):Promise<DeepReadonly<StartResponse>> {
  let captured:StartRequest,values;try{captured=snapshotApiV23(request) as StartRequest;if(!validateApiV23(captured,'StartRequest'))throw Error();values=options(opts,true)}catch{throw new ApiV23Error('INVALID_REQUEST')}
  return this.send(input('POST',base+'/transactions',values,JSON.stringify(captured)),'StartResponse',value=>value.data.environment===captured.environment);
 }
 async get(id:string,opts:ReadOptions={}):Promise<DeepReadonly<TransactionResponse>> {
  let values;try{if(!transactionId(id))throw Error();values=options(opts)}catch{throw new ApiV23Error('INVALID_REQUEST')}
  return this.send(input('GET',base+'/transactions/'+id,values),'TransactionResponse',value=>value.data.transactionId===id);
 }
 async cancel(id:string,request:CancelRequest,opts:MutationOptions):Promise<DeepReadonly<CancelResponse>> {
  let captured:CancelRequest,values;try{if(!transactionId(id))throw Error();captured=snapshotApiV23(request) as CancelRequest;if(!validateApiV23(captured,'CancelRequest'))throw Error();values=options(opts,true)}catch{throw new ApiV23Error('INVALID_REQUEST')}
  return this.send(input('POST',base+'/transactions/'+id+'/cancel',values,JSON.stringify(captured)),'CancelResponse',value=>value.data.transactionId===id);
 }
 async list(opts:ReadOptions={}):Promise<DeepReadonly<ConnectionListResponse>> {
  let values;try{values=options(opts)}catch{throw new ApiV23Error('INVALID_REQUEST')}
  return this.send(input('GET',base,values),'ConnectionListResponse',()=>true);
 }
 async account(id:string,opts:ReadOptions={}):Promise<DeepReadonly<AccountResponse>> {
  let values;try{if(!connectionId(id))throw Error();values=options(opts)}catch{throw new ApiV23Error('INVALID_REQUEST')}
  return this.send(input('GET',base+'/'+id+'/account',values),'AccountResponse',value=>value.data.connectionId===id);
 }
}
