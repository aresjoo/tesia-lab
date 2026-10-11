import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {TesiaExchangeConnectionsV12Client} from '../internal-poc/contracts/generated/api-v0.12/client.js'
import {createExchangeConnectionsTransport} from '../exchange-connect/transport'
import {catalogueSourceSha} from '../client-catalogue'
import type {CatalogueCopySettings} from '../client-catalogue-copy-setup'
import {createCopyTransport} from './transport'
import {createCandidateCopyController,CopyControllerError} from './controller'
import {api18CandidateFixture} from './candidate-fixture'
import type {CopyScope,IssuedSourceBinding,SourceSelection} from './presentation'
import type {CatalogueCopyExecutionPort} from './catalogue-port'
import type {Environment} from './fixtures/api-v0.18/types'

export type CandidateCopyInput = Readonly<{
 fixture:typeof api18CandidateFixture
 connectionId:string|null
 /** Must come from trusted deployment/account evidence. API12 does not supply it. */
 environment:Environment|null
 readIssuedBinding?:(scope:CopyScope,source:SourceSelection,signal:AbortSignal)=>Promise<IssuedSourceBinding|null>
 readAvailableBudget?:(scope:CopyScope,versionId:string,signal:AbortSignal)=>Promise<{availableUsdt:string;revision:string;expiresAtMs:number}|null>
}>
type SessionPort={current:()=>Promise<{body:{data:{sessionId:string;state:string}}}>;csrf:()=>Promise<{body:{data:{csrfToken:string}}}>}
type Budget=NonNullable<Awaited<ReturnType<NonNullable<CandidateCopyInput['readAvailableBudget']>>>>
const validBudget=(value:Budget|null):value is Budget=>Boolean(value&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.availableUsdt)&&Number.isFinite(Number(value.availableUsdt))&&Number(value.availableUsdt)<=Number.MAX_SAFE_INTEGER&&value.revision&&Number.isFinite(value.expiresAtMs)&&value.expiresAtMs>Date.now()&&value.expiresAtMs<=Date.now()+10_000)
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
 // No public build flag or failed request enables the candidate fixture.
 const allowed=enabled&&import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)
 useEffect(()=>{
  if(!allowed||!key||!input||input.fixture!==api18CandidateFixture)return
  let retired=false
  const abort=new AbortController(),sourceIds=new Map<string,string>()
  const scope:CopyScope|null=input.connectionId&&input.environment?{owner:key,sessionId:key,connectionId:input.connectionId,environment:input.environment}:null
  const confirmedSession=async()=>{
   const value=(await sessionPort.current()).body.data,now=latest.current()
   if(retired||abort.signal.aborted||value.state!=='AUTHENTICATED'||value.sessionId!==key||now?.sessionState!=='AUTHENTICATED'||now.sessionId!==key)throw new CopyControllerError('SCOPE_CHANGED')
  }
  const raw=createCopyTransport({origin:()=>window.location.origin,fetch:window.fetch.bind(window)})
  const controller=createCandidateCopyController({fixture:input.fixture,currentScope:()=>{
   const value=latest.current();return !retired&&value?.sessionState==='AUTHENTICATED'&&value.sessionId===key?scope:null
  },transport:{request:async request=>{await confirmedSession();const value=await raw.request(request);await confirmedSession();return value}},
  csrf:async()=>{await confirmedSession();const value=(await sessionPort.csrf()).body.data.csrfToken;await confirmedSession();return value},readIssuedBinding:input.readIssuedBinding})
  const held=controller
  const publish=()=>{
   if(retired)return
   const value:CatalogueCopyExecutionPort={scope:key,controller:held,moneyUnit:'USDT',
    sourceForCopy:id=>{const state=held.getSnapshot();return sourceIds.get(state.copies.find(copy=>copy.subscriptionId===id)?.versionId??(state.selectedCopy?.subscriptionId===id?state.selectedCopy.versionId:'')??'')??null},
    copyForSource:id=>{
     const versionId=[...sourceIds].find(([,sourceId])=>sourceId===id)?.[0];if(!versionId)return null
     const selected=held.getSnapshot().selectedCopy;if(selected?.versionId===versionId)return selected.subscriptionId
     const copies=held.getSnapshot().copies.filter(copy=>copy.versionId===versionId&&copy.connectionId===scope?.connectionId);return copies.length===1?copies[0].subscriptionId:null
    },prepareSetup:async(sourceId,signal)=>{
     if(!scope)return null
     const version=await held.selectSource({sourceSha:catalogueSourceSha,sourceId},signal)
     sourceIds.set(version.versionId,sourceId)
     if(!input.readAvailableBudget)return null
     const budget=await input.readAvailableBudget(scope,version.versionId,signal);await confirmedSession()
     if(!validBudget(budget)||signal.aborted)return null
     const createIntent=crypto.randomUUID(),startIntent=crypto.randomUUID();let submitted=false
     return{owner:key,sourceSha:catalogueSourceSha,strategyId:sourceId,revision:JSON.stringify([version.versionId,version.policyHash,budget.revision]),available:Number(budget.availableUsdt),moneyUnit:'USDT',
      onConfirm:async(settings:Readonly<CatalogueCopySettings>,request:AbortSignal)=>{
       const allocationUsdt=String(settings.amount),maxLossUsdt=timesPercent(String(settings.amount),Math.abs(settings.loss))
       if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(allocationUsdt))throw new CopyControllerError('INVALID_REQUEST')
       if(!submitted){
        // Freshness limits account evidence, never the user's time to fill the original sheet.
        const fresh=await input.readAvailableBudget!(scope,version.versionId,request);await confirmedSession()
        if(request.aborted||!validBudget(fresh)||!coversBudget(fresh.availableUsdt,allocationUsdt))throw new CopyControllerError('ACCOUNT_FACTS_UNAVAILABLE')
       }
       let created
       try{created=await held.create({allocationUsdt,maxLossUsdt,maxPositionFraction:timesPercent(String(settings.cap),1),startMode:settings.existing==='copy'?'current_position':'next_signal'},createIntent,request);submitted=true}catch(error){if(held.getSnapshot().phase==='reconciliation')submitted=true;throw error}
       const active=await held.action('start',created.subscriptionId,created.revision,startIntent,request)
       if(active.state!=='ACTIVE')throw new CopyControllerError('EXECUTION_UNAVAILABLE')
      }}
    }}
   setPort({input,port:value})
  }
  const disconnect=held.subscribe(publish);publish()
  void(async()=>{
   if(!scope)return
   try{
    await confirmedSession()
    const connections=(await new TesiaExchangeConnectionsV12Client(createExchangeConnectionsTransport()).connections()).data.connections
    await confirmedSession()
    const matched=connections.find(value=>value.connectionId===scope.connectionId)
    if(!matched||matched.exchangeId!=='bitget'||matched.status!=='connected'||!matched.permissionsVerified||!matched.permissions.read||matched.permissions.withdrawal||!matched.permissions.futuresTrade)throw new CopyControllerError('PERMISSION_REJECTED')
    held.bind(scope);await held.loadLists(abort.signal).catch(()=>undefined)
   }catch{if(!retired)held.bind(null)}
  })()
  return()=>{retired=true;abort.abort();disconnect();held.dispose()}
 },[allowed,key,input,sessionPort])
 return allowed&&key&&stored&&stored.input===input&&stored.port.scope===key?stored.port:undefined
}
