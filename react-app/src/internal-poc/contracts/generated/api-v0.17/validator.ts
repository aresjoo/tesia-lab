import type {DeepReadonly} from './types.js';
const schema={"$defs":{"AccountProduct":{"additionalProperties":false,"properties":{"balances":{"$ref":"#/$defs/BalanceSection"},"positions":{"$ref":"#/$defs/PositionSection"},"product":{"enum":["spot","USDT-FUTURES","USDC-FUTURES","COIN-FUTURES","unified"],"type":"string"}},"required":["product","balances","positions"],"type":"object"},"AccountResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.17.0"},"data":{"$ref":"#/$defs/AccountSnapshot"}},"required":["apiContractVersion","data"],"type":"object"},"AccountSnapshot":{"additionalProperties":false,"allOf":[{"else":{"properties":{"products":{"items":{"anyOf":[{"$ref":"#/$defs/UnifiedProduct"},{"$ref":"#/$defs/UnifiedFuturesProduct"}]}}}},"if":{"properties":{"accountMode":{"const":"classic"}}},"then":{"properties":{"products":{"items":{"anyOf":[{"$ref":"#/$defs/ClassicSpotProduct"},{"$ref":"#/$defs/ClassicFuturesProduct"}]}}}}}],"properties":{"accountMode":{"enum":["classic","uta"],"type":"string"},"connectionId":{"$ref":"#/$defs/Id"},"exchangeId":{"const":"bitget"},"observedAt":{"format":"date-time","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})?Z$(?![\\s\\S])","type":"string"},"products":{"items":{"$ref":"#/$defs/AccountProduct"},"maxItems":4,"minItems":4,"type":"array"}},"required":["connectionId","exchangeId","observedAt","accountMode","products"],"type":"object"},"BalanceItem":{"additionalProperties":false,"properties":{"available":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"balance":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"coin":{"$ref":"#/$defs/Coin"},"equity":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"frozen":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"locked":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"unrealizedPnl":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]}},"required":["coin","equity","balance","available","frozen","locked","unrealizedPnl"],"type":"object"},"BalanceSection":{"additionalProperties":false,"allOf":[{"else":{"properties":{"reason":{"type":"null"}}},"if":{"properties":{"status":{"const":"unavailable"}}},"then":{"properties":{"items":{"maxItems":0},"reason":{"$ref":"#/$defs/SectionReason"}}}},{"if":{"properties":{"status":{"const":"not_applicable"}}},"then":{"properties":{"items":{"maxItems":0}}}}],"properties":{"items":{"items":{"$ref":"#/$defs/BalanceItem"},"maxItems":1000,"type":"array"},"reason":{"anyOf":[{"$ref":"#/$defs/SectionReason"},{"type":"null"}]},"status":{"$ref":"#/$defs/SectionStatus"}},"required":["status","reason","items"],"type":"object"},"ClassicFuturesProduct":{"allOf":[{"$ref":"#/$defs/AccountProduct"},{"properties":{"balances":{"properties":{"status":{"enum":["ok","unavailable"]}}},"positions":{"properties":{"status":{"enum":["ok","unavailable"]}}},"product":{"enum":["USDT-FUTURES","USDC-FUTURES","COIN-FUTURES"]}}}]},"ClassicSpotProduct":{"allOf":[{"$ref":"#/$defs/AccountProduct"},{"properties":{"balances":{"properties":{"status":{"enum":["ok","unavailable"]}}},"positions":{"properties":{"status":{"const":"not_applicable"}}},"product":{"enum":["spot"]}}}]},"Coin":{"maxLength":32,"minLength":1,"pattern":"^[A-Za-z0-9][A-Za-z0-9._-]*$(?![\\s\\S])","type":"string"},"DecimalString":{"maxLength":98,"pattern":"^-?(?:0|[1-9][0-9]{0,63})(?:\\.[0-9]{1,32})?$(?![\\s\\S])","type":"string"},"ErrorCode":{"enum":["BAD_REQUEST","AUTHENTICATION_REQUIRED","FORBIDDEN","CSRF_INVALID","ORIGIN_INVALID","NOT_FOUND","PROVIDER_UNAVAILABLE","TRANSACTION_EXPIRED","TRANSACTION_REPLAYED","PROVIDER_FAILED","PERMISSION_REJECTED","ACCOUNT_CONFLICT","RATE_LIMITED","INTERNAL_ERROR"],"type":"string"},"ErrorEnvelope":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.17.0"},"error":{"additionalProperties":false,"properties":{"code":{"$ref":"#/$defs/ErrorCode"},"message":{"maxLength":160,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"}},"required":["code","message"],"type":"object"}},"required":["apiContractVersion","error"],"type":"object"},"Id":{"maxLength":128,"minLength":16,"pattern":"^[A-Za-z0-9_-]+$(?![\\s\\S])","type":"string"},"PositionItem":{"additionalProperties":false,"properties":{"entryPrice":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"marginCoin":{"anyOf":[{"$ref":"#/$defs/Coin"},{"type":"null"}]},"markPrice":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]},"quantity":{"$ref":"#/$defs/QuantityString"},"side":{"enum":["long","short"],"type":"string"},"symbol":{"$ref":"#/$defs/Symbol"},"unrealizedPnl":{"anyOf":[{"$ref":"#/$defs/DecimalString"},{"type":"null"}]}},"required":["symbol","side","quantity","entryPrice","markPrice","unrealizedPnl","marginCoin"],"type":"object"},"PositionSection":{"additionalProperties":false,"allOf":[{"else":{"properties":{"reason":{"type":"null"}}},"if":{"properties":{"status":{"const":"unavailable"}}},"then":{"properties":{"items":{"maxItems":0},"reason":{"$ref":"#/$defs/SectionReason"}}}},{"if":{"properties":{"status":{"const":"not_applicable"}}},"then":{"properties":{"items":{"maxItems":0}}}}],"properties":{"items":{"items":{"$ref":"#/$defs/PositionItem"},"maxItems":1000,"type":"array"},"reason":{"anyOf":[{"$ref":"#/$defs/SectionReason"},{"type":"null"}]},"status":{"$ref":"#/$defs/SectionStatus"}},"required":["status","reason","items"],"type":"object"},"QuantityString":{"maxLength":97,"pattern":"^(?:0|[1-9][0-9]{0,63})(?:\\.[0-9]{1,32})?$(?![\\s\\S])","type":"string"},"SectionReason":{"enum":["PROVIDER_FAILED","PERMISSION_REJECTED","RATE_LIMITED","PROVIDER_UNAVAILABLE"],"type":"string"},"SectionStatus":{"enum":["ok","unavailable","not_applicable"],"type":"string"},"Symbol":{"maxLength":64,"minLength":1,"pattern":"^[A-Za-z0-9][A-Za-z0-9._-]*$(?![\\s\\S])","type":"string"},"UnifiedFuturesProduct":{"allOf":[{"$ref":"#/$defs/AccountProduct"},{"properties":{"balances":{"properties":{"status":{"const":"not_applicable"}}},"positions":{"properties":{"status":{"enum":["ok","unavailable"]}}},"product":{"enum":["USDT-FUTURES","USDC-FUTURES","COIN-FUTURES"]}}}]},"UnifiedProduct":{"allOf":[{"$ref":"#/$defs/AccountProduct"},{"properties":{"balances":{"properties":{"status":{"enum":["ok","unavailable"]}}},"positions":{"properties":{"status":{"const":"not_applicable"}}},"product":{"enum":["unified"]}}}]}},"$id":"https://contracts.tesia.ai/api/v0.17.0/account-snapshot.schema.json","$schema":"https://json-schema.org/draft/2020-12/schema","description":"Read-only connected Bitget account snapshot. Product uniqueness and UTC calendar validity are normative semantic checks."};
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
export function strictParseApiV17(payload:string,request=false):unknown{
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
export function snapshotApiV17(input:unknown,request=false):unknown{
 try{return strictParseApiV17(JSON.stringify(clone(input)),request);}catch{return bad();}
}
function check(value:any,rule:any):boolean{
 if(rule.$ref)return check(value,definitions[rule.$ref.split('/').at(-1)]);
 if(Object.hasOwn(rule,'const')&&value!==rule.const)return false;
 if(rule.enum&&!rule.enum.includes(value))return false;
 if(rule.anyOf&&!rule.anyOf.some((part:any)=>check(value,part)))return false;
 if(rule.allOf&&!rule.allOf.every((part:any)=>check(value,part)))return false;
 if(rule.if&&!check(value,check(value,rule.if)?rule.then??{}:rule.else??{}))return false;
 const kind=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(rule.type&&kind!==rule.type)return false;
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
  if(rule.items&&value.some((item:any)=>!check(item,rule.items)))return false;
 }
 return true;
}
function utc(value:string):boolean{
 const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10));
 const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return year>=1&&month>=1&&month<=12&&day>=1&&day<=days[month-1]!&&Number(value.slice(11,13))<=23&&Number(value.slice(14,16))<=59&&Number(value.slice(17,19))<=59;
}
export function validateApiV17(input:unknown,schemaName='AccountResponse'):boolean{
 try{
  if(!['AccountResponse','ErrorEnvelope'].includes(schemaName))return false;
  const value:any=snapshotApiV17(input);if(!check(value,definitions[schemaName]))return false;
  if(schemaName==='AccountResponse'){
   if(!utc(value.data.observedAt))return false;
   const products:string[]=value.data.products.map((row:any)=>row.product);
   const expected=[value.data.accountMode==='classic'?'spot':'unified','USDT-FUTURES','USDC-FUTURES','COIN-FUTURES'];
   if(new Set(products).size!==4||expected.some(name=>!products.includes(name)))return false;
  }
  return true;
 }catch{return false;}
}
export function freezeApiV17<T>(value:T):DeepReadonly<T>{if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freezeApiV17(child);Object.freeze(value);}return value as DeepReadonly<T>;}
