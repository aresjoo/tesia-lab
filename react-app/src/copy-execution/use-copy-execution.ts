import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {TesiaExchangeConnectionsV12Client} from '../internal-poc/contracts/generated/api-v0.12/client.js'
import type {ConnectionsResponse,DeepReadonly as V12Readonly} from '../internal-poc/contracts/generated/api-v0.12/types.js'
import {TesiaBitgetAccountV17Client} from '../internal-poc/contracts/generated/api-v0.17/client.js'
import type {AccountSnapshot,DeepReadonly as V17Readonly} from '../internal-poc/contracts/generated/api-v0.17/types.js'
import {createExchangeConnectionsTransport} from '../exchange-connect/transport'
import {accountConnectionBinding,createBitgetAccountTransport} from '../exchange-connect/account-read'
import {catalogueSourceSha} from '../client-catalogue'
import type {CatalogueCopySettings} from '../client-catalogue-copy-setup'
import {createCopyTransport} from './transport'
import {createCandidateCopyController,CopyControllerError} from './controller'
import {api18CandidateFixture} from './candidate-fixture'
import {TesiaBitgetCopyV18Client} from './fixtures/api-v0.18/client.js'
import type {ApprovedVersion,CopySnapshot,CopySummary,DeepReadonly as V18Readonly,Environment,Market} from './fixtures/api-v0.18/types.js'
import type {CopyPresentation,CopyScope,IssuedSourceBinding,SourceSelection} from './presentation'
import type {CatalogueCopyExecutionPort, CatalogueCopySource} from './catalogue-port'
import { readExecutionMinimum, minimumForPolicy, decimalAtLeast } from '../client-execution-minimum'
import { createCopyMutationDispatchObserver, waitForCopyStartReadiness } from './start-readiness'

type CreateSettings=Readonly<Pick<CopySnapshot,'allocationUsdt'|'maxLossUsdt'|'maxPositionFraction'|'startMode'>>
const sameCreateSettings=(a:CreateSettings,b:CreateSettings)=>a.allocationUsdt===b.allocationUsdt&&a.maxLossUsdt===b.maxLossUsdt&&a.maxPositionFraction===b.maxPositionFraction&&a.startMode===b.startMode

type DevelopmentCopyInput = Readonly<{
 mode?:'development'
 deployment?:never
 fixture:typeof api18CandidateFixture
 connectionId:string|null
 /** Must come from trusted deployment/account evidence. API12 does not supply it. */
 environment:Environment|null
 readIssuedBinding?:(scope:CopyScope,source:SourceSelection,signal:AbortSignal)=>Promise<IssuedSourceBinding|null>
 readAvailableBudget?:(scope:CopyScope,versionId:string,signal:AbortSignal)=>Promise<{availableUsdt:string;revision:string;expiresAtMs:number}|null>
}>
export type CopyExecutionDeploymentBinding=Readonly<{
 sourceSha:string;sourceId:string;strategyId:string;versionId:string;policyHash:string;environment:Environment
 minimumDescriptor?:CatalogueCopySource['minimumDescriptor']
}>
export type CopyExecutionDeployment=Readonly<{schema:1;environment:Environment;bindings:ReadonlyArray<CopyExecutionDeploymentBinding>}>
export type ServiceCopyInput=Readonly<{mode:'service';deployment:CopyExecutionDeployment;fixture?:never}>
export type CandidateCopyInput=DevelopmentCopyInput|ServiceCopyInput
type SessionPort={current:()=>Promise<{body:{data:{sessionId:string;state:string}}}>;csrf:()=>Promise<{body:{data:{csrfToken:string}}}>}
type Budget=NonNullable<Awaited<ReturnType<NonNullable<DevelopmentCopyInput['readAvailableBudget']>>>>
type Connection=V12Readonly<ConnectionsResponse['data']['connections'][number]>

const ID=/^[A-Za-z0-9_-]{16,128}$/
const SOURCE_ID=/^[A-Za-z0-9_-]{1,128}$/
const HASH64=/^[a-f0-9]{64}$/
const SOURCE_SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/
const DECIMAL=/^(?:0|[1-9][0-9]{0,63})(?:\.[0-9]{1,32})?$/
const DEPLOYMENT_URL='/assets/copy-execution-deployment.json'
const MAX_DEPLOYMENT_BYTES=262_144

