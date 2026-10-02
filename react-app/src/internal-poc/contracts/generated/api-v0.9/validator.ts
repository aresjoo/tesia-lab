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
const nativeSchemas: Record<string, any> = {"https://contracts.tesia.ai/api/v0.2.0/common.schema.json":{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json","title":"TESIA hosted authentication API common types","$defs":{"ApiContractVersion":{"const":"0.2.0"},"CanonicalTimestamp":{"type":"string","format":"date-time","pattern":"^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})?Z$(?![\\s\\S])"},"Revision":{"type":"string","pattern":"^(?:0|[1-9][0-9]{0,18}|1[0-7][0-9]{18}|18[0-3][0-9]{17}|184[0-3][0-9]{16}|1844[0-5][0-9]{15}|18446[0-6][0-9]{14}|184467[0-3][0-9]{13}|1844674[0-3][0-9]{12}|184467440[0-6][0-9]{10}|1844674407[0-2][0-9]{9}|18446744073[0-6][0-9]{8}|1844674407370[0-8][0-9]{6}|18446744073709[0-4][0-9]{5}|184467440737095[0-4][0-9]{4}|18446744073709550[0-9]{3}|18446744073709551[0-5][0-9]{2}|1844674407370955160[0-9]|1844674407370955161[0-5])$(?![\\s\\S])"},"StrongETag":{"type":"string","pattern":"^\"[A-Za-z0-9_-]{16,128}\"$(?![\\s\\S])"},"IdempotencyKey":{"type":"string","pattern":"^[A-Za-z0-9_-]{16,128}$(?![\\s\\S])"},"CsrfToken":{"type":"string","pattern":"^[!-~]{16,256}$(?![\\s\\S])"},"RequestId":{"type":"string","pattern":"^req_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])"},"TraceId":{"type":"string","pattern":"^trace_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])"},"TransactionId":{"type":"string","pattern":"^oidc_tx_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])"},"ResultId":{"type":"string","pattern":"^oauth_result_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])"},"SessionId":{"type":"string","pattern":"^session_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])"},"ResponseMeta":{"type":"object","additionalProperties":false,"required":["apiContractVersion","requestId","traceId","resourceRevision"],"properties":{"apiContractVersion":{"$ref":"#/$defs/ApiContractVersion"},"requestId":{"$ref":"#/$defs/RequestId"},"traceId":{"$ref":"#/$defs/TraceId"},"resourceRevision":{"oneOf":[{"$ref":"#/$defs/Revision"},{"type":"null"}]}}},"ErrorCode":{"enum":["BAD_REQUEST","AUTHENTICATION_REQUIRED","FORBIDDEN","NOT_FOUND","CSRF_INVALID","ORIGIN_INVALID","PRECONDITION_REQUIRED","PRECONDITION_FAILED","IDEMPOTENCY_KEY_INVALID","IDEMPOTENCY_IN_PROGRESS","IDEMPOTENCY_KEY_REUSED","AUTH_TRANSACTION_CONFLICT","AUTH_TRANSACTION_EXPIRED","AUTH_RESULT_NOT_READY","AUTH_RESULT_EXPIRED","AUTH_BINDING_CONFLICT","INVALID_STATE_TRANSITION","CONTRACT_VERSION_UNSUPPORTED","INTERNAL_ERROR"]},"ErrorEnvelope":{"type":"object","additionalProperties":false,"required":["meta","error"],"properties":{"meta":{"$ref":"#/$defs/ResponseMeta"},"error":{"type":"object","additionalProperties":false,"required":["code","message"],"properties":{"code":{"$ref":"#/$defs/ErrorCode"},"message":{"type":"string","minLength":1,"maxLength":240},"field":{"type":"string","pattern":"^/(?:[A-Za-z0-9_~-]+/?)*$(?![\\s\\S])","maxLength":160}}}}}}},"https://contracts.tesia.ai/api/v0.9.0/common.schema.json":{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://contracts.tesia.ai/api/v0.9.0/common.schema.json","$defs":{"ChallengeId":{"type":"string","pattern":"^email_challenge_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])"},"ResponseMeta":{"type":"object","additionalProperties":false,"required":["apiContractVersion","requestId","traceId","resourceRevision"],"properties":{"apiContractVersion":{"const":"0.9.0"},"requestId":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/RequestId"},"traceId":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/TraceId"},"resourceRevision":{"oneOf":[{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/Revision"},{"type":"null"}]}}},"ErrorCode":{"enum":["BAD_REQUEST","AUTHENTICATION_REQUIRED","FORBIDDEN","NOT_FOUND","CSRF_INVALID","ORIGIN_INVALID","PRECONDITION_REQUIRED","PRECONDITION_FAILED","IDEMPOTENCY_KEY_INVALID","IDEMPOTENCY_IN_PROGRESS","IDEMPOTENCY_KEY_REUSED","AUTH_TRANSACTION_CONFLICT","AUTH_BINDING_CONFLICT","CHALLENGE_EXPIRED","CODE_INVALID","RATE_LIMITED","MAIL_DISABLED","INTERNAL_ERROR"]},"ErrorEnvelope":{"type":"object","additionalProperties":false,"required":["meta","error"],"properties":{"meta":{"$ref":"#/$defs/ResponseMeta"},"error":{"type":"object","additionalProperties":false,"required":["code","message"],"properties":{"code":{"$ref":"#/$defs/ErrorCode"},"message":{"const":"Authentication request failed."}}}}}}},"https://contracts.tesia.ai/api/v0.9.0/identity-session.schema.json":{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://contracts.tesia.ai/api/v0.9.0/identity-session.schema.json","$defs":{"EmailChallengeRequest":{"type":"object","additionalProperties":false,"required":["email"],"properties":{"email":{"type":"string","minLength":3,"pattern":"^[ -~]+$(?![\\s\\S])"}}},"EmailVerificationRequest":{"type":"object","additionalProperties":false,"required":["code"],"properties":{"code":{"type":"string","pattern":"^[0-9]{6}$(?![\\s\\S])"}}},"EmailChallengeData":{"type":"object","additionalProperties":false,"required":["challengeId","initiatingSessionId","initiatingSessionRevision","initiatingSessionEtag","issuedAt","expiresAt","resendAllowedAt","deliveryStatus"],"properties":{"challengeId":{"$ref":"common.schema.json#/$defs/ChallengeId"},"initiatingSessionId":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/SessionId"},"initiatingSessionRevision":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/Revision"},"initiatingSessionEtag":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/StrongETag"},"issuedAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"},"expiresAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"},"resendAllowedAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"},"deliveryStatus":{"enum":["ACCEPTED","UNKNOWN","FAILED"]}}},"EmailChallengeEnvelope":{"type":"object","additionalProperties":false,"required":["meta","data"],"properties":{"meta":{"$ref":"common.schema.json#/$defs/ResponseMeta"},"data":{"$ref":"#/$defs/EmailChallengeData"}}},"AuthenticatedSession":{"type":"object","additionalProperties":false,"required":["sessionId","state","revision","issuedAt","expiresAt"],"properties":{"sessionId":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/SessionId"},"state":{"const":"AUTHENTICATED"},"revision":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/Revision"},"issuedAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"},"expiresAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"}}},"HandoffReservation":{"type":"object","additionalProperties":false,"required":["challengeId","initiatingSessionId","initiatingSessionRevision","initiatingSessionEtag","authenticatedSessionId","state","expiresAt"],"properties":{"challengeId":{"$ref":"common.schema.json#/$defs/ChallengeId"},"initiatingSessionId":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/SessionId"},"initiatingSessionRevision":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/Revision"},"initiatingSessionEtag":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/StrongETag"},"authenticatedSessionId":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/SessionId"},"state":{"const":"RESERVED_FOR_CLAIM"},"expiresAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"}}},"EmailVerificationData":{"type":"object","additionalProperties":false,"required":["challengeId","challengeExpiresAt","session","handoffReservation"],"properties":{"challengeId":{"$ref":"common.schema.json#/$defs/ChallengeId"},"challengeExpiresAt":{"$ref":"https://contracts.tesia.ai/api/v0.2.0/common.schema.json#/$defs/CanonicalTimestamp"},"session":{"$ref":"#/$defs/AuthenticatedSession"},"handoffReservation":{"$ref":"#/$defs/HandoffReservation"}}},"EmailVerificationEnvelope":{"type":"object","additionalProperties":false,"required":["meta","data"],"properties":{"meta":{"$ref":"common.schema.json#/$defs/ResponseMeta"},"data":{"$ref":"#/$defs/EmailVerificationData"}}}}}};
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


export const strictParseApiV09=(payload:string):unknown=>strictParseReportingV01(payload);
export const snapshotApiV09=(input:unknown):unknown=>strictParseReportingV01(stable(input));
export function canonicalEmailAddress(value:unknown):string{
 if(typeof value!=='string'||/[^\x20-\x7e]/.test(value))throw Error('BAD_REQUEST');
 const address=value.replace(/^ +| +$/g,'');
 if(address.length<3||address.length>254||address.split('@').length!==2)throw Error('BAD_REQUEST');
 const [local,domain]=address.split('@') as [string,string],labels=domain.split('.');
 if(local.length<1||local.length>64||!/^([A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)||labels.length<2||labels.some(label=>!(/^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/).test(label)))throw Error('BAD_REQUEST');
 return local+'@'+domain.toLowerCase();
}
function emailMicros(value:string):bigint{
 const [whole,part='']=value.slice(0,-1).split('.');
 return BigInt(Date.parse(whole+'Z'))*1000n+BigInt(part.padEnd(6,'0'));
}
export async function validateApiV09(input:unknown,schemaRef:string):Promise<boolean>{
 try{
  const value=strictParseReportingV01(stable(input)) as any;
  if(!/^(common|identity-session)\.schema\.json#\/\$defs\/[A-Za-z]+$/.test(schemaRef))return false;
  const[s,id]=nativeResolve(schemaRef,'https://contracts.tesia.ai/api/v0.9.0/common.schema.json');
  if(!s||!nativeCheck(value,s,id))return false;
  const kind=schemaRef.split('#/$defs/')[1]!,data=kind.endsWith('Envelope')&&kind!=='ErrorEnvelope'?value.data:value;
  if(kind==='EmailChallengeRequest')canonicalEmailAddress(data.email);
  if(kind==='EmailChallengeData'||kind==='EmailChallengeEnvelope'){
   const issued=emailMicros(data.issuedAt);
   if(emailMicros(data.expiresAt)!==issued+300000000n||emailMicros(data.resendAllowedAt)!==issued+30000000n)return false;
   if(kind.endsWith('Envelope')&&value.meta.resourceRevision!==data.initiatingSessionRevision)return false;
  }
  if(kind==='EmailVerificationData'||kind==='EmailVerificationEnvelope'){
   const session=data.session,handoff=data.handoffReservation,issued=emailMicros(session.issuedAt),expiry=emailMicros(session.expiresAt),deadline=emailMicros(data.challengeExpiresAt);
   if(data.challengeId!==handoff.challengeId||session.sessionId!==handoff.authenticatedSessionId||session.sessionId===handoff.initiatingSessionId||session.expiresAt!==handoff.expiresAt||!(issued<deadline&&deadline<=issued+300000000n)||!(issued<expiry&&expiry<=issued+43200000000n))return false;
   if(kind.endsWith('Envelope')&&value.meta.resourceRevision!==session.revision)return false;
  }
  return true;
 }catch{return false;}
}
