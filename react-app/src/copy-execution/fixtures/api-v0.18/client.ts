import type * as Wire from './types.js';
import {strictParseApiV18,snapshotApiV18,validateApiV18,freezeApiV18} from './validator.js';
const manifest=[{"defaultLimit": 20, "errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "INTERNAL_ERROR", "NOT_FOUND", "RATE_LIMITED"], "method": "GET", "mutation": false, "operationId": "listVersions", "path": "/api/v1/copy-strategy-versions", "querySchema": "PageQuery", "requestSchema": null, "responseSchema": "VersionListResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "INTERNAL_ERROR", "NOT_FOUND", "RATE_LIMITED"], "method": "GET", "mutation": false, "operationId": "getVersion", "path": "/api/v1/copy-strategy-versions/{versionId}", "requestSchema": null, "responseSchema": "VersionResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "CSRF_INVALID", "CURRENT_POSITION_UNAVAILABLE", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INTERNAL_ERROR", "NOT_FOUND", "ORDER_RECONCILIATION_REQUIRED", "ORIGIN_INVALID", "PROVIDER_UNAVAILABLE", "RATE_LIMITED", "REVISION_CONFLICT", "RISK_LIMIT_REJECTED", "STRATEGY_NOT_APPROVED"], "method": "POST", "mutation": true, "operationId": "createCopy", "path": "/api/v1/strategy-copies", "requestSchema": "CreateCopyRequest", "responseSchema": "CopyResponse", "successStatus": 201}, {"defaultLimit": 20, "errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "INTERNAL_ERROR", "NOT_FOUND", "RATE_LIMITED"], "method": "GET", "mutation": false, "operationId": "listCopies", "path": "/api/v1/strategy-copies", "querySchema": "PageQuery", "requestSchema": null, "responseSchema": "CopyListResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "INTERNAL_ERROR", "NOT_FOUND", "RATE_LIMITED"], "method": "GET", "mutation": false, "operationId": "getCopy", "path": "/api/v1/strategy-copies/{subscriptionId}", "requestSchema": null, "responseSchema": "CopyResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "CSRF_INVALID", "CURRENT_POSITION_UNAVAILABLE", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INTERNAL_ERROR", "NOT_FOUND", "ORDER_RECONCILIATION_REQUIRED", "ORIGIN_INVALID", "PROVIDER_UNAVAILABLE", "RATE_LIMITED", "REVISION_CONFLICT", "RISK_LIMIT_REJECTED", "STRATEGY_NOT_APPROVED"], "method": "PATCH", "mutation": true, "operationId": "updateCopy", "path": "/api/v1/strategy-copies/{subscriptionId}", "requestSchema": "UpdateCopyRequest", "responseSchema": "CopyResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "CSRF_INVALID", "CURRENT_POSITION_UNAVAILABLE", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INTERNAL_ERROR", "NOT_FOUND", "ORDER_RECONCILIATION_REQUIRED", "ORIGIN_INVALID", "PROVIDER_UNAVAILABLE", "RATE_LIMITED", "REVISION_CONFLICT", "RISK_LIMIT_REJECTED", "STRATEGY_NOT_APPROVED"], "method": "POST", "mutation": true, "operationId": "startCopy", "path": "/api/v1/strategy-copies/{subscriptionId}/start", "requestSchema": "StartCopyRequest", "responseSchema": "CopyResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "CSRF_INVALID", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INTERNAL_ERROR", "NOT_FOUND", "ORIGIN_INVALID", "RATE_LIMITED"], "method": "POST", "mutation": true, "operationId": "pauseCopy", "path": "/api/v1/strategy-copies/{subscriptionId}/pause", "requestSchema": "PauseCopyRequest", "responseSchema": "CopyResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "CSRF_INVALID", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INTERNAL_ERROR", "NOT_FOUND", "ORIGIN_INVALID", "RATE_LIMITED"], "method": "POST", "mutation": true, "operationId": "stopCopy", "path": "/api/v1/strategy-copies/{subscriptionId}/stop", "requestSchema": "StopCopyRequest", "responseSchema": "CopyResponse", "successStatus": 200}, {"errorCodes": ["AUTHENTICATION_REQUIRED", "BAD_REQUEST", "CSRF_INVALID", "CURRENT_POSITION_UNAVAILABLE", "EXECUTION_UNAVAILABLE", "FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INTERNAL_ERROR", "NOT_FOUND", "ORDER_RECONCILIATION_REQUIRED", "ORIGIN_INVALID", "PROVIDER_UNAVAILABLE", "RATE_LIMITED", "REVISION_CONFLICT", "RISK_LIMIT_REJECTED", "STRATEGY_NOT_APPROVED"], "method": "POST", "mutation": true, "operationId": "closeCopy", "path": "/api/v1/strategy-copies/{subscriptionId}/close", "requestSchema": "CloseCopyRequest", "responseSchema": "CopyResponse", "successStatus": 200}];
const statusByCode:Record<string,number>={"AUTHENTICATION_REQUIRED": 401, "BAD_REQUEST": 400, "CSRF_INVALID": 403, "CURRENT_POSITION_UNAVAILABLE": 409, "EXECUTION_UNAVAILABLE": 503, "FORBIDDEN": 403, "IDEMPOTENCY_CONFLICT": 409, "INTERNAL_ERROR": 500, "NOT_FOUND": 404, "ORDER_RECONCILIATION_REQUIRED": 409, "ORIGIN_INVALID": 403, "PROVIDER_UNAVAILABLE": 503, "RATE_LIMITED": 429, "REVISION_CONFLICT": 409, "RISK_LIMIT_REJECTED": 409, "STRATEGY_NOT_APPROVED": 409};
export type ReadOptions=Readonly<{signal?:AbortSignal}>;
export type PageOptions=Readonly<{signal?:AbortSignal;limit?:number;cursor?:string}>;
export type CopyBinding=Readonly<{connectionId:string;versionId:string;policyHash:string;environment:Wire.Environment;startMode:Wire.StartMode}>;
export type MutationOptions=Readonly<{csrfToken:string;idempotencyKey:string;signal?:AbortSignal;expectedBinding?:CopyBinding}>;
export interface BitgetCopyTransport {
 request(input:Readonly<{method:'GET'|'POST'|'PATCH';path:string;headers:Readonly<Record<string,string>>;body?:string;credentials:'include';redirect:'manual';cache:'no-store';signal?:AbortSignal}>):Promise<{status:number;headers:ReadonlyArray<readonly [string,string]>;body:string}>;
}
export class ApiV18Error extends Error {
 constructor(public readonly code:Wire.ErrorCode|'INVALID_REQUEST'|'INVALID_RESPONSE'|'TRANSPORT_FAILED'|'ABORTED',public readonly status=0){super(code);this.name='ApiV18Error';}
}
const idValid=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9_-]{16,128}$(?![\s\S])/.test(id);
function decimalEqual(a:string,b:string):boolean{const normalize=(n:string)=>n.includes('.')?n.replace(/0+$/,'').replace(/\.$/,''):n;return normalize(a)===normalize(b);}
export class TesiaBitgetCopyV18Client {
 constructor(private readonly transport:BitgetCopyTransport){}
 async listVersions(options:PageOptions={}):Promise<Wire.DeepReadonly<Wire.VersionListResponse>>{return await this.invoke("listVersions",undefined,undefined,options) as Wire.DeepReadonly<Wire.VersionListResponse>;}
 async getVersion(versionId:string,options:ReadOptions={}):Promise<Wire.DeepReadonly<Wire.VersionResponse>>{return await this.invoke("getVersion",versionId,undefined,options) as Wire.DeepReadonly<Wire.VersionResponse>;}
 async createCopy(input:Wire.CreateCopyRequest,options:MutationOptions):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("createCopy",undefined,input,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 async listCopies(options:PageOptions={}):Promise<Wire.DeepReadonly<Wire.CopyListResponse>>{return await this.invoke("listCopies",undefined,undefined,options) as Wire.DeepReadonly<Wire.CopyListResponse>;}
 async getCopy(subscriptionId:string,options:ReadOptions={}):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("getCopy",subscriptionId,undefined,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 async updateCopy(subscriptionId:string,input:Wire.UpdateCopyRequest,options:MutationOptions):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("updateCopy",subscriptionId,input,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 async startCopy(subscriptionId:string,input:Wire.StartCopyRequest,options:MutationOptions):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("startCopy",subscriptionId,input,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 async pauseCopy(subscriptionId:string,input:Wire.PauseCopyRequest,options:MutationOptions):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("pauseCopy",subscriptionId,input,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 async stopCopy(subscriptionId:string,input:Wire.StopCopyRequest,options:MutationOptions):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("stopCopy",subscriptionId,input,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 async closeCopy(subscriptionId:string,input:Wire.CloseCopyRequest,options:MutationOptions):Promise<Wire.DeepReadonly<Wire.CopyResponse>>{return await this.invoke("closeCopy",subscriptionId,input,options) as Wire.DeepReadonly<Wire.CopyResponse>;}
 private async invoke(operationId:string,id:string|undefined,input:unknown,options:ReadOptions|PageOptions|MutationOptions):Promise<unknown>{
  const operation=manifest.find(row=>row.operationId===operationId)!;
  let signal:AbortSignal|undefined,request:any,binding:any,page:any={},headers:Record<string,string>={Accept:'application/json'};
  try{
   if(operation.path.includes('{')&&!idValid(id)||!operation.path.includes('{')&&id!==undefined)throw Error();
   if(!options||typeof options!=='object'||Object.getPrototypeOf(options)!==Object.prototype)throw Error();
   const descriptors=Object.getOwnPropertyDescriptors(options),allowed=operation.mutation?['signal','csrfToken','idempotencyKey','expectedBinding']:Object.hasOwn(operation,'querySchema')?['signal','limit','cursor']:['signal'];
   if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!allowed.includes(key)))throw Error();
   for(const property of Object.values(descriptors))if(!property.enumerable||!Object.hasOwn(property,'value'))throw Error();
   if(descriptors.signal)signal=descriptors.signal.value;
   if(signal!==undefined&&(typeof AbortSignal==='undefined'||!(signal instanceof AbortSignal)))throw Error();
   if(operation.mutation){
    const csrf=descriptors.csrfToken?.value,key=descriptors.idempotencyKey?.value;
    if(typeof csrf!=='string'||!/^[A-Za-z0-9_-]{16,512}$(?![\s\S])/.test(csrf)||!idValid(key))throw Error();
    headers={...headers,'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':key};
    request=snapshotApiV18(input,true);if(!validateApiV18(request,operation.requestSchema!))throw Error();
    if(descriptors.expectedBinding){binding=snapshotApiV18(descriptors.expectedBinding.value);if(Object.keys(binding).sort().join(',')!=='connectionId,environment,policyHash,startMode,versionId'||!idValid(binding.connectionId)||!idValid(binding.versionId)||!/^[a-f0-9]{64}$/.test(binding.policyHash)||!['demo','production'].includes(binding.environment)||!['current_position','next_signal'].includes(binding.startMode))throw Error();}
   }else if(input!==undefined)throw Error();
   if(Object.hasOwn(operation,'querySchema')){for(const key of ['limit','cursor'])if(descriptors[key])page[key]=descriptors[key].value;if(!validateApiV18(page,'PageQuery'))throw Error();}
  }catch{throw new ApiV18Error('INVALID_REQUEST');}
  if(signal?.aborted)throw new ApiV18Error('ABORTED');
  const parameters=new URLSearchParams();if(page.limit!==undefined)parameters.set('limit',String(page.limit));if(page.cursor!==undefined)parameters.set('cursor',page.cursor);
  const query=parameters.toString();
  const path=operation.path.replace(/\{(?:versionId|subscriptionId)\}/,id??'')+(query?'?'+query:'');
  const transportInput=Object.freeze({method:operation.method as 'GET'|'POST'|'PATCH',path,headers:Object.freeze(headers),credentials:'include' as const,redirect:'manual' as const,cache:'no-store' as const,...(operation.mutation?{body:JSON.stringify(request)}:{}),...(signal===undefined?{}:{signal})});
  let response:Awaited<ReturnType<BitgetCopyTransport['request']>>;
  try{response=await this.transport.request(transportInput);}catch{throw new ApiV18Error(signal?.aborted?'ABORTED':'TRANSPORT_FAILED');}
  if(signal?.aborted)throw new ApiV18Error('ABORTED');
  let body:any,status:number=0;
  try{
   status=response.status;if(!Number.isInteger(status)||status<200||status>599||status>=300&&status<400)throw Error();
   if(!Array.isArray(response.headers))throw Error();const headers=new Map<string,string>();
   for(const pair of response.headers){
    if(!Array.isArray(pair)||pair.length!==2)throw Error();const [name,value]=pair;
    if(typeof name!=='string'||typeof value!=='string'||!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)||/[\r\n]/.test(value))throw Error();
    const key=name.toLowerCase();if(['content-type','cache-control','location','www-authenticate'].includes(key)){if(headers.has(key))throw Error();headers.set(key,value);}
   }
   if(headers.get('cache-control')!=='no-store'||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get('content-type')??'')||headers.has('location')||headers.has('www-authenticate'))throw Error();
   body=strictParseApiV18(response.body);
  }catch{throw new ApiV18Error('INVALID_RESPONSE',Number.isInteger(status)&&status>=200&&status<=599?status:0);}
  if(status!==operation.successStatus){
   if(!validateApiV18(body,'ErrorEnvelope')||statusByCode[(body as Wire.ErrorEnvelope).error.code]!==status)throw new ApiV18Error('INVALID_RESPONSE',status);
   if(!operation.errorCodes.includes(body.error.code))throw new ApiV18Error('INVALID_RESPONSE',status);
   throw new ApiV18Error((body as Wire.ErrorEnvelope).error.code,status);
  }
  if(!validateApiV18(body,operation.responseSchema))throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='getVersion'&&body.data.versionId!==id||id!==undefined&&operationId!=='getVersion'&&body.data.subscriptionId!==id)throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='createCopy'){
   for(const key of ['connectionId','versionId','environment','startMode'])if(body.data[key]!==request[key])throw new ApiV18Error('INVALID_RESPONSE',status);
  }
  if(operationId==='createCopy'||operationId==='updateCopy'){
   for(const key of ['allocationUsdt','maxLossUsdt','maxPositionFraction'])if(!decimalEqual(body.data[key],request[key]))throw new ApiV18Error('INVALID_RESPONSE',status);
  }
  if(Object.hasOwn(operation,'querySchema')&&(body.data.length>(page.limit??20)||body.nextCursor!==null&&body.nextCursor===page.cursor))throw new ApiV18Error('INVALID_RESPONSE',status);
  if(binding)for(const key of Object.keys(binding))if(body.data[key]!==binding[key])throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='createCopy'&&(body.data.revision!==0||body.data.state!==(request.startMode==='current_position'&&!body.data.currentPositionAvailable?'PENDING_CURRENT_POSITION':'CREATED')))throw new ApiV18Error('INVALID_RESPONSE',status);
  if(['updateCopy','startCopy','closeCopy'].includes(operationId)&&body.data.revision!==request.expectedRevision+1)throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='updateCopy'&&!['CREATED','PENDING_CURRENT_POSITION','ACTIVE','PAUSED'].includes(body.data.state))throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='startCopy'&&body.data.state!=='ACTIVE')throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='pauseCopy'&&!['PAUSED','STOPPING','STOPPED'].includes(body.data.state)||operationId==='stopCopy'&&!['STOPPING','STOPPED'].includes(body.data.state))throw new ApiV18Error('INVALID_RESPONSE',status);
  if(operationId==='closeCopy'&&(!['PAUSED','STOPPING','STOPPED'].includes(body.data.state)||!['PENDING','COMPLETE'].includes(body.data.closeStatus)))throw new ApiV18Error('INVALID_RESPONSE',status);
  return freezeApiV18(body);
 }
}