const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>{
 const actual=Object.keys(value).sort(),expected=[...keys].sort()
 return actual.length===expected.length&&actual.every((key,index)=>key===expected[index])
}
function strictJson(raw:string):unknown{
 let at=0
 const ws=()=>{while(at<raw.length&&/[\t\n\r ]/.test(raw[at]!))at++}
 const string=()=>{const start=at++;let escaped=false;while(at<raw.length){const char=raw[at++]!;if(escaped){escaped=false;continue}if(char==='\\'){escaped=true;continue}if(char==='"')return JSON.parse(raw.slice(start,at))}throw Error('INVALID_JSON')}
 const value=(depth:number):unknown=>{
  if(depth>12)throw Error('INVALID_JSON');ws();const char=raw[at]
  if(char==='"')return string()
  if(char==='{'){
   at++;ws();const out:Record<string,unknown>=Object.create(null),seen=new Set<string>();if(raw[at]==='}'){at++;return out}
   for(;;){ws();if(raw[at]!=='"')throw Error('INVALID_JSON');const key=string();if(seen.has(key))throw Error('INVALID_JSON');seen.add(key);ws();if(raw[at++]!==':')throw Error('INVALID_JSON');out[key]=value(depth+1);ws();const next=raw[at++];if(next==='}')return out;if(next!==',')throw Error('INVALID_JSON')}
  }
  if(char==='['){at++;ws();const out:unknown[]=[];if(raw[at]===']'){at++;return out}for(;;){out.push(value(depth+1));ws();const next=raw[at++];if(next===']')return out;if(next!==',')throw Error('INVALID_JSON')}}
  for(const [literal,result]of [['true',true],['false',false],['null',null]]as const)if(raw.startsWith(literal,at)){at+=literal.length;return result}
  const number=/^-?(?:0|[1-9][0-9]*)/.exec(raw.slice(at));if(number){at+=number[0].length;if(/[.eE]/.test(raw[at]??''))throw Error('INVALID_JSON');const parsed=Number(number[0]);if(!Number.isSafeInteger(parsed))throw Error('INVALID_JSON');return parsed}
  throw Error('INVALID_JSON')
 }
 const parsed=value(0);ws();if(at!==raw.length)throw Error('INVALID_JSON');return parsed
}
export function parseCopyExecutionDeployment(raw:string):CopyExecutionDeployment|null{
 try{
  const value=strictJson(raw)
  if(!value||typeof value!=='object'||Array.isArray(value)||!exactKeys(value as Record<string,unknown>,['schema','environment','bindings']))return null
  const root=value as Record<string,unknown>
  if(root.schema!==1||!['production','demo'].includes(root.environment as string)||!Array.isArray(root.bindings)||root.bindings.length>1000)return null
  const seen=new Set<string>(),bindings:CopyExecutionDeploymentBinding[]=[]
  for(const candidate of root.bindings){
   if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return null
   const row=candidate as Record<string,unknown>
   const hasMinimum=Object.hasOwn(row,'minimumDescriptor')
   if(!exactKeys(row,['sourceSha','sourceId','strategyId','versionId','policyHash','environment',...(hasMinimum?['minimumDescriptor']:[])]))return null
   if(['sourceSha','sourceId','strategyId','versionId','policyHash','environment'].some(key=>typeof row[key]!=='string')||!SOURCE_SHA.test(row.sourceSha as string)||!SOURCE_ID.test(row.sourceId as string)||!ID.test(row.strategyId as string)||!ID.test(row.versionId as string)||!HASH64.test(row.policyHash as string)||row.environment!==root.environment)return null
   let minimumDescriptor:CatalogueCopySource['minimumDescriptor']
   if(hasMinimum){
    const descriptor=row.minimumDescriptor
    if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor)||!exactKeys(descriptor as Record<string,unknown>,['policyVersionId','descriptorPolicyHash']))return null
    const value=descriptor as Record<string,unknown>
    if(typeof value.policyVersionId!=='string'||!/^(?:policy_)?[a-f0-9]{64}$/.test(value.policyVersionId)||typeof value.descriptorPolicyHash!=='string'||!HASH64.test(value.descriptorPolicyHash))return null
    minimumDescriptor=Object.freeze({policyVersionId:value.policyVersionId,descriptorPolicyHash:value.descriptorPolicyHash})
   }
   const pair=JSON.stringify([row.sourceSha,row.sourceId]);if(seen.has(pair))return null;seen.add(pair)
   bindings.push(Object.freeze({sourceSha:String(row.sourceSha),sourceId:String(row.sourceId),strategyId:String(row.strategyId),versionId:String(row.versionId),policyHash:String(row.policyHash),environment:row.environment as Environment,...(minimumDescriptor?{minimumDescriptor}:{})}))
  }
  return Object.freeze({schema:1,environment:root.environment as Environment,bindings:Object.freeze(bindings)})
 }catch{return null}
}
export async function loadCopyExecutionDeployment(pin:string,ports:Readonly<{origin:()=>string;fetch:typeof fetch;signal?:AbortSignal}>):Promise<ServiceCopyInput|undefined>{
 if(!HASH64.test(pin))return undefined
 try{
  const origin=new URL(ports.origin()).origin,url=new URL(DEPLOYMENT_URL,origin)
  if(url.origin!==origin||ports.origin()!==origin)return undefined
  const response=await ports.fetch(url.href,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:ports.signal})
  if(response.status===404||!response.ok||response.redirected||response.url!==url.href||ports.origin()!==origin||!response.body)return undefined
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
  try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>MAX_DEPLOYMENT_BYTES)throw Error('DEPLOYMENT_TOO_LARGE');chunks.push(item.value)}}finally{await reader.cancel().catch(()=>undefined)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('')
  if(digest!==pin)return undefined
  const deployment=parseCopyExecutionDeployment(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  return deployment?Object.freeze({mode:'service',deployment}):undefined
 }catch{return undefined}
}

export function resolveCopyExecutionMode(input:CandidateCopyInput|undefined,enabled:boolean,runtime:Readonly<{dev:boolean;hostname:string}>):'off'|'development'|'service'{
 if(!enabled||!input)return'off'
 if(input.mode==='service')return'service'
 return runtime.dev&&['localhost','127.0.0.1','[::1]'].includes(runtime.hostname)&&input.fixture===api18CandidateFixture?'development':'off'
}
export function issuedProductionBinding(deployment:CopyExecutionDeployment,source:SourceSelection):CopyExecutionDeploymentBinding|null{
 const found=deployment.bindings.filter(row=>row.sourceSha===source.sourceSha&&row.sourceId===source.sourceId)
 return found.length===1?found[0]!:null
}
export async function readProductionIssuedVersion(client:TesiaBitgetCopyV18Client,binding:CopyExecutionDeploymentBinding,signal?:AbortSignal):Promise<V18Readonly<ApprovedVersion>>{
 const value=(await client.getVersion(binding.versionId,{signal})).data
 if(value.status!=='approved'||value.versionId!==binding.versionId||value.strategyId!==binding.strategyId||value.policyHash!==binding.policyHash||value.policy.environment!==binding.environment)throw new CopyControllerError('SOURCE_BINDING_MISMATCH')
 return value
}

