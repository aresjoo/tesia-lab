import type {DeepReadonly} from './types.js';
const schema={"$defs":{"Accounting":{"additionalProperties":false,"properties":{"accountingComplete":{"type":"boolean"},"fees":{"items":{"$ref":"#/$defs/Fee"},"maxItems":32,"minItems":0,"type":"array"},"feesConfirmed":{"type":"boolean"},"fundingConfirmed":{"type":"boolean"},"fundingUsdt":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"realizedPnlUsdt":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"totalPnlUsdt":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]}},"required":["accountingComplete","feesConfirmed","fundingConfirmed","fees","fundingUsdt","realizedPnlUsdt","totalPnlUsdt"],"type":"object"},"AiPolicy":{"additionalProperties":false,"properties":{"decisionIntervalSeconds":{"maximum":86400,"minimum":1,"type":"integer"},"environment":{"$ref":"#/$defs/Environment"},"exchangeId":{"const":"bitget"},"market":{"$ref":"#/$defs/Market"},"modelIdentity":{"$ref":"#/$defs/ModelIdentity"},"promptSha256":{"$ref":"#/$defs/Hash"},"riskLimits":{"$ref":"#/$defs/RiskLimits"},"rules":{"items":{"maxLength":1000,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"},"maxItems":32,"minItems":1,"type":"array"},"spec":{"maxLength":1000,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"},"symbols":{"items":{"$ref":"#/$defs/CopySymbol"},"maxItems":32,"minItems":1,"type":"array","uniqueItems":true}},"required":["exchangeId","environment","promptSha256","modelIdentity","market","symbols","decisionIntervalSeconds","riskLimits","spec","rules"],"type":"object"},"ApprovalMetadata":{"additionalProperties":false,"properties":{"issuedAt":{"$ref":"#/$defs/Utc"},"issuerId":{"$ref":"#/$defs/Id"},"reviewEvidenceSha256":{"$ref":"#/$defs/Hash"},"reviewedAt":{"$ref":"#/$defs/Utc"},"reviewerId":{"$ref":"#/$defs/Id"}},"required":["issuerId","reviewerId","reviewEvidenceSha256","reviewedAt","issuedAt"],"type":"object"},"ApprovedVersion":{"additionalProperties":false,"properties":{"approval":{"$ref":"#/$defs/ApprovalMetadata"},"name":{"maxLength":160,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"},"policy":{"$ref":"#/$defs/AiPolicy"},"policyHash":{"$ref":"#/$defs/Hash"},"status":{"enum":["approved","revoked"],"type":"string"},"strategyId":{"$ref":"#/$defs/Id"},"versionId":{"$ref":"#/$defs/Id"}},"required":["versionId","strategyId","name","status","policy","policyHash","approval"],"type":"object"},"BlockedReason":{"enum":["RUNTIME_UNAVAILABLE","ACTIVATION_REQUIRED","CURRENT_POSITION_UNAVAILABLE","ACCOUNT_FACTS_UNAVAILABLE","POLICY_REVOKED","PRODUCT_UNSUPPORTED","PERMISSION_REJECTED","ACCOUNTING_INCOMPLETE","ORDER_RECONCILIATION_REQUIRED","RISK_LIMIT_REJECTED","STALE_MARKET","PROVIDER_UNAVAILABLE","SERVER_APPROVAL_REQUIRED","PROJECTION_CAPACITY_EXCEEDED"],"type":"string"},"Capability":{"additionalProperties":false,"properties":{"available":{"type":"boolean"},"reason":{"anyOf":[{"$ref":"#/$defs/BlockedReason"},{"type":"null"}]}},"required":["available","reason"],"type":"object"},"CloseCopyRequest":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"expectedRevision":{"maximum":9007199254740991,"minimum":0,"type":"integer"}},"required":["apiContractVersion","expectedRevision"],"type":"object"},"CloseStatus":{"enum":["NONE","PENDING","COMPLETE"],"type":"string"},"CopyListResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"data":{"items":{"$ref":"#/$defs/CopySummary"},"maxItems":100,"minItems":0,"type":"array"},"nextCursor":{"anyOf":[{"$ref":"#/$defs/Cursor"},{"type":"null"}]}},"required":["apiContractVersion","data","nextCursor"],"type":"object"},"CopyResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"data":{"$ref":"#/$defs/CopySnapshot"}},"required":["apiContractVersion","data"],"type":"object"},"CopySnapshot":{"additionalProperties":false,"properties":{"allocationUsdt":{"$ref":"#/$defs/QuantityString"},"closeStatus":{"$ref":"#/$defs/CloseStatus"},"connectionId":{"$ref":"#/$defs/Id"},"currentPositionAvailable":{"type":"boolean"},"environment":{"$ref":"#/$defs/Environment"},"exchangeId":{"const":"bitget"},"execution":{"$ref":"#/$defs/ExecutionProjection"},"joinedAt":{"$ref":"#/$defs/Utc"},"maxLossUsdt":{"$ref":"#/$defs/QuantityString"},"maxPositionFraction":{"$ref":"#/$defs/QuantityString"},"policyHash":{"$ref":"#/$defs/Hash"},"revision":{"maximum":9007199254740991,"minimum":0,"type":"integer"},"startMode":{"$ref":"#/$defs/StartMode"},"state":{"enum":["CREATED","PENDING_CURRENT_POSITION","ACTIVE","PAUSED","STOPPING","STOPPED"],"type":"string"},"subscriptionId":{"$ref":"#/$defs/Id"},"versionId":{"$ref":"#/$defs/Id"}},"required":["subscriptionId","connectionId","versionId","exchangeId","environment","startMode","state","revision","joinedAt","currentPositionAvailable","allocationUsdt","maxLossUsdt","maxPositionFraction","execution","policyHash","closeStatus"],"type":"object"},"CopySummary":{"additionalProperties":false,"properties":{"accountingComplete":{"type":"boolean"},"actualExecutionVerified":{"type":"boolean"},"allocationUsdt":{"$ref":"#/$defs/QuantityString"},"availability":{"$ref":"#/$defs/TradingAvailability"},"closeStatus":{"$ref":"#/$defs/CloseStatus"},"connectionId":{"$ref":"#/$defs/Id"},"currentPositionAvailable":{"type":"boolean"},"environment":{"$ref":"#/$defs/Environment"},"exchangeId":{"const":"bitget"},"joinedAt":{"$ref":"#/$defs/Utc"},"maxLossUsdt":{"$ref":"#/$defs/QuantityString"},"maxPositionFraction":{"$ref":"#/$defs/QuantityString"},"observedAt":{"$ref":"#/$defs/Utc"},"origin":{"enum":["unconnected","synthetic","exchange"],"type":"string"},"policyHash":{"$ref":"#/$defs/Hash"},"realizedPnlUsdt":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"revision":{"maximum":9007199254740991,"minimum":0,"type":"integer"},"startMode":{"$ref":"#/$defs/StartMode"},"state":{"enum":["CREATED","PENDING_CURRENT_POSITION","ACTIVE","PAUSED","STOPPING","STOPPED"],"type":"string"},"subscriptionId":{"$ref":"#/$defs/Id"},"totalPnlUsdt":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"verificationEvidenceSha256":{"anyOf":[{"$ref":"#/$defs/Hash"},{"type":"null"}]},"versionId":{"$ref":"#/$defs/Id"}},"required":["allocationUsdt","connectionId","currentPositionAvailable","environment","exchangeId","joinedAt","maxLossUsdt","maxPositionFraction","revision","startMode","state","subscriptionId","versionId","policyHash","closeStatus","observedAt","actualExecutionVerified","availability","accountingComplete","realizedPnlUsdt","totalPnlUsdt","origin","verificationEvidenceSha256"],"type":"object"},"CopySymbol":{"maxLength":24,"minLength":6,"pattern":"^[A-Z0-9]{2,20}USDT$(?![\\s\\S])","type":"string"},"CreateCopyRequest":{"additionalProperties":false,"properties":{"allocationUsdt":{"$ref":"#/$defs/QuantityString"},"apiContractVersion":{"const":"0.18.0"},"connectionId":{"$ref":"#/$defs/Id"},"environment":{"$ref":"#/$defs/Environment"},"maxLossUsdt":{"$ref":"#/$defs/QuantityString"},"maxPositionFraction":{"$ref":"#/$defs/QuantityString"},"startMode":{"$ref":"#/$defs/StartMode"},"versionId":{"$ref":"#/$defs/Id"}},"required":["apiContractVersion","connectionId","versionId","environment","startMode","allocationUsdt","maxLossUsdt","maxPositionFraction"],"type":"object"},"Cursor":{"maxLength":512,"minLength":16,"pattern":"^[A-Za-z0-9_-]+$(?![\\s\\S])","type":"string"},"DecimalString":{"maxLength":68,"pattern":"^-?(?:0|[1-9][0-9]{0,33})(?:\\.[0-9]{1,32})?$(?![\\s\\S])","type":"string"},"DecisionRecord":{"additionalProperties":false,"properties":{"action":{"enum":["OPEN_LONG","OPEN_SHORT","CLOSE_LONG","CLOSE_SHORT","HOLD"],"type":"string"},"allocationFraction":{"$ref":"#/$defs/QuantityString"},"eventId":{"maxLength":128,"minLength":1,"pattern":"^[A-Za-z0-9][A-Za-z0-9_.:/-]*$(?![\\s\\S])","type":"string"},"modelIdentity":{"$ref":"#/$defs/ModelIdentity"},"observedAt":{"$ref":"#/$defs/Utc"},"policyHash":{"$ref":"#/$defs/Hash"},"reason":{"maxLength":2000,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"},"symbol":{"$ref":"#/$defs/CopySymbol"}},"required":["eventId","observedAt","symbol","action","allocationFraction","modelIdentity","policyHash","reason"],"type":"object"},"Environment":{"enum":["demo","production"],"type":"string"},"ErrorCode":{"enum":["BAD_REQUEST","AUTHENTICATION_REQUIRED","FORBIDDEN","CSRF_INVALID","ORIGIN_INVALID","NOT_FOUND","REVISION_CONFLICT","IDEMPOTENCY_CONFLICT","STRATEGY_NOT_APPROVED","CURRENT_POSITION_UNAVAILABLE","RISK_LIMIT_REJECTED","ORDER_RECONCILIATION_REQUIRED","EXECUTION_UNAVAILABLE","PROVIDER_UNAVAILABLE","RATE_LIMITED","INTERNAL_ERROR"],"type":"string"},"ErrorEnvelope":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"error":{"additionalProperties":false,"properties":{"code":{"$ref":"#/$defs/ErrorCode"},"message":{"$ref":"#/$defs/ErrorCode"}},"required":["code","message"],"type":"object"}},"required":["apiContractVersion","error"],"type":"object"},"ExecutionOrder":{"additionalProperties":false,"properties":{"action":{"enum":["OPEN_LONG","OPEN_SHORT","CLOSE_LONG","CLOSE_SHORT"],"type":"string"},"averagePrice":{"anyOf":[{"$ref":"#/$defs/QuantityString"},{"type":"null"}]},"clientOid":{"maxLength":32,"minLength":1,"pattern":"^[A-Za-z0-9_-]+$(?![\\s\\S])","type":"string"},"eventId":{"maxLength":128,"minLength":1,"pattern":"^[A-Za-z0-9][A-Za-z0-9_.:/-]*$(?![\\s\\S])","type":"string"},"fees":{"items":{"$ref":"#/$defs/Fee"},"maxItems":32,"minItems":0,"type":"array"},"feesConfirmed":{"type":"boolean"},"filledQuantity":{"$ref":"#/$defs/QuantityString"},"quantity":{"$ref":"#/$defs/QuantityString"},"state":{"enum":["SENDING","UNKNOWN","ACK","OPEN","PARTIALLY_FILLED","FILLED","CANCELLED","REJECTED"],"type":"string"},"symbol":{"$ref":"#/$defs/CopySymbol"}},"required":["eventId","clientOid","symbol","action","state","quantity","filledQuantity","averagePrice","fees","feesConfirmed"],"type":"object"},"ExecutionProjection":{"additionalProperties":false,"properties":{"accounting":{"$ref":"#/$defs/Accounting"},"actualExecutionVerified":{"type":"boolean"},"availability":{"$ref":"#/$defs/TradingAvailability"},"lastDecision":{"anyOf":[{"$ref":"#/$defs/DecisionRecord"},{"type":"null"}]},"observedAt":{"$ref":"#/$defs/Utc"},"orders":{"$ref":"#/$defs/OrderSection"},"origin":{"enum":["unconnected","synthetic","exchange"],"type":"string"},"positions":{"$ref":"#/$defs/PositionSection"},"verificationEvidenceSha256":{"anyOf":[{"$ref":"#/$defs/Hash"},{"type":"null"}]}},"required":["observedAt","origin","actualExecutionVerified","verificationEvidenceSha256","availability","positions","orders","accounting","lastDecision"],"type":"object"},"Fee":{"additionalProperties":false,"properties":{"amount":{"$ref":"#/$defs/DecimalString"},"currency":{"maxLength":32,"minLength":1,"pattern":"^[A-Za-z0-9][A-Za-z0-9._-]*$(?![\\s\\S])","type":"string"}},"required":["currency","amount"],"type":"object"},"Hash":{"maxLength":64,"minLength":64,"pattern":"^[a-f0-9]{64}$(?![\\s\\S])","type":"string"},"Id":{"maxLength":128,"minLength":16,"pattern":"^[A-Za-z0-9_-]+$(?![\\s\\S])","type":"string"},"Market":{"enum":["SPOT","USDT-FUTURES"],"type":"string"},"ModelIdentity":{"additionalProperties":false,"properties":{"model":{"maxLength":128,"minLength":1,"pattern":"^[A-Za-z0-9][A-Za-z0-9._:/-]*$(?![\\s\\S])","type":"string"},"provider":{"enum":["openai","anthropic","google","deepseek","qwen","xai","moonshot"],"type":"string"},"revision":{"anyOf":[{"maxLength":128,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"},{"type":"null"}]}},"required":["provider","model","revision"],"type":"object"},"OrderSection":{"additionalProperties":false,"properties":{"hasMore":{"type":"boolean"},"items":{"items":{"$ref":"#/$defs/ExecutionOrder"},"maxItems":64,"minItems":0,"type":"array"},"nextCursor":{"anyOf":[{"$ref":"#/$defs/Cursor"},{"type":"null"}]},"reason":{"anyOf":[{"$ref":"#/$defs/BlockedReason"},{"type":"null"}]},"status":{"enum":["ok","unavailable"],"type":"string"}},"required":["status","reason","items","hasMore","nextCursor"],"type":"object"},"OwnedPosition":{"additionalProperties":false,"properties":{"entryPrice":{"anyOf":[{"$ref":"#/$defs/QuantityString"},{"type":"null"}]},"markPrice":{"anyOf":[{"$ref":"#/$defs/QuantityString"},{"type":"null"}]},"quantity":{"$ref":"#/$defs/QuantityString"},"side":{"enum":["long","short"],"type":"string"},"symbol":{"$ref":"#/$defs/CopySymbol"},"unrealizedPnlUsdt":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]}},"required":["symbol","side","quantity","entryPrice","markPrice","unrealizedPnlUsdt"],"type":"object"},"PageQuery":{"additionalProperties":false,"properties":{"cursor":{"$ref":"#/$defs/Cursor"},"limit":{"maximum":100,"minimum":1,"type":"integer"}},"required":[],"type":"object"},"PauseCopyRequest":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"expectedRevision":{"maximum":9007199254740991,"minimum":0,"type":"integer"}},"required":["apiContractVersion"],"type":"object"},"PositionSection":{"additionalProperties":false,"properties":{"items":{"items":{"$ref":"#/$defs/OwnedPosition"},"maxItems":64,"minItems":0,"type":"array"},"reason":{"anyOf":[{"$ref":"#/$defs/BlockedReason"},{"type":"null"}]},"status":{"enum":["ok","unavailable"],"type":"string"}},"required":["status","reason","items"],"type":"object"},"QuantityString":{"maxLength":67,"pattern":"^(?:0|[1-9][0-9]{0,33})(?:\\.[0-9]{1,32})?$(?![\\s\\S])","type":"string"},"RiskLimits":{"additionalProperties":false,"properties":{"maxEntryAgeSeconds":{"maximum":900,"minimum":1,"type":"integer"},"maxLeverage":{"maximum":125,"minimum":1,"type":"integer"},"maxPositionFraction":{"$ref":"#/$defs/QuantityString"},"maxPriceDeviationFraction":{"$ref":"#/$defs/QuantityString"}},"required":["maxPositionFraction","maxLeverage","maxEntryAgeSeconds","maxPriceDeviationFraction"],"type":"object"},"StartCopyRequest":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"expectedRevision":{"maximum":9007199254740991,"minimum":0,"type":"integer"}},"required":["apiContractVersion","expectedRevision"],"type":"object"},"StartMode":{"enum":["current_position","next_signal"],"type":"string"},"StopCopyRequest":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"expectedRevision":{"maximum":9007199254740991,"minimum":0,"type":"integer"}},"required":["apiContractVersion"],"type":"object"},"TradingAvailability":{"additionalProperties":false,"properties":{"cancel":{"$ref":"#/$defs/Capability"},"close":{"$ref":"#/$defs/Capability"},"pause":{"$ref":"#/$defs/Capability"},"query":{"$ref":"#/$defs/Capability"},"start":{"$ref":"#/$defs/Capability"},"stop":{"$ref":"#/$defs/Capability"},"update":{"$ref":"#/$defs/Capability"}},"required":["start","update","pause","stop","close","query","cancel"],"type":"object"},"UpdateCopyRequest":{"additionalProperties":false,"properties":{"allocationUsdt":{"$ref":"#/$defs/QuantityString"},"apiContractVersion":{"const":"0.18.0"},"expectedRevision":{"maximum":9007199254740991,"minimum":0,"type":"integer"},"maxLossUsdt":{"$ref":"#/$defs/QuantityString"},"maxPositionFraction":{"$ref":"#/$defs/QuantityString"}},"required":["apiContractVersion","expectedRevision","allocationUsdt","maxLossUsdt","maxPositionFraction"],"type":"object"},"Utc":{"format":"date-time","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})?Z$(?![\\s\\S])","type":"string"},"VersionListResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"data":{"items":{"$ref":"#/$defs/VersionSummary"},"maxItems":100,"minItems":0,"type":"array"},"nextCursor":{"anyOf":[{"$ref":"#/$defs/Cursor"},{"type":"null"}]}},"required":["apiContractVersion","data","nextCursor"],"type":"object"},"VersionResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.18.0"},"data":{"$ref":"#/$defs/ApprovedVersion"}},"required":["apiContractVersion","data"],"type":"object"},"VersionSummary":{"additionalProperties":false,"properties":{"environment":{"$ref":"#/$defs/Environment"},"market":{"$ref":"#/$defs/Market"},"modelIdentity":{"$ref":"#/$defs/ModelIdentity"},"name":{"maxLength":160,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"},"policyHash":{"$ref":"#/$defs/Hash"},"status":{"enum":["approved","revoked"],"type":"string"},"strategyId":{"$ref":"#/$defs/Id"},"versionId":{"$ref":"#/$defs/Id"}},"required":["versionId","strategyId","name","status","environment","market","modelIdentity","policyHash"],"type":"object"}},"$id":"https://contracts.tesia.ai/api/v0.18.0/bitget-copy-execution.schema.json","$schema":"https://json-schema.org/draft/2020-12/schema","description":"Additive server-authorized Bitget AI policy/copy wire. Normative semantic validation is required; no validator grants execution authority."};
const definitions:Record<string,any>=schema.$defs;
const maximum=262144, maxDepth=16;
const bad=():never=>{throw Error('BAD_REQUEST');};
function unicode(value:string):void{
 for(let i=0;i<value.length;i++){
  const n=value.charCodeAt(i);
  if(n>=0xd800&&n<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))bad();}
  else if(n>=0xdc00&&n<=0xdfff)bad();
 }
}
export function strictParseApiV18(payload:string,request=false):unknown{
 if(typeof request!=='boolean'||typeof payload!=='string'||payload.length>maximum||new TextEncoder().encode(payload).length>maximum)bad();
 unicode(payload);
 let at=0;
 const ws=()=>{while(/[\t\n\r ]/.test(payload[at]??'')&&at<payload.length)at++;};
 const string=():string=>{
  const start=at++;let escaped=false;
  while(at<payload.length){const c=payload[at++]!;if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c==='"'){const value:unknown=JSON.parse(payload.slice(start,at));if(typeof value!=='string')return bad();unicode(value);return value;}}
  return bad();
 };
 const value=(depth:number):any=>{
  if(depth>maxDepth)bad();ws();const c=payload[at];
  if(c==='"')return string();
  if(c==='{'){
   at++;ws();const out:Record<string,unknown>=Object.create(null),keys=new Set<string>();
   if(payload[at]==='}'){at++;return out;}
   while(true){ws();if(payload[at]!=='"')bad();const key=string();if(keys.has(key))bad();keys.add(key);ws();if(payload[at++]!==':')bad();out[key]=value(depth+1);ws();const next=payload[at++];if(next==='}')return out;if(next!==',')bad();}
  }
  if(c==='['){at++;ws();const out:unknown[]=[];if(payload[at]===']'){at++;return out;}while(true){out.push(value(depth+1));ws();const next=payload[at++];if(next===']')return out;if(next!==',')bad();}}
  for(const [literal,result] of [['true',true],['false',false],['null',null]] as const){if(payload.startsWith(literal,at)){at+=literal.length;return result;}}
  const match=/^-?(?:0|[1-9][0-9]*)/.exec(payload.slice(at));
  if(match){at+=match[0].length;if(/[.eE]/.test(payload[at]??''))bad();const result=Number(match[0]);if(!Number.isSafeInteger(result))bad();return result;}
  return bad();
 };
 try{const result=value(0);ws();if(at!==payload.length)bad();return result;}catch{return bad();}
}
function clone(value:unknown,depth=0):unknown{
 if(depth>maxDepth)bad();
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='string'){unicode(value);return value;}
 if(typeof value==='number'){if(!Number.isSafeInteger(value))bad();return value;}
 if(typeof value!=='object')return bad();
 const isArray=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(!isArray&&prototype!==Object.prototype&&prototype!==null)bad();
 const descriptors=Object.getOwnPropertyDescriptors(value), out:any=isArray?[]:Object.create(null);
 for(const key of Reflect.ownKeys(descriptors)){
  if(typeof key!=='string')return bad();if(isArray&&key==='length')continue;
  const descriptor=descriptors[key]!;
  if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))bad();
  if(isArray&&!/^(?:0|[1-9][0-9]*)$/.test(key))bad();unicode(key);
  out[key]=clone(descriptor.value,depth+1);
 }
 if(isArray&&out.length!==(value as unknown[]).length)bad();
 return out;
}
export function snapshotApiV18(input:unknown,request=false):unknown{
 try{return strictParseApiV18(JSON.stringify(clone(input)),request);}catch{return bad();}
}
function check(value:any,rule:any):boolean{
 if(rule.$ref)return check(value,definitions[rule.$ref.split('/').at(-1)]);
 if(Object.hasOwn(rule,'const')&&value!==rule.const)return false;
 if(rule.enum&&!rule.enum.includes(value))return false;
 if(rule.anyOf&&!rule.anyOf.some((part:any)=>check(value,part)))return false;
 if(rule.allOf&&!rule.allOf.every((part:any)=>check(value,part)))return false;
 if(rule.if&&!check(value,check(value,rule.if)?rule.then??{}:rule.else??{}))return false;
 const kind=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(rule.type==='integer'){if(kind!=='number'||!Number.isSafeInteger(value))return false;}
 else if(rule.type&&kind!==rule.type)return false;
 if(kind==='number'&&(value<(rule.minimum??-Number.MAX_SAFE_INTEGER)||value>(rule.maximum??Number.MAX_SAFE_INTEGER)))return false;
 if(kind==='string'){
  const count=[...value].length;if(count<(rule.minLength??0)||count>(rule.maxLength??maximum))return false;
  if(rule.pattern&&!new RegExp(rule.pattern).test(value))return false;
 }
 if(kind==='object'){
  const properties=rule.properties??{};
  if((rule.required??[]).some((key:string)=>!Object.hasOwn(value,key)))return false;
  if(rule.additionalProperties===false&&Object.keys(value).some(key=>!Object.hasOwn(properties,key)))return false;
  if(Object.entries(properties).some(([key,part])=>Object.hasOwn(value,key)&&!check(value[key],part)))return false;
 }
 if(kind==='array'){
  if(value.length<(rule.minItems??0)||value.length>(rule.maxItems??maximum))return false;
  if(rule.uniqueItems&&new Set(value.map((child:any)=>JSON.stringify(child))).size!==value.length)return false;
  if(rule.items&&value.some((item:any)=>!check(item,rule.items)))return false;
 }
 return true;
}
function utc(value:string):boolean{
 const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10));
 const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return year>=1&&month>=1&&month<=12&&day>=1&&day<=days[month-1]!&&Number(value.slice(11,13))<=23&&Number(value.slice(14,16))<=59&&Number(value.slice(17,19))<=59;
}
const names=["PageQuery", "AiPolicy", "ApprovedVersion", "CreateCopyRequest", "UpdateCopyRequest", "StartCopyRequest", "PauseCopyRequest", "StopCopyRequest", "CloseCopyRequest", "VersionResponse", "VersionListResponse", "CopyResponse", "CopyListResponse", "ErrorEnvelope"];
const decimalKeys=new Set(['allocationUsdt','maxLossUsdt','maxPositionFraction','maxPriceDeviationFraction','quantity','filledQuantity','averagePrice','entryPrice','markPrice','unrealizedPnlUsdt','realizedPnlUsdt','totalPnlUsdt','fundingUsdt','amount','allocationFraction']);
const dates=new Set(['observedAt','joinedAt','reviewedAt','issuedAt']);
function requireValue(value:boolean):void{if(!value)bad();}
function decimal(value:string):readonly [bigint,bigint]{const [whole,fraction='']=value.split('.');return [BigInt(whole!+fraction),10n**BigInt(fraction.length)];}
function compare(a:string,b:string):number{const [an,ad]=decimal(a),[bn,bd]=decimal(b);const delta=an*bd-bn*ad;return delta<0n?-1:delta>0n?1:0;}
function utcKey(value:string):string{const [base,fraction='']=value.slice(0,-1).split('.');return base!.replace(/[^0-9]/g,'')+fraction.padEnd(6,'0');}
function canonical(value:any):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 return JSON.stringify(value);
}
function sha256(input:string):string{
 const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const bytes=new TextEncoder().encode(input),padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);padded.set(bytes);padded[bytes.length]=128;
 const view=new DataView(padded.buffer);view.setUint32(padded.length-4,bytes.length*8,false);
 const hash=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
 const rotate=(n:number,k:number)=>(n>>>k)|(n<<(32-k)),words=new Uint32Array(64);
 for(let offset=0;offset<padded.length;offset+=64){
  for(let i=0;i<16;i++)words[i]=view.getUint32(offset+i*4,false);
  for(let i=16;i<64;i++){const x=words[i-15]!,y=words[i-2]!;words[i]=(rotate(x,7)^rotate(x,18)^(x>>>3))+words[i-16]!+(rotate(y,17)^rotate(y,19)^(y>>>10))+words[i-7]!;}
  let [a,b,c,d,e,f,g,h]=Array.from(hash) as [number,number,number,number,number,number,number,number];
  for(let i=0;i<64;i++){const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]!+words[i]!)>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
  [a,b,c,d,e,f,g,h].forEach((value,index)=>{hash[index]=(hash[index]!+value)>>>0;});
 }
 return Array.from(hash).map(n=>n.toString(16).padStart(8,'0')).join('');
}
function semantics(value:any):void{
 if(Array.isArray(value)){value.forEach(semantics);return;}
 if(value===null||typeof value!=='object')return;
 for(const [key,child] of Object.entries(value)){
  if(child!==null&&decimalKeys.has(key)){
   const text=child as string;requireValue(text.replace(/^-/,'').replace('.','').replace(/^0+/,'').length<=34);
   if(['allocationUsdt','maxLossUsdt','quantity','averagePrice','entryPrice','markPrice'].includes(key))requireValue(compare(text,'0')>0);
   else if(['maxPositionFraction','maxPriceDeviationFraction'].includes(key))requireValue(compare(text,'0')>0&&compare(text,'1')<=0);
   else if(key==='allocationFraction')requireValue(compare(text,'0')>=0&&compare(text,'1')<=0);
  }
  if(child!==null&&dates.has(key))requireValue(utc(child as string));
  semantics(child);
 }
 if(Object.hasOwn(value,'allocationUsdt'))requireValue(compare(value.maxLossUsdt,value.allocationUsdt)<=0);
 if(Object.hasOwn(value,'promptSha256')&&value.market==='SPOT')requireValue(value.riskLimits.maxLeverage===1);
 if(Object.hasOwn(value,'issuerId')){requireValue(value.issuerId!==value.reviewerId);requireValue(utcKey(value.reviewedAt)<=utcKey(value.issuedAt));}
 if(Object.hasOwn(value,'policy'))requireValue(value.policyHash===bitgetAiPolicyHash(value.policy));
 if(Object.hasOwn(value,'available'))requireValue((value.reason===null)===value.available);
 if(Object.hasOwn(value,'items')){requireValue((value.reason===null)===(value.status==='ok'));if(value.status==='unavailable')requireValue(value.items.length===0);if(Object.hasOwn(value,'hasMore')){requireValue(value.hasMore===(value.nextCursor!==null));if(value.status==='unavailable')requireValue(!value.hasMore);}}
 if(Object.hasOwn(value,'clientOid')){
  requireValue(compare(value.filledQuantity,'0')>=0&&compare(value.filledQuantity,value.quantity)<=0);
  if(value.state==='FILLED')requireValue(compare(value.filledQuantity,value.quantity)===0);
  else if(value.state==='PARTIALLY_FILLED')requireValue(compare(value.filledQuantity,'0')>0&&compare(value.filledQuantity,value.quantity)<0);
  else if(['SENDING','ACK','OPEN','REJECTED'].includes(value.state))requireValue(compare(value.filledQuantity,'0')===0);
 }
 if(Object.hasOwn(value,'accountingComplete')&&Object.hasOwn(value,'feesConfirmed')){
  if(value.accountingComplete)requireValue(value.feesConfirmed&&value.fundingConfirmed&&value.realizedPnlUsdt!==null&&value.totalPnlUsdt!==null);
  else requireValue(value.realizedPnlUsdt===null&&value.totalPnlUsdt===null);
  requireValue(value.fundingConfirmed===(value.fundingUsdt!==null));
 }
 if(Object.hasOwn(value,'allocationFraction'))requireValue(value.action.startsWith('OPEN')?compare(value.allocationFraction,'0')>0:compare(value.allocationFraction,'0')===0);
 if(Object.hasOwn(value,'actualExecutionVerified')&&Object.hasOwn(value,'origin')){
  requireValue(value.actualExecutionVerified?value.origin==='exchange'&&value.verificationEvidenceSha256!==null:value.verificationEvidenceSha256===null);
  if(value.origin==='unconnected')requireValue(Object.entries(value.availability).every(([key,cap]:[string,any])=>['pause','stop'].includes(key)||!cap.available));
  if(!Object.hasOwn(value,'orders')){if(value.origin==='unconnected')requireValue(!value.accountingComplete);}
  else {
  if(value.actualExecutionVerified)requireValue(value.orders.status==='ok'&&value.positions.status==='ok');
  if(value.origin==='unconnected'){requireValue(value.positions.status==='unavailable'&&value.orders.status==='unavailable');requireValue(value.lastDecision===null&&!value.accounting.accountingComplete);}
  for(const [section,key] of [['positions','symbol'],['orders','clientOid']]){const ids=value[section!].items.map((row:any)=>JSON.stringify([row[key!],row.side??null]));requireValue(new Set(ids).size===ids.length);}
  const accounting=value.accounting;if(accounting.feesConfirmed)requireValue(value.orders.status==='ok'&&value.orders.items.every((row:any)=>row.feesConfirmed));
  if(accounting.accountingComplete){requireValue(value.orders.status==='ok'&&value.positions.status==='ok');requireValue(!value.orders.items.some((row:any)=>['SENDING','UNKNOWN'].includes(row.state)));requireValue(value.positions.items.every((row:any)=>row.unrealizedPnlUsdt!==null));}
  }
 }
 if(Object.hasOwn(value,'currentPositionAvailable')&&value.startMode==='current_position'&&!value.currentPositionAvailable){requireValue(['PENDING_CURRENT_POSITION','PAUSED','STOPPING','STOPPED'].includes(value.state));requireValue(!(value.execution??value).availability.start.available);}
 if(Object.hasOwn(value,'currentPositionAvailable')&&value.state==='PENDING_CURRENT_POSITION')requireValue(value.startMode==='current_position'&&!value.currentPositionAvailable);
 if(Object.hasOwn(value,'lastDecision')&&value.lastDecision!==null)requireValue(utcKey(value.lastDecision.observedAt)<=utcKey(value.observedAt));
 if(Object.hasOwn(value,'closeStatus')){
  if(value.closeStatus!=='NONE')requireValue(['PAUSED','STOPPING','STOPPED'].includes(value.state));
  if(value.execution){const e=value.execution;if(e.lastDecision!==null)requireValue(e.lastDecision.policyHash===value.policyHash);if(value.closeStatus==='COMPLETE'){requireValue(e.actualExecutionVerified);requireValue(e.positions.status==='ok'&&e.orders.status==='ok'&&e.positions.items.length===0);requireValue(!e.orders.items.some((row:any)=>['SENDING','UNKNOWN','ACK','OPEN','PARTIALLY_FILLED'].includes(row.state)));}}
  else {requireValue(value.accountingComplete?value.realizedPnlUsdt!==null&&value.totalPnlUsdt!==null:value.realizedPnlUsdt===null&&value.totalPnlUsdt===null);if(value.closeStatus==='COMPLETE')requireValue(value.actualExecutionVerified);}
 }
 if(Object.hasOwn(value,'apiContractVersion')&&Array.isArray(value.data)&&!value.data.length)requireValue(value.nextCursor===null);
 if(Object.hasOwn(value,'apiContractVersion')&&Array.isArray(value.data)&&value.data.length){const key=Object.hasOwn(value.data[0],'subscriptionId')?'subscriptionId':'versionId';requireValue(new Set(value.data.map((row:any)=>row[key])).size===value.data.length);}
 if(Object.hasOwn(value,'error'))requireValue(value.error.message===value.error.code);
}
export function validateApiV18(input:unknown,schemaName:string):boolean{
 try{if(!names.includes(schemaName))return false;const value:any=snapshotApiV18(input);if(!check(value,definitions[schemaName]))return false;semantics(value);return true;}catch{return false;}
}
export function bitgetAiPolicyHash(input:unknown):string{
 const policy=snapshotApiV18(input);if(!validateApiV18(policy,'AiPolicy'))return bad();return sha256('TESIA_BITGET_AI_POLICY_V18\0'+canonical(policy));
}
export function freezeApiV18<T>(value:T):DeepReadonly<T>{if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freezeApiV18(child);Object.freeze(value);}return value as DeepReadonly<T>;}
