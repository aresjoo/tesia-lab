
import {strictParseApiV06,validateApiV06} from './validator.js';
import type {Operations} from './types.js';
const operations=[{"operationId":"getNativeReportV6","method":"GET","path":"/api/v6/backtests/{backtestId}/native-report","requestSchema":"native-report.schema.json#/$defs/ReportRequest","responseSchema":"native-report.schema.json#/$defs/NativeReportEnvelope","pathField":"backtestId"},{"operationId":"getNativeTradesV6","method":"GET","path":"/api/v6/backtests/{backtestId}/native-trades","requestSchema":"native-trades.schema.json#/$defs/TradesRequest","responseSchema":"native-trades.schema.json#/$defs/NativeTradesEnvelope","pathField":"backtestId","defaultLimit":50,"maximumLimit":100}] as const;
const errors:Record<string,number>={"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"NOT_READY":409,"CURSOR_INVALID":409,"BINDING_CONFLICT":409,"SOURCE_VERIFICATION_FAILED":409,"INTERNAL_ERROR":500};
export interface Transport{
 request(request:{method:'GET';path:string;headers:Readonly<Record<string,string>>;credentials:'include';redirect:'manual';cache:'no-store'}):Promise<{status:number;headers:Record<string,string>;body:string}>;
}
export class ApiV06Error extends Error{constructor(readonly code:string){super(code);this.name='ApiV06Error';}}
export class TesiaNativeResultsV06Client{
 constructor(private readonly transport:Transport){}
 async call<K extends keyof Operations>(operation:K,request:Operations[K]['request']):Promise<Operations[K]['response']>{
  const op=operations.find(x=>x.operationId===operation);
  let values:Record<string,unknown>;
  try{const snapshot=JSON.stringify(request);if(!op||!await validateApiV06(request,op.requestSchema))throw Error();values=strictParseApiV06(snapshot) as Record<string,unknown>;if(!await validateApiV06(values,op.requestSchema))throw Error();}catch{throw new ApiV06Error('BAD_REQUEST');}
  const field=op!.pathField,pathValue=values[field],query=new URLSearchParams();
  for(const key of Object.keys(values).sort())if(key!==field)query.set(key,String(values[key]));
  const path=op!.path.replace('{'+field+'}',encodeURIComponent(String(pathValue)))+(query.size?'?'+query.toString():'');
  let response:Awaited<ReturnType<Transport['request']>>;
  try{response=await this.transport.request({method:'GET',path,headers:{Accept:'application/json'},credentials:'include',redirect:'manual',cache:'no-store'});}catch{throw new ApiV06Error('TRANSPORT_FAILED');}
  let body:unknown;
  try{
   const controls=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='cache-control');
   if(controls.length!==1||controls[0]![1].toLowerCase()!=='no-store'||typeof response.body!=='string')throw Error();
   body=strictParseApiV06(response.body);
  }catch{throw new ApiV06Error('INVALID_RESPONSE');}
  if(response.status!==200){
   if(!await validateApiV06(body,'common.schema.json#/$defs/ErrorEnvelope'))throw new ApiV06Error('INVALID_RESPONSE');
   const code=(body as {error:{code:string}}).error.code;
   if(errors[code]!==response.status)throw new ApiV06Error('INVALID_RESPONSE');throw new ApiV06Error(code);
  }
  if(!await validateApiV06(body,op!.responseSchema))throw new ApiV06Error('INVALID_RESPONSE');
  const data=(body as {data:Record<string,any>}).data;
  if(data.binding.backtestId!==pathValue)throw new ApiV06Error('BINDING_CONFLICT');
  if(operation==='getNativeTradesV6'&&(data.binding.segment!==values.segment||data.limit!==(values.limit??50)))throw new ApiV06Error('BINDING_CONFLICT');
  return body as Operations[K]['response'];
 }
}