const connectionIdentity=(value:Connection)=>JSON.stringify([value.connectionId,value.connectedAt,value.maskedAccountLabel,value.permissionsVerified,value.permissions.read,value.permissions.spotTrade,value.permissions.futuresTrade,value.permissions.withdrawal])
const connectionEligible=(value:Connection,market:Market)=>value.exchangeId==='bitget'&&value.status==='connected'&&value.permissionsVerified&&value.permissions.read&&!value.permissions.withdrawal&&(market==='SPOT'?value.permissions.spotTrade:value.permissions.futuresTrade)
export type ProductionConnectionProof=Readonly<{owner:string;sessionId:string;market:Market;connectionId:string;identity:string}>
export function captureProductionConnectionProof(owner:string,sessionId:string,market:Market,connections:ReadonlyArray<Connection>):ProductionConnectionProof|null{
 const eligible=connections.filter(value=>connectionEligible(value,market))
 return eligible.length===1?Object.freeze({owner,sessionId,market,connectionId:eligible[0]!.connectionId,identity:connectionIdentity(eligible[0]!)}):null
}
export function verifyProductionConnectionProof(proof:ProductionConnectionProof,owner:string,sessionId:string,connections:ReadonlyArray<Connection>,emergency=false):boolean{
 if(proof.owner!==owner||proof.sessionId!==sessionId)return false
 const exact=connections.filter(value=>value.connectionId===proof.connectionId&&connectionIdentity(value)===proof.identity)
 if(exact.length!==1||!connectionEligible(exact[0]!,proof.market))return false
 if(emergency)return true
 const current=captureProductionConnectionProof(owner,sessionId,proof.market,connections)
 return current?.connectionId===proof.connectionId&&current.identity===proof.identity
}
export function productionBudgetFromAccount(account:V17Readonly<AccountSnapshot>,market:Market,nowMs:number,localRevision:string):Budget|null{
 const observedAtMs=Date.parse(account.observedAt),productName=market==='SPOT'?'spot':'USDT-FUTURES'
 if(account.accountMode!=='classic'||!Number.isFinite(observedAtMs)||observedAtMs>nowMs||nowMs-observedAtMs>10_000||!/^local:[A-Za-z0-9_.:-]{1,160}$/.test(localRevision))return null
 const products=account.products.filter(value=>value.product===productName)
 if(products.length!==1||products[0]!.balances.status!=='ok')return null
 const usdt=products[0]!.balances.items.filter(value=>value.coin==='USDT')
 if(usdt.length!==1||usdt[0]!.available===null||!DECIMAL.test(usdt[0]!.available))return null
 return Object.freeze({availableUsdt:usdt[0]!.available,revision:localRevision,expiresAtMs:observedAtMs+10_000})
}

