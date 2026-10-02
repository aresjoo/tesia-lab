
import {strictParseApiV08,validateApiV08} from './validator.js';
import type {Operations} from './types.js';
const operations=[{"headers":[],"method":"GET","operationId":"listNativeConversationHistoryV8","path":"/api/v8/conversations/{conversationId}/native-history","pathField":"conversationId","requestSchema":"native-conversation-history.schema.json#/$defs/NativeConversationHistoryRequest","responseSchema":"native-conversation-history.schema.json#/$defs/NativeConversationHistoryEnvelope","successEtagRequired":true,"successStatus":200}] as const;
const errors:Record<string,number>={"BAD_REQUEST":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"NOT_READY":409,"SNAPSHOT_CHANGED":409,"CURSOR_INVALID":409,"BINDING_CONFLICT":409,"SOURCE_VERIFICATION_FAILED":409,"INTERNAL_ERROR":500};
const etagPattern="^\"[A-Za-z0-9_-]{16,128}\"$";
export interface Transport{
 request(request:{method:'GET';path:string;headers:Readonly<Record<string,string>>;credentials:'include';redirect:'manual';cache:'no-store'}):Promise<{status:number;headers:Record<string,string>;body:string}>;
}
export class ApiV08Error extends Error{constructor(readonly code:string){super(code);this.name='ApiV08Error';}}
export class TesiaNativeConversationHistoryV08Client{
 constructor(private readonly transport:Transport){}
 async call<K extends keyof Operations>(operation:K,request:Operations[K]['request']):Promise<Operations[K]['response']>{
  const op=operations.find(item=>item.operationId===operation);
  let values:Record<string,unknown>;
  try{const snapshot=JSON.stringify(request);if(!op||!await validateApiV08(request,op.requestSchema))throw Error();values=strictParseApiV08(snapshot) as Record<string,unknown>;if(!await validateApiV08(values,op.requestSchema))throw Error();}catch{throw new ApiV08Error('BAD_REQUEST');}
  const query=new URLSearchParams();for(const key of Object.keys(values).sort())if(key!==op!.pathField)query.set(key,String(values[key]));
  const path=op!.path.replace('{'+op!.pathField+'}',encodeURIComponent(String(values[op!.pathField])))+(query.size?'?'+query.toString():'');
  let response:Awaited<ReturnType<Transport['request']>>;
  try{response=await this.transport.request({method:'GET',path,headers:{Accept:'application/json'},credentials:'include',redirect:'manual',cache:'no-store'});}catch{throw new ApiV08Error('TRANSPORT_FAILED');}
  let body:any;
  try{const controls=Object.entries(response.headers).filter(([key])=>key.toLowerCase()==='cache-control');if(controls.length!==1||controls[0]![1].toLowerCase()!=='no-store'||typeof response.body!=='string')throw Error();body=strictParseApiV08(response.body);}catch{throw new ApiV08Error('INVALID_RESPONSE');}
  if(response.status!==op!.successStatus){if(!await validateApiV08(body,'common.schema.json#/$defs/ErrorEnvelope')||errors[body.error.code]!==response.status)throw new ApiV08Error('INVALID_RESPONSE');throw new ApiV08Error(body.error.code);}
  const etags=Object.entries(response.headers).filter(([key])=>key.toLowerCase()==='etag');
  if(etags.length!==1||!new RegExp(etagPattern).test(etags[0]![1])||!await validateApiV08(body,op!.responseSchema))throw new ApiV08Error('INVALID_RESPONSE');
  if(body.data.conversationId!==values.conversationId||body.data.limit!==(values.limit??50))throw new ApiV08Error('BINDING_CONFLICT');
  return body as Operations[K]['response'];
 }
}
