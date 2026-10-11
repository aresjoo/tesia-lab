import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {NativeStrategies} from '../../src/internal-poc/NativeStrategies'
import {createCandidateCopyController} from '../../src/copy-execution/controller'
import {api18CandidateFixture} from '../../src/copy-execution/candidate-fixture'
import {catalogueSourceSha} from '../../src/client-catalogue'
import type {CatalogueCopyExecutionPort} from '../../src/copy-execution/catalogue-port'
import type {CopyScope} from '../../src/copy-execution/presentation'
import type {SharedLocation} from '../../src/client-shared-strategies'
import type {CopyResponse} from '../../src/copy-execution/fixtures/api-v0.18/types'
import cases from './wire-cases.json'
export function mountCopyUi(mode:'unbound'|'setup'|'management'|'404'|'active-flat'|'synthetic-finance'|'exchange-unverified'='unbound'){
 document.getElementById('root')?.remove();const host=document.createElement('main');document.body.append(host)
 let scope:CopyScope|null={owner:'owner-one',sessionId:'session-one',connectionId:'connection_fixture_00001',environment:'demo'}
 const sample=structuredClone(cases.cases.find(item=>item.name==='observation-lost-emergency-controls')!.value)as CopyResponse
 if(mode==='active-flat'){
  sample.data.execution.origin='exchange';sample.data.execution.actualExecutionVerified=true;sample.data.execution.verificationEvidenceSha256='a'.repeat(64)
  sample.data.execution.availability.close={available:true,reason:null}
  sample.data.execution.positions={status:'ok',reason:null,items:[{symbol:'BTCUSDT',side:'long',quantity:'0.001',entryPrice:'60000',markPrice:'60010',unrealizedPnlUsdt:'0.01'}]}
 }
 if(mode==='synthetic-finance'||mode==='exchange-unverified'){sample.data.execution.origin=mode==='exchange-unverified'?'exchange':'synthetic';sample.data.execution.accounting={accountingComplete:true,fees:[],feesConfirmed:true,fundingConfirmed:true,fundingUsdt:'0',realizedPnlUsdt:'12',totalPnlUsdt:'12'};sample.data.execution.positions={status:'ok',reason:null,items:[{symbol:'BTCUSDT',side:'long',quantity:'0.001',entryPrice:'60000',markPrice:'60010',unrealizedPnlUsdt:'17.25'}]}}
 if(mode==='active-flat'||mode==='synthetic-finance'||mode==='exchange-unverified')sample.data.execution.orders={status:'ok',reason:null,items:[],hasMore:false,nextCursor:null}
 const calls:{path:string;method:string;body?:string}[]=[],confirmations:{signal:AbortSignal;resolve:()=>void}[]=[]
 let patch!:(owner:string)=>void,routeCopy!:(id:string)=>void
 const controller=createCandidateCopyController({fixture:api18CandidateFixture,currentScope:()=>scope,csrf:async()=> 'csrf_fixture_0000000001',transport:{request:async input=>{
  calls.push(input)
  const bound=structuredClone(sample);const id=/strategy-copies\/([^/]+)/.exec(input.path)?.[1];if(id)bound.data.subscriptionId=id
  const value=mode==='404'?{apiContractVersion:'0.18.0',error:{code:'NOT_FOUND',message:'NOT_FOUND'}}:bound
  return{status:mode==='404'?404:200,headers:[['content-type','application/json'],['cache-control','no-store']],body:JSON.stringify(value)}
 }}});controller.bind(scope)
 const port:CatalogueCopyExecutionPort={scope:'owner-one',controller,moneyUnit:'USDT',copyForSource:()=>null,sourceForCopy:()=> 'f1',prepareSetup:async(sourceId,signal)=>mode==='unbound'||signal.aborted?null:{owner:'owner-one',sourceSha:catalogueSourceSha,strategyId:sourceId,revision:'confirmed-budget-test',available:1000.75,moneyUnit:'USDT',onConfirm:(_settings,request)=>new Promise(resolve=>confirmations.push({signal:request,resolve}))}}
 function Harness(){
    const [owner,setOwner]=useState('owner-one'),[location,setLocation]=useState<SharedLocation>(mode==='management'||mode==='404'||mode==='active-flat'||mode==='synthetic-finance'||mode==='exchange-unverified'?{view:'copy-detail',copyModel:'catalogue',copyId:sample.data.subscriptionId,period:'all'}:{nick:'f1',period:'all'})
  routeCopy=id=>setLocation({view:'copy-detail',copyModel:'catalogue',copyId:id,period:'all'})
  patch=value=>{scope=null;controller.bind(null);setOwner(value)}
  return <div className="client-source-app"><NativeStrategies owner={owner} catalogueCopyExecution={port} location={location} onNavigate={setLocation} signedIn onLogin={()=>{}} onReturn={()=>setLocation({period:'all'})} shouldFocus={()=>true} onTabChange={()=>{}}/></div>
 }
 const root=createRoot(host);root.render(<Harness/>);return{routeCopy:(id:string)=>routeCopy(id),patch:(owner:string)=>patch(owner),calls:()=>calls,confirmations:()=>confirmations.map(value=>({aborted:value.signal.aborted})),settle:()=>confirmations[0]?.resolve(),dispose:()=>{root.unmount();controller.dispose()}}
}
