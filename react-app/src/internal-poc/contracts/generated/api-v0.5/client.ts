
import {validateApiV05} from './validator.js';
import type {Operations} from './types.js';
const operations = [{"operationId":"listConversationResultsV5","method":"GET","path":"/api/v5/conversations/{conversationId}/results","requestSchema":"conversation-result-index.schema.json#/$defs/HistoryRequest","responseSchema":"conversation-result-index.schema.json#/$defs/ConversationResultIndexEnvelope","pathField":"conversationId","defaultLimit":50,"maximumLimit":50},{"operationId":"getChartManifestV5","method":"GET","path":"/api/v5/backtests/{backtestId}/chart-manifest","requestSchema":"chart-manifest.schema.json#/$defs/ManifestRequest","responseSchema":"chart-manifest.schema.json#/$defs/ChartManifestEnvelope","pathField":"backtestId"},{"operationId":"getChartWindowV5","method":"GET","path":"/api/v5/backtests/{backtestId}/chart-window","requestSchema":"chart-window.schema.json#/$defs/WindowRequest","responseSchema":"chart-window.schema.json#/$defs/ChartWindowEnvelope","pathField":"backtestId","defaultLimit":1000,"maximumLimit":1000},{"operationId":"getFillMarkersV5","method":"GET","path":"/api/v5/backtests/{backtestId}/fill-markers","requestSchema":"fill-marker-page.schema.json#/$defs/MarkerRequest","responseSchema":"fill-marker-page.schema.json#/$defs/FillMarkerPageEnvelope","pathField":"backtestId","defaultLimit":50,"maximumLimit":100}] as const;
const errors:Record<string,number> = {"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"NOT_READY":409,"OUT_OF_RANGE":400,"LIMIT_EXCEEDED":400,"SNAPSHOT_CHANGED":409,"CURSOR_INVALID":400,"BINDING_CONFLICT":409,"SOURCE_VERIFICATION_FAILED":409,"INTERNAL_ERROR":500};
export interface Transport{request(request:{method:'GET';path:string;headers:Readonly<Record<string,string>>;credentials:'include';redirect:'manual';cache:'no-store'}):Promise<{status:number;headers:Record<string,string>;body:unknown}>;}
export class ApiV05Error extends Error{constructor(readonly code:string){super(code);this.name='ApiV05Error';}}
export class TesiaResultChartsV05Client{
 constructor(private readonly transport:Transport){}
 async call<K extends keyof Operations>(operation:K,request:Operations[K]['request']):Promise<Operations[K]['response']>{
  const op=operations.find(x=>x.operationId===operation);if(!op||!validateApiV05(request,op.requestSchema))throw new ApiV05Error('BAD_REQUEST');
  const values=request as Record<string,unknown>,field=op.pathField,pathValue=values[field];
  const query=new URLSearchParams();for(const key of Object.keys(values).sort())if(key!==field)query.set(key,String(values[key]));
  const path=op.path.replace('{'+field+'}',encodeURIComponent(String(pathValue)))+(query.size?'?'+query.toString():'');
  let response:Awaited<ReturnType<Transport['request']>>;
  try{response=await this.transport.request({method:'GET',path,headers:{Accept:'application/json'},credentials:'include',redirect:'manual',cache:'no-store'});}catch{throw new ApiV05Error('TRANSPORT_FAILED');}
  const controls=Object.entries(response.headers).filter(([k])=>k.toLowerCase()==='cache-control');
  if(controls.length!==1||controls[0]![1].toLowerCase()!=='no-store')throw new ApiV05Error('INVALID_RESPONSE');
  if(response.status!==200){if(!validateApiV05(response.body,'common.schema.json#/$defs/ErrorEnvelope'))throw new ApiV05Error('INVALID_RESPONSE');const code=(response.body as {error:{code:string}}).error.code;if(errors[code]!==response.status)throw new ApiV05Error('INVALID_RESPONSE');throw new ApiV05Error(code);}
  if(!validateApiV05(response.body,op.responseSchema))throw new ApiV05Error('INVALID_RESPONSE');
  const data=(response.body as {data:Record<string,any>}).data;
  if(field==='conversationId'?(data.conversationId!==pathValue||data.limit!==(values.limit??50)):(data.binding.backtestId!==pathValue||data.binding.segment!==values.segment))throw new ApiV05Error('BINDING_CONFLICT');
  if(values.manifestContentHash!==undefined&&data.manifestContentHash!==values.manifestContentHash)throw new ApiV05Error('BINDING_CONFLICT');
  if(operation==='getChartWindowV5'&&(data.seriesId!==values.seriesId||data.resolution!==values.resolution||data.requestedRange.fromInclusive!==values.fromInclusive||data.requestedRange.toExclusive!==values.toExclusive||data.maxPoints!==(values.maxPoints??1000)))throw new ApiV05Error('BINDING_CONFLICT');
  if(operation==='getFillMarkersV5'&&data.limit!==(values.limit??50))throw new ApiV05Error('BINDING_CONFLICT');
  return response.body as Operations[K]['response'];
 }
}
