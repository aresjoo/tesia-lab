import type {DeepReadonly} from './types.js';
// Frozen reporting/v0.1 canonical/hash/strict-parser helpers; no issuer.
type JsonRecord=Record<string,unknown>;
const record = (v: unknown): v is JsonRecord => typeof v === "object" && v !== null && !Array.isArray(v);
const plainRecord = (v: unknown): v is JsonRecord => {if(!record(v))return false;const prototype=Object.getPrototypeOf(v);return prototype===Object.prototype||prototype===null;};
const own = (v: JsonRecord, k: string): boolean => Object.prototype.hasOwnProperty.call(v, k);
const unicodeScalarNfc=(v:string):boolean=>{if(v!==v.normalize("NFC"))return false;for(let i=0;i<v.length;i++){const unit=v.charCodeAt(i);if(unit>=0xd800&&unit<=0xdbff){if(i+1>=v.length){return false;}const next=v.charCodeAt(++i);if(next<0xdc00||next>0xdfff)return false;}else if(unit>=0xdc00&&unit<=0xdfff)return false;}return true;};
const codePointCompare=(a:string,b:string):number=>{const left=Array.from(a),right=Array.from(b),length=Math.min(left.length,right.length);for(let i=0;i<length;i++){const delta=left[i]!.codePointAt(0)!-right[i]!.codePointAt(0)!;if(delta!==0)return delta;}return left.length-right.length;};
type CanonicalState={nodes:number;ancestors:Set<object>};
const stable = (v:unknown,d=0,state:CanonicalState={nodes:0,ancestors:new Set<object>()}):string => {if(d>32)throw new Error("REPORTING_DOCUMENT_TOO_DEEP");if(++state.nodes>20000)throw new Error("REPORTING_DOCUMENT_TOO_COMPLEX");if(v===null)return"null";if(typeof v==="string"){if(!unicodeScalarNfc(v))throw new Error("REPORTING_NON_NFC_STRING");return JSON.stringify(v);}if(typeof v==="boolean")return JSON.stringify(v);if(typeof v==="number"){if(!Number.isFinite(v))throw new Error("REPORTING_NONFINITE_NUMBER");if(!Number.isInteger(v))throw new Error("REPORTING_FLOAT_FORBIDDEN");if(!Number.isSafeInteger(v))throw new Error("REPORTING_CANONICAL_TYPE_INVALID");return JSON.stringify(v);}if(typeof v!=="object"||state.ancestors.has(v))throw new Error("REPORTING_CANONICAL_TYPE_INVALID");state.ancestors.add(v);try{if(Array.isArray(v)){if(Object.keys(v).length!==v.length||!Array.from({length:v.length},(_,index)=>Object.prototype.hasOwnProperty.call(v,index)).every(Boolean))throw new Error("REPORTING_CANONICAL_TYPE_INVALID");return`[${v.map(x=>stable(x,d+1,state)).join(",")}]`;}if(plainRecord(v)){const objectKeys=Object.keys(v);if(!objectKeys.every(unicodeScalarNfc))throw new Error("REPORTING_NON_NFC_STRING");return`{${objectKeys.sort(codePointCompare).map(k=>`${JSON.stringify(k)}:${stable(v[k],d+1,state)}`).join(",")}}`;}throw new Error("REPORTING_CANONICAL_TYPE_INVALID");}finally{state.ancestors.delete(v);}};
const boundedStable=(v:unknown):{canonical:string;bytes:Uint8Array}=>{const canonical=stable(v),bytes=new TextEncoder().encode(canonical);if(bytes.length>1048576)throw new Error("REPORTING_DOCUMENT_TOO_LARGE");return{canonical,bytes};};
const digest = async(domain:string,v:unknown):Promise<string>=>{const canonicalBytes=boundedStable(v).bytes,prefix=new TextEncoder().encode(`${domain}\0`),bytes=new Uint8Array(prefix.length+canonicalBytes.length);bytes.set(prefix);bytes.set(canonicalBytes,prefix.length);const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");};
const withoutHash=(v:JsonRecord):JsonRecord=>{boundedStable(v);if(!plainRecord(v))throw new Error("REPORTING_CANONICAL_TYPE_INVALID");return Object.fromEntries(Object.entries(v).filter(([k])=>k!=="contentHash"));};
const reportingProjectionContentHash = (v:JsonRecord):Promise<string>=>digest("tesia.reporting.private-actual-backtest-projection.v0.1.0",withoutHash(v));
const reportingReceiptContentHash = (v:JsonRecord):Promise<string>=>digest("tesia.reporting.private-actual-projection-verification-receipt.v0.1.0",withoutHash(v));
const reportingEnvelopeContentHash = (v:JsonRecord):Promise<string>=>digest("tesia.reporting.private-actual-backtest-report-envelope.v0.1.0",withoutHash(v));
class StrictParser{
  private i=0;private nodes=0;constructor(private readonly s:string){}
  parse():unknown{if(this.s.charCodeAt(0)===0xfeff)throw new Error("REPORTING_BOM_FORBIDDEN");const v=this.value(0);this.ws();if(this.i!==this.s.length)throw new Error("REPORTING_JSON_INVALID");return v;}
  private ws(){while(/[\x20\t\r\n]/.test(this.s[this.i]??""))this.i++;}
  private bump(d:number){if(d>32)throw new Error("REPORTING_DOCUMENT_TOO_DEEP");if(++this.nodes>20000)throw new Error("REPORTING_DOCUMENT_TOO_COMPLEX");}
  private value(d:number):unknown{this.bump(d);this.ws();const c=this.s[this.i];if(c==="{")return this.object(d+1);if(c==="[")return this.array(d+1);if(c==='"')return this.string();for(const [x,v]of[["true",true],["false",false],["null",null]]as const)if(this.s.startsWith(x,this.i)){this.i+=x.length;return v;}return this.number();}
  private number():number{const start=this.i;if(this.s[this.i]==="-")this.i++;const first=this.s[this.i];if(first==="0")this.i++;else if(first!==undefined&&first>="1"&&first<="9"){this.i++;while((this.s[this.i]??"")>="0"&&(this.s[this.i]??"")<="9")this.i++;}else throw new Error("REPORTING_JSON_INVALID");if(/[.eE]/.test(this.s[this.i]??""))throw new Error("REPORTING_FLOAT_FORBIDDEN");const value=Number(this.s.slice(start,this.i));if(!Number.isSafeInteger(value))throw new Error("REPORTING_CANONICAL_TYPE_INVALID");return value;}
  private string():string{const start=this.i++;let escaped=false;for(;this.i<this.s.length;this.i++){const c=this.s[this.i]!;if(!escaped&&c==='"'){this.i++;let v:string;try{v=JSON.parse(this.s.slice(start,this.i)) as string;}catch{throw new Error("REPORTING_JSON_INVALID");}if(!unicodeScalarNfc(v))throw new Error("REPORTING_NON_NFC_STRING");return v;}escaped=!escaped&&c==='\\';if(c!=="\\")escaped=false;}throw new Error("REPORTING_JSON_INVALID");}
  private object(d:number):JsonRecord{this.i++;const out=Object.create(null) as JsonRecord;const seen=new Set<string>();this.ws();if(this.s[this.i]==="}"){this.i++;return out;}for(;;){this.ws();if(this.s[this.i]!=="\"")throw new Error("REPORTING_JSON_INVALID");const k=this.string();if(seen.has(k))throw new Error("REPORTING_DUPLICATE_KEY");seen.add(k);this.ws();if(this.s[this.i++]!==":")throw new Error("REPORTING_JSON_INVALID");Object.defineProperty(out,k,{value:this.value(d),enumerable:true,writable:true,configurable:true});this.ws();const c=this.s[this.i++];if(c==="}")return out;if(c!==",")throw new Error("REPORTING_JSON_INVALID");}}
  private array(d:number):unknown[]{this.i++;const out:unknown[]=[];this.ws();if(this.s[this.i]==="]"){this.i++;return out;}for(;;){out.push(this.value(d));this.ws();const c=this.s[this.i++];if(c==="]")return out;if(c!==",")throw new Error("REPORTING_JSON_INVALID");}}
}
const strictParseReportingV01=(payload:string):unknown=>{if(new TextEncoder().encode(payload).length>1048576)throw new Error("REPORTING_DOCUMENT_TOO_LARGE");return new StrictParser(payload).parse();};

// Literal schema interpreter. No server context, source custody or issuer API.
const nativeSchemas: Record<string, any> = {"https://contracts.tesia.ai/api/v0.12.0/exchange-connections.schema.json":{"$defs":{"CatalogResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.12.0"},"data":{"additionalProperties":false,"properties":{"providers":{"items":{"additionalProperties":false,"allOf":[{"else":{"properties":{"reason":{"$ref":"#/$defs/StableCode"}}},"if":{"properties":{"available":{"const":true}}},"then":{"properties":{"reason":{"type":"null"}}}}],"properties":{"available":{"type":"boolean"},"exchangeId":{"$ref":"#/$defs/ExchangeId"},"reason":{"anyOf":[{"$ref":"#/$defs/StableCode"},{"type":"null"}]}},"required":["exchangeId","available","reason"],"type":"object"},"maxItems":6,"minItems":6,"type":"array","uniqueItems":true}},"required":["providers"],"type":"object"}},"required":["apiContractVersion","data"],"type":"object"},"ConnectionsResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.12.0"},"data":{"additionalProperties":false,"properties":{"connections":{"items":{"additionalProperties":false,"allOf":[{"if":{"properties":{"permissionsVerified":{"const":false}}},"then":{"properties":{"permissions":{"properties":{"futuresTrade":{"const":false},"spotTrade":{"const":false}}}}}}],"properties":{"connectedAt":{"$ref":"#/$defs/Timestamp"},"connectionId":{"$ref":"#/$defs/Id"},"exchangeId":{"$ref":"#/$defs/ExchangeId"},"maskedAccountLabel":{"maxLength":64,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]*\\*[^\\x00-\\x1f\\x7f]*$(?![\\s\\S])","type":"string"},"permissions":{"additionalProperties":false,"properties":{"futuresTrade":{"type":"boolean"},"read":{"const":true},"spotTrade":{"type":"boolean"},"withdrawal":{"const":false}},"required":["read","spotTrade","futuresTrade","withdrawal"],"type":"object"},"permissionsVerified":{"type":"boolean"},"status":{"enum":["connected","disconnected"]}},"required":["connectionId","exchangeId","maskedAccountLabel","connectedAt","status","permissions","permissionsVerified"],"type":"object"},"maxItems":100,"type":"array"}},"required":["connections"],"type":"object"}},"required":["apiContractVersion","data"],"type":"object"},"DisconnectResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.12.0"},"data":{"additionalProperties":false,"properties":{"connectionId":{"$ref":"#/$defs/Id"},"revocation":{"enum":["local_only","revoked"]},"status":{"const":"disconnected"}},"required":["connectionId","status","revocation"],"type":"object"}},"required":["apiContractVersion","data"],"type":"object"},"ErrorCode":{"enum":["BAD_REQUEST","AUTHENTICATION_REQUIRED","FORBIDDEN","CSRF_INVALID","ORIGIN_INVALID","NOT_FOUND","PROVIDER_UNAVAILABLE","TRANSACTION_EXPIRED","TRANSACTION_REPLAYED","PROVIDER_FAILED","PERMISSION_REJECTED","ACCOUNT_CONFLICT","RATE_LIMITED","INTERNAL_ERROR"],"type":"string"},"ErrorEnvelope":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.12.0"},"error":{"additionalProperties":false,"properties":{"code":{"$ref":"#/$defs/ErrorCode"},"message":{"maxLength":160,"minLength":1,"pattern":"^[^\\x00-\\x1f\\x7f]+$(?![\\s\\S])","type":"string"}},"required":["code","message"],"type":"object"}},"required":["apiContractVersion","error"],"type":"object"},"ExchangeId":{"enum":["bybit","bitget","bingx","gate","mexc","htx"],"type":"string"},"Id":{"maxLength":128,"minLength":16,"pattern":"^[A-Za-z0-9_-]+$(?![\\s\\S])","type":"string"},"StableCode":{"maxLength":64,"minLength":2,"pattern":"^[A-Z][A-Z0-9_]*$(?![\\s\\S])","type":"string"},"StartRequest":{"additionalProperties":false,"properties":{"exchangeId":{"$ref":"#/$defs/ExchangeId"}},"required":["exchangeId"],"type":"object"},"Timestamp":{"format":"date-time","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})?Z$(?![\\s\\S])","type":"string"},"TransactionResponse":{"additionalProperties":false,"properties":{"apiContractVersion":{"const":"0.12.0"},"data":{"additionalProperties":false,"allOf":[{"else":{"properties":{"connectionId":{"type":"null"}}},"if":{"properties":{"status":{"const":"connected"}}},"then":{"properties":{"authorizationUrl":{"type":"null"},"connectionId":{"$ref":"#/$defs/Id"},"failureCode":{"type":"null"}}}},{"else":{"properties":{"failureCode":{"type":"null"}}},"if":{"properties":{"status":{"const":"failed"}}},"then":{"properties":{"failureCode":{"$ref":"#/$defs/ErrorCode"}}}},{"if":{"properties":{"status":{"not":{"const":"pending"}}}},"then":{"properties":{"authorizationUrl":{"type":"null"}}}}],"properties":{"authorizationUrl":{"anyOf":[{"maxLength":4096,"minLength":12,"pattern":"^https://[^\\s#\\\\]+$(?![\\s\\S])","type":"string"},{"type":"null"}]},"connectionId":{"anyOf":[{"$ref":"#/$defs/Id"},{"type":"null"}]},"exchangeId":{"$ref":"#/$defs/ExchangeId"},"expiresAt":{"$ref":"#/$defs/Timestamp"},"failureCode":{"anyOf":[{"$ref":"#/$defs/ErrorCode"},{"type":"null"}]},"status":{"enum":["pending","processing","connected","failed","cancelled","expired"]},"transactionId":{"$ref":"#/$defs/Id"}},"required":["transactionId","exchangeId","status","expiresAt","authorizationUrl","connectionId","failureCode"],"type":"object"}},"required":["apiContractVersion","data"],"type":"object"}},"$id":"https://contracts.tesia.ai/api/v0.12.0/exchange-connections.schema.json","$schema":"https://json-schema.org/draft/2020-12/schema","title":"TETH exchange connection wire v0.12.0 \u2014 no trading authority"}};
function nativeResolve(ref:string,base:string):[any,string]{
 const url=new URL(ref,base),id=url.origin+url.pathname;let value=nativeSchemas[id];
 if(!value)throw Error('BAD_REQUEST');
 for(const part of url.hash.slice(2).split('/'))if(part)value=value[part.replace(/~1/g,'/').replace(/~0/g,'~')];
 return[value,id];
}
function nativeTimestamp(value:string):boolean{
 const m=/^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]+))?(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(value);
 if(!m||m[1]!.startsWith('0000'))return false;
 const local=Date.parse(m[1]+'Z');
 if(!Number.isFinite(local)||new Date(local).toISOString().slice(0,19)!==m[1])return false;
 return Number.isFinite(Date.parse(value));
}
function nativeCheck(value:any,s:any,base:string):boolean{
 if(s===true)return true;if(s===false)return false;
 if(s.$ref){const[t,id]=nativeResolve(s.$ref,base);if(!nativeCheck(value,t,id))return false;}
 if('const'in s&&stable(value)!==stable(s.const))return false;
 if(s.enum&&!s.enum.some((x:any)=>stable(value)===stable(x)))return false;
 if(s.allOf&&!s.allOf.every((x:any)=>nativeCheck(value,x,base)))return false;
 if(s.anyOf&&!s.anyOf.some((x:any)=>nativeCheck(value,x,base)))return false;
 if(s.oneOf&&s.oneOf.filter((x:any)=>nativeCheck(value,x,base)).length!==1)return false;
 if(s.not&&nativeCheck(value,s.not,base))return false;
 if(s.if){if(nativeCheck(value,s.if,base)){if(s.then&&!nativeCheck(value,s.then,base))return false;}else if(s.else&&!nativeCheck(value,s.else,base))return false;}
 if(s.type){const types=Array.isArray(s.type)?s.type:[s.type];if(!types.some((t:string)=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?plainRecord(value):t==='integer'?typeof value==='number'&&Number.isSafeInteger(value):t==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===t))return false;}
 if(typeof value==='string'){
  if(s.pattern&&!new RegExp(s.pattern).test(value))return false;
  if(s.minLength!==undefined&&[...value].length<s.minLength||s.maxLength!==undefined&&[...value].length>s.maxLength)return false;
  if(s.format==='date-time'&&!nativeTimestamp(value))return false;
 }
 if(typeof value==='number'&&(s.minimum!==undefined&&value<s.minimum||s.maximum!==undefined&&value>s.maximum))return false;
 if(Array.isArray(value)){
  if(s.minItems!==undefined&&value.length<s.minItems||s.maxItems!==undefined&&value.length>s.maxItems)return false;
  if(s.uniqueItems&&new Set(value.map(x=>stable(x))).size!==value.length)return false;
  for(let i=0;i<value.length;i++){const child=s.prefixItems?.[i]??s.items;if(child!==undefined&&!nativeCheck(value[i],child,base))return false;}
 }
 if(plainRecord(value)){
  if(s.required&&!s.required.every((k:string)=>own(value,k)))return false;
  for(const key of Object.keys(value)){if(s.properties&&own(s.properties,key)){if(!nativeCheck(value[key],s.properties[key],base))return false;}else if(s.additionalProperties===false)return false;}
 }
 return true;
}

export function strictParseApiV12(payload:string,request=false):unknown{
 const maximum=request?8192:262144;
 if(typeof payload!=='string'||payload.length>maximum||new TextEncoder().encode(payload).length>maximum)throw Error('BAD_REQUEST');
 return strictParseReportingV01(payload);
}
export function snapshotApiV12(value:unknown,request=false):unknown{return strictParseApiV12(stable(value),request);}
export function authorizationUrlAllowed(exchangeId:string,value:string):boolean{
 try{
  if(!/^[\x21-\x7e]+$/.test(value)||value.includes('\\'))return false;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!value.startsWith('https://'+url.hostname+'/'))return false;
  if(url.pathname!==value.slice(('https://'+url.hostname).length).split(/[?#]/)[0])return false;
  const targets:Record<string,readonly string[]>={bybit:['www.bybit.com/oauth'],bitget:['www.bitget.com/account/oauth'],bingx:['bingx.com/broker/oauth'],gate:['openplatform.gateapi.io/oauth/authorize'],mexc:['www.mexc.com/auth/authorize'],htx:['www.huobi.com/en-us/broker/empower']};
  return Object.hasOwn(targets,exchangeId)&&targets[exchangeId]!.includes(url.hostname+url.pathname);
 }catch{return false;}
}
export function validateApiV12(input:unknown,schemaName:string):boolean{
 try{
  if(!['StartRequest','CatalogResponse','TransactionResponse','ConnectionsResponse','DisconnectResponse','ErrorEnvelope'].includes(schemaName))return false;
  const value=snapshotApiV12(input,schemaName==='StartRequest') as any;
  const base='https://contracts.tesia.ai/api/v0.12.0/exchange-connections.schema.json';
  const [schema,identity]=nativeResolve('#/$defs/'+schemaName,base);
  if(!nativeCheck(value,schema,identity))return false;
  if(schemaName==='CatalogResponse'&&new Set(value.data.providers.map((row:any)=>row.exchangeId)).size!==value.data.providers.length)return false;
  if(schemaName==='ConnectionsResponse'&&new Set(value.data.connections.map((row:any)=>row.connectionId)).size!==value.data.connections.length)return false;
  if(schemaName==='TransactionResponse'&&value.data.authorizationUrl!==null&&!authorizationUrlAllowed(value.data.exchangeId,value.data.authorizationUrl))return false;
  return true;
 }catch{return false;}
}
export function freezeApiV12<T>(value:T):DeepReadonly<T>{if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freezeApiV12(child);Object.freeze(value);}return value as DeepReadonly<T>;}