const validDevelopmentBudget=(value:Budget|null):value is Budget=>Boolean(value&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.availableUsdt)&&Number.isFinite(Number(value.availableUsdt))&&Number(value.availableUsdt)<=Number.MAX_SAFE_INTEGER&&value.revision&&Number.isFinite(value.expiresAtMs)&&value.expiresAtMs>Date.now()&&value.expiresAtMs<=Date.now()+10_000)
async function sourceMinimum(source: CatalogueCopySource, signal: AbortSignal) {
 const descriptor=source.minimumDescriptor
 if(!descriptor)return null
 if(!HASH64.test(descriptor.descriptorPolicyHash)||!/^(?:[a-f0-9]{64}|policy_[a-f0-9]{64})$/.test(descriptor.policyVersionId))return null
 const quote=await readExecutionMinimum(signal),item=minimumForPolicy(quote,descriptor.policyVersionId,descriptor.descriptorPolicyHash)
 return item&&quote?{...item,expiresAtMs:Date.parse(quote.expiresAt)}:null
}
function coversBudget(available:string,requested:string){
 const [a,af='']=available.split('.'),[b,bf='']=requested.split('.'),scale=Math.max(af.length,bf.length)
 return BigInt(a+af.padEnd(scale,'0'))>=BigInt(b+bf.padEnd(scale,'0'))
}
function timesPercent(raw:string,percent:number){
 if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))throw new CopyControllerError('INVALID_REQUEST')
 const [whole,fraction='']=raw.split('.'),digits=BigInt(whole+fraction)*BigInt(percent),scale=fraction.length+2
 const padded=digits.toString().padStart(scale+1,'0');return(padded.slice(0,-scale)+'.'+padded.slice(-scale)).replace(/0+$/,'').replace(/\.$/,'')
}
export function useCandidateCopyExecution(input:CandidateCopyInput|undefined,enabled:boolean,sessionPort:SessionPort,
 currentSession:()=>{sessionId:string;sessionState:string}|null,key:string|null):CatalogueCopyExecutionPort|undefined{
 const latest=useRef(currentSession);useLayoutEffect(()=>{latest.current=currentSession})
 const [stored,setPort]=useState<{input:CandidateCopyInput;port:CatalogueCopyExecutionPort}>()
 const mode=resolveCopyExecutionMode(input,enabled,{dev:import.meta.env.DEV,hostname:window.location.hostname})
 useEffect(()=>{
  if(mode==='off'||!key||!input)return
  let retired=false
  const abort=new AbortController()
  const confirmedSession=async()=>{
   const value=(await sessionPort.current()).body.data,now=latest.current()
   if(retired||abort.signal.aborted||value.state!=='AUTHENTICATED'||value.sessionId!==key||now?.sessionState!=='AUTHENTICATED'||now.sessionId!==key)throw new CopyControllerError('SCOPE_CHANGED')
  }
  const dispatch=createCopyMutationDispatchObserver(window.fetch.bind(window))
  const raw=createCopyTransport({origin:()=>window.location.origin,fetch:dispatch.fetch})
  if(mode==='development'){
   const development=input as DevelopmentCopyInput,sourceIds=new Map<string,string>(),sourceHashes=new Map<string,string>()
   const scope:CopyScope|null=development.connectionId&&development.environment?{owner:key,sessionId:key,connectionId:development.connectionId,environment:development.environment}:null
   const controller=createCandidateCopyController({fixture:development.fixture,currentScope:()=>{
    const value=latest.current();return !retired&&value?.sessionState==='AUTHENTICATED'&&value.sessionId===key?scope:null
   },transport:{request:async request=>{await confirmedSession();const value=await raw.request(request);await confirmedSession();return value}},
   csrf:async()=>{await confirmedSession();const value=(await sessionPort.csrf()).body.data.csrfToken;await confirmedSession();return value},readIssuedBinding:development.readIssuedBinding})
   const publish=()=>{
    if(retired)return
    const value:CatalogueCopyExecutionPort={scope:key,controller,moneyUnit:'USDT',
     sourceForCopy:id=>{const state=controller.getSnapshot();return sourceIds.get(state.copies.find(copy=>copy.subscriptionId===id)?.versionId??(state.selectedCopy?.subscriptionId===id?state.selectedCopy.versionId:'')??'')??null},
     copyForSource:(id,sourceSha=catalogueSourceSha)=>{
      const versionId=[...sourceIds].find(([versionId,sourceId])=>sourceId===id&&sourceHashes.get(versionId)===sourceSha)?.[0];if(!versionId)return null
      const selected=controller.getSnapshot().selectedCopy;if(selected?.versionId===versionId)return selected.subscriptionId
      const copies=controller.getSnapshot().copies.filter(copy=>copy.versionId===versionId&&copy.connectionId===scope?.connectionId);return copies.length===1?copies[0].subscriptionId:null
     },prepareSetup:async(sourceId,signal,selection={sourceSha:catalogueSourceSha,sourceId})=>{
      if(!scope||selection.sourceId!==sourceId)return null
      const version=await controller.selectSource(selection,signal)
      sourceIds.set(version.versionId,sourceId);sourceHashes.set(version.versionId,selection.sourceSha)
      if(!development.readAvailableBudget)return null
      const budget=await development.readAvailableBudget(scope,version.versionId,signal);await confirmedSession()
      if(!validDevelopmentBudget(budget)||signal.aborted)return null
      const minimum=selection.minimumDescriptor?await sourceMinimum(selection,signal):null;await confirmedSession()
      if(selection.minimumDescriptor&&(!minimum||minimum.expiresAtMs<=Date.now()||signal.aborted))return null
      const createIntent=crypto.randomUUID(),startIntent=crypto.randomUUID();let submitted=false,startSubmitted=false;let createdSnapshot:V18Readonly<CopySnapshot>|null=null,createdSettings:CreateSettings|null=null
      return{owner:key,sourceSha:selection.sourceSha,strategyId:sourceId,revision:JSON.stringify([version.versionId,version.policyHash,budget.revision]),available:Number(budget.availableUsdt),moneyUnit:'USDT',minimumUsdt:minimum?.minimumAllocationUsdt,
       onConfirm:async(settings:Readonly<CatalogueCopySettings>,request:AbortSignal)=>{
        const allocationUsdt=String(settings.amount),maxLossUsdt=timesPercent(String(settings.amount),Math.abs(settings.loss))
        if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(allocationUsdt))throw new CopyControllerError('INVALID_REQUEST')
        const createSettings:CreateSettings={allocationUsdt,maxLossUsdt,maxPositionFraction:timesPercent(String(settings.cap),1),startMode:settings.existing==='copy'?'current_position':'next_signal'}
        if(createdSettings&&!sameCreateSettings(createdSettings,createSettings))throw new CopyControllerError('IDEMPOTENCY_CONFLICT')
        if(!submitted){
         let minimumExpiresAt=Infinity
         if(selection.minimumDescriptor){const quote=await sourceMinimum(selection,request);await confirmedSession();if(!quote||quote.expiresAtMs<=Date.now()||!decimalAtLeast(allocationUsdt,quote.minimumAllocationUsdt)||!decimalAtLeast(maxLossUsdt,quote.requiredMaxLossUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE');minimumExpiresAt=quote.expiresAtMs}
         // Freshness limits account evidence, never the user's time to fill the original sheet.
         const fresh=await development.readAvailableBudget!(scope,version.versionId,request);await confirmedSession()
         if(minimumExpiresAt<=Date.now()||request.aborted||!validDevelopmentBudget(fresh)||!coversBudget(fresh.availableUsdt,allocationUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
        }
        let created=createdSnapshot
        if(!created){
         const sent=dispatch.watch(createIntent)
         try{created=await controller.create(createSettings,createIntent,request);createdSnapshot=created;createdSettings=createSettings;submitted=true}catch(error){submitted=controller.hasUncertainIntent(createIntent)&&(submitted||sent.dispatched);throw error}finally{sent.release()}
        }
        if(!startSubmitted){
         await waitForCopyStartReadiness(created,signal=>controller.readCopy(created.subscriptionId,signal),request)
         await confirmedSession()
         let minimumExpiresAt=Infinity
         if(selection.minimumDescriptor){const quote=await sourceMinimum(selection,request);await confirmedSession();if(!quote||quote.expiresAtMs<=Date.now()||!decimalAtLeast(allocationUsdt,quote.minimumAllocationUsdt)||!decimalAtLeast(maxLossUsdt,quote.requiredMaxLossUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE');minimumExpiresAt=quote.expiresAtMs}
         const fresh=await development.readAvailableBudget!(scope,version.versionId,request);await confirmedSession()
         if(minimumExpiresAt<=Date.now()||request.aborted||!validDevelopmentBudget(fresh)||!coversBudget(fresh.availableUsdt,allocationUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
        }
        let active
        const sent=dispatch.watch(startIntent)
        try{active=await controller.action('start',created.subscriptionId,created.revision,startIntent,request);startSubmitted=true}catch(error){startSubmitted=controller.hasUncertainIntent(startIntent)&&(startSubmitted||sent.dispatched);throw error}finally{sent.release()}
        if(active.state!=='ACTIVE')throw new CopyControllerError('EXECUTION_UNAVAILABLE')
       }}
     }}
    setPort({input,port:value})
   }
   const disconnect=controller.subscribe(publish);publish()
   void(async()=>{if(!scope)return;try{await confirmedSession();const connections=(await new TesiaExchangeConnectionsV12Client(createExchangeConnectionsTransport()).connections()).data.connections;await confirmedSession();const matched=connections.find(value=>value.connectionId===scope.connectionId);if(!matched||matched.exchangeId!=='bitget'||matched.status!=='connected'||!matched.permissionsVerified||!matched.permissions.read||matched.permissions.withdrawal||!matched.permissions.futuresTrade)throw new CopyControllerError('PERMISSION_REJECTED');controller.bind(scope);await controller.loadLists(abort.signal).catch(()=>undefined)}catch{if(!retired)controller.bind(null)}})()
   return()=>{retired=true;abort.abort();disconnect();controller.dispose()}
  }

  const service=input as ServiceCopyInput,deployment=service.deployment
  const connectionsClient=new TesiaExchangeConnectionsV12Client(createExchangeConnectionsTransport())
  const accountClient=new TesiaBitgetAccountV17Client(createBitgetAccountTransport())
  const copyClient=new TesiaBitgetCopyV18Client(raw)
  type Controller=ReturnType<typeof createCandidateCopyController>
  type CopyBinding=Readonly<{connectionId:string;versionId:string;policyHash:string;environment:Environment;startMode:'current_position'|'next_signal'}>
  type Child=Readonly<{controller:Controller;scope:CopyScope;subscriptions:Set<string>;setupProof:ProductionConnectionProof|null}>
  type KnownCopy=Readonly<{binding:CopyBinding;child:Child}>
  let proof:ProductionConnectionProof|null=null,interaction=0,budgetObservation=0,currentSetup:Child|null=null,disposed=false,restoreSettlement:Promise<void>|null=null
  const children=new Set<Child>(),known=new Map<string,KnownCopy>(),summaries=new Map<string,V18Readonly<CopySummary>>(),childDisconnects=new Map<Child,()=>void>(),listeners=new Set<()=>void>()
  let state:CopyPresentation=Object.freeze({phase:'unavailable',reason:'SOURCE_BINDING_UNAVAILABLE',mutationBusy:false,versions:Object.freeze([]),copies:Object.freeze([]),selectedVersion:null,selectedCopy:null})
  const publish=(patch:Partial<CopyPresentation>={})=>{state=Object.freeze({...state,...patch});for(const listener of listeners)try{listener()}catch{/* UI cannot change server outcomes. */}}
  const syncChildren=()=>{
   const states=[...children].map(value=>value.controller.getSnapshot()),reconciliation=states.find(value=>value.phase==='reconciliation'),error=states.find(value=>value.phase==='error')
   publish({mutationBusy:states.some(value=>value.mutationBusy),...(reconciliation?{phase:'reconciliation' as const,reason:reconciliation.reason}:error?{phase:'error' as const,reason:error.reason}:{})})
  }
  const registerChild=(child:Child)=>{children.add(child);childDisconnects.set(child,child.controller.subscribe(syncChildren));return child}
  const destroyChild=(child:Child)=>{childDisconnects.get(child)?.();childDisconnects.delete(child);children.delete(child);child.controller.dispose()}
  const retireSetup=()=>{interaction++;proof=null;currentSetup=null}
  const readConnections=async()=>{await confirmedSession();const value=(await connectionsClient.connections()).data.connections;await confirmedSession();return value}
  const verifyCurrent=async(expected:ProductionConnectionProof)=>{
   const connections=await readConnections()
   if(retired||proof!==expected||!verifyProductionConnectionProof(expected,key,key,connections)){retireSetup();throw new CopyControllerError('SCOPE_CHANGED')}
  }
  const createChild=(childScope:CopyScope,setupProof:ProductionConnectionProof|null,initialSubscriptions:Iterable<string>=[])=>{
   const subscriptions=new Set(initialSubscriptions)
   const controller=createCandidateCopyController({fixture:api18CandidateFixture,currentScope:()=>{
    const value=latest.current(),authorized=!setupProof||proof===setupProof||subscriptions.size>0
    return !retired&&authorized&&value?.sessionState==='AUTHENTICATED'&&value.sessionId===key?childScope:null
   },transport:{request:async request=>{
    const url=new URL(request.path,window.location.origin),emergency=request.method==='POST'?/^\/api\/v1\/strategy-copies\/([^/]+)\/(?:pause|stop)$/.exec(url.pathname):null
    const read=request.method==='GET'?/^\/api\/v1\/strategy-copies\/([^/]+)$/.exec(url.pathname):null
    const knownId=decodeURIComponent((emergency??read)?.[1]??''),management=Boolean((emergency||read)&&subscriptions.has(knownId))
    if(management)await confirmedSession();else{if(!setupProof||proof!==setupProof)throw new CopyControllerError('SOURCE_BINDING_UNAVAILABLE');await verifyCurrent(setupProof)}
    let value:Awaited<ReturnType<typeof raw.request>>|undefined,failure:unknown,failed=false
    try{value=await raw.request(request)}catch(error){failure=error;failed=true}
    if(management)await confirmedSession();else await verifyCurrent(setupProof!)
    if(failed)throw failure
    return value!
   }},csrf:async()=>{await confirmedSession();const value=(await sessionPort.csrf()).body.data.csrfToken;await confirmedSession();return value},
   readIssuedBinding:async(current,source)=>current.environment===deployment.environment?issuedProductionBinding(deployment,source):null})
   controller.bind(childScope);const child:Child=Object.freeze({controller,scope:childScope,subscriptions,setupProof});return registerChild(child)
  }
  const bindingOf=(value:V18Readonly<CopySnapshot>|V18Readonly<CopySummary>):CopyBinding=>Object.freeze({connectionId:value.connectionId,versionId:value.versionId,policyHash:value.policyHash,environment:value.environment,startMode:value.startMode})
  const sameBinding=(left:CopyBinding,right:CopyBinding)=>left.connectionId===right.connectionId&&left.versionId===right.versionId&&left.policyHash===right.policyHash&&left.environment===right.environment&&left.startMode===right.startMode
  const remember=(id:string,binding:CopyBinding,child:Child)=>{
   const previous=known.get(id)
   if(previous&&(!sameBinding(previous.binding,binding)||previous.child!==child))throw new CopyControllerError('COPY_BINDING_MISMATCH')
   child.subscriptions.add(id);known.set(id,Object.freeze({binding,child}))
  }
  const matchingCopies=(sourceId:string,sourceSha=catalogueSourceSha)=>{
   const binding=issuedProductionBinding(deployment,{sourceSha,sourceId});if(!binding)return[]
   return[...known].filter(([,value])=>value.binding.versionId===binding.versionId&&value.binding.policyHash===binding.policyHash&&value.binding.environment===binding.environment)
  }
  const readBudget=async(expected:ProductionConnectionProof,market:Market,signal:AbortSignal)=>{
   await verifyCurrent(expected)
   let account:V17Readonly<AccountSnapshot>|undefined,failure:unknown,failed=false
   try{account=(await accountClient.account(expected.connectionId,{signal})).data}catch(error){failure=error;failed=true}
   await verifyCurrent(expected)
   if(failed)throw failure
   if(signal.aborted||proof!==expected)return null
   return productionBudgetFromAccount(account!,market,Date.now(),`local:${++budgetObservation}`)
  }
  const awaitRestoreSettlement=async()=>{const settlement=restoreSettlement;if(settlement)await settlement;await confirmedSession();if(retired)throw new CopyControllerError('SCOPE_CHANGED')}
  const controller:Controller={
   hasUncertainIntent:id=>[...children].some(child=>child.controller.hasUncertainIntent(id)),
   bind(next){if(next===null)retireSetup()},getSnapshot:()=>state,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
   async selectSource(selection,signal){if(!currentSetup)throw new CopyControllerError('SOURCE_BINDING_UNAVAILABLE');const value=await currentSetup.controller.selectSource(selection,signal);publish({phase:'ready',reason:null,selectedVersion:value});return value},
   async loadLists(){publish({phase:known.size?'ready':'idle',reason:null,copies:Object.freeze([...summaries.values()])})},
   async readCopy(id,signal){await awaitRestoreSettlement();const entry=known.get(id);if(!entry)throw new CopyControllerError('SOURCE_BINDING_UNAVAILABLE');const value=await entry.child.controller.readCopy(id,signal);publish({phase:'ready',reason:null,selectedCopy:value});return value},
   async create(settings,intentId,signal){if(!currentSetup)throw new CopyControllerError('SOURCE_BINDING_UNAVAILABLE');return await currentSetup.controller.create(settings,intentId,signal)},
   async update(id,revision,settings,intentId,signal){const entry=known.get(id);if(!entry)throw new CopyControllerError('SOURCE_BINDING_UNAVAILABLE');const value=await entry.child.controller.update(id,revision,settings,intentId,signal);publish({phase:'ready',reason:null,selectedCopy:value});return value},
   async action(operation,id,revision,intentId,signal){const entry=known.get(id);if(!entry)throw new CopyControllerError('SOURCE_BINDING_UNAVAILABLE');const value=await entry.child.controller.action(operation,id,revision,intentId,signal);publish({phase:'ready',reason:null,selectedCopy:value});return value},
   dispose(){if(disposed)return;disposed=true;for(const child of [...children])destroyChild(child);listeners.clear()}
  }
  const port:CatalogueCopyExecutionPort={scope:key,controller,moneyUnit:'USDT',
   bindingForSource:selection=>{
    if(retired||latest.current()?.sessionId!==key||latest.current()?.sessionState!=='AUTHENTICATED')return null
    const binding=issuedProductionBinding(deployment,selection);if(!binding)return null
    const approved=controller.getSnapshot().versions.some(row=>row.status==='approved'&&row.versionId===binding.versionId&&row.strategyId===binding.strategyId&&row.policyHash===binding.policyHash&&row.environment===binding.environment)
    return approved?binding:null
   },
   sourceForCopy:id=>{const entry=known.get(id);if(!entry)return null;const rows=deployment.bindings.filter(row=>row.versionId===entry.binding.versionId&&row.policyHash===entry.binding.policyHash&&row.environment===entry.binding.environment);return rows.length===1?rows[0]!.sourceId:null},
   copyForSource:(id,sourceSha=catalogueSourceSha)=>{const matches=matchingCopies(id,sourceSha);return matches.length===1?matches[0]![0]:null},
   prepareSetup:async(sourceId,signal,selection={sourceSha:catalogueSourceSha,sourceId})=>{
    if(selection.sourceId!==sourceId)return null
    await awaitRestoreSettlement()
    if(signal.aborted)return null
    if(matchingCopies(sourceId,selection.sourceSha).length)return null
    const turn=++interaction,binding=issuedProductionBinding(deployment,selection);if(!binding)return null
    const descriptor=binding.minimumDescriptor
    if(!descriptor||selection.minimumDescriptor&&(selection.minimumDescriptor.policyVersionId!==descriptor.policyVersionId||selection.minimumDescriptor.descriptorPolicyHash!==descriptor.descriptorPolicyHash))return null
    // Only the pinned deployment may supply the ordinary catalogue descriptor.
    selection=Object.freeze({...selection,minimumDescriptor:descriptor})
    const before=await readConnections();let version:V18Readonly<ApprovedVersion>|undefined,failure:unknown,failed=false
    try{version=await readProductionIssuedVersion(copyClient,binding,signal)}catch(error){failure=error;failed=true}
    const after=await readConnections()
    if(signal.aborted||turn!==interaction)return null
    if(accountConnectionBinding(before)!==accountConnectionBinding(after)){retireSetup();return null}
    if(failed)throw failure
    const beforeProof=captureProductionConnectionProof(key,key,version!.policy.market,before),next=captureProductionConnectionProof(key,key,version!.policy.market,after)
    if(!beforeProof||!next)return null
    if(beforeProof.connectionId!==next.connectionId||beforeProof.identity!==next.identity){retireSetup();return null}
    proof=next
    const setupScope=Object.freeze({owner:key,sessionId:key,connectionId:next.connectionId,environment:deployment.environment}),setup=createChild(setupScope,next);currentSetup=setup
    const selected=await setup.controller.selectSource(selection,signal);publish({phase:'ready',reason:null,selectedVersion:selected})
    if(signal.aborted||turn!==interaction||proof!==next)return null
    const budget=await readBudget(next,selected.policy.market,signal)
    if(!budget||budget.expiresAtMs<=Date.now()||turn!==interaction)return null
    const minimum=await sourceMinimum(selection,signal)
    await verifyCurrent(next)
    if(!minimum||minimum.expiresAtMs<=Date.now()||budget.expiresAtMs<=Date.now()||signal.aborted||turn!==interaction||!coversBudget(budget.availableUsdt,minimum.requiredAvailableUsdt))return null
    void controller.loadLists(abort.signal).catch(()=>undefined)
    const createIntent=crypto.randomUUID(),startIntent=crypto.randomUUID();let submitted=false,startSubmitted=false;let createdSnapshot:V18Readonly<CopySnapshot>|null=null,createdSettings:CreateSettings|null=null
    return{owner:key,sourceSha:selection.sourceSha,strategyId:sourceId,revision:JSON.stringify(['local',selected.versionId,selected.policyHash,budget.revision]),available:Number(budget.availableUsdt),moneyUnit:'USDT',minimumUsdt:minimum?.minimumAllocationUsdt,
     onConfirm:async(settings:Readonly<CatalogueCopySettings>,request:AbortSignal)=>{
      if(turn!==interaction||proof!==next)throw new CopyControllerError('SCOPE_CHANGED')
      const allocationUsdt=String(settings.amount),maxLossUsdt=timesPercent(String(settings.amount),Math.abs(settings.loss))
      if(!DECIMAL.test(allocationUsdt))throw new CopyControllerError('INVALID_REQUEST')
      const createSettings:CreateSettings={allocationUsdt,maxLossUsdt,maxPositionFraction:timesPercent(String(settings.cap),1),startMode:settings.existing==='copy'?'current_position':'next_signal'}
      if(createdSettings&&!sameCreateSettings(createdSettings,createSettings))throw new CopyControllerError('IDEMPOTENCY_CONFLICT')
      if(!submitted){
       const quote=await sourceMinimum(selection,request);await verifyCurrent(next)
       if(!quote||quote.expiresAtMs<=Date.now()||!decimalAtLeast(allocationUsdt,quote.minimumAllocationUsdt)||!decimalAtLeast(maxLossUsdt,quote.requiredMaxLossUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
       const fresh=await readBudget(next,selected.policy.market,request);if(quote.expiresAtMs<=Date.now()||!fresh||fresh.expiresAtMs<=Date.now()||!coversBudget(fresh.availableUsdt,allocationUsdt)||!coversBudget(fresh.availableUsdt,quote.requiredAvailableUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
      }
      let created=createdSnapshot
      if(!created){
       const sent=dispatch.watch(createIntent)
       try{created=await setup.controller.create(createSettings,createIntent,request);createdSnapshot=created;createdSettings=createSettings;submitted=true}catch(error){submitted=setup.controller.hasUncertainIntent(createIntent)&&(submitted||sent.dispatched);throw error}finally{sent.release()}
      }
      remember(created.subscriptionId,bindingOf(created),setup)
      if(!startSubmitted){
       await waitForCopyStartReadiness(created,signal=>setup.controller.readCopy(created.subscriptionId,signal),request)
       await verifyCurrent(next)
       const quote=await sourceMinimum(selection,request);await verifyCurrent(next)
       if(!quote||quote.expiresAtMs<=Date.now()||!decimalAtLeast(allocationUsdt,quote.minimumAllocationUsdt)||!decimalAtLeast(maxLossUsdt,quote.requiredMaxLossUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
       const fresh=await readBudget(next,selected.policy.market,request)
       if(quote.expiresAtMs<=Date.now()||request.aborted||!fresh||fresh.expiresAtMs<=Date.now()||!coversBudget(fresh.availableUsdt,allocationUsdt)||!coversBudget(fresh.availableUsdt,quote.requiredAvailableUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
      }
      let active
      const sent=dispatch.watch(startIntent)
      try{active=await setup.controller.action('start',created.subscriptionId,created.revision,startIntent,request);startSubmitted=true}catch(error){startSubmitted=setup.controller.hasUncertainIntent(startIntent)&&(startSubmitted||sent.dispatched);throw error}finally{sent.release()}
      publish({phase:'ready',reason:null,selectedCopy:active})
      if(active.state!=='ACTIVE')throw new CopyControllerError('EXECUTION_UNAVAILABLE')
     }}
   }}
  const restoreTurn=interaction
  const currentApi18=async<T>(operation:()=>Promise<T>)=>{
   await confirmedSession();let value:T|undefined,failure:unknown,failed=false
   try{value=await operation()}catch(error){failure=error;failed=true}
   await confirmedSession();if(failed)throw failure;return value!
  }
  const readApprovedVersions=async()=>{
   const versions:Array<Awaited<ReturnType<typeof copyClient.listVersions>>['data'][number]>=[],ids=new Set<string>(),cursors=new Set<string>();let cursor:string|undefined
   for(let page=0;;page++){
    if(page>=50)throw new CopyControllerError('PAGINATION_BOUND_EXCEEDED')
    const response=await currentApi18(()=>copyClient.listVersions({limit:20,...(cursor===undefined?{}:{cursor}),signal:abort.signal}))
    if(retired)return
    for(const row of response.data){if(ids.has(row.versionId))throw new CopyControllerError('LIST_BINDING_MISMATCH');ids.add(row.versionId);versions.push(row)}
    if(versions.length>1000)throw new CopyControllerError('PAGINATION_BOUND_EXCEEDED')
    if(response.nextCursor===null)break
    if(!response.data.length||cursors.has(response.nextCursor))throw new CopyControllerError('PAGINATION_BINDING_MISMATCH')
    cursors.add(response.nextCursor);cursor=response.nextCursor
   }
   if(!retired)publish({versions:Object.freeze(versions)})
  }
  const restoreExisting=async()=>{
   const copies:V18Readonly<CopySummary>[]=[],ids=new Set<string>(),cursors=new Set<string>();let cursor:string|undefined
   for(let page=0;;page++){
    if(page>=50)throw new CopyControllerError('PAGINATION_BOUND_EXCEEDED')
    const response=await currentApi18(()=>copyClient.listCopies({limit:20,...(cursor===undefined?{}:{cursor}),signal:abort.signal}))
    if(retired||restoreTurn!==interaction)return
    for(const item of response.data){
     if(item.environment!==deployment.environment||ids.has(item.subscriptionId))throw new CopyControllerError('LIST_BINDING_MISMATCH')
     ids.add(item.subscriptionId);copies.push(item)
    }
    if(copies.length>1000)throw new CopyControllerError('PAGINATION_BOUND_EXCEEDED')
    if(response.nextCursor===null)break
    if(!response.data.length||cursors.has(response.nextCursor))throw new CopyControllerError('PAGINATION_BINDING_MISMATCH')
    cursors.add(response.nextCursor);cursor=response.nextCursor
   }
   if(!copies.length)return
   const restoring:Child[]=[]
   try{
    const groups=new Map<string,V18Readonly<CopySummary>[]>()
    for(const copy of copies){const group=groups.get(copy.connectionId)??[];group.push(copy);groups.set(copy.connectionId,group)}
    for(const [connectionId,group] of groups){
     const child=createChild(Object.freeze({owner:key,sessionId:key,connectionId,environment:deployment.environment}),null,group.map(value=>value.subscriptionId));restoring.push(child)
     for(const summary of group){
      const snapshot:V18Readonly<CopySnapshot>=await child.controller.readCopy(summary.subscriptionId,abort.signal)
      if(retired||restoreTurn!==interaction)return
      if(snapshot.subscriptionId!==summary.subscriptionId||snapshot.connectionId!==summary.connectionId||snapshot.environment!==summary.environment||snapshot.versionId!==summary.versionId||snapshot.policyHash!==summary.policyHash||snapshot.startMode!==summary.startMode||snapshot.revision!==summary.revision)throw new CopyControllerError('COPY_BINDING_MISMATCH')
      remember(summary.subscriptionId,bindingOf(snapshot),child);summaries.set(summary.subscriptionId,summary)
     }
    }
   }catch(error){for(const child of restoring)destroyChild(child);for(const id of ids){known.delete(id);summaries.delete(id)}throw error}
   if(!retired&&restoreTurn===interaction){
    publish({phase:'ready',reason:null,copies:Object.freeze([...summaries.values()]),selectedCopy:null})
   }
  }
  const disconnect=controller.subscribe(()=>{if(!retired)setPort({input,port})})
  restoreSettlement=restoreExisting().catch(()=>{if(!retired&&restoreTurn===interaction)publish({phase:'unavailable',reason:'SOURCE_BINDING_UNAVAILABLE'})})
  if(deployment.bindings.length)void readApprovedVersions().catch(()=>{if(!retired)publish({versions:Object.freeze([])})})
  setPort({input,port})
  return()=>{retired=true;abort.abort();disconnect();controller.dispose()}
 },[input,key,mode,sessionPort])
 return mode!=='off'&&key&&stored&&stored.input===input&&stored.port.scope===key?stored.port:undefined
}
