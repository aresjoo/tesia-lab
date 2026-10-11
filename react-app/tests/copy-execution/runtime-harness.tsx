import {useState,useSyncExternalStore} from 'react'
import {createRoot} from 'react-dom/client'
import {useCandidateCopyExecution,type CandidateCopyInput} from '../../src/copy-execution/use-copy-execution'
import {api18CandidateFixture} from '../../src/copy-execution/candidate-fixture'
import {NativeStrategies} from '../../src/internal-poc/NativeStrategies'
import type {ApprovedVersion} from '../../src/copy-execution/fixtures/api-v0.18/types'
import type {SharedLocation} from '../../src/client-shared-strategies'
function Snapshot({port}:{port:NonNullable<ReturnType<typeof useCandidateCopyExecution>>}){
 const state=useSyncExternalStore(port.controller.subscribe,port.controller.getSnapshot,port.controller.getSnapshot)
 return <output data-runtime-state>{state.phase}:{state.reason}</output>
}
/** Synthetic HTTP fixture tests the actual hook and generated API12/18 clients. */
export function mountRuntime(enabled:boolean,environment:'demo'|null){
 document.getElementById('root')?.remove();const host=document.createElement('main');document.body.append(host)
 let actual={sessionId:'session_fixture_00001',sessionState:'AUTHENTICATED'},replace!:(value:string)=>void
 const sessionPort={current:async()=>({body:{data:{sessionId:actual.sessionId,state:actual.sessionState}}}),csrf:async()=>({body:{data:{csrfToken:'csrf_fixture_0000000001'}}})}
 const input:CandidateCopyInput={fixture:api18CandidateFixture,connectionId:'connection_fixture_00001',environment}
 function Harness(){const [key,setKey]=useState(actual.sessionId);replace=value=>{actual={sessionId:value,sessionState:'AUTHENTICATED'};setKey(value)}
  const port=useCandidateCopyExecution(input,enabled,sessionPort,()=>actual,key)
  return port?<Snapshot port={port}/>:<output data-runtime-state>off</output>
 }
 const root=createRoot(host);root.render(<Harness/>);return{replace:(value:string)=>replace(value),dispose:()=>root.unmount()}
}
/** Whole original catalogue/settings/management with the real hook and SDKs. */
export function mountActualWorkflow(version:ApprovedVersion){
 document.getElementById('root')?.remove();const host=document.createElement('main');document.body.append(host)
 let session={sessionId:'session_fixture_00001',sessionState:'AUTHENTICATED'},owner!:(key:string)=>void,budgetReads=0,availableUsdt='1000.75'
 const sessionPort={current:async()=>({body:{data:{sessionId:session.sessionId,state:session.sessionState}}}),csrf:async()=>({body:{data:{csrfToken:'csrf_fixture_0000000001'}}})}
 const input:CandidateCopyInput={fixture:api18CandidateFixture,connectionId:'connection_fixture_00001',environment:'demo',
  readIssuedBinding:async(_scope,source)=>({...source,strategyId:version.strategyId,versionId:version.versionId,policyHash:version.policyHash,environment:'demo'}),
  readAvailableBudget:async()=>{budgetReads++;return{availableUsdt,revision:`budget_fixture_${budgetReads}`,expiresAtMs:Date.now()+10_000}}}
 function Harness(){const [key,setKey]=useState(session.sessionId),[location,navigate]=useState<SharedLocation>({nick:'f1',period:'all'})
  owner=value=>{session={sessionId:value,sessionState:'AUTHENTICATED'};setKey(value)}
  const port=useCandidateCopyExecution(input,true,sessionPort,()=>session,key)
  return <div className="client-source-app"><NativeStrategies owner={key} catalogueCopyExecution={port} location={location} onNavigate={navigate} signedIn onLogin={()=>{}} onReturn={()=>navigate({period:'all'})} shouldFocus={()=>true} onTabChange={()=>{}}/></div>
 }
 const root=createRoot(host);root.render(<Harness/>);return{owner:(key:string)=>owner(key),budget:(value:string)=>{availableUsdt=value},budgetReads:()=>budgetReads,dispose:()=>root.unmount()}
}
